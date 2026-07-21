from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import Audio, Example
from models import (
    ExampleBase,
    ExampleListRequest,
    ExampleUpsert,
    GetListResponseBase,
    UpsertResponseBase,
)
from service.creator_helpers.example_jp_words_sync import sync_example_jp_words
from utils.crud import (
    CrudSpec,
    cleanup_orphaned_object_keys,
    delete_items,
    get_list_response,
    normalize_int_ids,
    upsert_items,
)


EXAMPLE_CRUD_SPEC = CrudSpec(
    model=Example,
    schema=ExampleBase,
    count_sort_fields={"audios": "audios"},
    read_only_fields=("created_at", "updated_at"),
)

EXAMPLE_UPSERT_CRUD_SPEC = CrudSpec(
    model=Example,
    schema=ExampleUpsert,
    read_only_fields=("created_at", "updated_at"),
    preserve_unset_fields=("context", "context_embedding", "text_embedding", "prompt_embedding"),
)


async def get_example_list(
    db: AsyncSession,
    request: ExampleListRequest,
) -> GetListResponseBase:
    base_clause = (
        Example.prompt_embedding.isnot(None)
        if request.require_prompt_embedding
        else None
    )
    return await get_list_response(db, request, EXAMPLE_CRUD_SPEC, base_clause)


async def upsert_example_list(
    db: AsyncSession,
    items: List[ExampleUpsert],
) -> List[UpsertResponseBase]:
    results = await upsert_items(db, items, EXAMPLE_UPSERT_CRUD_SPEC)
    await sync_example_jp_words(db, [result.id for result in results])
    return results


async def delete_example_list(
    db: AsyncSession,
    ids: List[int],
) -> None:
    normalized_ids = normalize_int_ids(ids, sort=True)
    if not normalized_ids:
        return None

    audio_object_keys = (
        await db.execute(
            select(Audio.object_key).where(Audio.example_id.in_(normalized_ids))
        )
    ).scalars().all()

    await delete_items(db, EXAMPLE_CRUD_SPEC, normalized_ids)
    await cleanup_orphaned_object_keys(db, audio_object_keys)
    return None
