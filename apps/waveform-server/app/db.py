# db.py
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Date, Text,
    create_engine, DateTime
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
#from pgvector.sqlalchemy import Vector
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.types import Boolean

from datetime import datetime

import sys, os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))+'/..'
os.environ['WAVEFORM_SERVER_BASE_DIR'] = BASE_DIR
print("BASE_DIR: ", os.getenv('WAVEFORM_SERVER_BASE_DIR'))

env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(env_path)

DEFAULT_ADMIN_NAME = os.getenv("WAVEFORM_DEFAULT_ADMIN_NAME")
DEFAULT_ADMIN_PW = os.getenv("WAVEFORM_DEFAULT_ADMIN_PW")
if not DEFAULT_ADMIN_NAME or not DEFAULT_ADMIN_PW:
    os.environ['WAVEFORM_DEFAULT_ADMIN_NAME'] = 'admin'
    os.environ['WAVEFORM_DEFAULT_ADMIN_PW'] = 'qutat'

# DB URL 설정
DATABASE_URL = os.getenv("WAVEFORM_SERVER_DB_URL")
if not DATABASE_URL or DATABASE_URL == "":
    # 기본값: sqlite3 사용 (waveform.db 파일이 BASE_DIR에 생성됨)
    DATABASE_URL = f"sqlite+aiosqlite:///{os.path.join(BASE_DIR, 'waveform.db')}"

# 비동기 엔진 및 세션
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "user"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True)
    password = Column(String, nullable=False)
    email = Column(String, nullable=True, unique=True)
    grade = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now)
    is_active = Column(Boolean, nullable=False, default=True)
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    setups = relationship("Setup", back_populates="user", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="user", cascade="all, delete-orphan")
    outputs = relationship("Output", back_populates="user", cascade="all, delete-orphan")
    processes = relationship("Process", back_populates="user", cascade="all, delete-orphan")

class UserSession(Base):
    __tablename__ = "user_session"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    session_id = Column(String, nullable=False, unique=True)
    expires_at = Column(DateTime, nullable=False)
    user = relationship("User", back_populates="sessions")

class Setup(Base):
    __tablename__ = "setup"
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    title = Column(String, nullable=False)
    solver = Column(String, nullable=False)
    public = Column(Boolean, nullable=False, default=False)
    work_request = Column(Integer, nullable=False, default=0)
    description = Column(String, nullable=True)
    data = Column(Text, nullable=True)
    user = relationship("User", back_populates="setups")
    entities = relationship("Entity", back_populates="setup", cascade="all, delete-orphan")

class Entity(Base):
    __tablename__ = "entity"
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    setup_id = Column(String, ForeignKey("setup.id"), nullable=False)
    data = Column(Text, nullable=True)
    user = relationship("User", back_populates="entities")
    setup = relationship("Setup", back_populates="entities")
    outputs = relationship("Output", back_populates="entity", cascade="all, delete-orphan")
    processes = relationship("Process", back_populates="entity", cascade="all, delete-orphan")

class Output(Base):
    __tablename__ = "output"
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    entity_id = Column(String, ForeignKey("entity.id"), nullable=False)
    file_urls = Column(Text, nullable=True)
    user = relationship("User", back_populates="outputs")
    entity = relationship("Entity", back_populates="outputs")

class Process(Base):
    __tablename__ = "process"
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    id = Column(String, primary_key=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False)
    ip_address = Column(String, nullable=False)
    entity_id = Column(String, ForeignKey("entity.id"), nullable=True)
    status = Column(String, nullable=True)
    file_urls = Column(Text, nullable=True)
    user = relationship("User", back_populates="processes")
    entity = relationship("Entity", back_populates="processes")

