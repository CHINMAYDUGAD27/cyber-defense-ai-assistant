from groq_analyzer import analyze_with_groq, ask_followup_question
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, cast, Date, inspect, text
from collections import Counter
from database import engine, get_db, Base
from models import Incident, User, Notification, UserSettings, WatcherConfig
from auth_utils import hash_password, verify_password, create_access_token, get_current_user
from report_generator import generate_incident_pdf, generate_summary_pdf
from log_watcher import manager as ws_manager, start_watcher, stop_watcher, get_watcher_status, process_log_line
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from datetime import datetime, timedelta
import bleach
import re
import os
from dotenv import load_dotenv

load_dotenv()

Base.metadata.create_all(bind=engine)


def ensure_incident_schema():
    """Add Incident fields that may be absent from databases created by older releases.

    SQLAlchemy's create_all creates missing tables but never alters existing ones.
    Without these additive migrations, querying Incident selects a non-existent
    column and makes the dashboard fail with a server error.
    """
    required_columns = {
        "recommended_action": "TEXT",
        "trigger_phrases": "TEXT",
        "mitre_tactic": "VARCHAR",
        "source": "VARCHAR DEFAULT 'manual' NOT NULL",
    }

    with engine.begin() as connection:
        existing_columns = {
            column["name"]
            for column in inspect(connection).get_columns("incidents")
        }
        for name, definition in required_columns.items():
            if name not in existing_columns:
                connection.execute(text(f"ALTER TABLE incidents ADD COLUMN {name} {definition}"))


ensure_incident_schema()

# ─── Rate limiter (Phase 8) ──────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="AI Cyber Defense Assistant API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allow frontend origin — reads from env in prod, falls back to localhost for dev
_frontend_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_prod_origins = os.getenv("FRONTEND_URL", "")
_frontend_origins.extend(
    origin.strip().rstrip("/")
    for origin in _prod_origins.split(",")
    if origin.strip()
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic schemas ────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    log_text: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class FollowupRequest(BaseModel):
    question: str


class PasswordChangeRequest(BaseModel):
    new_password: str


def normalize_email(email: str) -> str:
    """Keep login consistent across keyboards, browsers, and older accounts."""
    return email.strip().lower()

class UserSettingsUpdate(BaseModel):
    notify_low: bool = False
    notify_medium: bool = True
    notify_high: bool = True
    notify_critical: bool = True
    theme: str = "dark"
    groq_api_key: Optional[str] = None

# ─── Helpers ─────────────────────────────────────────────────────────────────
RISK_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}

def sanitize_input(text: str) -> str:
    """Phase 8: Strip HTML/script tags and remove SQL injection patterns."""
    # Strip HTML tags
    cleaned = bleach.clean(text, tags=[], strip=True)
    # Remove common SQL injection patterns (extra safety layer)
    sql_patterns = [
        r"(?i)(drop\s+table|insert\s+into|delete\s+from|update\s+\w+\s+set|union\s+select|exec\s*\(|xp_cmdshell)"
    ]
    for pat in sql_patterns:
        cleaned = re.sub(pat, "[FILTERED]", cleaned)
    return cleaned.strip()

def create_notification_if_needed(db: Session, user_email: str, incident: Incident):
    """Phase 5: Auto-create a notification for High/Critical incidents based on user preferences."""
    settings = db.query(UserSettings).filter(UserSettings.user_email == user_email).first()

    should_notify = {
        "Low": settings.notify_low if settings else False,
        "Medium": settings.notify_medium if settings else True,
        "High": settings.notify_high if settings else True,
        "Critical": settings.notify_critical if settings else True,
    }

    if should_notify.get(incident.risk, False):
        notif = Notification(
            user_email=user_email,
            incident_id=incident.id,
            message=f"{incident.risk} risk detected: {incident.attack_type or 'Unknown threat'} — {(incident.reason or '')[:80]}...",
            risk=incident.risk,
        )
        db.add(notif)
        db.commit()

