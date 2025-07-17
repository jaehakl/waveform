# db.py
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Date, JSON,
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
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(env_path)
print("BASE_DIR: ", os.getenv('WAVEFORM_SERVER_BASE_DIR'))

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


#class Article(Base):
#    __tablename__ = "article"
#    id = Column(Integer, primary_key=True)
#    date = Column(Date)
#    name = Column(String, nullable=False)
#    tags = Column(String)
#    title = Column(String, nullable=False)
#    body = Column(String)
#    embedding = Column(Vector(768))
#    keywords = Column(String)
