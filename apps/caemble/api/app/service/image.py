from typing import Dict, List

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import Example, Image
from models import (
    ImagePromptSimilarityRequest,
    ImagePromptSimilarityResponse,
    SimilarityResult,
)


async def find_closest_images_by_example(
    db: AsyncSession,
    example_ids: List[int],
) -> Dict[int, SimilarityResult]:
    if not example_ids:
        return {}

    unique_example_ids = list(dict.fromkeys(example_ids))
    example_rows = (
        await db.execute(
            select(Example.id, Example.prompt_embedding)
            .where(Example.id.in_(unique_example_ids))
            .where(Example.prompt_embedding.isnot(None))
        )
    ).all()
    embeddings_by_example_id = {
        example_id: prompt_embedding
        for example_id, prompt_embedding in example_rows
    }

    matched_images: Dict[int, SimilarityResult] = {}
    for example_id in unique_example_ids:
        prompt_embedding = embeddings_by_example_id.get(example_id)
        if prompt_embedding is None:
            continue

        distance_expr = Image.prompt_embedding.cosine_distance(prompt_embedding).label("distance")
        row = (
            await db.execute(
                select(Image.id, distance_expr)
                .where(Image.prompt_embedding.isnot(None))
                .order_by(distance_expr.asc(), Image.id.asc())
                .limit(1)
            )
        ).first()
        if row is None:
            continue

        image_id, distance = row
        matched_images[example_id] = SimilarityResult(id=image_id, score=1.0 - float(distance))

    return matched_images


async def find_similar_by_image_prompt_embedding(
    db: AsyncSession,
    request: ImagePromptSimilarityRequest,
) -> ImagePromptSimilarityResponse:
    source_row = (
        await db.execute(
            select(Image.id, Image.prompt_embedding)
            .where(Image.id == request.image_id)
        )
    ).first()
    if source_row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image not found",
        )

    prompt_embedding = source_row.prompt_embedding
    if prompt_embedding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image prompt embedding not found",
        )

    image_distance_expr = Image.prompt_embedding.cosine_distance(prompt_embedding).label("distance")
    similar_image_ids = (
        await db.execute(
            select(Image.id)
            .where(Image.id != request.image_id)
            .where(Image.prompt_embedding.isnot(None))
            .order_by(image_distance_expr.asc(), Image.id.asc())
            .limit(request.limit)
        )
    ).scalars().all()

    example_distance_expr = Example.prompt_embedding.cosine_distance(prompt_embedding).label("distance")
    similar_example_ids = (
        await db.execute(
            select(Example.id)
            .where(Example.prompt_embedding.isnot(None))
            .order_by(example_distance_expr.asc(), Example.id.asc())
            .limit(request.limit)
        )
    ).scalars().all()

    return ImagePromptSimilarityResponse(
        similar_image_ids=similar_image_ids,
        similar_example_ids=similar_example_ids,
    )
