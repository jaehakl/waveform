import uuid
import bcrypt
from datetime import datetime, timedelta

from sqlalchemy import select, delete
from db import User, UserSession, AsyncSessionLocal
from fastapi import HTTPException, status, Response, Request

def hash_password(raw_password: str) -> str:
    return bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def check_password_hashes(raw_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(raw_password.encode('utf-8'), hashed_password.encode('utf-8'))

async def authenticate_user(name: str, password: str, response: Response):
    async with AsyncSessionLocal() as session:
        # 사용자 조회
        result = await session.execute(select(User).where(User.name == name))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 비밀번호 검증
        if not check_password_hashes(password, user.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
                
        # 세션 생성
        session_id = uuid.uuid4().hex
        expires_at = datetime.now() + timedelta(minutes=30)

        new_session = UserSession(
            user_id=user.id,
            session_id=session_id,
            expires_at=expires_at
        )
        session.add(new_session)
        await session.commit()        

        # 만료된 세션 삭제
        await session.execute(
            delete(UserSession).where(UserSession.expires_at < datetime.now())
        )

        # 쿠키에 session_id 설정
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,  # XSS 공격 방지
            secure=False,   # 개발환경에서는 False, 프로덕션에서는 True
            samesite="lax", # CSRF 공격 방지
            max_age=1800    # 30분 (초 단위)
        )
        return session_id


async def check_session(request: Request):    
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(UserSession).where(UserSession.session_id == session_id))
        user_session = result.scalar_one_or_none()
        if not user_session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated"
            )

        result = await session.execute(select(User).where(User.id == user_session.user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated"
            )

        if user_session.expires_at < datetime.now():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired"
            )            

        return {
            "message": "Session is valid",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "grade": user.grade
            }
        }
    session.close()


async def logout(request: Request, response: Response):
    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No session to logout"
        )

    async with AsyncSessionLocal() as session:
        # 세션 조회
        result = await session.execute(select(UserSession).where(UserSession.session_id == session_id))
        user_session = result.scalar_one_or_none()
        
        if user_session:
            # 세션 삭제
            await session.delete(user_session)
            await session.commit()

    # 쿠키 삭제
    response.delete_cookie(key="session_id")

    return {"message": "Logout successful"}
