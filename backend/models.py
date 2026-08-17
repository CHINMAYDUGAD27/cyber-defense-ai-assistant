from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    input_text = Column(Text, nullable=False)
    attack_type = Column(String, nullable=True)
    risk = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    recommendations = Column(Text, nullable=False)   # comma-joined list
    recommended_action = Column(Text, nullable=True)  # Phase 2: single primary action
    trigger_phrases = Column(Text, nullable=True)     # Phase 3: comma-joined highlight substrings
    mitre_tactic = Column(String, nullable=True)      # XSIAM Phase 1: MITRE ATT&CK Tactic
    source = Column(String, default="manual", nullable=False)  # "manual" | "watcher" (pre-detection)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, nullable=False, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=True)
    message = Column(Text, nullable=False)
    risk = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, unique=True, nullable=False, index=True)
    notify_low = Column(Boolean, default=False)
    notify_medium = Column(Boolean, default=True)
    notify_high = Column(Boolean, default=True)
    notify_critical = Column(Boolean, default=True)
    theme = Column(String, default="dark")
    groq_api_key = Column(String, nullable=True) # Phase 4
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WatcherConfig(Base):
    __tablename__ = "watcher_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String, unique=True, nullable=False, index=True)
    enabled = Column(Boolean, default=False)         # is watcher currently running?
    log_file_path = Column(String, nullable=True)    # path to real log file (None = use simulator)
    scan_interval = Column(Integer, default=5)        # seconds between scans
    use_simulator = Column(Boolean, default=True)    # True = generate fake logs for demo
    created_at = Column(DateTime(timezone=True), server_default=func.now())