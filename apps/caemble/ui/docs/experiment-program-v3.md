# Caemble Experiment Program v3 저작 가이드

이 문서는 Caemble에서 하나의 만능 Solver를 선택하는 대신, 여러 **named kernel task**를 조합해 문제에 맞는 시뮬레이션 프로그램을 작성하는 방법을 설명한다.

현재 Source code에서 사용하는 공개 모듈은 다음과 같다.

```tsx
import { defineTask, experiment } from '@caemble/core/v3'
import { dcCurrentDensity } from '@caemble/kernels/v1'
```

- `@caemble/core/v3`는 Experiment Program의 구조, state/artifact 참조, task 실행 API를 정의한다.
- `@caemble/kernels/v1`는 실행 구현이 아니라 신뢰된 kernel을 가리키는 capability만 노출한다.
- 현재 제품 Registry에 등록된 v1 capability는 `dcCurrentDensity` 하나다.
- Structure는 계속 `@caemble/core/v2`의 `structure()`로 작성한다.

UI에서 바로 수정하고 실행하려면 [DC Uniform Bar Playground](/examples/dc-uniform-bar)를 연다.

## 1. v2 Solver와 v3 Experiment Program

v2 Experiment는 하나의 Solver와 세 종류의 규칙을 Experiment 최상위에서 선언한다.

```tsx
experiment({
  solver: { ... },
  initializations: () => [...],
  boundaryConditions: () => [...],
  recordedData: () => [...],
})
```

v3에서는 solver별 수치 설정을 named task로 옮기고, Experiment 최상위에는 고정된 세계와 실행 정책을 둔다.

```tsx
const solveCurrent = defineTask(dcCurrentDensity, ({ vars }) => ({
  parameters: { ... },
  initializations: [...],
  boundaryConditions: [...],
  recordedData: [...],
}))

export default experiment({
  geometry: () => ...,
  varsSchema: { ... },
  tasks: { solveCurrent },
  outputs: { ... },
  simulate: async ({ sim, tasks, initialState }) => {
    const result = await sim.run(tasks.solveCurrent, { state: initialState })
    sim.record('totalCurrent', result.artifacts.totalCurrent)
    return result.state
  },
})
```

핵심 차이는 `simulate()`가 kernel 선택, 순서, 반복, 분기, fallback, 결과 기록을 담당한다는 점이다. kernel이 이해해야 하는 물리 분야별 설정은 해당 task 안에 머문다.

## 2. 속성은 어디에 두는가

| 항목 | 정의 위치 | 역할 |
| --- | --- | --- |
| `varsSchema` | Structure/Experiment 최상위 | 실행 전에 결정되고 run 동안 바뀌지 않는 설계·실험 변수 |
| `geometry` | Structure/Experiment 최상위 | reference geometry와 stable body identity 생성 |
| `geometryGroup`, `surfaceGroup` | Structure/Experiment 최상위 | kernel target에서 사용하는 안정적인 이름 |
| `lengthUnit` | Structure/Experiment 최상위 | geometry 저작 단위 |
| `initialState` | Experiment 최상위 | solver와 무관한 초기 pose·velocity 등 |
| kernel 초기화·경계·결과 요청 | 개별 `defineTask()` 내부 | 해당 kernel만 사용하는 수치 설정 |
| `outputs` | Experiment 최상위 | 최종 run 결과로 보존할 공개 schema |
| `simulate()` | Experiment 최상위 | task orchestration과 `sim.record()` 정책 |

`varsSchema`는 동적 물리 상태를 담는 곳이 아니다. 시간, pose, velocity, displacement, temperature, contact set처럼 run 중 변하는 값은 `SimulationState` 또는 `ArtifactRef`로 전달한다.

## 3. Structure: 고정 topology와 target

Structure는 v2 API로 reference geometry, Material, group을 정의한다.

```tsx
import { Mat, Material, structure, type Geometry, type Vec3 } from '@caemble/core/v2'

const Conductor: Geometry<{ size: Vec3 }> = ({ size }) => <box size={size} />

export default structure({
  lengthUnit: 'mm',
  varsSchema: {
    conductorSize: { min: [100, 5, 5], max: [100, 5, 5] },
    electricalConductivity: { min: 5.96e7, max: 5.96e7 },
  },
  geometry: ({ vars }) => (
    <Conductor
      id="conductor"
      size={vars.conductorSize}
      materials={[
        new Material('Copper', 'reference', {
          errorRate: 0,
          'electrical.conductivity': {
            dtype: 'float64',
            value: Mat(vars.electricalConductivity),
            unit: 'S.m-1',
          },
        }),
      ]}
    />
  ),
  geometryGroup: {
    conductor: ['conductor'],
  },
  surfaceGroup: {
    sourceTerminal: ['conductor/surface-1'],
    referenceTerminal: ['conductor/surface-2'],
  },
})
```