# ─── Root ────────────────────────────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "online", "service": "AI Cyber Defense Assistant"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# ─── Auth ─────────────────────────────────────────────────────────────────────
@app.post("/auth/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    email = normalize_email(user.email)
    existing = db.query(User).filter(sqlfunc.lower(User.email) == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(email=email, hashed_password=hash_password(user.password))
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": new_user.email})
    response = JSONResponse(content={"access_token": token, "token_type": "bearer"})
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=False, samesite="lax", max_age=86400
    )
    return response

@app.post("/auth/login")
@limiter.limit("10/minute")  # Phase 8: rate limit login to 10 attempts/min per IP
def login(request: Request, user: UserLogin, db: Session = Depends(get_db)):
    email = normalize_email(user.email)
    db_user = db.query(User).filter(sqlfunc.lower(User.email) == email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": db_user.email})
    response = JSONResponse(content={"access_token": token, "token_type": "bearer"})
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=False, samesite="lax", max_age=86400
    )
    return response

@app.post("/auth/logout")
def logout():
    response = JSONResponse(content={"ok": True})
    response.delete_cookie("access_token")
    return response

@app.get("/auth/me")
def get_me(user_email: str = Depends(get_current_user)):
    return {"email": user_email}


@app.post("/auth/change-password")
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user),
):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must contain at least 8 characters")

    user = db.query(User).filter(
        sqlfunc.lower(User.email) == normalize_email(user_email)
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account no longer exists")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"ok": True}

# ─── Analyze ─────────────────────────────────────────────────────────────────
@app.post("/analyze")
def analyze(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user)
):
    # Phase 8: sanitize before sending to LLM / saving to DB
    safe_text = sanitize_input(request.log_text)

    settings = db.query(UserSettings).filter(UserSettings.user_email == user_email).first()
    # Use user-specific key → fall back to server-wide env variable
    api_key = (settings.groq_api_key if settings else None) or os.getenv("GROQ_API_KEY", "")

    try:
        result = analyze_with_groq(safe_text, api_key=api_key)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="No Groq API key configured — set GROQ_API_KEY in your server environment."
        )

    trigger_str = ", ".join(result.get("trigger_phrases", []))

    incident = Incident(
        input_text=safe_text,
        attack_type=result["attack_type"],
        risk=result["risk"],
        reason=result["reason"],
        recommendations=", ".join(result["recommendations"]),
        recommended_action=result.get("recommended_action"),
        trigger_phrases=trigger_str if trigger_str else None,
        mitre_tactic=result.get("mitre_tactic"),
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # Phase 5: auto-notify
    create_notification_if_needed(db, user_email, incident)

    result["id"] = incident.id
    result["created_at"] = str(incident.created_at)
    result["mitre_tactic"] = incident.mitre_tactic
    return result

@app.post("/analyze/bulk")
async def analyze_bulk(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user)
):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    if len(lines) > 50:
        raise HTTPException(status_code=400, detail="File too large — limit is 50 lines per upload.")

    settings = db.query(UserSettings).filter(UserSettings.user_email == user_email).first()
    api_key = (settings.groq_api_key if settings else None) or os.getenv("GROQ_API_KEY", "")

    if not api_key or not api_key.strip():
        raise HTTPException(
            status_code=400,
            detail="No Groq API key configured — set GROQ_API_KEY in your server environment."
        )

    results = []
    for line in lines:
        safe_line = sanitize_input(line)
        try:
            result = analyze_with_groq(safe_line, api_key=api_key)
        except Exception as e:
            result = {
                "detected": False,
                "attack_type": None,
                "risk": "Low",
                "reason": f"Could not analyze this line: {str(e)}",
                "recommended_action": None,
                "recommendations": [],
                "trigger_phrases": [],
            }

        trigger_str = ", ".join(result.get("trigger_phrases", []))
        incident = Incident(
            input_text=safe_line,
            attack_type=result["attack_type"],
            risk=result["risk"],
            reason=result["reason"],
            recommendations=", ".join(result["recommendations"]),
            recommended_action=result.get("recommended_action"),
            trigger_phrases=trigger_str if trigger_str else None,
        )
        db.add(incident)
        db.commit()
        db.refresh(incident)

        create_notification_if_needed(db, user_email, incident)

        result["id"] = incident.id
        result["created_at"] = str(incident.created_at)
        result["input_text"] = safe_line
        results.append(result)

    results.sort(key=lambda r: RISK_ORDER.get(r["risk"], 0), reverse=True)

    summary = {
        "total_processed": len(results),
        "threats_detected": len([r for r in results if r["detected"]]),
        "critical": len([r for r in results if r["risk"] == "Critical"]),
        "high": len([r for r in results if r["risk"] == "High"]),
    }

    return {"summary": summary, "results": results}


