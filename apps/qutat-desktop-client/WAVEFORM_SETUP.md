# Waveform Server 연동 설정

이 문서는 qutat-desktop-client에서 waveform-server와의 연동 설정 방법을 설명합니다.

## 환경 변수 설정

`.env` 파일을 생성하고 다음 환경 변수들을 설정하세요:

```env
# Waveform 서버 설정
WAVEFORM_HOST=http://localhost:8000

# 사용자 인증 정보
QUTAT_USERNAME=your_username
QUTAT_PASSWORD=your_password

# 기본 디렉토리
QUTAT_BASE_DIR=.
```

## 주요 변경사항

### 1. 인증 시스템
- 기존 레거시 서버 대신 waveform-server 전용 인증 시스템 사용
- 쿠키 기반 세션 관리
- 자동 로그인 및 세션 유지

### 2. API 통신
- `WaveformServerApi` 클래스를 통한 API 통신
- 모든 요청에 자동으로 인증 쿠키 포함

### 3. 사용법

```python
# 로그인
from api.auth import login, check_session
user_info = {"name": "username", "password": "password"}
resp = login(user_info)

# 세션 확인
session_info = check_session()

# API 사용
from api.waveform_api import WaveformServerApi
setups = WaveformServerApi.get_setup_list()
```

## 파일 구조

```
app/
├── api/
│   ├── auth.py              # 인증 관련 함수들
│   └── waveform_api.py      # Waveform 서버 API 클래스
├── core/network/
│   └── waveform_api.py      # API 엔드포인트 정의
└── main_window.py           # 메인 윈도우 (로그인 로직 포함)
```

## 세션 관리

- 로그인 성공 시 쿠키가 `waveform_cookies.json` 파일에 저장됨
- 모든 API 요청에 자동으로 쿠키가 포함됨
- 세션 만료 시 자동으로 로그아웃 처리