각 scene part는 run 동안 다음 형식의 stable ID를 갖는다.

```text
structure:conductor
experiment:probe
```

kernel은 pose나 field를 바꿀 수 있지만 body를 생성·삭제해서는 안 된다. remesh가 필요해도 reference body ID는 보존해야 한다. runtime은 kernel 성공 결과를 commit하기 전에 body ID 집합과 pose·velocity의 유효성을 검사한다.

## 4. `defineTask()`: kernel 한 번의 호출 계약

`defineTask(kernel, configure)`는 재사용 가능한 호출 설정을 만든다. `configure({ vars, world })`는 `simulate()` 시작 전에 한 번 평가되며, run 도중 다시 평가되지 않는다.

```tsx
const solveCurrent = defineTask(dcCurrentDensity, ({ vars }) => ({
  parameters: {
    relativeTolerance: {
      dtype: 'float64',
      value: 1e-10,
      unit: '{fraction}',
      quantityKind: 'DimensionlessRatio',
    },
    maxIterations: 1000,
  },
  initializations: [...],
  boundaryConditions: [...],
  recordedData: [...],
}))
```

Experiment의 `tasks` object에 등록한 이름이 run trace의 task identity가 된다.

```tsx
tasks: {
  solveCurrent,
}
```

`sim.run()`에는 이 `tasks` object에서 받은 resolved task만 전달할 수 있다. 임의로 만든 task나 다른 run의 state/artifact 참조는 거부된다.

## 5. `initialState`와 stable state revision

`initialState`를 생략하면 모든 body가 reference pose와 zero velocity로 시작한다. 명시하려면 다음처럼 작성한다.

```tsx
initialState: ({ world }) => ({
  bodies: world.bodies.map((body) => ({
    body,
    pose: body.referencePose,
    velocity: [0, 0, 0],
  })),
}),
```

사용자 코드는 실제 state object를 직접 받지 않는다. 대신 현재 run과 revision을 가리키는 `SimulationStateRef`를 받는다.

```text
initialState  r0
kernel A      r0 → r1
kernel B      r1 → r2
```

kernel 호출은 원자적이다. 성공한 결과만 새 revision으로 commit된다. 실패한 kernel이 입력 state의 복사본을 수정했더라도 그 변경은 저장되지 않는다.

## 6. `simulate()`: 실행 순서와 artifact 전달

가장 단순한 프로그램은 task를 한 번 실행한다.

```tsx
simulate: async ({ sim, tasks, initialState }) => {
  const result = await sim.run(tasks.solveCurrent, {
    state: initialState,
  })
  sim.record('totalCurrent', result.artifacts.totalCurrent)
  return result.state
},
```

순차 실행은 이전 결과의 state를 다음 호출로 전달한다.

```tsx
simulate: async ({ sim, tasks, initialState }) => {
  const coarse = await sim.run(tasks.solveCoarse, {
    state: initialState,
  })

  const fine = await sim.run(tasks.solveFine, {
    state: coarse.state,
  })

  return fine.state
},
```

kernel 사이에 mesh나 field를 전달할 때는 `artifacts`를 사용한다.

```tsx
const next = await sim.run(tasks.nextStep, {
  state: previous.state,
  artifacts: {
    mesh: previous.artifacts.mesh,
  },
})
```

artifact는 같은 run 안에서만 유효하다. 다른 run의 `ArtifactRef`, 존재하지 않는 output, 등록되지 않은 task는 fatal 오류다.

`sim.random()`은 Experiment seed에 기반한 결정적 난수를 반환한다. 같은 source, vars, seed, task 순서는 같은 입력·출력 hash를 만들어야 한다.

## 7. 실패와 fallback

일반 kernel 실패는 `SimulationKernelErrorV3`로 전달되며 `try/catch`로 대체 task를 실행할 수 있다. 실패한 호출은 state revision을 만들지 않는다. 같은 input revision에서 바로 성공한 다음 task는 trace에서 `fallback`으로 표시된다.

