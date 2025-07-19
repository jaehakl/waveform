import json
import uuid
from datetime import datetime
from sqlalchemy import select
from db import AsyncSessionLocal, Setup, User, UserSession
from service import auth_service

async def get_current_user(request) -> User:
    """
    현재 로그인한 사용자를 조회하는 함수
    """
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None

    async with AsyncSessionLocal() as session:
        # 세션 조회
        result = await session.execute(select(UserSession).where(UserSession.session_id == session_id))
        user_session = result.scalar_one_or_none()
        
        if not user_session or user_session.expires_at < datetime.now():
            return None

        # 사용자 조회
        result = await session.execute(select(User).where(User.id == user_session.user_id))
        user = result.scalar_one_or_none()
        
        return user

async def save_setup(data: dict, request) -> dict:
    """
    Setup 데이터를 저장하는 함수
    
    Args:
        data: 프론트엔드에서 전송한 setup 데이터
        request: FastAPI request 객체
    
    Returns:
        dict: 저장 결과
    """
    try:
        # 1. 사용자 인증 확인
        user = await get_current_user(request)
        if not user:
            return {"success": False, "message": "로그인이 필요합니다."}
        
        # 2. 필수 필드 검증
        required_fields = ["title", "solver", "setup_data"]
        for field in required_fields:
            if field not in data:
                return {"success": False, "message": f"필수 필드가 누락되었습니다: {field}"}
        
        # 3. 데이터 준비
        setup_id = str(uuid.uuid4())
        setup_data_json = json.dumps(data["setup_data"], ensure_ascii=False)
        
        # 4. DB에 저장
        async with AsyncSessionLocal() as session:
            new_setup = Setup(
                id=setup_id,
                user_id=user.id,
                title=data["title"],
                solver=data["solver"],
                public=data.get("public", False),
                description=data.get("description", ""),
                data=setup_data_json,
                created_at=datetime.now()
            )
            
            session.add(new_setup)
            await session.commit()
            
            return {
                "success": True, 
                "message": "Setup이 성공적으로 저장되었습니다.",
                "setup_id": setup_id
            }
            
    except Exception as e:
        print(f"Setup 저장 중 오류 발생: {str(e)}")
        return {"success": False, "message": "저장 중 오류가 발생했습니다."}

async def get_setup(setup_id: str, request) -> dict:
    """
    Setup 데이터를 조회하는 함수
    
    Args:
        setup_id: Setup ID
        request: FastAPI request 객체
    
    Returns:
        dict: Setup 데이터
    """
    try:
        # 1. 사용자 인증 확인
        user = await get_current_user(request)
        if not user:
            return {"success": False, "message": "로그인이 필요합니다."}
        
        # 2. DB에서 조회
        async with AsyncSessionLocal() as session:
            setup = await session.get(Setup, setup_id)
            
            if not setup:
                return {"success": False, "message": "Setup을 찾을 수 없습니다."}
            
            # 3. 권한 확인 (본인 또는 공개된 setup)
            if setup.user_id != user.id and not setup.public:
                return {"success": False, "message": "접근 권한이 없습니다."}
            
            # 4. 데이터 반환
            setup_data = json.loads(setup.data) if setup.data else {}
            
            return {
                "success": True,
                "setup": {
                    "id": setup.id,
                    "title": setup.title,
                    "solver": setup.solver,
                    "public": setup.public,
                    "description": setup.description,
                    "setup_data": setup_data,
                    "created_at": setup.created_at.isoformat()
                }
            }
            
    except Exception as e:
        print(f"Setup 조회 중 오류 발생: {str(e)}")
        return {"success": False, "message": "조회 중 오류가 발생했습니다."}

async def get_user_setups(request) -> dict:
    """
    현재 사용자의 Setup 목록을 조회하는 함수
    
    Args:
        request: FastAPI request 객체
    
    Returns:
        dict: Setup 목록
    """
    try:
        # 1. 사용자 인증 확인
        user = await get_current_user(request)
        if not user:
            return {"success": False, "message": "로그인이 필요합니다."}
        
        # 2. DB에서 사용자의 setup 목록 조회
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Setup).where(Setup.user_id == user.id).order_by(Setup.created_at.desc())
            )
            setups = result.scalars().all()
            
            # 3. 데이터 변환
            setup_list = []
            for setup in setups:
                setup_list.append({
                    "id": setup.id,
                    "title": setup.title,
                    "solver": setup.solver,
                    "public": setup.public,
                    "description": setup.description,
                    "created_at": setup.created_at.isoformat(),
                    "work_request": setup.work_request
                })
            
            return {
                "success": True,
                "setups": setup_list
            }
            
    except Exception as e:
        print(f"Setup 목록 조회 중 오류 발생: {str(e)}")
        return {"success": False, "message": "목록 조회 중 오류가 발생했습니다."}
