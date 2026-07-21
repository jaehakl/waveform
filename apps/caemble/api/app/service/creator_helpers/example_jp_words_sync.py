import asyncio
from collections.abc import Iterable, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db import Example, JpWord
from models import SyncExampleJpWordsResponse
from utils.jp_words_from_text import extract_jp_words_from_text


BATCH_SIZE = 100


async def _sync_example_batch(
    db: AsyncSession,
    examples: Sequence[Example],
    lemma_ids_without_jp_word: set[int],
) -> tuple[int, int]:
    lemma_ids_by_example_id: dict[int, set[int]] = {}
    batch_lemma_ids: set[int] = set()

    for example in examples:
        _, extracted_words = await asyncio.to_thread(
            extract_jp_words_from_text,
            example.jp_text,
        )
        lemma_ids = {
            lemma_id
            for lemma_id in extracted_words.keys()
            if lemma_id is not None
        }
        lemma_ids_by_example_id[example.id] = lemma_ids
        batch_lemma_ids.update(lemma_ids)

    words_by_lemma_id: dict[int, JpWord] = {}
    if batch_lemma_ids:
        words = (
            await db.execute(
                select(JpWord)
                .where(JpWord.lemma_id.in_(batch_lemma_ids))
                .order_by(JpWord.id.asc())
            )
        ).scalars().all()
        for word in words:
            if word.lemma_id not in words_by_lemma_id:
                words_by_lemma_id[word.lemma_id] = word

    examples_updated = 0
    jp_words_added = 0
    for example in examples:
        existing_lemma_ids = {word.lemma_id for word in example.jp_words}
        example_updated = False
        for lemma_id in sorted(lemma_ids_by_example_id.get(example.id, set())):
            if lemma_id in existing_lemma_ids:
                continue

            word = words_by_lemma_id.get(lemma_id)
            if word is None:
                lemma_ids_without_jp_word.add(lemma_id)
                continue

            example.jp_words.append(word)
            existing_lemma_ids.add(lemma_id)
            example_updated = True
            jp_words_added += 1

        if example_updated:
            examples_updated += 1

    if jp_words_added:
        await db.commit()

    return examples_updated, jp_words_added


async def sync_example_jp_words(
    db: AsyncSession,
    example_ids: Iterable[int] | None = None,
    *,
    start_id: int | None = None,
    end_id: int | None = None,
    limit: int = BATCH_SIZE,
) -> SyncExampleJpWordsResponse:
    examples_checked = 0
    examples_updated = 0
    jp_words_added = 0
    lemma_ids_without_jp_word: set[int] = set()
    target_ids = None if example_ids is None else sorted(set(example_ids))

    if target_ids is not None:
        for offset in range(0, len(target_ids), BATCH_SIZE):
            id_batch = target_ids[offset : offset + BATCH_SIZE]
            examples = (
                await db.execute(
                    select(Example)
                    .options(selectinload(Example.jp_words))
                    .where(Example.id.in_(id_batch))
                    .order_by(Example.id.asc())
                )
            ).scalars().all()
            examples_checked += len(examples)
            batch_updated, batch_added = await _sync_example_batch(
                db,
                examples,
                lemma_ids_without_jp_word,
            )
            examples_updated += batch_updated
            jp_words_added += batch_added

        return SyncExampleJpWordsResponse(
            examples_checked=examples_checked,
            examples_updated=examples_updated,
            jp_words_added=jp_words_added,
            lemma_ids_without_jp_word=sorted(lemma_ids_without_jp_word),
        )

    if start_id is not None or end_id is not None:
        if start_id is None or end_id is None:
            raise ValueError("start_id and end_id must be provided together.")
        if start_id > end_id:
            raise ValueError("start_id must be less than or equal to end_id.")

        batch_size = min(BATCH_SIZE, max(1, limit))
        range_examples = (
            await db.execute(
                select(Example)
                .options(selectinload(Example.jp_words))
                .where(Example.id >= start_id, Example.id <= end_id)
                .order_by(Example.id.asc())
                .limit(batch_size + 1)
            )
        ).scalars().all()
        examples = range_examples[:batch_size]
        last_example_id = examples[-1].id if examples else None
        next_start_id = range_examples[batch_size].id if len(range_examples) > batch_size else None

        examples_checked = len(examples)
        batch_updated, batch_added = await _sync_example_batch(
            db,
            examples,
            lemma_ids_without_jp_word,
        )
        examples_updated += batch_updated
        jp_words_added += batch_added

        return SyncExampleJpWordsResponse(
            examples_checked=examples_checked,
            examples_updated=examples_updated,
            jp_words_added=jp_words_added,
            lemma_ids_without_jp_word=sorted(lemma_ids_without_jp_word),
            last_example_id=last_example_id,
            next_start_id=next_start_id,
        )

    last_example_id = 0

    while True:
        examples = (
            await db.execute(
                select(Example)
                .options(selectinload(Example.jp_words))
                .where(Example.id > last_example_id)
                .order_by(Example.id.asc())
                .limit(BATCH_SIZE)
            )
        ).scalars().all()
        if not examples:
            break

        last_example_id = examples[-1].id
        examples_checked += len(examples)
        batch_updated, batch_added = await _sync_example_batch(
            db,
            examples,
            lemma_ids_without_jp_word,
        )
        examples_updated += batch_updated
        jp_words_added += batch_added

    return SyncExampleJpWordsResponse(
        examples_checked=examples_checked,
        examples_updated=examples_updated,
        jp_words_added=jp_words_added,
        lemma_ids_without_jp_word=sorted(lemma_ids_without_jp_word),
    )
