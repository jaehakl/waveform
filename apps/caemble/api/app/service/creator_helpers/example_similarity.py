from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from db import Example
from models import EmbeddingSimilarityRequest, SimilarityResult
from utils.embedding_similarity import find_similar_ids_by_embedding_column


async def find_similar_examples_by_embedding(
    db: AsyncSession,
    request: EmbeddingSimilarityRequest,
) -> List[SimilarityResult]:
    return await find_similar_ids_by_embedding_column(
        db,
        request,
        Example,
        Example.text_embedding,
    )


async def find_similar_examples_by_context_embedding(
    db: AsyncSession,
    request: EmbeddingSimilarityRequest,
) -> List[SimilarityResult]:
    return await find_similar_ids_by_embedding_column(
        db,
        request,
        Example,
        Example.context_embedding,
    )
