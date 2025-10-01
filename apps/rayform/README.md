# Rayform Studio - CGS Tree Editor

Rayform Studio는 CGS (Constructive Solid Geometry) tree 구조를 편집할 수 있는 데스크톱 애플리케이션입니다.

## 기능

### 1. CGS Tree 편집
- **TreeView 인터페이스**: Left dock에서 CGS tree 구조를 시각적으로 표시
- **노드 추가/제거**: Union, Intersect, Subtract 연산을 포함한 geometry 노드 관리
- **재귀적 구조**: Tree 내부에 하위 tree 구조 지원
- **실시간 편집**: 노드 선택 시 즉시 편집 가능

### 2. Geometry Node 편집
- **Role 설정**: Union, Intersect, Subtract 중 선택
- **Geometry Type**: Sphere, Cube, Cylinder, Plane 등 primitive geometry 지원
- **Position/Rotation**: 3D 좌표 및 회전값 설정 (파라미터 참조 지원)
- **Material**: 재료 ID 연결

### 3. Parameters 관리
- **파라미터 정의**: 숫자값 또는 문자열 파라미터 설정
- **Sweep 지원**: 범위 기반 파라미터 (예: %10~20)
- **실시간 편집**: 테이블 형태로 파라미터 관리

### 4. Materials 관리
- **재료 데이터베이스**: 파장별 굴절률(n, k) 데이터 저장
- **복소수 지원**: 복소 굴절률 데이터 관리
- **Nearest Neighbor**: 가장 가까운 파장값 사용

### 5. Workspace 관리
- **다중 Workspace**: Acquisition, Analysis, Automation 등 여러 workspace 지원
- **독립적 데이터**: 각 workspace별로 독립적인 CGS 데이터 관리
- **탭 인터페이스**: 쉬운 workspace 전환

### 6. 데이터 저장/로드
- **JSON 형식**: 표준 JSON 파일로 데이터 저장
- **예제 데이터**: 내장된 예제 데이터로 빠른 시작
- **파일 다이얼로그**: 직관적인 파일 선택 인터페이스

## 설치 방법

### 1. Python 환경 설정
```bash
# Python 3.8 이상 필요
python --version
```

### 2. 의존성 설치
```bash
# PySide6 설치
pip install PySide6

# 또는 poetry 사용 (권장)
poetry install
```

### 3. 애플리케이션 실행
```bash
# 직접 실행
python app/main.py

# 또는 poetry 사용
poetry run python app/main.py
```

## 사용 방법

### 1. 기본 사용법
1. 애플리케이션 실행
2. 원하는 workspace 탭 선택 (Acquisition, Analysis, Automation)
3. Left dock에서 CGS tree 구조 확인
4. 노드 선택 시 Bottom panel에서 편집 가능

### 2. CGS Tree 편집
1. **노드 추가**: "Add Node" 버튼 클릭
2. **노드 편집**: 노드 더블클릭 또는 선택 후 Bottom panel에서 편집
3. **노드 제거**: 노드 선택 후 "Remove Node" 버튼 클릭

### 3. 데이터 관리
1. **예제 데이터 로드**: File → Load Example Data
2. **데이터 저장**: File → Save CGS Data (Ctrl+S)
3. **데이터 로드**: File → Load CGS Data (Ctrl+O)

### 4. 파라미터 설정
1. Bottom panel에서 "Parameters" 탭 선택
2. "Add Parameter" 버튼으로 새 파라미터 추가
3. 파라미터명과 값 입력 (숫자 또는 문자열)
4. "Update Parameters" 버튼으로 저장

### 5. 재료 데이터 설정
1. Bottom panel에서 "Materials" 탭 선택
2. "Add Material" 버튼으로 새 재료 추가
3. 파장별 굴절률 데이터 입력
4. "Update Materials" 버튼으로 저장

## 데이터 구조

### CGS Tree 구조
```python
{
    "cgs_tree": [
        {
            "role": "union",
            "geometry_type": "sphere",
            "geometry": "sphere",  # 또는 하위 노드 리스트
            "pos": [0, 0, "$a"],
            "rotation": [0, 0, 0],
            "material": "SiO2"
        }
    ],
    "parameters": {
        "a": 10.0,
        "b": "%10~20"
    },
    "materials": {
        "SiO2": {
            "400e-9": {"n": 1.46, "k": 0.0},
            "500e-9": {"n": 1.45, "k": 0.0}
        }
    }
}
```

## 키보드 단축키

- `Ctrl+N`: 새 문서 생성
- `Ctrl+S`: CGS 데이터 저장
- `Ctrl+O`: CGS 데이터 로드
- `Ctrl+Q`: 애플리케이션 종료

## 개발자 정보

이 애플리케이션은 PySide6를 사용하여 개발되었으며, 모듈화된 구조로 설계되어 있습니다:

- `models.py`: 데이터 모델 정의
- `context.py`: 전역 상태 관리
- `state.py`: UI 상태 관리
- `ui/main_window.py`: 메인 윈도우
- `ui/cgs_tree_widget.py`: CGS tree 편집 위젯
- `ui/editor_panel.py`: 편집 패널

## 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
