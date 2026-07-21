from typing import Any, Dict, List, Set

from sqlalchemy import select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from db import Example, Image
from models import (
    ExampleBase,
    ExampleSortSimilarItem,
    ExampleSortSimilarListResponse,
    SimilarityResult,
)
from utils.crud import CrudSpec, get_list_response
from utils.crud.list import (
    build_list_where_clause,
    get_list_sort_request,
    get_list_total,
    serialize_list_entities,
)


EXAMPLE_SORT_SIMILAR_CRUD_SPEC = CrudSpec(
    model=Example,
    schema=ExampleBase,
    count_sort_fields={"audios": "audios", "jp_words": "jp_words"},
    read_only_fields=("created_at", "updated_at"),
)

SIMILAR_PROMPT_IMAGE_FIELD = "similar_prompt_image"
SIMILAR_CONTEXT_TEXT_EXAMPLE_FIELD = "similar_context_text_example"
SIMILAR_TEXT_CONTEXT_EXAMPLE_FIELD = "similar_text_context_example"
SIMILAR_SORT_FIELD_TO_MATCH_FIELD = {
    "similar_prompt_image_score": SIMILAR_PROMPT_IMAGE_FIELD,
    "similar_context_text_example_score": SIMILAR_CONTEXT_TEXT_EXAMPLE_FIELD,
    "similar_text_context_example_score": SIMILAR_TEXT_CONTEXT_EXAMPLE_FIELD,
}
SIMILAR_SORT_FIELDS = set(SIMILAR_SORT_FIELD_TO_MATCH_FIELD)
DEFAULT_SIMILARITY_FIELDS = {SIMILAR_PROMPT_IMAGE_FIELD}


def _to_similarity_result(match_id: Any, distance: Any) -> SimilarityResult | None:
    if match_id is None or distance is None:
        return None
    return SimilarityResult(id=int(match_id), score=1.0 - float(distance))


def _prompt_image_match_lateral(name: str):
    distance_expr = Image.prompt_embedding.cosine_distance(Example.prompt_embedding).label("distance")
    return (
        select(Image.id.label("match_id"), distance_expr)
        .where(Example.prompt_embedding.isnot(None))
        .where(Image.prompt_embedding.isnot(None))
        .order_by(distance_expr.asc(), Image.id.asc())
        .limit(1)
        .lateral(name)
    )


def _example_match_lateral(name: str, source_embedding: Any, candidate_embedding_name: str):
    candidate = aliased(Example, name=f"{name}_candidate")
    candidate_embedding = getattr(candidate, candidate_embedding_name)
    distance_expr = candidate_embedding.cosine_distance(source_embedding).label("distance")
    return (
        select(candidate.id.label("match_id"), distance_expr)
        .where(source_embedding.isnot(None))
        .where(candidate_embedding.isnot(None))
        .where(candidate.id != Example.id)
        .order_by(distance_expr.asc(), candidate.id.asc())
        .limit(1)
        .lateral(name)
    )


def _sort_match_lateral(sort_field: str):
    if sort_field == "similar_prompt_image_score":
        return _prompt_image_match_lateral("sort_prompt_image")
    if sort_field == "similar_context_text_example_score":
        return _example_match_lateral(
            "sort_context_text_example",
            Example.context_embedding,
            "text_embedding",
        )
    return _example_match_lateral(
        "sort_text_context_example",
        Example.text_embedding,
        "context_embedding",
    )


async def _find_similarity_matches_by_example_ids(
    db: AsyncSession,
    example_ids: List[int],
    include_fields: Set[str],
) -> Dict[int, Dict[str, SimilarityResult | None]]:
    unique_example_ids = list(dict.fromkeys(example_ids))
    matches_by_example_id: Dict[int, Dict[str, SimilarityResult | None]] = {
        example_id: {field: None for field in include_fields}
        for example_id in unique_example_ids
    }
    if not unique_example_ids or not include_fields:
        return matches_by_example_id

    columns = [Example.id.label("example_id")]
    joins = []

    if SIMILAR_PROMPT_IMAGE_FIELD in include_fields:
        prompt_image = _prompt_image_match_lateral("prompt_image")
        columns.extend([
            prompt_image.c.match_id.label("prompt_image_id"),
            prompt_image.c.distance.label("prompt_image_distance"),
        ])
        joins.append(prompt_image)

    if SIMILAR_CONTEXT_TEXT_EXAMPLE_FIELD in include_fields:
        context_text = _example_match_lateral(
            "context_text_example",
            Example.context_embedding,
            "text_embedding",
        )
        columns.extend([
            context_text.c.match_id.label("context_text_example_id"),
            context_text.c.distance.label("context_text_example_distance"),
        ])
        joins.append(context_text)

    if SIMILAR_TEXT_CONTEXT_EXAMPLE_FIELD in include_fields:
        text_context = _example_match_lateral(
            "text_context_example",
            Example.text_embedding,
            "context_embedding",
        )
        columns.extend([
            text_context.c.match_id.label("text_context_example_id"),
            text_context.c.distance.label("text_context_example_distance"),
        ])
        joins.append(text_context)

    stmt = select(*columns).select_from(Example)
    for join in joins:
        stmt = stmt.outerjoin(join, true())

    rows = (await db.execute(stmt.where(Example.id.in_(unique_example_ids)))).all()

    for row in rows:
        matches = {field: None for field in include_fields}
        if SIMILAR_PROMPT_IMAGE_FIELD in include_fields:
            matches[SIMILAR_PROMPT_IMAGE_FIELD] = _to_similarity_result(
                row.prompt_image_id,
                row.prompt_image_distance,
            )
        if SIMILAR_CONTEXT_TEXT_EXAMPLE_FIELD in include_fields:
            matches[SIMILAR_CONTEXT_TEXT_EXAMPLE_FIELD] = _to_similarity_result(
                row.context_text_example_id,
                row.context_text_example_distance,
            )
        if SIMILAR_TEXT_CONTEXT_EXAMPLE_FIELD in include_fields:
            matches[SIMILAR_TEXT_CONTEXT_EXAMPLE_FIELD] = _to_similarity_result(
                row.text_context_example_id,
                row.text_context_example_distance,
            )
        matches_by_example_id[row.example_id] = matches

    return matches_by_example_id


