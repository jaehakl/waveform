# Waveform - 다중물리 시뮬레이션 플랫폼

Waveform은 빠르고 적은 비용으로 다중물리 시뮬레이션을 수행할 수 있는 플랫폼입니다. 컴퓨터 기반 공학 설계(CAD/CAE) 프로그램으로서 구조 설계와 해석(시뮬레이션) 기능을 제공합니다.

## 🏗️ 프로젝트 구조

이 레포지토리는 모노레포 구조로 구성되어 있으며, 다음과 같은 앱들과 패키지들을 포함합니다:

### 📱 애플리케이션 (apps/)

#### 새로운 시스템 (개발 중)
- **`waveform-server`** - FastAPI 기반 클라우드 서버
- **`waveform-web`** - React + Vite 기반 웹 클라이언트

#### 기존 시스템 (유지보수 중)
- **`qutat-cloud-django`** - Django 기반 클라우드 서버
- **`qutat-desktop-client`** - PySide6 기반 데스크톱 클라이언트
- **`qutat-web-client`** - Next.js 기반 웹 클라이언트

### 📦 공통 패키지 (packages/)

#### Python 패키지
- **`matform`** - 행렬 변환 및 수치 계산 라이브러리
- **`qleaf`** - Python GUI 프레임워크 (PySide6 기반)

#### JavaScript 패키지
- **`qutat-3d`** - 3D 시각화 컴포넌트 (Three.js 기반)

## 🚀 주요 기능

### 시뮬레이션 입력 데이터 편집
- **Space**: 시뮬레이션 공간의 크기, 해상도, 단위 길이와 시간 설정
- **Geometry**: 시뮬레이션 공간 내 물체 정의
- **Source**: 광원 및 소스 설정
- **Detector**: 스펙트럼 측정 영역 정의

### 시뮬레이션 엔진
- **FDTD (유한차분시간영역법)**: MEEP 라이브러리를 WSL 환경에서 서브프로세스로 구동
- **확장 가능한 아키텍처**: 서드파티 모듈 추가 지원

### 시각화 및 데이터 관리
- **3D 모델링**: 시뮬레이션 입력 데이터의 실시간 3D 시각화
- **결과 시각화**: 시뮬레이션 결과 데이터를 그래프로 표시
- **클라우드 저장**: 시뮬레이션 데이터의 클라우드 저장 및 공유
- **로컬 저장**: JSON/Excel 형식으로 로컬 저장 지원

## 🛠️ 설치 및 실행

### 사전 요구사항

```bash
# Node.js 패키지 매니저
npm install -g pnpm

# Python 패키지 매니저
pip install poetry

# 가상환경을 프로젝트 디렉토리에 생성 (선택사항)
poetry config virtualenvs.in-project true
```

### 새로운 시스템 실행 (권장)

```bash
# 전체 시스템 실행 (Windows)
./1_run.bat

# 또는 개별 실행
cd apps/waveform-server && poetry install && poetry run python -m app.main
cd apps/waveform-web && pnpm install && pnpm dev
```

### 기존 시스템 실행

```bash
# Django 서버
cd apps/qutat-cloud-django && poetry install && poetry run python manage.py runserver

# 데스크톱 클라이언트
cd apps/qutat-desktop-client && poetry install && poetry run python main_window.py

# Next.js 웹 클라이언트
cd apps/qutat-web-client && pnpm install && pnpm dev
```

## 🔧 개발 가이드

### 내부 패키지 사용

#### Python 패키지
```toml
# pyproject.toml
[tool.poetry.dependencies]
matform = { path = "../../packages/python/matform", develop = true }
qleaf = { path = "../../packages/python/qleaf", develop = true }
```

#### JavaScript 패키지
```json
// package.json
{
  "dependencies": {
    "qutat-3d": "workspace:*"
  }
}
```

### 모듈 개발
- 각 모듈은 `modules/` 폴더 내에 추가
- 서브프로세스 통신을 위한 API 템플릿 제공
- `lib/` 폴더의 공통 라이브러리 활용

## 📋 시스템 요구사항

### 지원 운영체제
- Windows 10/11 (WSL2 권장)
- macOS
- Linux (Ubuntu, Fedora, CentOS, RedHat)

### 필수 소프트웨어
- Python 3.10+
- Node.js 18+
- WSL2 (Windows에서 MEEP 시뮬레이션 실행 시)

## 🔄 마이그레이션 계획

현재 기존 시스템(`qutat-*`)에서 새로운 시스템(`waveform-*`)으로 점진적 마이그레이션을 진행 중입니다:

1. **Phase 1**: `waveform-server` (FastAPI) 개발 완료
2. **Phase 2**: `waveform-web` (React) 개발 완료  
3. **Phase 3**: `qutat-desktop-client` 대대적 리팩토링
4. **Phase 4**: 기존 시스템 단계적 폐기

## 📄 라이선스

본 프로젝트는 GPL3 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🤝 기여하기

1. 이슈를 통해 버그 리포트 또는 기능 요청
2. Fork 후 Pull Request 제출
3. 코드 스타일 가이드 준수
4. 테스트 코드 작성

## 📞 문의

프로젝트 관련 문의사항은 이슈를 통해 연락해 주세요.
