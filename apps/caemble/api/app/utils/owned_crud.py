from __future__ import annotations

from typing import Any, Iterable, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import UpsertResponseBase
from utils.crud import CrudSpec, delete_items, normalize_int_ids, upsert_items


SchemaT = TypeVar("SchemaT", bound=BaseModel)


async def assert_owned_ids(
    db: AsyncSession,
    model: type[Any],
    ids: Iterable[Any],
    user_id: str,
    label: str,
) -> list[int]:
    item_ids = normalize_int_ids(ids, sort=True)
    if not item_ids:
        return []

    owned_ids = set(
        (
            await db.execute(
                select(model.id).where(
                    model.user_id == user_id,
                    model.id.in_(item_ids),
                )
            )
        ).scalars().all()
    )
    missing_ids = [item_id for item_id in item_ids if item_id not in owned_ids]
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"{label} not found: {missing_ids}.")
    return item_ids


async def upsert_owned_items(
    db: AsyncSession,
    items: list[SchemaT],
    spec: CrudSpec[Any, SchemaT],
    user_id: str,
    label: str,
) -> list[UpsertResponseBase]:
    await assert_owned_ids(db, spec.model, (item.id for item in items), user_id, label)
    prepared_items = [item.model_copy(update={"user_id": user_id}) for item in items]
    return await upsert_items(db, prepared_items, spec)


async def delete_owned_items(
    db: AsyncSession,
    ids: Iterable[Any],
    spec: CrudSpec[Any, Any],
    user_id: str,
    label: str,
) -> None:
    item_ids = await assert_owned_ids(db, spec.model, ids, user_id, label)
    await delete_items(db, spec, item_ids)
