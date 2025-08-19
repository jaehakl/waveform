import json
import uuid
from datetime import datetime
from sqlalchemy import select
from db import AsyncSessionLocal, Setup, User, UserSession
from service import auth_service
import os
from pathlib import Path

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

async def delete_setup(setup_id: str, request) -> dict:
    """
    Setup을 삭제하는 함수
    
    Args:
        setup_id: 삭제할 Setup ID
        request: FastAPI request 객체
    
    Returns:
        dict: 삭제 결과
    """
    try:
        # 1. 사용자 인증 확인
        user = await get_current_user(request)
        if not user:
            return {"success": False, "message": "로그인이 필요합니다."}
        
        # 2. DB에서 setup 조회 및 권한 확인
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Setup).where(Setup.id == setup_id))
            setup = result.scalar_one_or_none()
            
            if not setup:
                return {"success": False, "message": "Setup을 찾을 수 없습니다."}
            
            # 3. 권한 확인 (본인만 삭제 가능)
            if setup.user_id != user.id:
                return {"success": False, "message": "삭제 권한이 없습니다."}
            
            # 4. Setup 삭제
            await session.delete(setup)
            await session.commit()
            
            return {
                "success": True,
                "message": "Setup이 성공적으로 삭제되었습니다."
            }
            
    except Exception as e:
        print(f"Setup 삭제 중 오류 발생: {str(e)}")
        return {"success": False, "message": "삭제 중 오류가 발생했습니다."}

async def update_setup(setup_id: str, data: dict, request) -> dict:
    """
    Setup 데이터를 업데이트하는 함수
    
    Args:
        setup_id: 업데이트할 Setup ID
        data: 업데이트할 데이터
        request: FastAPI request 객체
    
    Returns:
        dict: 업데이트 결과
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
        
        # 3. DB에서 setup 조회 및 권한 확인
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Setup).where(Setup.id == setup_id))
            setup = result.scalar_one_or_none()
            
            if not setup:
                return {"success": False, "message": "Setup을 찾을 수 없습니다."}
            
            # 4. 권한 확인 (본인만 업데이트 가능)
            if setup.user_id != user.id:
                return {"success": False, "message": "수정 권한이 없습니다."}
            
            # 5. 데이터 업데이트
            setup_data_json = json.dumps(data["setup_data"], ensure_ascii=False)
            
            setup.title = data["title"]
            setup.solver = data["solver"]
            setup.public = data.get("public", False)
            setup.description = data.get("description", "")
            setup.data = setup_data_json
            
            await session.commit()
            
            return {
                "success": True,
                "message": "Setup이 성공적으로 업데이트되었습니다.",
                "setup_id": setup_id
            }
            
    except Exception as e:
        print(f"Setup 업데이트 중 오류 발생: {str(e)}")
        return {"success": False, "message": "업데이트 중 오류가 발생했습니다."}

def get_input_variables_data():
    """
    input_variables JSON 파일들을 읽어서 클라이언트에 필요한 데이터를 반환합니다.
    """
    # input_variables 디렉토리 경로 (waveform-server의 input_variables 디렉토리)
    input_vars_dir = Path(__file__).parent.parent.parent / "input_variables"
    
    result = {}
    
    # 각 JSON 파일 처리
    json_files = [
        "structures.json", "components.json", "sources.json", 
        "detectors.json", "settings.json", "constants.json", 
        "materials.json", "material_sus.json"
    ]
    
    for filename in json_files:
        file_path = input_vars_dir / filename
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # 파일 타입에 따라 데이터 구조화
                if filename in ["structures.json", "components.json", "sources.json", "detectors.json", "materials.json", "material_sus.json"]:
                    # 스프레드시트 형태의 데이터
                    init_values = data.get("init_values", [])
                    initial_data = []
                    for item in init_values:
                        item_dict = {}
                        for i, colname in enumerate(data.get("columns", {}).keys()):
                            item_dict[colname] = item[i]
                        initial_data.append(item_dict)
                    result[filename.replace('.json', '')] = {
                        "columnNames": list(data.get("columns", {}).keys()),
                        "rowOptions": data.get("options", {}),
                        "initialData": initial_data
                    }
                elif filename in ["settings.json", "constants.json"]:
                    # 폼 형태의 데이터
                    keys = data.get("keys", {})
                    initial_data = {}
                    for key, config in keys.items():
                        initial_data[key] = config.get("default_value", "")
                    
                    result[filename.replace('.json', '')] = {
                        "keys": keys,
                        "initialData": initial_data
                    }
                    
            except Exception as e:
                print(f"Error reading {filename}: {e}")
                result[filename.replace('.json', '')] = {
                    "error": f"Failed to read {filename}: {str(e)}"
                }
        else:
            result[filename.replace('.json', '')] = {
                "error": f"File {filename} not found at {file_path}"
            }
    
    return result
