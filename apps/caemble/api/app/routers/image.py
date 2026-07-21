from typing import Dict, List

from fastapi import APIRouter, Body, Depends, Request as FastAPIRequest
from sqlalchemy.ext.asyncio import AsyncSession

from db import Image
from models import (
    GetListRequestBase,
    GetListResponseBase,
    ImageBase,
    ImagePromptSimilarityRequest,
    ImagePromptSimilarityResponse,
    ImageUpsert,
    SimilarityResult,
    UpsertResponseBase,
)
from service.image import (
    find_closest_images_by_example,
    find_similar_by_image_prompt_embedding,
)
from user_auth.db import User  # noqa: F401
from user_auth.routes import get_db
from user_auth.utils.auth_wrapper import require_roles
from utils.crud import CrudSpec, delete_items, get_list_response, upsert_items
from utils.upsert_form import preserve_existing_upload_fields, upsert_form_item


router = APIRouter(prefix="/image", tags=["image"])

IMAGE_CRUD_SPEC = CrudSpec(
    model=Image,
    schema=ImageBase,
    presigned_fields=("object_key",),
    read_only_fields=("created_at", "updated_at"),
)

IMAGE_UPSERT_CRUD_SPEC = CrudSpec(
    model=Image,
    schema=ImageUpsert,
    presigned_fields=("object_key",),
    read_only_fields=("created_at", "updated_at"),
    preserve_unset_fields=("prompt_embedding",),
)


@router.post("/list", response_model=GetListResponseBase)
async def api_get_image_list(
    request: GetListRequestBase,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    del user
    return await get_list_response(db, request, IMAGE_CRUD_SPEC)


@router.post("/closest-by-example", response_model=Dict[int, SimilarityResult])
async def api_find_closest_images_by_example(
    example_ids: List[int] = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    del user
    return await find_closest_images_by_example(db, example_ids)


@router.post("/similar-by-image", response_model=ImagePromptSimilarityResponse)
async def api_find_similar_by_image_prompt_embedding(
    request: ImagePromptSimilarityRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    del user
    return await find_similar_by_image_prompt_embedding(db, request)


@router.post("/upsert", response_model=List[UpsertResponseBase])
async def api_upsert_image_list(
    items: List[ImageUpsert],
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    sanitized_items = await preserve_existing_upload_fields(db, items, IMAGE_UPSERT_CRUD_SPEC, ("object_key",))
    return await upsert_items(db, sanitized_items, IMAGE_UPSERT_CRUD_SPEC)


@router.post("/upsert-form", response_model=UpsertResponseBase)
async def api_upsert_image_form(
    request: FastAPIRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    return await upsert_form_item(request, db, IMAGE_UPSERT_CRUD_SPEC, {"object_key": "image"})


@router.delete("/", status_code=200)
async def api_delete_image_list(
    ids: List[int] = Body(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["admin"])),
):
    del user
    await delete_items(db, IMAGE_CRUD_SPEC, ids, ("object_key",))
    return None
