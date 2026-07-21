# Caemble API

FastAPI와 PostgreSQL을 사용하는 Caemble 백엔드다. 인증 테이블은
`app/user_auth/db.py`, Caemble 도메인 테이블은 `app/db.py`에서 관리한다.

## CRUD 계약

각 도메인 router는 공통 `utils/crud`를 사용해 다음 경로만 제공한다.

- `POST /<table>/list`
- `POST /<table>/upsert`
- `DELETE /<table>/`

대상 table 경로는 `material`, `material_name`, `material_parameter`,
`material_parameter_qualifier`, `geometry`, `structure`, `experiment`, `sample`,
`setup`, `measurement`, `recorded_data`, `designer_model`, `predictor_model`이다.

`user_id IS NULL`인 행은 공개 데이터다. 익명 사용자는 공개 행을 조회할 수
있고, 로그인 사용자는 공개 행과 본인 행을 조회하며 본인 행만 변경할 수 있다.
관리자는 모든 범위를 관리할 수 있다. `MaterialParameterQualifier`는 별도
`user_id` 없이 부모 `MaterialParameter`의 범위를 상속한다.

공개 행의 FK는 공개 행만 가리킬 수 있다. 사용자 행의 FK는 공개 행 또는 같은
사용자의 행을 가리킬 수 있다. Geometry, Structure, Experiment의 parent 관계는
순환을 허용하지 않으며, 부모 삭제 시 자식은 가장 가까운 생존 조상으로 이동한다.

## 도메인 테이블

- Material, MaterialName, MaterialParameter, MaterialParameterQualifier
- Geometry, Structure, Experiment
- Sample, Setup, Measurement, RecordedData
- DesignerModel, PredictorModel

모든 도메인 테이블은 `id`, `created_at`, `updated_at`을 가진다. JSON 데이터는
JSONB, 코드 임베딩은 768차원 pgvector로 저장한다. MaterialName은 공개 범위와
사용자별 범위에서 각각 유일하다.

## 실행

```powershell
poetry install --no-root
cd app
poetry run python -m uvicorn main:app --reload --host 0.0.0.0
```

DB 마이그레이션, `metadata.create_all`, 시드 작업은 이 앱에서 수행하지 않는다.
PostgreSQL 스키마와 `vector` 확장은 별도로 준비해야 한다.
