import asyncio
from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import JpWord, UserJpWordSkill
from utils.jp_words_from_text import extract_jp_words_from_text, get_pron_from_extracted_word


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _normalize_skill(
    word_id: int,
    raw_skill: Any,
) -> Dict[str, Any]:
    if hasattr(raw_skill, "model_dump"):
        raw_skill = raw_skill.model_dump()

    if isinstance(raw_skill, dict):
        return {
            "word_id": word_id,
            "reading": _safe_int(raw_skill.get("reading")),
            "listening": _safe_int(raw_skill.get("listening")),
            "speaking": _safe_int(raw_skill.get("speaking")),
            "updated_at": raw_skill.get("updated_at", raw_skill.get("updatedAt")),
        }

    return {
        "word_id": word_id,
        "reading": _safe_int(raw_skill),
        "listening": 0,
        "speaking": 0,
        "updated_at": None,
    }


def _normalize_word_skills(skills: Any) -> Dict[int, Dict[str, Any]]:
    if not skills:
        return {}

    normalized: Dict[int, Dict[str, Any]] = {}
    if isinstance(skills, dict):
        for raw_word_id, raw_skill in skills.items():
            try:
                word_id = int(raw_word_id)
            except (TypeError, ValueError):
                continue
            normalized[word_id] = _normalize_skill(word_id, raw_skill)
        return normalized

    if isinstance(skills, list):
        for raw_skill in skills:
            if hasattr(raw_skill, "model_dump"):
                raw_skill = raw_skill.model_dump()
            if not isinstance(raw_skill, dict):
                continue
            raw_word_id = raw_skill.get("word_id", raw_skill.get("wordId"))
            try:
                word_id = int(raw_word_id)
            except (TypeError, ValueError):
                continue
            normalized[word_id] = _normalize_skill(word_id, raw_skill)
        return normalized

    return {}


def _db_skill_to_dict(skill: UserJpWordSkill) -> Dict[str, Any]:
    return {
        "id": skill.id,
        "user_id": skill.user_id,
        "word_id": skill.word_id,
        "reading": skill.reading,
        "listening": skill.listening,
        "speaking": skill.speaking,
        "created_at": skill.created_at,
        "updated_at": skill.updated_at,
    }


def _fallback_text(value: Optional[str], fallback: str) -> str:
    return value if value else fallback


async def analyze_jp_text(
    text: str,
    skills: Any = None,
    db: AsyncSession = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    if db is None:
        raise ValueError("db session is required")

    document, extracted_words = await asyncio.to_thread(
        extract_jp_words_from_text,
        text,
    )
    payload_skills_by_word_id = _normalize_word_skills(skills)
    lemma_ids = [
        lemma_id
        for lemma_id in extracted_words.keys()
        if lemma_id is not None
    ]

    words_by_lemma: Dict[int, JpWord] = {}
    if lemma_ids:
        rows = (
            await db.execute(
                select(JpWord)
                .where(JpWord.lemma_id.in_(lemma_ids))
                .order_by(JpWord.id.asc())
            )
        ).scalars().all()
        for word in rows:
            if word.lemma_id not in words_by_lemma:
                words_by_lemma[word.lemma_id] = word

    db_skills_by_word_id: Dict[int, Dict[str, Any]] = {}
    word_ids = [word.id for word in words_by_lemma.values()]
    if user_id is not None and word_ids:
        skill_rows = (
            await db.execute(
                select(UserJpWordSkill).where(
                    UserJpWordSkill.user_id == user_id,
                    UserJpWordSkill.word_id.in_(word_ids),
                )
            )
        ).scalars().all()
        db_skills_by_word_id = {
            skill.word_id: _db_skill_to_dict(skill)
            for skill in skill_rows
        }

    words = []
    for line_index, line in enumerate(document):
        for word_index, token in enumerate(line):
            surface = token["surface"]
            lemma_id = token["lemma_id"]
            db_word = words_by_lemma.get(lemma_id)
            extracted = extracted_words.get(lemma_id) or {}
            lemma = extracted.get("lemma") or surface
            pronunciation = get_pron_from_extracted_word(extracted)

            if db_word is not None:
                db_lemma = _fallback_text(db_word.lemma, lemma)
                skill = (
                    db_skills_by_word_id.get(db_word.id)
                    or payload_skills_by_word_id.get(db_word.id)
                )
                words.append(
                    {
                        "id": f"{line_index}-{word_index}",
                        "word_id": db_word.id,
                        "lemma_id": db_word.lemma_id,
                        "surface": surface,
                        "lemma": db_lemma,
                        "jpPron": pronunciation,
                        "krMean": db_word.kr_mean,
                        "userWordSkill": skill,
                    }
                )
                continue

            fallback = _fallback_text(lemma, surface)
            words.append(
                {
                    "id": f"{line_index}-{word_index}",
                    "word_id": None,
                    "lemma_id": lemma_id,
                    "surface": surface,
                    "lemma": fallback,
                    "jpPron": pronunciation,
                    "krMean": fallback,
                    "userWordSkill": None,
                }
            )

    return {"words": words}
