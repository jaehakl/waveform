from typing import List

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import UserText
from models import GetListRequestBase, GetListResponseBase, UpsertResponseBase, UserData, UserTextBase
from user_auth.db import User  # noqa: F401
from user_auth.routes import get_db
from user_auth.utils.auth_wrapper import require_roles
from utils.crud import CrudSpec, get_list_response
from utils.owned_crud import delete_owned_items, upsert_owned_items


router = APIRouter(prefix="/user_text", tags=["user_text"])

USER_TEXT_CRUD_SPEC = CrudSpec(
    model=UserText,
    schema=UserTextBase,
    read_only_fields=("created_at", "updated_at"),
)


@router.post("/list", response_model=GetListResponseBase)
async def api_get_user_text_list(
    request: GetListRequestBase,
    db: AsyncSession = Depends(get_db),
    user: UserData = Depends(require_roles(["admin", "user"])),
):
    return await get_list_response(
        db,
        request,
        USER_TEXT_CRUD_SPEC,
        base_clause=UserText.user_id == user.id,
    )


@router.post("/upsert", response_model=List[UpsertResponseBase])
async def api_upsert_user_text_list(
    items: List[UserTextBase],
    db: AsyncSession = Depends(get_db),
    user: UserData = Depends(require_roles(["admin", "user"])),
):
    return await upsert_owned_items(db, items, USER_TEXT_CRUD_SPEC, user.id, "User text")


@router.delete("/", status_code=200)
async def api_delete_user_text_list(
    ids: List[int] = Body(...),
    db: AsyncSession = Depends(get_db),
    user: UserData = Depends(require_roles(["admin", "user"])),
):
    await delete_owned_items(db, ids, USER_TEXT_CRUD_SPEC, user.id, "User text")
    return None
