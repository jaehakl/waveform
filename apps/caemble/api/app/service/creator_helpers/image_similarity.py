from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from db import Image
from models import EmbeddingSimilarityRequest, SimilarityResult
from utils.embedding_similarity import find_similar_ids_by_embedding_column


async def find_similar_images_by_prompt_embedding(
    db: AsyncSession,
    request: EmbeddingSimilarityRequest,
) -> List[SimilarityResult]:
    return await find_similar_ids_by_embedding_column(
        db,
        request,
        Image,
        Image.prompt_embedding,
    )