# ─── Follow-up chat ───────────────────────────────────────────────────────────
@app.post("/incidents/{incident_id}/ask")
def ask_about_incident(
    incident_id: int,
    request: FollowupRequest,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user)
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident_context = {
        "input_text": incident.input_text,
        "attack_type": incident.attack_type,
        "risk": incident.risk,
        "reason": incident.reason,
    }

    settings = db.query(UserSettings).filter(UserSettings.user_email == user_email).first()
    api_key = settings.groq_api_key if settings else None

    try:
        answer = ask_followup_question(incident_context, request.question, api_key=api_key)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="No Groq API key configured — add one in Settings before running analysis."
        )
    return {"answer": answer}

# ─── Incidents ────────────────────────────────────────────────────────────────
@app.get("/incidents")
def get_incidents(db: Session = Depends(get_db), user_email: str = Depends(get_current_user)):
    incidents = db.query(Incident).order_by(Incident.created_at.desc()).all()
    return [
        {
            "id": i.id,
            "attack_type": i.attack_type,
            "risk": i.risk,
            "reason": i.reason,
            "recommended_action": i.recommended_action,
            "recommendations": i.recommendations.split(", ") if i.recommendations else [],
            "created_at": str(i.created_at)
        }
        for i in incidents
    ]

@app.get("/incidents/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db), user_email: str = Depends(get_current_user)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return {
        "id": incident.id,
        "input_text": incident.input_text,
        "attack_type": incident.attack_type,
        "risk": incident.risk,
        "reason": incident.reason,
        "recommended_action": incident.recommended_action,
        "recommendations": incident.recommendations.split(", ") if incident.recommendations else [],
        "trigger_phrases": incident.trigger_phrases.split(", ") if incident.trigger_phrases else [],
        "created_at": str(incident.created_at),
    }

@app.get("/incidents/{incident_id}/report")
def download_report(incident_id: int, db: Session = Depends(get_db), user_email: str = Depends(get_current_user)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    incident_dict = {
        "id": incident.id,
        "attack_type": incident.attack_type,
        "risk": incident.risk,
        "reason": incident.reason,
        "recommended_action": incident.recommended_action,
        "recommendations": incident.recommendations.split(", ") if incident.recommendations else [],
        "created_at": str(incident.created_at)
    }

    pdf_buffer = generate_incident_pdf(incident_dict)
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=incident_{incident_id}_report.pdf"}
    )

# ─── Dashboard stats ──────────────────────────────────────────────────────────
@app.get("/dashboard/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    query = db.query(Incident)
    if from_date:
        try:
            query = query.filter(Incident.created_at >= datetime.strptime(from_date, "%Y-%m-%d"))
        except ValueError:
            pass
    if to_date:
        try:
            # Include the full to_date day
            end = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Incident.created_at < end)
        except ValueError:
            pass

    incidents = query.all()
    total = len(incidents)
    critical_count = len([i for i in incidents if i.risk == "Critical"])
    detected_count = len([i for i in incidents if i.attack_type is not None])
    detection_rate = round((detected_count / total) * 100) if total > 0 else 0

    type_counts = Counter([i.attack_type for i in incidents if i.attack_type])

    day_counts = [0, 0, 0, 0, 0, 0, 0]
    for i in incidents:
        if i.created_at:
            day_counts[i.created_at.weekday()] += 1

    return {
        "total_incidents": total,
        "critical_alerts": critical_count,
        "detection_rate": detection_rate,
        "threat_breakdown": dict(type_counts),
        "weekly_incidents": day_counts
    }

