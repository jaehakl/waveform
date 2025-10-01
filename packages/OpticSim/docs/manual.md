LocalOpticSim.jl 상세 사용 매뉴얼 📖
이 문서는 LocalOpticSim.jl 라이브러리의 핵심 개념과 사용법을 안내하는 매뉴얼입니다. 이 라이브러리는 고성능 광학 시스템 시뮬레이션을 위한 강력한 도구입니다.

## 1. 핵심 개념
LocalOpticSim을 사용하기 위해 알아야 할 몇 가지 핵심 개념이 있습니다.

### 🧊 표면과 프리미티브 (Surfaces & Primitives)
모든 광학 부품은 

Surface 라는 기본 단위로 구성됩니다. 

Surface는 광선과 상호작용할 수 있는 모든 기하학적 객체를 의미합니다.


ParametricSurface: UV 좌표계를 사용하여 수학적으로 정의되는 표면입니다. 구(Sphere), 평면(Plane), 비구면(Aspheric) 등이 여기에 속하며, CSG 연산의 기본 단위가 됩니다.


AcceleratedParametricSurface: 저니커(Zernike), 체비쇼프(Chebyshev)와 같이 해석적으로 교점을 찾기 어려운 복잡한 ParametricSurface를 위한 래퍼(wrapper)입니다. 표면을 내부적으로 삼각형 메쉬로 만들어 교점 계산을 가속화하고, 최종적으로 뉴턴-랩슨 방법을 사용해 정밀한 해를 찾습니다.



프리미티브(Primitive): CSG 객체를 포함하여 광선 추적에서 사용되는 가장 기본적인 요소를 의미합니다.

### 🛠️ CSG (Constructive Solid Geometry)
CSG는 간단한 기본 도형들을 

결합(Union, ∪), 교차(Intersection, ∩), **제거(Difference, -)**하여 복잡한 3차원 형상을 만드는 모델링 기법입니다.



leaf() 함수: ParametricSurface를 CSG 연산이 가능한 CSGGenerator로 변환합니다.

예시: 두 개의 구와 하나의 원통을 교차시켜 양면이 볼록한 렌즈를 만들 수 있습니다.

Julia

# 렌즈의 앞면, 뒷면, 그리고 측면(배럴) 정의
front_surface = Sphere(front_radius)
back_surface = Sphere(back_radius)
barrel = Cylinder(semi_diameter, thickness)

# CSG 연산으로 렌즈 생성
lens_body = leaf(front_surface) ∩ leaf(back_surface) ∩ leaf(barrel)
### ✨ 광학 인터페이스 (Optical Interface)
표면이 빛과 어떻게 상호작용할지를 정의합니다. 모든 표면에는 인터페이스가 할당됩니다.


FresnelInterface: 스넬의 법칙과 프레넬 방정식에 따라 빛의 굴절과 반사를 처리하는 가장 일반적인 인터페이스입니다. 재질, 반사율, 투과율 등을 지정할 수 있습니다.



NullInterface: 빛과 전혀 상호작용하지 않으며, 주로 CSG 객체를 구성할 때 절단면 등으로 사용됩니다.


특수 인터페이스: ThinGratingInterface (회절 격자) , 

HologramInterface (홀로그램) , 

ParaxialInterface (이상적인 박막 렌즈)  등이 있습니다.

### 🔦 광선 및 광학계

OpticalRay: 기하학적 정보(위치, 방향) 외에 파워(power), 파장(wavelength), 광학 경로 길이(optical path length) 등의 물리적 속성을 갖는 광선입니다.


LensAssembly: 여러 개의 렌즈, 스탑 등 광학 부품들을 하나의 그룹으로 묶은 집합체입니다.


CSGOpticalSystem: LensAssembly와 검출기(detector)를 결합하여 완전한 광학 시스템을 구성합니다. 시스템의 온도와 압력도 설정할 수 있습니다.

## 2. 광학 시스템 제작하기 (단계별 가이드)
### 단계 1: 표면 정의하기 (렌즈, 스탑 등)
먼저 광학 시스템을 구성할 개별 부품들을 정의합니다.


기본 렌즈: SphericalLens, ConicLens, AsphericLens와 같은 헬퍼 함수를 사용하여 쉽게 렌즈를 생성할 수 있습니다.



Julia

using LocalOpticSim.AGFFileReader # 재질 라이브러리

# 구면 렌즈 생성
biconvex_lens = SphericalLens(
    SCHOTT.N_BK7,      # 재질
    0.0,               # 앞면 정점 Z위치
    50.0,              # 앞면 곡률 반경
    -50.0,             # 뒷면 곡률 반경
    10.0,              # 두께
    25.0               # 반구경 (Semi-diameter)
)() # CSGTree 객체로 즉시 생성

