// YOU MUST OPEN ALL FRONTEND SOURCE FILES with UTF-8 ENCODING to READ KOREAN CHARACTERS CORRECTLY.

export type UserData = {
  id: string;
  email?: string | null;
  display_name?: string | null;
  picture_url?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  roles: string[];
};

export type GpsAccessTokenData = {
  gps_access_token: string | null;
};

export type GetListRequest = {
  offset: number;
  limit: number | null;
  selected_ids: number[];
  search_text: string | null;
  text_filter: Record<string, string[]>;
  filter: Record<string, unknown[]>;
  sort: [string, 'asc' | 'desc'] | null;
  random?: boolean;
};

export type GetListResponse<T> = {
  total: number;
  items: T[];
};

export type UpsertResponse = {
  id: number;
  fk_not_found?: Record<string, number[]> | null;
};

type RecordFields = {
  id?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type OwnedRecordFields = RecordFields & {
  user_id?: string | null;
};

export type MaterialRecord = OwnedRecordFields & {
  inchi?: string | null;
  description?: string | null;
};

export type MaterialNameRecord = OwnedRecordFields & {
  material_id: number;
  name: string;
};

export type MaterialParameterRecord = OwnedRecordFields & {
  material_id: number;
  name: string;
  value: unknown;
  source?: string | null;
  version?: string | null;
  description?: string | null;
  temperature?: number | null;
  pressure?: number | null;
  frequency?: number | null;
};

export type MaterialParameterQualifierRecord = RecordFields & {
  material_parameter_id: number;
  name: string;
  value: number;
};

type CodeEntityRecord = OwnedRecordFields & {
  parent_id?: number | null;
  name: string;
  description?: string | null;
  code: string;
  code_embedding?: number[] | null;
};

export type GeometryRecord = CodeEntityRecord;
export type StructureRecord = CodeEntityRecord;
export type ExperimentRecord = CodeEntityRecord;

export type SampleRecord = OwnedRecordFields & {
  structure_id: number;
  vars: Record<string, unknown>;
  material_parameters: Record<string, unknown>;
};

export type SetupRecord = OwnedRecordFields & {
  experiment_id: number;
  vars: Record<string, unknown>;
};

export type MeasurementRecord = OwnedRecordFields & {
  sample_id: number;
  setup_id: number;
};

export type RecordedDataRecord = OwnedRecordFields & {
  measurement_id: number;
  name: string;
  quantity_kind: string;
  tensor_order: number;
  dtype: string;
  data?: unknown | null;
  data_url?: string | null;
  file_size?: number | null;
};

type ModelArtifactRecord = OwnedRecordFields & {
  structure_id: number;
  experiment_id: number;
  model_url?: string | null;
  file_size?: number | null;
};

export type DesignerModelRecord = ModelArtifactRecord;
export type PredictorModelRecord = ModelArtifactRecord;
