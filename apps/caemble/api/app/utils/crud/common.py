from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db import Audio, Image
from utils.aws_s3 import delete_object
from utils.datetime_utils import parse_api_datetime_to_utc


ModelT = TypeVar("ModelT")
SchemaT = TypeVar("SchemaT", bound=BaseModel)
ComputedFieldSpec = tuple[tuple[str, ...], str, bool]
ComputedFieldConfig = tuple[ComputedFieldSpec, ...]


@dataclass(frozen=True)
class CrudSpec(Generic[ModelT, SchemaT]):
    model: type[ModelT]
    schema: type[SchemaT]
    relation_aliases: Mapping[str, str] = field(default_factory=dict)
    computed_fields: Mapping[str, ComputedFieldConfig] = field(default_factory=dict)
    search_aliases: Mapping[str, tuple[str, ...]] = field(default_factory=dict)
    count_sort_fields: Mapping[str, str] = field(default_factory=dict)
    presigned_fields: tuple[str, ...] = field(default_factory=tuple)
    read_only_fields: tuple[str, ...] = field(default_factory=tuple)
    preserve_unset_fields: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class RelationValueSpec:
    field_name: str
    path: tuple[str, ...]
    attr_name: str
    exclude_self: bool = False


FILE_REFERENCE_COLUMNS = (
    Image.object_key,
    Audio.object_key,
)


def computed(*path: str, attr: str = "id", exclude_self: bool = False) -> ComputedFieldConfig:
    return ((tuple(path), attr, exclude_self),)


def normalize_int_ids(values: Optional[Iterable[Any]], *, sort: bool = False) -> List[int]:
    normalized_ids: List[int] = []
    seen_ids: set[int] = set()

    for value in values or []:
        if not isinstance(value, int) or value in seen_ids:
            continue
        seen_ids.add(value)
        normalized_ids.append(value)

    return sorted(normalized_ids) if sort else normalized_ids


def get_model_column_python_type(model: type[Any], field_name: str) -> Any | None:
    column = model.__table__.columns.get(field_name)
    if column is None:
        return None

    try:
        return column.type.python_type
    except (AttributeError, NotImplementedError):
        return None


def normalize_payload_value(model: type[Any], field_name: str, value: Any) -> Any:
    if value is None:
        return None
    if get_model_column_python_type(model, field_name) is datetime:
        return parse_api_datetime_to_utc(value)
    return value


def get_relationship_attr(model: type[Any], attr_name: str) -> Any | None:
    relationship_attr = getattr(model, attr_name, None)
    if relationship_attr is None:
        return None

    relationship_property = getattr(relationship_attr, "property", None)
    if relationship_property is None or not hasattr(relationship_property, "mapper"):
        return None

    return relationship_attr


def get_relation_attr_name(spec: CrudSpec[Any, Any], field_name: str) -> str | None:
    if field_name in spec.computed_fields:
        return None

    attr_name = spec.relation_aliases.get(field_name, field_name)
    if get_relationship_attr(spec.model, attr_name) is None:
        return None

    return attr_name


def get_relation_fields(spec: CrudSpec[Any, Any]) -> list[tuple[str, str, type[Any]]]:
    relation_fields: list[tuple[str, str, type[Any]]] = []
    for field_name in spec.schema.model_fields:
        attr_name = get_relation_attr_name(spec, field_name)
        if attr_name is None:
            continue

        relationship_attr = get_relationship_attr(spec.model, attr_name)
        if relationship_attr is None:
            continue

        relation_fields.append((field_name, attr_name, relationship_attr.property.mapper.class_))

    return relation_fields


def build_load_options(
    model: type[Any],
    paths: Iterable[tuple[str, ...]],
) -> tuple[Any, ...]:
    unique_paths = {path for path in paths if path}
    compressed_paths = sorted(
        (
            path
            for path in unique_paths
            if not any(
                len(other_path) > len(path) and other_path[: len(path)] == path
                for other_path in unique_paths
            )
        ),
        key=lambda path: (len(path), path),
    )

    load_options = []
    for path in compressed_paths:
        current_model = model
        current_load = None
        for attr_name in path:
            relationship_attr = getattr(current_model, attr_name)
            current_load = (
                selectinload(relationship_attr)
                if current_load is None
                else current_load.selectinload(relationship_attr)
            )
            current_model = relationship_attr.property.mapper.class_
        if current_load is not None:
            load_options.append(current_load)

    return tuple(load_options)


async def cleanup_orphaned_object_keys(
    db: AsyncSession,
    object_keys: Sequence[str | None],
) -> None:
    for object_key in {key for key in object_keys if key}:
        is_referenced = False
        for column in FILE_REFERENCE_COLUMNS:
            stmt = select(func.count()).select_from(column.class_).where(column == object_key)
            if (await db.execute(stmt)).scalar_one():
                is_referenced = True
                break
        if not is_referenced:
            delete_object(object_key)
