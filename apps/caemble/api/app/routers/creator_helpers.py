from typing import List

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    EmbeddingSimilarityRequest,
    ExampleSortSimilarListResponse,
    GetListRequestBase,
    SimilarityResult,
    SyncExampleJpWordsRequest,
    SyncExampleJpWordsResponse,
    AutoFlowSeedResponse,
)
from service.creator_helpers.example_jp_words_sync import sync_example_jp_words
from service.creator_helpers.example_similarity import (
    find_similar_examples_by_context_embedding,
    find_similar_examples_by_embedding,
)
from service.creator_helpers.example_sort_similar import (
    get_example_list_sort_similar_response,
)
from service.creator_helpers.image_similarity import (
    find_similar_images_by_prompt_embedding,
)
from service.creator_helpers.auto_flow_seed import (
    pop_auto_flow_seed,
)
from user_auth.db import User  # noqa: F401
from user_auth.routes import get_db
from user_auth.utils.auth_wrapper import require_roles


router = APIRouter(prefix="/creator-helpers", tags=["creator-helpers"])


@router.post("/example-list-sort-similar", response_model=ExampleSortSimilarListResponse)
async def api_get_example_list_sort_similar(
    request: GetListRequestBase,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    return await get_example_list_sort_similar_response(db, request)


@router.post("/sync-example-jp-words", response_model=SyncExampleJpWordsResponse)
async def api_sync_example_jp_words(
    request: SyncExampleJpWordsRequest | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    if request is None:
        return await sync_example_jp_words(db)

    return await sync_example_jp_words(
        db,
        start_id=request.start_id,
        end_id=request.end_id,
        limit=request.limit,
    )


@router.post("/auto-flow-seed", response_model=AutoFlowSeedResponse)
async def api_pop_auto_flow_seed(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    return await pop_auto_flow_seed(db)


@router.post("/similar-examples-by-embedding", response_model=List[SimilarityResult])
async def api_find_similar_examples_by_embedding(
    request: EmbeddingSimilarityRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    del user
    return await find_similar_examples_by_embedding(db, request)


@router.post("/similar-examples-by-context-embedding", response_model=List[SimilarityResult])
async def api_find_similar_examples_by_context_embedding(
    request: EmbeddingSimilarityRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    del user
    return await find_similar_examples_by_context_embedding(db, request)


@router.post("/similar-images-by-prompt-embedding", response_model=List[SimilarityResult])
async def api_find_similar_images_by_prompt_embedding(
    request: EmbeddingSimilarityRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    del user
    return await find_similar_images_by_prompt_embedding(db, request)