# ─── Phase 4: Trends ──────────────────────────────────────────────────────────
@app.get("/dashboard/trends")
def get_dashboard_trends(
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user),
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    # Determine window boundaries
    try:
        start_dt = datetime.strptime(from_date, "%Y-%m-%d") if from_date else datetime.utcnow() - timedelta(days=30)
        end_dt = (datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)) if to_date else datetime.utcnow()
    except ValueError:
        start_dt = datetime.utcnow() - timedelta(days=30)
        end_dt = datetime.utcnow()

    incidents = db.query(Incident).filter(
        Incident.created_at >= start_dt,
        Incident.created_at < end_dt,
    ).all()

    # Build per-day buckets spanning the whole window
    daily_counts: dict = {}
    daily_risk_scores: dict = {}
    risk_score_map = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}

    delta_days = (end_dt.date() - start_dt.date()).days or 1
    for offset in range(delta_days):
        d = str(start_dt.date() + timedelta(days=offset))
        daily_counts[d] = 0
        daily_risk_scores[d] = []

    for i in incidents:
        if i.created_at:
            day = str(i.created_at.date())
            if day in daily_counts:
                daily_counts[day] += 1
            if day in daily_risk_scores:
                daily_risk_scores[day].append(risk_score_map.get(i.risk, 0))

    labels = list(daily_counts.keys())
    counts = list(daily_counts.values())
    avg_scores = [
        round(sum(scores) / len(scores), 2) if scores else 0
        for scores in daily_risk_scores.values()
    ]

    return {
        "labels": labels,
        "daily_counts": counts,
        "avg_risk_scores": avg_scores,
    }

# ─── Phase 5: Notifications ───────────────────────────────────────────────────
@app.get("/notifications")
def get_notifications(db: Session = Depends(get_db), user_email: str = Depends(get_current_user)):
    settings = db.query(UserSettings).filter(UserSettings.user_email == user_email).first()
    
    enabled_risks = []
    if settings:
        if settings.notify_low: enabled_risks.append("Low")
        if settings.notify_medium: enabled_risks.append("Medium")
        if settings.notify_high: enabled_risks.append("High")
        if settings.notify_critical: enabled_risks.append("Critical")
    else:
        enabled_risks = ["Medium", "High", "Critical"]
        
    incidents = (
        db.query(Incident)
        .filter(Incident.risk.in_(enabled_risks))
        .order_by(Incident.created_at.desc())
        .limit(20)
        .all()
    )
    
    if incidents:
        incident_ids = [i.id for i in incidents]
        read_notifs = db.query(Notification).filter(
            Notification.user_email == user_email,
            Notification.incident_id.in_(incident_ids),
            Notification.is_read == True
        ).all()
        read_incident_ids = {n.incident_id for n in read_notifs}
    else:
        read_incident_ids = set()
    
    return [
        {
            "id": inc.id,
            "incident_id": inc.id,
            "message": f"{inc.risk} risk detected: {inc.attack_type or 'Unknown threat'} — {(inc.reason or '')[:80]}...",
            "risk": inc.risk,
            "is_read": inc.id in read_incident_ids,
            "created_at": str(inc.created_at),
        }
        for inc in incidents
    ]

