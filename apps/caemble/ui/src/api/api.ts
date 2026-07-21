// YOU MUST OPEN ALL FRONTEND SOURCE FILES with UTF-8 ENCODING to READ KOREAN CHARACTERS CORRECTLY.

import { API_URL, request } from './http';
import type {
  DesignerModelRecord,
  ExperimentRecord,
  GeometryRecord,
  GetListRequest,
  GetListResponse,
  GpsAccessTokenData,
  MaterialNameRecord,
  MaterialParameterQualifierRecord,
  MaterialParameterRecord,
  MaterialRecord,
  MeasurementRecord,
  PredictorModelRecord,
  RecordedDataRecord,
  SampleRecord,
  SetupRecord,
  StructureRecord,
  UpsertResponse,
  UserData,
} from './types';

export { API_URL };

export function startGoogleLogin() {
  const returnTo = window.location.href;
  window.location.href = `${API_URL}/auth/google/start?return_to=${encodeURIComponent(returnTo)}`;
}

export async function logout() {
  await request<{ ok: true }>('post', '/auth/logout');
}

export function getGpsAccessToken() {
  return request<GpsAccessTokenData>('get', '/auth/gps-access-token');
}

export function updateGpsAccessToken(gpsAccessToken: string | null) {
  return request<GpsAccessTokenData>('post', '/auth/gps-access-token', {
    gps_access_token: gpsAccessToken,
  });
}

