

### **공유 패키지 관리를 위한 유의사항 및 권장사항**
 
- [ ] 패키지의 책임과 경계가 명확한가?
- [ ] `pyproject.toml`을 사용하여 의존성을 관리하는가?
- [ ] 패키지의 의존성은 추상적(`>=`), 앱의 의존성은 구체적(`==`)인가?
- [ ] `pytest`를 이용한 테스트 코드가 존재하는가?
- [ ] GitHub Actions 등 CI를 통해 테스트가 자동화되어 있는가?
- [ ] 유의적 버전(SemVer) 규칙에 따라 버전을 관리하는가?
- [ ] 모든 공개 함수/클래스에 Docstring이 작성되어 있는가?
- [ ] `README.md`에 설치 및 사용법이 잘 설명되어 있는가?



#### **pyproject.toml 및 Poetry 를 이용한 의존성 및 가상환경 관리**

- **개발 환경 설정 시 (dev 그룹 포함):** `poetry install`
- **프로덕션 배포 시 (dev 그룹 제외):** `poetry install --no-dev`

터미널에서 다음 설정 명령어를 **한 번만** 실행해두면, 그 이후부터 생성되는 모든 Poetry 가상환경은 프로젝트 폴더 내에 만들어집니다.

```
poetry config virtualenvs.in-project true
```


### 패스워드 등 민감 정보 관리

#### **1: `.gitignore`를 이용한 원천 차단**

#### **2: `.env.example` 템플릿 파일 제공**

#### **3:  코드에서 로드

```
import os
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
API_KEY = os.getenv("API_KEY")
```



### **패키지 배포 준비**

**`packages/my-algorithm/pyproject.toml`

!!! 패키지 파일에 수정이 있을 때 마다 버전 갱신


### **CI/CD를 통한 배포 자동화**

 !!! Github Repository Secrets 에 PyPI API Key 등록

**`.github/workflows/dynamic-publish.yml` 

`v0.1.1` 같은 태그 달아 Push 하면, PyPI 배포가 자동으로 완료


