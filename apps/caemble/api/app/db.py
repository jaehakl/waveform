from __future__ import annotations

from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, MetaData, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from settings import settings


def make_async_db_url(url: str) -> str:
    if not url:
        return url
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


DB_URL = make_async_db_url(settings.db_url)
engine = create_async_engine(DB_URL, future=True, pool_pre_ping=True, echo=False)
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=naming_convention)


class TimestampMixin:
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Example(TimestampMixin, Base):
    __tablename__ = "examples"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    jp_text: Mapped[str] = mapped_column(Text, nullable=False)
    kr_text: Mapped[str] = mapped_column(Text, nullable=False)
    context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    negative_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt_embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True, deferred=True)
    context_embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True, deferred=True)
    text_embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True, deferred=True)

    jp_words: Mapped[List["JpWord"]] = relationship("JpWord",secondary="jp_word_examples",back_populates="examples",lazy="selectin",)
    audios: Mapped[List["Audio"]] = relationship("Audio",back_populates="example",cascade="all, delete-orphan",)
    error_reports: Mapped[List["ErrorReport"]] = relationship("ErrorReport",back_populates="example",cascade="all, delete-orphan",)


class JpWord(TimestampMixin, Base):
    __tablename__ = "jp_words"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    lemma_id: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    lemma: Mapped[str] = mapped_column(Text, nullable=False)
    kr_mean: Mapped[str] = mapped_column(Text, nullable=False)

    examples: Mapped[List["Example"]] = relationship("Example",secondary="jp_word_examples",back_populates="jp_words",lazy="selectin",)
    user_word_skills: Mapped[List["UserJpWordSkill"]] = relationship("UserJpWordSkill",back_populates="word",cascade="all, delete-orphan",)


class ExampleJpWord(TimestampMixin, Base):
    __tablename__ = "jp_word_examples"

    example_id: Mapped[int] = mapped_column(Integer,ForeignKey("examples.id", ondelete="CASCADE"),primary_key=True,)
    jp_word_id: Mapped[int] = mapped_column(Integer,ForeignKey("jp_words.id", ondelete="CASCADE"),primary_key=True,)


class Image(TimestampMixin, Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    negative_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prompt_embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True, deferred=True)
    object_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Audio(TimestampMixin, Base):
    __tablename__ = "audios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    example_id: Mapped[int] = mapped_column(Integer, ForeignKey("examples.id", ondelete="CASCADE"), nullable=False)
    speaker: Mapped[str] = mapped_column(Text, nullable=False)
    object_key: Mapped[str] = mapped_column(Text, nullable=False)

    example: Mapped["Example"] = relationship("Example", back_populates="audios", lazy="selectin")


class UserJpWordSkill(TimestampMixin, Base):
    __tablename__ = "user_jp_word_skills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    word_id: Mapped[int] = mapped_column(Integer, ForeignKey("jp_words.id", ondelete="CASCADE"), nullable=False)
    reading: Mapped[int] = mapped_column(Integer, default=0)
    listening: Mapped[int] = mapped_column(Integer, default=0)
    speaking: Mapped[int] = mapped_column(Integer, default=0)

    word: Mapped["JpWord"] = relationship("JpWord", back_populates="user_word_skills")
    user: Mapped["User"] = relationship("User", back_populates="user_jp_word_skills")


class UserText(TimestampMixin, Base):
    __tablename__ = "user_texts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True, deferred=True)
    youtube_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="user_texts")


class ErrorReport(TimestampMixin, Base):
    __tablename__ = "error_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    example_id: Mapped[int] = mapped_column(Integer, ForeignKey("examples.id", ondelete="CASCADE"), nullable=False)
    error_type: Mapped[str] = mapped_column(Text, nullable=False)
    error_description: Mapped[str] = mapped_column(Text, nullable=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped["User"] = relationship("User", back_populates="error_reports", lazy="selectin")
    example: Mapped["Example"] = relationship("Example", back_populates="error_reports", lazy="selectin")