export const dbTables = {
  User: {
    label: '사용자',
    columns: {
      id: { label: 'ID', type: 'id' },
      email: { label: '이메일', type: 'text' },
      display_name: { label: '이름', type: 'text' },
      picture_url: { label: '프로필 이미지', type: 'text' },
      is_active: { label: '활성', type: 'boolean' },
      roles: { label: '권한', type: 'list' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
    },
    fetchMe: async () => {
      try {
        return await request<UserData>('get', '/auth/me');
      } catch {
        return null;
      }
    },
    getAllUsersAdmin: (limit: number, offset: number) =>
      request<UserData[]>(
        'get',
        `/user_admin/get_all_users/${encodeURIComponent(String(limit))}/${encodeURIComponent(String(offset))}`,
      ),
    deleteUserAdmin: (id: string) =>
      request<boolean>('get', `/user_admin/delete/${encodeURIComponent(id)}`),
    getUserSummaryAdmin: (userId: string) =>
      request<UserData | null>('get', `/user_data/summary/admin/${encodeURIComponent(userId)}`),
    getUserSummaryUser: () =>
      request<UserData | null>('get', '/user_data/summary/user'),
  },

  Material: {
    label: '재료',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      inchi: { label: 'InChI', type: 'text' },
      description: { label: '설명', type: 'text' },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<MaterialRecord>>('post', '/material/list', listRequest),
    upsertRow: (items: MaterialRecord[]) =>
      request<UpsertResponse[]>('post', '/material/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/material/', ids).then(() => undefined),
  },

  MaterialName: {
    label: '재료명',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      material_id: { label: '재료', type: 'fk', targetTable: 'Material', required: true },
      name: { label: '이름', type: 'text', required: true },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<MaterialNameRecord>>('post', '/material_name/list', listRequest),
    upsertRow: (items: MaterialNameRecord[]) =>
      request<UpsertResponse[]>('post', '/material_name/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/material_name/', ids).then(() => undefined),
  },

  MaterialParameter: {
    label: '재료 파라미터',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      material_id: { label: '재료', type: 'fk', targetTable: 'Material', required: true },
      name: { label: '이름', type: 'text', required: true },
      value: { label: '값', type: 'json', required: true },
      source: { label: '출처', type: 'text' },
      version: { label: '버전', type: 'text' },
      description: { label: '설명', type: 'text' },
      temperature: { label: '온도', type: 'number' },
      pressure: { label: '압력', type: 'number' },
      frequency: { label: '주파수', type: 'number' },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<MaterialParameterRecord>>('post', '/material_parameter/list', listRequest),
    upsertRow: (items: MaterialParameterRecord[]) =>
      request<UpsertResponse[]>('post', '/material_parameter/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/material_parameter/', ids).then(() => undefined),
  },

  MaterialParameterQualifier: {
    label: '파라미터 한정자',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      material_parameter_id: { label: '재료 파라미터', type: 'fk', targetTable: 'MaterialParameter', required: true },
      name: { label: '이름', type: 'text', required: true },
      value: { label: '값', type: 'number', required: true },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<MaterialParameterQualifierRecord>>('post', '/material_parameter_qualifier/list', listRequest),
    upsertRow: (items: MaterialParameterQualifierRecord[]) =>
      request<UpsertResponse[]>('post', '/material_parameter_qualifier/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/material_parameter_qualifier/', ids).then(() => undefined),
  },

  Geometry: {
    label: '지오메트리',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      parent_id: { label: '부모', type: 'fk', targetTable: 'Geometry' },
      name: { label: '이름', type: 'text', required: true },
      description: { label: '설명', type: 'text' },
      code: { label: '코드', type: 'text', required: true },
      code_embedding: { label: '코드 임베딩', type: 'list' },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<GeometryRecord>>('post', '/geometry/list', listRequest),
    upsertRow: (items: GeometryRecord[]) =>
      request<UpsertResponse[]>('post', '/geometry/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/geometry/', ids).then(() => undefined),
  },

  Structure: {
    label: '구조',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      parent_id: { label: '부모', type: 'fk', targetTable: 'Structure' },
      name: { label: '이름', type: 'text', required: true },
      description: { label: '설명', type: 'text' },
      code: { label: '코드', type: 'text', required: true },
      code_embedding: { label: '코드 임베딩', type: 'list' },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<StructureRecord>>('post', '/structure/list', listRequest),
    upsertRow: (items: StructureRecord[]) =>
      request<UpsertResponse[]>('post', '/structure/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/structure/', ids).then(() => undefined),
  },

  Experiment: {
    label: '실험',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      parent_id: { label: '부모', type: 'fk', targetTable: 'Experiment' },
      name: { label: '이름', type: 'text', required: true },
      description: { label: '설명', type: 'text' },
      code: { label: '코드', type: 'text', required: true },
      code_embedding: { label: '코드 임베딩', type: 'list' },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<ExperimentRecord>>('post', '/experiment/list', listRequest),
    upsertRow: (items: ExperimentRecord[]) =>
      request<UpsertResponse[]>('post', '/experiment/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/experiment/', ids).then(() => undefined),
  },

  Sample: {
    label: '시료',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      structure_id: { label: '구조', type: 'fk', targetTable: 'Structure', required: true },
      vars: { label: '변수', type: 'json', required: true },
      material_parameters: { label: '재료 파라미터', type: 'json', required: true },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<SampleRecord>>('post', '/sample/list', listRequest),
    upsertRow: (items: SampleRecord[]) =>
      request<UpsertResponse[]>('post', '/sample/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/sample/', ids).then(() => undefined),
  },

  Setup: {
    label: '설정',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      experiment_id: { label: '실험', type: 'fk', targetTable: 'Experiment', required: true },
      vars: { label: '변수', type: 'json', required: true },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<SetupRecord>>('post', '/setup/list', listRequest),
    upsertRow: (items: SetupRecord[]) =>
      request<UpsertResponse[]>('post', '/setup/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/setup/', ids).then(() => undefined),
  },

  Measurement: {
    label: '측정',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      sample_id: { label: '시료', type: 'fk', targetTable: 'Sample', required: true },
      setup_id: { label: '설정', type: 'fk', targetTable: 'Setup', required: true },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<MeasurementRecord>>('post', '/measurement/list', listRequest),
    upsertRow: (items: MeasurementRecord[]) =>
      request<UpsertResponse[]>('post', '/measurement/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/measurement/', ids).then(() => undefined),
  },

  RecordedData: {
    label: '기록 데이터',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      measurement_id: { label: '측정', type: 'fk', targetTable: 'Measurement', required: true },
      name: { label: '이름', type: 'text', required: true },
      quantity_kind: { label: 'Quantity Kind', type: 'text', required: true },
      tensor_order: { label: 'Tensor Order', type: 'number', required: true },
      dtype: { label: '데이터 타입', type: 'text', required: true },
      data: { label: '데이터', type: 'json' },
      data_url: { label: '데이터 URL', type: 'text' },
      file_size: { label: '파일 크기', type: 'number' },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<RecordedDataRecord>>('post', '/recorded_data/list', listRequest),
    upsertRow: (items: RecordedDataRecord[]) =>
      request<UpsertResponse[]>('post', '/recorded_data/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/recorded_data/', ids).then(() => undefined),
  },

  DesignerModel: {
    label: '설계 모델',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      structure_id: { label: '구조', type: 'fk', targetTable: 'Structure', required: true },
      experiment_id: { label: '실험', type: 'fk', targetTable: 'Experiment', required: true },
      model_url: { label: '모델 URL', type: 'text' },
      file_size: { label: '파일 크기', type: 'number' },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<DesignerModelRecord>>('post', '/designer_model/list', listRequest),
    upsertRow: (items: DesignerModelRecord[]) =>
      request<UpsertResponse[]>('post', '/designer_model/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/designer_model/', ids).then(() => undefined),
  },

  PredictorModel: {
    label: '예측 모델',
    columns: {
      id: { label: 'ID', type: 'id' },
      created_at: { label: '생성일', type: 'datetime', readOnly: true },
      updated_at: { label: '수정일', type: 'datetime', readOnly: true },
      user_id: { label: '사용자', type: 'text', readOnly: true },
      structure_id: { label: '구조', type: 'fk', targetTable: 'Structure', required: true },
      experiment_id: { label: '실험', type: 'fk', targetTable: 'Experiment', required: true },
      model_url: { label: '모델 URL', type: 'text' },
      file_size: { label: '파일 크기', type: 'number' },
    },
    listRows: (listRequest: GetListRequest) =>
      request<GetListResponse<PredictorModelRecord>>('post', '/predictor_model/list', listRequest),
    upsertRow: (items: PredictorModelRecord[]) =>
      request<UpsertResponse[]>('post', '/predictor_model/upsert', items),
    deleteRows: (ids: number[]) =>
      request<null>('delete', '/predictor_model/', ids).then(() => undefined),
  },
};

export type DbTableName = keyof typeof dbTables;