@app.patch("/notifications/{notif_id}/read")
def mark_notification_read(notif_id: int, db: Session = Depends(get_db), user_email: str = Depends(get_current_user)):
    notif = db.query(Notification).filter(
        Notification.incident_id == notif_id,
        Notification.user_email == user_email
    ).first()
    
    if notif:
        notif.is_read = True
    else:
        notif = Notification(
            user_email=user_email,
            incident_id=notif_id,
            message="Read notification",
            risk="Unknown",
            is_read=True
        )
        db.add(notif)
    db.commit()
    return {"ok": True}

@app.patch("/notifications/read-all")
def mark_all_read(db: Session = Depends(get_db), user_email: str = Depends(get_current_user)):
    settings = db.query(UserSettings).filter(UserSettings.user_email == user_email).first()
    
    enabled_risks = []
    if settings:
        if settings.notify_low: enabled_risks.append("Low")
        if settings.notify_medium: enabled_risks.append("Medium")
        if settings.notify_high: enabled_risks.append("High")
        if settings.notify_critical: enabled_risks.append("Critical")
    else:
        enabled_risks = ["Medium", "High", "Critical"]
        
    incidents = (
        db.query(Incident)
        .filter(Incident.risk.in_(enabled_risks))
        .order_by(Incident.created_at.desc())
        .limit(20)
        .all()
    )
    
    if incidents:
        incident_ids = [i.id for i in incidents]
        read_notifs = db.query(Notification).filter(
            Notification.user_email == user_email,
            Notification.incident_id.in_(incident_ids),
            Notification.is_read == True
        ).all()
        read_incident_ids = {n.incident_id for n in read_notifs}
        
        for inc in incidents:
            if inc.id not in read_incident_ids:
                notif = db.query(Notification).filter(
                    Notification.user_email == user_email,
                    Notification.incident_id == inc.id
                ).first()
                if notif:
                    notif.is_read = True
                else:
                    new_notif = Notification(
                        user_email=user_email,
                        incident_id=inc.id,
                        message="Read notification",
                        risk=inc.risk,
                        is_read=True
                    )
                    db.add(new_notif)
        db.commit()
    return {"ok": True}

# ─── Phase 6: Settings ────────────────────────────────────────────────────────
@app.get("/settings")
def get_settings(db: Session = Depends(get_db), user_email: str = Depends(get_current_user)):
    settings = db.query(UserSettings).filter(UserSettings.user_email == user_email).first()
    if not settings:
        # Return defaults
        return {
            "notify_low": False,
            "notify_medium": True,
            "notify_high": True,
            "notify_critical": True,
            "theme": "dark",
        }
    key = settings.groq_api_key
    masked_key = None
    if key:
        masked_key = f"{key[:4]}****{key[-4:]}" if len(key) > 10 else "****"
        
    return {
        "notify_low": settings.notify_low,
        "notify_medium": settings.notify_medium,
        "notify_high": settings.notify_high,
        "notify_critical": settings.notify_critical,
        "theme": settings.theme,
        "groq_api_key": masked_key,
    }

@app.put("/settings")
def update_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user)
):
    settings = db.query(UserSettings).filter(UserSettings.user_email == user_email).first()
    if not settings:
        settings = UserSettings(user_email=user_email)
        db.add(settings)

    settings.notify_low = payload.notify_low
    settings.notify_medium = payload.notify_medium
    settings.notify_high = payload.notify_high
    settings.notify_critical = payload.notify_critical
    settings.theme = payload.theme
    
    # Only update the API key if it's provided and it's not the masked placeholder
    if payload.groq_api_key is not None and "****" not in payload.groq_api_key:
        settings.groq_api_key = payload.groq_api_key
    elif payload.groq_api_key == "":
        settings.groq_api_key = None
        
    db.commit()
    return {"ok": True}

