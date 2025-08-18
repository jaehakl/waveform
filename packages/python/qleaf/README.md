## QLeaf GUI 프레임워크 분석

### �� **프레임워크 개요**
QLeaf는 PySide6를 기반으로 한 반응형 GUI 프레임워크로, React와 유사한 컴포넌트 기반 아키텍처를 제공합니다. "Productive GUI Framework for Python"이라는 슬로건을 가지고 있으며, 데이터 중심의 GUI 애플리케이션 개발을 위한 도구입니다.

### ��️ **핵심 아키텍처**

#### 1. **AbstractComp 클래스**
```python
class AbstractComp(QWidget):
    clicked = Signal(object)
    doubleClicked = Signal(object)
    changed = Signal(object)
    submitted = Signal(object)
```
- 모든 컴포넌트의 기본 클래스
- 이벤트 기반 신호 시스템 (clicked, changed, submitted 등)
- Props 시스템을 통한 상태 관리
- 자동 레이아웃 관리

#### 2. **Props 시스템 (React의 Props와 유사)**
```python
class Prop(QObject):
    updated = Signal(object)
    
    def get(self, *keys):
        # 중첩된 데이터 접근 지원
        value_alias = self._value
        for key in keys:
            value_alias = value_alias[key]
        return value_alias
    
    def set(self, value, *keys):
        # 데이터 변경 시 자동으로 updated 시그널 발생
        self.updated.emit(self)
```
- 반응형 데이터 바인딩
- 데이터 변경 시 자동 UI 업데이트
- 중첩된 데이터 구조 지원

#### 3. **컴포넌트 계층 구조**
```
qleaf/
├── core/           # 핵심 프레임워크
│   ├── abstract_comp.py    # 기본 컴포넌트 클래스
│   ├── prop.py            # Props 시스템
│   └── main_window/       # 메인 윈도우 관리
├── comp/           # UI 컴포넌트들
│   ├── basic/     # 기본 컴포넌트 (버튼, 폼, 테이블 등)
│   ├── chart/     # 차트 컴포넌트 (matplotlib 기반)
│   └── advanced/  # 고급 컴포넌트
└── style/          # QSS 스타일시트
```

### �� **주요 컴포넌트들**

#### **기본 컴포넌트**
- `PushButtonComp`: 클릭 이벤트 처리
- `FormComp`: 동적 폼 생성 및 데이터 바인딩
- `TableEditorComp`: 데이터 테이블 편집
- `ListViewComp`: 리스트 뷰

#### **차트 컴포넌트**
- `LineGraphComp`: matplotlib 기반 라인 그래프
- `ImShowComp`: 이미지 표시
- `ScatterComp`: 산점도

### 🚀 **사용 예시 (FDTD 모듈)**

```python
# 컴포넌트 생성 시 Props와 이벤트 핸들러 연결
FormComp(self,
    onChange=lambda v: self.props["data"].set(v),
    props=self.props
)

# 상태 변경 시 자동 UI 업데이트
State().solver.updated.connect(lambda v: current_solver.setText(v.get()))
State().current_setup_data.updated.connect(lambda v: current_setup.setText(v.get()[1]))
```

### �� **React와의 유사점**

1. **컴포넌트 기반**: 재사용 가능한 UI 컴포넌트
2. **Props 시스템**: 부모에서 자식으로 데이터 전달
3. **상태 관리**: 중앙화된 상태와 반응형 업데이트
4. **이벤트 핸들링**: 콜백 기반 이벤트 처리
5. **자동 렌더링**: 데이터 변경 시 자동 UI 업데이트

### 🔄 **데이터 플로우**

```
Props 변경 → updated 시그널 발생 → 연결된 컴포넌트의 updateUI() 호출 → UI 자동 업데이트
```

### 📊 **Qutat Desktop Client에서의 활용**

- **모듈 시스템**: FDTD, Inverse Design, Model Builder 등
- **동적 UI**: 설정 데이터에 따른 자동 폼 생성
- **3D 뷰어**: OpenGL 기반 지오메트리 렌더링
- **차트 통합**: matplotlib과의 완벽한 통합
- **상태 동기화**: 여러 컴포넌트 간 실시간 데이터 동기화

### 🎨 **스타일링 시스템**

- QSS(Qt Style Sheets) 지원
- 테마별 스타일 관리
- 컴포넌트별 커스텀 스타일 적용

이 프레임워크는 PySide6의 복잡성을 추상화하고, React와 유사한 개발 경험을 제공하여 Python으로 데스크톱 GUI 애플리케이션을 효율적으로 개발할 수 있게 해줍니다. 특히 데이터 중심의 과학/엔지니어링 애플리케이션에 최적화되어 있습니다.