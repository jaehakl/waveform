## DB Tables

Material
- id
- user_id
- inchi
- description

MaterialName
- id
- user_id
- material_id
- name (unique constraint for global + self)

MaterialParameter
- id
- user_id
- material_id
- name
- value (JSON)
- source
- version
- description (str)
- temperature (float)
- pressure (float)
- frequency (float)

MaterialParameterQualifier
- id
- material_parameter_id
- name
- value (float)

Geometry
- id
- user_id
- parent_id
- name
- description
- code (str)
- code_embedding

Structure
- id
- user_id
- parent_id
- name
- description
- code (str)
- code_embedding

Experiment
- id
- user_id
- parent_id
- name
- description
- code (str)
- code_embedding

Sample
- id
- user_id
- structure_id
- vars (JSON)
- material_parameters (JSON)

Setup
- id
- user_id
- experiment_id
- vars (JSON)

Measurement
- id
- user_id
- sample_id
- setup_id

RecordedData
- id
- user_id
- measurement_id
- name
- quantity_kind
- tensor_order
- dtype
- data (JSON)
- data_url
- file_size

DesignerModel
- id
- user_id
- structure_id
- experiment_id
- model_url
- file_size

PredictorModel
- id
- user_id
- structure_id
- experiment_id
- model_url
- file_size

