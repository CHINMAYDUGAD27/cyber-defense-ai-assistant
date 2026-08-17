"""
log_watcher.py — Pre-Detection Engine
======================================
Runs as a background asyncio task. Every N seconds it either:
  - Reads new lines appended to a real log file (tail-style), OR
  - Generates simulated log entries (demo mode, enabled by default)

Each line is fed through the existing rule-based detectors.
Threats are auto-saved to the DB as Incident(source="watcher") and
broadcast to all connected WebSocket clients.
"""

import asyncio
import os
import random
from datetime import datetime
from typing import Set

# Directory that contains this script — used to resolve relative log paths
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))

from sqlalchemy.orm import Session
from fastapi import WebSocket

from database import SessionLocal
from models import Incident, Notification, UserSettings
from detectors.brute_force import analyze_brute_force
from detectors.network import analyze_network
from detectors.malware import analyze_malware
from detectors.phishing import analyze_phishing
from detectors.sql_injection import analyze_sql_injection
from windows_events import get_windows_events, reset as reset_windows_events

# ─── WebSocket connection manager ────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, data: dict):
        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        self.active_connections -= dead


manager = ConnectionManager()

# ─── Watcher state (global, per-process) ─────────────────────────────────────

_watcher_task = None
_watcher_running: bool = False
_watcher_owner = None  # email of the user who started it
_file_positions: dict = {}  # track file read position per path

# ─── Simulated log generator ─────────────────────────────────────────────────

SIMULATED_LOGS = [
    # Brute-force patterns
    "WARN  Failed login attempt for user admin from 192.168.1.100",
    "WARN  Failed login attempt for user root from 10.0.0.5",
    "WARN  Failed login attempt for user admin from 192.168.1.100",
    "WARN  Failed login attempt for user admin from 192.168.1.100",
    "WARN  Failed login attempt for user admin from 192.168.1.100",
    "INFO  Successful login for user johndoe from 10.0.0.20",
    # Network / exfiltration
    "ALERT Unusual outbound traffic detected to 185.220.101.45 on port 4444",
    "ALERT Data exfiltration suspected: 2.3GB transferred to unknown host",
    "INFO  Beaconing pattern observed from host 10.0.0.55 to C2 server",
    "INFO  Port scan detected from 203.0.113.99",
    # Malware indicators
    "ALERT Process svchost.exe -k spawned from temp\\ with base64 encoded command",
    "ALERT invoke-expression detected in PowerShell script execution",
    "WARN  File dropped: C:\\Users\\Public\\update.exe (mimikatz signature detected)",
    # Phishing
    "INFO  Email received from no-reply@secure-bank-verify.ru — urgent action required",
    # Benign
    "INFO  User johndoe logged in successfully",
    "INFO  Scheduled backup completed successfully",
    "INFO  API health check passed",
    "INFO  Database connection pool healthy",
]

# Weights — benign logs appear ~55% of the time
_LOG_WEIGHTS = [1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1, 5, 5, 5, 5]


def get_simulated_line() -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    template = random.choices(SIMULATED_LOGS, weights=_LOG_WEIGHTS, k=1)[0]
    return f"{now}  {template}"


# ─── Detector pipeline ────────────────────────────────────────────────────────

def run_detectors(line: str):
    """Run all rule-based detectors on a single log line. Returns first hit or None."""
    for fn in [analyze_sql_injection, analyze_brute_force, analyze_network, analyze_malware, analyze_phishing]:
        result = fn(line)
        if result.get("detected"):
            return result
    return None


# ─── Real file tail helper ────────────────────────────────────────────────────

def _resolve_path(path: str) -> str:
    """Resolve relative paths against the backend directory."""
    if not os.path.isabs(path):
        return os.path.join(_BACKEND_DIR, path)
    return path


def read_new_lines(path: str):
    """Read lines added since the last call (tail -f style)."""
    abs_path = _resolve_path(path)
    if not os.path.exists(abs_path):
        print(f"[Watcher] Log file not found: {abs_path}")
        return []
    pos = _file_positions.get(abs_path, 0)
    lines = []
    try:
        with open(abs_path, "r", errors="ignore") as f:
            f.seek(pos)
            for line in f:
                stripped = line.strip()
                if stripped:
                    lines.append(stripped)
            _file_positions[abs_path] = f.tell()
            if lines:
                print(f"[Watcher] Read {len(lines)} new line(s) from {abs_path}")
    except OSError as e:
        print(f"[Watcher] OSError reading {abs_path}: {e}")
    return lines


