# CAD element 추가하기

각 CAD 태그는 역할에 따라 `primitives` 또는 `operations` 아래의 자체 디렉터리에서 공개 형태와 실행 코드를 분리합니다. `definition.ts`는 props 타입과 `tag`, `category`, `syntax`, `summary` manifest만 내보내며 JSCAD를 import하지 않습니다. `runtime.ts`는 입력 검증과 Geometry 생성을 담당합니다.

- `primitives`: 자식 Geometry 없이 stand-alone solid를 생성합니다.
- `operations`: 하나 이상의 자식 Geometry를 평가해 파생 Geometry를 생성합니다.

새 element를 추가할 때는 다음 순서를 따릅니다.

1. 역할에 맞는 `primitives/_template` 또는 `operations/_template`을 복사해 `elements/<group>/<tag>/definition.ts`와 `runtime.ts`를 만듭니다.
2. primitive는 `category: 'primitive'`, `kind: 'primitive'`와 `createGeometry(props)`를 사용합니다. geometry operation은 `category: 'operation'`, `kind: 'operation'`과 `evaluate(node, context)`를 사용합니다.
3. `evaluation/registry.ts`의 정적 등록 배열에 runtime definition을 추가합니다.
4. `catalog.ts`에 가벼운 manifest를 추가합니다.
5. `api/caemble-core.d.ts`와 `api/cad-jsx.d.ts`에 공개 타입과 JSX tag를 추가합니다.
6. element 디렉터리에 정상 입력, 경계값, `CadModelError` 메시지를 검증하는 테스트를 추가합니다.

공통 벡터 계산, polyline 호 길이 재샘플링, Bishop frame은 `cad/geometry`를 재사용합니다. 공통 좌표 타입은 `cad/model/types.ts`에서 가져옵니다. Material 선택, 이름 중복 검사, `scale → rotate → pos` 적용은 evaluation 계층의 책임이므로 element runtime에서 반복하지 않습니다.