복잡한 표면: ZernikeSurface나 QTypeSurface를 사용하여 비대칭 또는 자유 곡면을 정의할 수 있습니다. 이런 표면은 


AcceleratedParametricSurface로 감싸서 사용해야 합니다.



스탑과 조리개: CircularAperture나 Annulus (원환)를 사용하여 시스템 내 빛을 차단하는 부품을 만듭니다.


Julia

# Z=15 위치에 직경 10mm의 조리개 생성
stop = CircularAperture(5.0, SVector(0.0, 0.0, 1.0), SVector(0.0, 0.0, 15.0))
### 단계 2: 렌즈 어셈블리 생성하기
정의된 광학 부품들을 

LensAssembly로 묶어 하나의 광학계 그룹을 만듭니다.


Julia

assembly = LensAssembly(biconvex_lens, stop)
### 단계 3: 검출기 정의하기
광선이 최종적으로 도달할 검출기를 정의합니다. 검출기는 UV 좌표를 계산할 수 있는 

Surface여야 하며, 주로 Rectangle, Ellipse, SphericalCap이 사용됩니다.




Julia

# Z=50 위치에 20x20 크기의 사각형 검출기 생성
detector = Rectangle(
    10.0, 10.0,
    SVector(0.0, 0.0, 1.0),
    SVector(0.0, 0.0, 50.0),
    interface=opaqueinterface() # 빛을 흡수하는 인터페이스
)
### 단계 4: 광학 시스템 완성하기
LensAssembly와 detector를 CSGOpticalSystem에 전달하여 최종 광학계를 완성합니다. 검출기의 해상도와 픽셀 데이터 타입도 이때 지정합니다.

Julia

system = CSGOpticalSystem(
    assembly,
    detector,
    1024, 1024, # 검출기 해상도 (가로 x 세로)
    Float32     # 픽셀 데이터 타입
)
## 3. 광선 추적 실행하기
### 단계 1: 광원 정의하기
시뮬레이션에 사용할 광선을 생성하는 OpticalRayGenerator를 정의합니다. Emitters 모듈의 헬퍼 함수를 사용하면 편리합니다.


점 광원: 특정 지점에서 원뿔 형태로 광선을 방출합니다.

Julia

using Unitful.DefaultSymbols # nm, mm 등 단위 사용

# 원점(-50)에서 Z축 방향으로 15도 원뿔 내로 10만개의 광선 방출
point_source = pointemitter(SVector(-10.0, 0.0, -50.0), 15°, λ=550nm, numrays=100000)

평행 광원: 특정 영역에서 평행한 광선을 방출합니다.

Julia

# Z=-50 평면의 20x20 영역에서 Z축 방향으로 평행 광선 방출
collimated_source = collimatedemitter(SVector(0.0, 0.0, -50.0), 10.0, λ=550nm, numrays=10000)
### 단계 2: 추적 실행하기
trace 또는 traceMT 함수를 사용하여 광선 추적을 실행합니다.


trace: 단일 스레드에서 광선을 추적합니다.


traceMT: 멀티 스레딩을 사용하여 추적 속도를 극대화합니다.

Julia

# 멀티 스레드로 광선 추적 실행
detector_image = traceMT(system, point_source, printprog=true)
### 단계 3: 결과 확인 및 분석
추적이 완료되면 검출기에 기록된 이미지를 확인하거나, 광선의 경로 데이터를 분석할 수 있습니다.


이미지 접근: detectorimage(system) 함수로 결과 이미지에 접근할 수 있습니다. 이 이미지는 효율적인 희소 배열인 

HierarchicalImage 타입입니다.

Julia

# 검출기 이미지 가져오기
img = detectorimage(system)

# 새 시뮬레이션을 위해 검출기 초기화
resetdetector!(system) [cite: 1262]

광선 경로 추적: tracehits 또는 tracehitsMT 함수를 사용하면 검출기에 도달한 모든 광선의 상세한 경로 정보(LensTrace 객체 리스트)를 얻을 수 있습니다. 이는 광학 경로 길이, 각 표면에서의 교점 정보 등을 분석하는 데 유용합니다.


## 4. 고급 기능 및 유틸리티

인간 눈 모델: Data 모듈에 포함된 ArizonaEye() 및 

ModelEye()  함수를 통해 정교하게 사전 정의된 인간 눈 모델을 시스템에 추가할 수 있습니다.


시각화: makemesh(object) 함수를 사용하면 CSGTree나 ParametricSurface로부터 TriangleMesh를 생성하여 외부 3D 뷰어에서 시각화할 수 있습니다.

주요 상수:


RAY_OFFSET: 광선이 표면과 교차한 직후 동일한 표면에 다시 교차하는 것을 방지하기 위한 작은 전진 값입니다.

POWER_THRESHOLD: 광선의 파워가 이 값보다 낮아지면 추적을 중단하여 불필요한 계산을 줄입니다.