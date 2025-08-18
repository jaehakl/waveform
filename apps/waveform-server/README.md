# Waveform Server

Waveform Cloud Computing Server는 물리 시뮬레이션을 위한 클라우드 컴퓨팅 서버입니다. FastAPI 기반으로 구축되어 있으며, 사용자 인증, 시뮬레이션 설정 관리, 그리고 다양한 물리 시뮬레이션 기능을 제공합니다.

## 🚀 주요 기능

- **사용자 인증 시스템**: 로그인/로그아웃 및 세션 관리
- **시뮬레이션 설정 관리**: CRUD 작업을 통한 시뮬레이션 설정 저장 및 관리
- **입력 변수 관리**: 다양한 물리 시뮬레이션을 위한 설정 파일 제공
- **비동기 데이터베이스**: SQLAlchemy를 사용한 비동기 데이터베이스 연동
- **CORS 지원**: 웹 클라이언트와의 원활한 통신

## 📋 요구사항

- Python 3.10 이상
- Poetry (의존성 관리)

## 🛠️ 설치 및 실행

### 1. 의존성 설치

```bash
# Poetry를 사용한 의존성 설치
poetry install

# 또는 스크립트 사용
scripts/install.bat
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 환경 변수를 설정하세요:

```env
# 기본 관리자 계정 설정
WAVEFORM_DEFAULT_ADMIN_NAME=admin
WAVEFORM_DEFAULT_ADMIN_PW=qutat

# 데이터베이스 URL (선택사항)
# 기본값: SQLite (waveform.db)
WAVEFORM_SERVER_DB_URL=sqlite+aiosqlite:///waveform.db

# PostgreSQL 사용 시 예시
# WAVEFORM_SERVER_DB_URL=postgresql+asyncpg://user:password@localhost/waveform
```

### 3. 서버 실행

```bash
# 직접 실행
cd app
poetry run uvicorn main:app --reload --host 0.0.0.0

# 또는 스크립트 사용
run.bat
```

서버는 기본적으로 `http://localhost:8000`에서 실행됩니다.

## 📁 프로젝트 구조

```
waveform-server/
├── app/
│   ├── main.py              # FastAPI 애플리케이션 메인 파일
│   ├── initserver.py        # 서버 초기화 및 설정
│   ├── db.py                # 데이터베이스 모델 및 설정
│   └── service/
│       ├── auth_service.py  # 인증 관련 서비스
│       └── setup_service.py # 시뮬레이션 설정 관리 서비스
├── input_variables/         # 시뮬레이션 입력 변수 JSON 파일들
│   ├── components.json
│   ├── constants.json
│   ├── detectors.json
│   ├── materials.json
│   ├── material_sus.json
│   ├── settings.json
│   ├── sources.json
│   └── structures.json
├── scripts/                 # 실행 스크립트
├── pyproject.toml          # Poetry 설정 파일
└── README.md
```

## 🔌 API 엔드포인트

### 인증 관련

- `POST /auth/login/` - 사용자 로그인
- `GET /auth/check-session/` - 세션 확인
- `GET /auth/logout/` - 로그아웃

### 시뮬레이션 설정 관리

- `POST /setup/save/` - 새로운 설정 저장
- `GET /setup/{setup_id}` - 특정 설정 조회
- `GET /setup/list/` - 사용자의 모든 설정 목록 조회
- `PUT /setup/{setup_id}` - 설정 업데이트
- `DELETE /setup/{setup_id}` - 설정 삭제

### 입력 변수

- `GET /input-variables/` - 시뮬레이션 입력 변수 데이터 조회

## 🗄️ 데이터베이스 모델

### User
- 사용자 정보 및 인증 데이터
- 세션, 설정, 엔티티, 출력, 프로세스와의 관계

### UserSession
- 사용자 세션 관리
- 세션 ID 및 만료 시간

### Setup
- 시뮬레이션 설정 정보
- 제목, 솔버, 공개 여부, 작업 요청 등

### Entity
- 시뮬레이션 엔티티 정보
- 설정과 연결된 개별 시뮬레이션 객체

### Output
- 시뮬레이션 결과 출력
- 파일 URL 및 결과 데이터

### Process
- 시뮬레이션 프로세스 정보
- 실행 상태 및 진행 상황

## 🔧 개발 환경 설정

### Poetry 사용

```bash
# 가상환경 활성화
poetry shell

# 의존성 추가
poetry add package-name

# 개발 의존성 추가
poetry add --group dev package-name
```

### 데이터베이스 마이그레이션

SQLAlchemy의 `create_all()`을 사용하여 데이터베이스 스키마를 자동으로 생성합니다. 서버 시작 시 자동으로 실행됩니다.

## 🌐 CORS 설정

기본적으로 다음 origin들이 허용됩니다:
- `http://localhost`
- `http://localhost:5173`

필요에 따라 `initserver.py`에서 CORS 설정을 수정할 수 있습니다.

## 📝 라이센스

이 프로젝트는 MIT 라이센스 하에 배포됩니다.

## 👥 기여

버그 리포트, 기능 요청, 또는 풀 리퀘스트를 환영합니다.

## 📞 문의

프로젝트 관련 문의사항이 있으시면 이슈를 생성해 주세요.
