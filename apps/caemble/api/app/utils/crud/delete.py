from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from utils.crud.common import CrudSpec, cleanup_orphaned_object_keys, normalize_int_ids


async def delete_items(
    db: AsyncSession,
    spec: CrudSpec[Any, Any],
    ids: Iterable[Any],
    cleanup_fields: Sequence[str] = (),
) -> None:
    normalized_ids = normalize_int_ids(ids, sort=True)
    if not normalized_ids:
        return

    orphan_candidates: list[str | None] = []
    if cleanup_fields:
        stmt = select(*(getattr(spec.model, field_name) for field_name in cleanup_fields)).where(
            spec.model.id.in_(normalized_ids)
        )
        rows = (await db.execute(stmt)).all()
        for row in rows:
            orphan_candidates.extend(getattr(row, field_name) for field_name in cleanup_fields)

    await db.execute(sa_delete(spec.model).where(spec.model.id.in_(normalized_ids)))
    await db.commit()
    await cleanup_orphaned_object_keys(db, orphan_candidates)
