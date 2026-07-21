from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from models import TextAnalyzeJpRequest
from service.analysis_text.analysis_jp_text import analyze_jp_text
from user_auth.routes import get_db
from user_auth.utils.auth_wrapper import require_roles


router = APIRouter(prefix="/text", tags=["text"])


@router.post("/analyze/jp")
async def api_analyze_jp_text(
    payload: TextAnalyzeJpRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles(["*"])),
):
    return await analyze_jp_text(
        payload.text,
        skills=payload.skills,
        db=db,
        user_id=user.id if user else None,
    )
