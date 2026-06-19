"""
db.py
SQLite setup via SQLAlchemy. Schema carries `user_id` on every table from
day one (per the plan) so multi-user auth can be added later without a
migration — for now every row just uses user_id="default".
"""

import os
from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./data/app.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

DEFAULT_USER_ID = "default"


class MasterCVRow(Base):
    __tablename__ = "master_cv"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, default=DEFAULT_USER_ID)
    json_data = Column(Text, nullable=False)  # MasterCV serialized as JSON
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GenerationHistoryRow(Base):
    __tablename__ = "generation_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, default=DEFAULT_USER_ID)
    job_description = Column(Text, nullable=False)
    tailored_json = Column(Text, nullable=True)
    pdf_path = Column(String, nullable=True)
    ats_score = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()