# ─── Phase 7: Summary report ──────────────────────────────────────────────────
@app.get("/reports/summary")
def download_summary_report(
    from_date: str,
    to_date: str,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user)
):
    try:
        from_dt = datetime.strptime(from_date, "%Y-%m-%d")
        to_dt = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    incidents = db.query(Incident).filter(
        Incident.created_at >= from_dt,
        Incident.created_at < to_dt
    ).all()

    risk_counts = Counter([i.risk for i in incidents])
    attack_counts = Counter([i.attack_type for i in incidents if i.attack_type])

    summary_data = {
        "from_date": from_date,
        "to_date": to_date,
        "generated_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "totals": {
            "total": len(incidents),
            "critical": risk_counts.get("Critical", 0),
            "high": risk_counts.get("High", 0),
            "medium": risk_counts.get("Medium", 0),
            "low": risk_counts.get("Low", 0),
        },
        "attack_breakdown": dict(attack_counts),
    }

    pdf_buffer = generate_summary_pdf(summary_data)
    filename = f"summary_{from_date}_to_{to_date}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─── Pre-Detection: WebSocket live alerts ─────────────────────────────────────
@app.websocket("/ws/live-alerts")
async def websocket_live_alerts(websocket: WebSocket):
    """WebSocket endpoint — frontend connects here to receive real-time threat alerts."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; watcher broadcasts independently
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ─── Pre-Detection: Watcher control endpoints ─────────────────────────────────
class WatcherConfigUpdate(BaseModel):
    use_simulator: bool = True
    use_windows_events: bool = False
    log_file_path: Optional[str] = None
    scan_interval: int = 5


class IngestPayload(BaseModel):
    line: str


@app.get("/watcher/status")
def watcher_status(user_email: str = Depends(get_current_user)):
    """Return current watcher running state and config."""
    status = get_watcher_status()
    return status


@app.post("/watcher/start")
async def watcher_start(
    payload: WatcherConfigUpdate,
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user),
):
    """Start the pre-detection watcher for the authenticated user."""
    # Persist config to DB
    cfg = db.query(WatcherConfig).filter(WatcherConfig.user_email == user_email).first()
    if not cfg:
        cfg = WatcherConfig(user_email=user_email)
        db.add(cfg)
    cfg.use_simulator = payload.use_simulator
    cfg.log_file_path = payload.log_file_path
    cfg.scan_interval = max(2, payload.scan_interval)
    cfg.enabled = True
    db.commit()

    started = start_watcher(user_email, {
        "use_simulator": cfg.use_simulator,
        "use_windows_events": payload.use_windows_events,
        "log_file_path": cfg.log_file_path,
        "scan_interval": cfg.scan_interval,
    })
    if not started:
        return {"ok": False, "message": "Watcher is already running."}
    return {"ok": True, "message": "Watcher started."}


@app.post("/watcher/ingest")
async def watcher_ingest(
    payload: IngestPayload,
    user_email: str = Depends(get_current_user),
):
    """Receive a raw log line from a distributed agent and process it."""
    result = await process_log_line(payload.line, user_email)
    if result:
        return {"ok": True, "alert_triggered": True, "risk": result.get("risk")}
    return {"ok": True, "alert_triggered": False}



@app.post("/watcher/stop")
async def watcher_stop(
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user),
):
    """Stop the pre-detection watcher."""
    cfg = db.query(WatcherConfig).filter(WatcherConfig.user_email == user_email).first()
    if cfg:
        cfg.enabled = False
        db.commit()
    stopped = stop_watcher()
    if not stopped:
        return {"ok": False, "message": "Watcher was not running."}
    return {"ok": True, "message": "Watcher stopped."}


@app.get("/watcher/config")
def watcher_get_config(
    db: Session = Depends(get_db),
    user_email: str = Depends(get_current_user),
):
    """Return saved watcher configuration for the authenticated user."""
    cfg = db.query(WatcherConfig).filter(WatcherConfig.user_email == user_email).first()
    if not cfg:
        return {
            "use_simulator": True,
            "log_file_path": None,
            "scan_interval": 5,
            "enabled": False,
        }
    return {
        "use_simulator": cfg.use_simulator,
        "log_file_path": cfg.log_file_path,
        "scan_interval": cfg.scan_interval,
        "enabled": cfg.enabled,
    }