async def process_log_line(line: str, user_email: str):
    """Processes a single log line, runs detectors, saves to DB, notifies, and broadcasts."""
    db: Session = SessionLocal()
    try:
        result = run_detectors(line)
        if not result:
            return None

        settings = db.query(UserSettings).filter(
            UserSettings.user_email == user_email
        ).first()

        recs = result.get("recommendations", [])
        incident = Incident(
            input_text=line,
            attack_type=result["attack_type"],
            risk=result["risk"],
            reason=result["reason"],
            recommendations=", ".join(recs),
            recommended_action=recs[0] if recs else None,
            trigger_phrases=None,
            source="watcher",
        )
        db.add(incident)
        db.flush()

        # Auto-notify
        should_notify = {
            "Low": settings.notify_low if settings else False,
            "Medium": settings.notify_medium if settings else True,
            "High": settings.notify_high if settings else True,
            "Critical": settings.notify_critical if settings else True,
        }
        if should_notify.get(result["risk"], False):
            notif = Notification(
                user_email=user_email,
                incident_id=incident.id,
                message=(
                    f"[Live Monitor] {result['risk']} risk: "
                    f"{result['attack_type']} — {result['reason'][:80]}…"
                ),
                risk=result["risk"],
            )
            db.add(notif)

        db.commit()

        alert_data = {
            "type": "alert",
            "id": incident.id,
            "attack_type": result["attack_type"],
            "risk": result["risk"],
            "reason": result["reason"],
            "recommendations": recs,
            "log_line": line,
            "timestamp": datetime.utcnow().isoformat(),
        }
        await manager.broadcast(alert_data)
        return alert_data

    except Exception as db_err:
        db.rollback()
        print(f"[Watcher] DB error: {db_err}")
        return None
    finally:
        db.close()


# ─── Core watcher loop ────────────────────────────────────────────────────────

async def _watcher_loop(user_email: str, config: dict):
    """
    Main async loop. Runs until cancelled.
    config keys: use_simulator, log_file_path, scan_interval
    """
    global _watcher_running
    scan_interval = max(2, config.get("scan_interval", 5))
    use_simulator = config.get("use_simulator", True)
    log_path = config.get("log_file_path", None)

    while _watcher_running:
        try:
            # ── Gather log lines ──────────────────────────────────────────────
            use_windows = config.get("use_windows_events", False)
            if use_simulator or (not log_path and not use_windows):
                lines = [get_simulated_line() for _ in range(random.randint(1, 3))]
            elif use_windows:
                lines = get_windows_events()
            else:
                lines = read_new_lines(log_path)

            # ── Analyze & persist ─────────────────────────────────────────────
            for line in lines:
                await process_log_line(line, user_email)

        except asyncio.CancelledError:
            break
        except Exception as loop_err:
            print(f"[Watcher] Loop error: {loop_err}")

        await asyncio.sleep(scan_interval)

    print("[Watcher] Loop stopped.")


# ─── Public API ───────────────────────────────────────────────────────────────

def start_watcher(user_email: str, config: dict) -> bool:
    """Start the background watcher. Returns False if already running."""
    global _watcher_task, _watcher_running, _watcher_owner, _file_positions
    if _watcher_running:
        return False
    _watcher_running = True
    _watcher_owner = user_email

    # Reset Windows events timestamp so we tail from NOW
    reset_windows_events()

    # Reset all file positions so we tail from NOW (end of file),
    # not from position 0 (which would replay old log lines on every restart).
    _file_positions = {}
    log_path = config.get("log_file_path")
    if log_path:
        abs_log_path = _resolve_path(log_path)
        print(f"[Watcher] Resolved log path: {abs_log_path}")
        if os.path.exists(abs_log_path):
            # Seek to end so only *new* appended lines are picked up
            try:
                with open(abs_log_path, "r", errors="ignore") as f:
                    f.seek(0, 2)  # SEEK_END
                    _file_positions[abs_log_path] = f.tell()
                print(f"[Watcher] Tailing '{abs_log_path}' from byte {_file_positions[abs_log_path]}")
            except OSError as e:
                print(f"[Watcher] Could not seek log file: {e}")
        else:
            print(f"[Watcher] WARNING — log file does not exist yet: {abs_log_path}")

    _watcher_task = asyncio.ensure_future(_watcher_loop(user_email, config))
    print(f"[Watcher] Started for {user_email} (simulator={config.get('use_simulator', True)})")
    return True


def stop_watcher() -> bool:
    """Stop the background watcher. Returns False if not running."""
    global _watcher_task, _watcher_running, _watcher_owner
    if not _watcher_running:
        return False
    _watcher_running = False
    _watcher_owner = None
    if _watcher_task and not _watcher_task.done():
        _watcher_task.cancel()
    _watcher_task = None
    print("[Watcher] Stopped.")
    return True


def get_watcher_status() -> dict:
    return {
        "running": _watcher_running,
        "owner": _watcher_owner,
    }