async def _build_sort_similar_items(
    db: AsyncSession,
    base_items: List[Any],
    include_fields: Set[str],
) -> List[ExampleSortSimilarItem]:
    example_ids = [
        item.id
        for item in base_items
        if getattr(item, "id", None) is not None
    ]
    matches_by_example_id = await _find_similarity_matches_by_example_ids(
        db,
        example_ids,
        include_fields,
    )

    items: List[ExampleSortSimilarItem] = []
    for item in base_items:
        item_data = item.model_dump()
        item_data.update(
            matches_by_example_id.get(
                item.id,
                {field: None for field in include_fields},
            )
        )
        items.append(ExampleSortSimilarItem.model_validate(item_data))
    return items


async def _get_similarity_sorted_example_ids(
    db: AsyncSession,
    request: Any,
    sort_field: str,
    direction: str,
) -> tuple[int, List[int]]:
    where_clause = build_list_where_clause(request, EXAMPLE_SORT_SIMILAR_CRUD_SPEC)
    total = await get_list_total(db, EXAMPLE_SORT_SIMILAR_CRUD_SPEC, where_clause)
    match = _sort_match_lateral(sort_field)
    distance_order = (
        match.c.distance.desc().nulls_last()
        if direction == "asc"
        else match.c.distance.asc().nulls_last()
    )
    stmt = (
        select(Example.id.label("example_id"))
        .select_from(Example)
        .outerjoin(match, true())
        .order_by(distance_order, Example.id.desc())
    )
    if where_clause is not None:
        stmt = stmt.where(where_clause)
    if request.offset:
        stmt = stmt.offset(request.offset)
    if request.limit is not None:
        stmt = stmt.limit(request.limit)

    rows = (await db.execute(stmt)).all()
    return total, [row.example_id for row in rows]


async def _get_examples_by_ordered_ids(
    db: AsyncSession,
    example_ids: List[int],
) -> List[Example]:
    if not example_ids:
        return []

    rows = (
        await db.execute(
            select(Example)
            .where(Example.id.in_(example_ids))
        )
    ).scalars().all()
    examples_by_id = {example.id: example for example in rows}
    return [
        examples_by_id[example_id]
        for example_id in example_ids
        if example_id in examples_by_id
    ]


async def get_example_list_sort_similar_response(
    db: AsyncSession,
    request: Any,
) -> ExampleSortSimilarListResponse:
    sort_field, direction = get_list_sort_request(request)
    is_similarity_sort = (
        not bool(getattr(request, "random", False))
        and sort_field in SIMILAR_SORT_FIELDS
    )
    include_fields = (
        {SIMILAR_SORT_FIELD_TO_MATCH_FIELD[sort_field]}
        if is_similarity_sort and sort_field is not None
        else DEFAULT_SIMILARITY_FIELDS
    )

    if not is_similarity_sort:
        response = await get_list_response(db, request, EXAMPLE_SORT_SIMILAR_CRUD_SPEC)
        return ExampleSortSimilarListResponse(
            total=response.total,
            items=await _build_sort_similar_items(db, response.items, include_fields),
        )

    total, ordered_ids = await _get_similarity_sorted_example_ids(
        db,
        request,
        sort_field or "",
        direction,
    )
    examples = await _get_examples_by_ordered_ids(db, ordered_ids)
    base_items = await serialize_list_entities(
        db,
        examples,
        EXAMPLE_SORT_SIMILAR_CRUD_SPEC,
    )
    return ExampleSortSimilarListResponse(
        total=total,
        items=await _build_sort_similar_items(db, base_items, include_fields),
    )