다음 오류는 catch하더라도 run 전체를 종료하는 fatal 오류로 유지된다.

- 취소 또는 격리 runner 실패
- 등록되지 않은 kernel/task 사용
- 다른 run의 state/artifact 참조
- body identity 생성·삭제
- 잘못된 최종 state ref
- 선언하지 않은 output 기록
- output dtype, shape, unit, basis, series coordinate 불일치

## 8. output과 `sim.record()`

task의 `recordedData`는 kernel에게 무엇을 계산할지 요청한다. 반환 artifact가 최종 결과에 자동으로 포함되지는 않는다.

Experiment의 `outputs`는 외부에 보존할 결과 schema다.

```tsx
outputs: {
  totalCurrent: {
    dtype: 'float64',
    unit: 'A',
    quantityKind: 'electromagnetism.ElectricCurrent',
  },
  currentDensity: {
    dtype: 'float64',
    unit: 'A.m-2',
    quantityKind: 'electromagnetism.ElectricCurrentDensity',
    basis: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    axes: [
      { name: 'cross-section v', unit: 'm', quantityKind: 'Length' },
      { name: 'cross-section u', unit: 'm', quantityKind: 'Length' },
    ],
  },
},
```

`sim.record(name, artifact)`를 호출해야 해당 artifact가 보존된다.

```tsx
sim.record('totalCurrent', result.artifacts.totalCurrent)
```

시계열 output은 `seriesAxis`를 선언하고 모든 sample에 finite `time` 좌표를 제공한다.

```tsx
outputs: {
  displacement: {
    dtype: 'float64',
    unit: 'm',
    quantityKind: 'kinematics.Displacement',
    seriesAxis: {
      unit: 's',
      quantityKind: 'Time',
    },
  },
}

sim.record('displacement', result.artifacts.displacement, { time: 0.1 })
```

일반 output에 `time`을 주거나, 시계열 output에 `time`을 생략하면 오류다. 기록 시점에 dtype, tensor shape, axes, Quantity Kind, UCUM unit, Cartesian basis를 검증한다.

성공한 run은 다음을 포함하는 versioned `.caemble-run.json`으로 다운로드할 수 있다.

- output series와 각 sample
- 최종 state revision과 body 수
- task/kernel 호출 순서와 성공·실패·fallback trace
- 각 호출의 input/output hash
- Structure/Experiment source hash, vars, seed
- 사용한 kernel name/version

## 9. `dcCurrentDensity` task

현재 `@caemble/kernels/v1`의 실제 제품 kernel은 `dc-current-density@0.0.0`이다. 하나의 연결된 homogeneous isotropic conductor에서 정상상태 전위, 전류 밀도, 전체 전류를 계산한다.

### Solver parameters

| 이름 | 값 |
| --- | --- |
| `relativeTolerance` | `float64`, `DimensionlessRatio`, `0 < value < 1` |
| `maxIterations` | 1 이상의 `int32` safe integer |

### Initialization

| method ID | target | parameter |
| --- | --- | --- |
| `dc.voxel-grid` | `structure.geometry.<group>` 하나 | `gridShape`: int32 `[s,u,v]`, 각 값 3 이상 |

총 voxel 수는 250,000 이하여야 한다.

### Boundary conditions

| method ID | target | parameter |
| --- | --- | --- |
| `dc.source-potential` | `structure.surface.<group>` 하나 | `voltage`: float Voltage |
| `dc.reference-potential` | `structure.surface.<group>` 하나 | `voltage`: float Voltage |

두 terminal은 conductor의 서로 마주 보는 평면 axial surface여야 한다. 나머지 경계는 절연으로 처리한다.

### Result requests

| method ID | 결과 | parameter |
| --- | --- | --- |
| `dc.current-density` | 2D vector field, `A.m-2` | `crossSectionPosition`: `0 < fraction < 1` |
| `dc.total-current` | scalar, `A` | 같은 cross-section position |

각 요청은 `key`를 가지며, 이 key로 `result.artifacts.<key>`에 접근한다.

```tsx
recordedData: [
  {
    key: 'totalCurrent',
    target: ['structure.geometry.conductor'],
    methodId: 'dc.total-current',
    parameters: {
      crossSectionPosition: {
        dtype: 'float64',
        value: 0.5,
        unit: '{fraction}',
        quantityKind: 'DimensionlessRatio',
      },
    },
  },
],
```

