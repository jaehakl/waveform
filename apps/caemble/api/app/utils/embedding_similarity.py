from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import EmbeddingSimilarityRequest, SimilarityResult


async def find_similar_ids_by_embedding_column(
    db: AsyncSession,
    request: EmbeddingSimilarityRequest,
    model,
    embedding_column,
) -> List[SimilarityResult]:
    distance_expr = embedding_column.cosine_distance(request.embedding).label("distance")
    rows = (
        await db.execute(
            select(model.id, distance_expr)
            .where(embedding_column.isnot(None))
            .order_by(distance_expr.asc(), model.id.asc())
            .limit(request.top_n)
        )
    ).all()

    return [
        SimilarityResult(id=entity_id, score=1.0 - float(distance))
        for entity_id, distance in rows
    ]
