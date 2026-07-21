from typing import List

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import JpWord
from models import GetListRequestBase, GetListResponseBase, JpWordBase, UpsertResponseBase
from user_auth.db import User  # noqa: F401
from user_auth.routes import get_db
from user_auth.utils.auth_wrapper import require_roles
from utils.crud import CrudSpec, delete_items, get_list_response, upsert_items
from utils.jp_words_from_text import format_lemma_with_pron


router = APIRouter(prefix="/jp_word", tags=["jp_word"])

JP_WORD_CRUD_SPEC = CrudSpec(
    model=JpWord,
    schema=JpWordBase,
    count_sort_fields={"examples": "examples"},
    read_only_fields=("created_at", "updated_at"),
)


@router.post("/list", response_model=GetListResponseBase)
async def api_get_jp_word_list(
    request: GetListRequestBase,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    del user
    return await get_list_response(db, request, JP_WORD_CRUD_SPEC)


@router.post("/list-with-prons", response_model=GetListResponseBase)
async def api_get_jp_word_list_with_prons(
    request: GetListRequestBase,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    response = await get_list_response(db, request, JP_WORD_CRUD_SPEC)
    return GetListResponseBase(
        total=response.total,
        items=[
            item.model_copy(
                update={
                    "lemma": format_lemma_with_pron(item.lemma_id, item.lemma),
                },
            )
            for item in response.items
        ],
    )


@router.post("/upsert", response_model=List[UpsertResponseBase])
async def api_upsert_jp_word_list(
    items: List[JpWordBase],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    return await upsert_items(db, items, JP_WORD_CRUD_SPEC)


@router.delete("/", status_code=200)
async def api_delete_jp_word_list(
    ids: List[int] = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    await delete_items(db, JP_WORD_CRUD_SPEC, ids)
    return None
