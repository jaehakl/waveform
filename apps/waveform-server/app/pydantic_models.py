from pydantic import BaseModel
from typing import Optional

class LoginRequest(BaseModel):
    name: str
    password: str

class SetupData(BaseModel):
    # setup 데이터에 필요한 필드들을 여기에 정의
    # 예시로 몇 개만 정의
    name: Optional[str] = None
    description: Optional[str] = None
    data: Optional[dict] = None
