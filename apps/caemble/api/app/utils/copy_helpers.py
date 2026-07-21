from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from typing import Any, Dict, Iterable, List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect as sa_inspect
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.interfaces import RelationshipDirection

from models import CopyResponseBase
from utils.crud import normalize_int_ids


async def copy_items(
    db: AsyncSession,
    root_model: type[Any],
    ids: Iterable[Any],
) -> CopyResponseBase:
    normalized_db_table = root_model.__name__
    normalized_ids = normalize_int_ids(ids, sort=False)
    if not normalized_ids:
        raise ValueError("No valid ids provided")

    model_by_table_name: Dict[str, type[Any]] = {}
    db_table_by_model: Dict[type[Any], str] = {}
    model_load_options: Dict[type[Any], tuple[Any, ...]] = {}
    for mapper in root_model.registry.mappers:
        mapped_class = mapper.class_
        table = getattr(mapped_class, "__table__", None)
        if table is None:
            continue
        model_by_table_name[table.name] = mapped_class
        db_table_by_model[mapped_class] = mapped_class.__name__
        model_load_options[mapped_class] = tuple(
            selectinload(getattr(mapped_class, relationship.key))
            for relationship in sa_inspect(mapped_class).relationships
        )

    original_cache: Dict[type[Any], Dict[int, Any | None]] = defaultdict(dict)
    clone_cache: Dict[type[Any], Dict[int, Any]] = defaultdict(dict)
    clone_order: List[Tuple[type[Any], int, Any, Any]] = []

    async def _get_original_entity(model: type[Any], entity_id: int) -> Any | None:
        cached_entities = original_cache[model]
        if entity_id in cached_entities:
            return cached_entities[entity_id]

        stmt = select(model).where(model.id == entity_id).options(*model_load_options[model])
        entity = (await db.execute(stmt)).scalar_one_or_none()
        cached_entities[entity_id] = entity
        return entity

    async def _clone_entity(model: type[Any], entity_id: int) -> Any | None:
        existing_clone = clone_cache[model].get(entity_id)
        if existing_clone is not None:
            return existing_clone

        original_entity = await _get_original_entity(model, entity_id)
        if original_entity is None:
            return None

        mapper = sa_inspect(model)
        clone_entity = model()
        clone_cache[model][entity_id] = clone_entity
        db.add(clone_entity)

        for relationship in mapper.relationships:
            if relationship.uselist and relationship.secondary is not None:
                setattr(clone_entity, relationship.key, [])

        for column in mapper.columns:
            if column.primary_key:
                continue

            copied_value = deepcopy(getattr(original_entity, column.key))
            target_model = None
            for foreign_key in column.foreign_keys:
                target_model = model_by_table_name.get(foreign_key.column.table.name)
                if target_model is not None:
                    break

            if target_model is not None and copied_value is not None:
                target_clone = clone_cache[target_model].get(copied_value)
                if target_clone is not None and getattr(target_clone, "id", None) is not None:
                    copied_value = target_clone.id

            setattr(clone_entity, column.key, copied_value)

        await db.flush()
        clone_order.append((model, entity_id, original_entity, clone_entity))

        for relationship in mapper.relationships:
            if relationship.viewonly:
                continue
            if relationship.direction is not RelationshipDirection.ONETOMANY:
                continue
            if relationship.secondary is not None:
                continue

            child_model = relationship.entity.class_
            if child_model not in db_table_by_model:
                continue

            for child_entity in getattr(original_entity, relationship.key) or []:
                child_id = getattr(child_entity, "id", None)
                if child_id is None:
                    continue
                await _clone_entity(child_model, child_id)

        return clone_entity

    try:
        copied_ids: List[int] = []
        not_found_ids: List[int] = []

        for source_id in normalized_ids:
            cloned_entity = await _clone_entity(root_model, source_id)
            if cloned_entity is None or getattr(cloned_entity, "id", None) is None:
                not_found_ids.append(source_id)
                continue
            copied_ids.append(cloned_entity.id)

        for model, _, original_entity, clone_entity in clone_order:
            for relationship in sa_inspect(model).relationships:
                if relationship.viewonly or not relationship.uselist:
                    continue
                if relationship.secondary is None:
                    continue

                related_entities: List[Any] = []
                for related_entity in getattr(original_entity, relationship.key) or []:
                    related_model = type(related_entity)
                    related_id = getattr(related_entity, "id", None)
                    copied_related_entity = clone_cache.get(related_model, {}).get(related_id)
                    related_entities.append(copied_related_entity or related_entity)

                deduped_entities: List[Any] = []
                seen_entity_keys: set[Tuple[type[Any], Any]] = set()
                for entity in related_entities:
                    if entity is None:
                        continue

                    entity_id = getattr(entity, "id", None)
                    entity_key = (type(entity), entity_id if entity_id is not None else id(entity))
                    if entity_key in seen_entity_keys:
                        continue

                    seen_entity_keys.add(entity_key)
                    deduped_entities.append(entity)

                setattr(clone_entity, relationship.key, deduped_entities)

        await db.commit()
    except Exception:
        await db.rollback()
        raise

    copied_ids_by_table: Dict[str, List[int]] = defaultdict(list)
    for model, _, _, clone_entity in clone_order:
        copied_ids_by_table[db_table_by_model[model]].append(clone_entity.id)

    return CopyResponseBase(
        db_table=normalized_db_table,
        source_ids=normalized_ids,
        copied_ids=copied_ids,
        not_found_ids=not_found_ids,
        copied_ids_by_table=dict(copied_ids_by_table),
    )
