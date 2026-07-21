from typing import List

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db import UserJpWordSkill
from models import GetListRequestBase, GetListResponseBase, UpsertResponseBase, UserData, UserJpWordSkillBase
from user_auth.db import User  # noqa: F401
from user_auth.routes import get_db
from user_auth.utils.auth_wrapper import require_roles
from utils.crud import CrudSpec, get_list_response
from utils.owned_crud import delete_owned_items, upsert_owned_items


router = APIRouter(prefix="/user_jp_word_skill", tags=["user_jp_word_skill"])

USER_JP_WORD_SKILL_CRUD_SPEC = CrudSpec(
    model=UserJpWordSkill,
    schema=UserJpWordSkillBase,
    read_only_fields=("created_at", "updated_at"),
)


@router.post("/list", response_model=GetListResponseBase)
async def api_get_user_jp_word_skill_list(
    request: GetListRequestBase,
    db: AsyncSession = Depends(get_db),
    user: UserData = Depends(require_roles(["admin", "user"])),
):
    return await get_list_response(
        db,
        request,
        USER_JP_WORD_SKILL_CRUD_SPEC,
        base_clause=UserJpWordSkill.user_id == user.id,
    )


@router.post("/upsert", response_model=List[UpsertResponseBase])
async def api_upsert_user_jp_word_skill_list(
    items: List[UserJpWordSkillBase],
    db: AsyncSession = Depends(get_db),
    user: UserData = Depends(require_roles(["admin", "user"])),
):
    return await upsert_owned_items(db, items, USER_JP_WORD_SKILL_CRUD_SPEC, user.id, "User word skill")


@router.delete("/", status_code=200)
async def api_delete_user_jp_word_skill_list(
    ids: List[int] = Body(...),
    db: AsyncSession = Depends(get_db),
    user: UserData = Depends(require_roles(["admin", "user"])),
):
    await delete_owned_items(db, ids, USER_JP_WORD_SKILL_CRUD_SPEC, user.id, "User word skill")
    return None
