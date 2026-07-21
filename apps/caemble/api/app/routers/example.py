from typing import List

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    ExampleContextPlayRequest,
    ExampleContextPlayResponse,
    ExampleListRequest,
    ExampleUpsert,
    GetListResponseBase,
    UpsertResponseBase,
)
from service.context_play import ContextPlayService
from service.example import (
    delete_example_list,
    get_example_list,
    upsert_example_list,
)
from user_auth.db import User  # noqa: F401
from user_auth.routes import get_db
from user_auth.utils.auth_wrapper import require_roles


router = APIRouter(prefix="/example", tags=["example"])


@router.post("/list", response_model=GetListResponseBase)
async def api_get_example_list(
    request: ExampleListRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    del user
    return await get_example_list(db, request)


@router.post("/context-play", response_model=ExampleContextPlayResponse)
async def api_get_example_context_play(
    request: ExampleContextPlayRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    return await ContextPlayService(db, user).get_context_play(request)


@router.post("/upsert", response_model=List[UpsertResponseBase])
async def api_upsert_example_list(
    items: List[ExampleUpsert],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    return await upsert_example_list(db, items)


@router.delete("/", status_code=200)
async def api_delete_example_list(
    ids: List[int] = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    return await delete_example_list(db, ids)
