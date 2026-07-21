from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import UpsertResponseBase
from utils.crud.common import (
    CrudSpec,
    build_load_options,
    get_relation_fields,
    normalize_int_ids,
    normalize_payload_value,
)


async def _fetch_entities_by_ids(
    db: AsyncSession,
    model: type[Any],
    ids: Iterable[Any],
    load_options: Sequence[Any] = (),
) -> Dict[int, Any]:
    normalized_ids = normalize_int_ids(ids, sort=True)
    if not normalized_ids:
        return {}

    stmt = select(model).where(model.id.in_(normalized_ids))
    if load_options:
        stmt = stmt.options(*load_options)

    result = await db.execute(stmt)
    return {entity.id: entity for entity in result.scalars().all()}


async def upsert_items(
    db: AsyncSession,
    items: List[Any],
    spec: CrudSpec[Any, Any],
) -> List[UpsertResponseBase]:
    if not items:
        return []

    relation_fields = get_relation_fields(spec)
    payload_excluded_fields = {
        "id",
        *(field_name for field_name, _, _ in relation_fields),
        *spec.computed_fields.keys(),
        *spec.read_only_fields,
    }
    prepared_items: List[Dict[str, Any]] = []
    relation_ids_by_model: dict[type[Any], set[int]] = defaultdict(set)

    for item in items:
        item_fields_set = getattr(item, "model_fields_set", set())
        item_excluded_fields = {
            *payload_excluded_fields,
            *(
                field_name
                for field_name in spec.preserve_unset_fields
                if field_name not in item_fields_set
            ),
        }
        relation_ids_by_field: Dict[str, Optional[List[int]]] = {}
        for field_name, _, related_model in relation_fields:
            requested_ids = getattr(item, field_name, None)
            normalized_relation_ids = None if requested_ids is None else normalize_int_ids(requested_ids)
            relation_ids_by_field[field_name] = normalized_relation_ids
            relation_ids_by_model[related_model].update(normalized_relation_ids or [])

        prepared_items.append(
            {
                "entity_id": getattr(item, "id", None),
                "payload": {
                    field_name: normalize_payload_value(spec.model, field_name, value)
                    for field_name, value in item.model_dump(exclude=item_excluded_fields).items()
                },
                "relation_ids_by_field": relation_ids_by_field,
            }
        )

    existing_entities_by_id = await _fetch_entities_by_ids(
        db,
        spec.model,
        (prepared_item["entity_id"] for prepared_item in prepared_items),
        load_options=build_load_options(
            spec.model,
            ((attr_name,) for _, attr_name, _ in relation_fields),
        ),
    )

    entities_by_model: Dict[type[Any], Dict[int, Any]] = {}
    for model, ids in relation_ids_by_model.items():
        if ids:
            entities_by_model[model] = await _fetch_entities_by_ids(db, model, ids)

    pending_results: List[tuple[Any, Optional[Dict[str, List[int]]]]] = []
    for prepared_item in prepared_items:
        entity_id = prepared_item["entity_id"]
        entity = existing_entities_by_id.get(entity_id) if entity_id is not None else None
        if entity is None:
            entity = spec.model()
            db.add(entity)

        for field_name, value in prepared_item["payload"].items():
            setattr(entity, field_name, value)

        fk_not_found: Dict[str, List[int]] = {}
        relation_ids_by_field = prepared_item["relation_ids_by_field"]
        for field_name, attr_name, related_model in relation_fields:
            requested_ids = relation_ids_by_field[field_name]
            if requested_ids is None:
                continue

            resolved_entities: List[Any] = []
            missing_ids: List[int] = []
            entity_map = entities_by_model.get(related_model, {})

            for related_id in requested_ids:
                related_entity = entity_map.get(related_id)
                if related_entity is None:
                    missing_ids.append(related_id)
                    continue
                resolved_entities.append(related_entity)

            setattr(entity, attr_name, resolved_entities)
            if missing_ids:
                fk_not_found[field_name] = missing_ids

        pending_results.append((entity, fk_not_found or None))

    await db.flush()
    await db.commit()

    return [
        UpsertResponseBase(id=entity.id, fk_not_found=fk_not_found)
        for entity, fk_not_found in pending_results
    ]
