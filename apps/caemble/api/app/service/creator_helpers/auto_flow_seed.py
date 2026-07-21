from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db import Audio, Example, ExampleJpWord, JpWord
from models import AutoFlowSeedResponse
from utils.crud import cleanup_orphaned_object_keys
from utils.jp_words_from_text import format_lemma_with_pron


async def pop_auto_flow_seed(db: AsyncSession) -> AutoFlowSeedResponse:
    sentence = (
        await db.execute(
            select(Example.id, Example.jp_text)
            .where(Example.context.is_(None))
            .order_by(Example.id.asc())
            .limit(1)
            .with_for_update(skip_locked=True)
        )
    ).one_or_none()
    if sentence is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="자동 생성에 사용할 context 없는 문장이 없습니다.",
        )

    word_counts = (
        select(
            JpWord.id.label("jp_word_id"),
            func.count(ExampleJpWord.example_id).label("example_count"),
        )
        .outerjoin(ExampleJpWord, ExampleJpWord.jp_word_id == JpWord.id)
        .group_by(JpWord.id)
        .subquery()
    )
    minimum_example_count = select(func.min(word_counts.c.example_count)).scalar_subquery()
    word = (
        await db.execute(
            select(JpWord.lemma_id, JpWord.lemma)
            .join(word_counts, word_counts.c.jp_word_id == JpWord.id)
            .where(word_counts.c.example_count == minimum_example_count)
            .order_by(func.random())
            .limit(1)
        )
    ).one_or_none()
    if word is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="자동 생성에 사용할 단어가 없습니다.",
        )

    seed_word = format_lemma_with_pron(word.lemma_id, word.lemma)
    audio_object_keys = (
        await db.execute(
            select(Audio.object_key).where(Audio.example_id == sentence.id)
        )
    ).scalars().all()
    await db.execute(delete(Example).where(Example.id == sentence.id))
    await db.commit()
    await cleanup_orphaned_object_keys(db, audio_object_keys)

    return AutoFlowSeedResponse(
        source_sentence=sentence.jp_text,
        seed_word=seed_word,
    )