별도 `result` schema를 쓰지 않으면 같은 key의 Experiment output schema를 사용한다. task key와 output 이름을 같게 두는 것이 가장 단순하다. DC bridge는 내부 v2 Solver가 필요로 하는 보조 결과를 자동 요청하지만, 사용자에게 반환하는 artifact는 task에서 명시한 key뿐이다.

### Material 제한

`dc.voxel-grid` target의 단일 part에 다음 Material 값이 필요하다.

```tsx
'electrical.conductivity': {
  dtype: 'float64',
  value: Mat(5.96e7),
  unit: 'S.m-1',
}
```

현재 구현은 양의 isotropic conductivity `σI`, global identity basis, 하나의 Material part만 지원한다. Structure의 `lengthUnit`, terminal voltage, conductivity, output unit은 kernel 경계에서 SI로 변환된다.

## 10. 실행 가능한 예제

세 예제는 동일한 fixture source를 UI, TypeScript 검사, source-policy 검사, snapshot 평가, 실제 DC kernel 통합 테스트에서 함께 사용한다.

1. [DC Uniform Bar](/examples/dc-uniform-bar)
   - 최소 Structure–Experiment pair
   - 단일 task와 scalar output
   - 해석해 `14.9 A`
2. [DC Notched Current Density](/examples/dc-notched-current-density)
   - 명시적 `initialState`
   - `[21,21,3]` vector field와 total current
   - notch 주변 전류 집중 시각화
3. [DC Resolution Study](/examples/dc-resolution-study)
   - coarse/fine named task
   - `r0 → r1 → r2` 순차 state 전달
   - trace와 deterministic hash 비교

Playground 편집은 로그인이나 DB 저장 없이 현재 페이지 세션에만 존재한다. **전체 예제 초기화**로 검증된 원본 pair와 빈 simulation 결과로 돌아갈 수 있다.

## 11. 문제 해결 순서

### Source가 Ready가 되지 않는다

1. Structure는 `@caemble/core/v2`, v3 Experiment는 `@caemble/core/v3`에서 factory를 import했는지 확인한다.
2. 정적 import가 허용된 모듈 또는 프로젝트 내부 상대 경로만 사용하는지 확인한다.
3. `varsSchema` tuple shape와 `vars` 사용 위치가 맞는지 확인한다.
4. float descriptor에 `dtype`, `value`, `unit`, `quantityKind`가 모두 있는지 확인한다.

### Simulation이 Incompatible이다

1. Solver Spec에서 등록되지 않은 kernel name/version이 있는지 확인한다.
2. `structure.geometry.<group>`과 `structure.surface.<group>`이 실제 Structure group 이름과 일치하는지 확인한다.
3. group member ID가 current Structure scene에 존재하는지 확인한다.
4. conductor Material에 올바른 conductivity tensor가 있는지 확인한다.

### Run이 실패한다

1. grid 세 축이 모두 3 이상이고 총 voxel 수가 250,000 이하인지 확인한다.
2. source/reference surface가 반대쪽 planar terminal인지 확인한다.
3. 두 voltage가 같지 않은지 확인한다.
4. `crossSectionPosition`이 열린 구간 `(0,1)`에 있는지 확인한다.
5. output의 unit, Quantity Kind, basis, axes가 kernel 결과와 일치하는지 확인한다.
6. PCG가 수렴하지 않으면 grid와 `relativeTolerance`, `maxIterations`를 점검한다.

### 결과가 보이지 않는다

1. task `recordedData.key`로 artifact가 반환되는지 확인한다.
2. 같은 이름이 `outputs`에 선언되어 있는지 확인한다.
3. `simulate()`에서 `sim.record()`를 호출했는지 확인한다.
4. Source 수정 후 기존 결과가 `Stale`인지 확인하고 다시 실행한다.

## 12. 버전과 호환성

`@caemble/core/v3`의 `v3`와 `@caemble/kernels/v1`의 `v1`은 서로 다른 version 축이다.

- core version은 Experiment Program 저작·runtime 계약을 나타낸다.
- kernels version은 capability export 묶음의 저작 API를 나타낸다.
- 실제 dispatch는 각 capability의 kernel name/version을 정확히 비교한다.

기존 v2 Structure, Experiment, Solver 경로는 그대로 지원된다. v3 코드는 기존 Source를 자동 변환하지 않으며, 한 Experiment Source는 v2 단일 Solver 또는 v3 Program 중 하나를 default-export한다.
