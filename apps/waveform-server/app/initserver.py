from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import Base, engine, AsyncSessionLocal, User
from sqlalchemy import select
import os
from service.auth_service import hash_password

def server():
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        # When service starts.
        await start()
    
        yield
        
        # When service is stopped.
        shutdown()

    app = FastAPI(lifespan=lifespan)

    origins = [
        "http://localhost",
        "http://localhost:5173"
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    #app.mount("/static", StaticFiles(directory="../static"), name="static")

    async def start():
        app.state.progress = 0
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # User 테이블에 admin 계정이 없으면 추가
        async with AsyncSessionLocal() as session:
            admin_name = os.getenv("WAVEFORM_DEFAULT_ADMIN_NAME")
            admin_pw = os.getenv("WAVEFORM_DEFAULT_ADMIN_PW")
            result = await session.execute(select(User).where(User.name == admin_name))
            admin = result.scalar_one_or_none()
            if not admin:
                user = User(
                    name=admin_name,
                    password=hash_password(admin_pw),  # 해시된 비밀번호 저장
                    grade=0,
                    is_active=True
                )
                session.add(user)
                await session.commit()

    def shutdown():
        print("service is stopped.")

    return app
