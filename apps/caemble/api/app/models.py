from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel as PydanticBaseModel
from pydantic import EmailStr, Field, field_serializer

from utils.datetime_utils import serialize_datetime_utc


class BaseModel(PydanticBaseModel):
    @field_serializer("*", when_used="json")
    def serialize_datetimes(self, value: Any) -> Any:
        return serialize_datetime_utc(value)


class RoleEnum(str, Enum):
    admin = "admin"
    user = "user"


class UserData(BaseModel):
    id: str
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None
    picture_url: Optional[str] = None
    is_active: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    roles: List[RoleEnum]


class GpsAccessTokenData(BaseModel):
    gps_access_token: Optional[str] = None


class GetListRequestBase(BaseModel):
    scope: Literal["visible", "mine", "public"] = "visible"
    offset: Optional[int] = 0
    limit: Optional[int] = None
    selected_ids: Optional[List[int]] = None
    search_text: Optional[str] = None
    text_filter: Optional[Dict[str, List[str]]] = None
    filter: Optional[Dict[str, List[Any]]] = None
    sort: Optional[List[str]] = None
    random: Optional[bool] = False


class GetListResponseBase(BaseModel):
    total: int
    items: List[Any]


class UpsertResponseBase(BaseModel):
    id: int
    fk_not_found: Optional[Dict[str, List[int]]] = None


class TimestampFields(BaseModel):
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class OwnedTimestampFields(TimestampFields):
    user_id: Optional[str] = None


class MaterialBase(OwnedTimestampFields):
    inchi: Optional[str] = None
    description: Optional[str] = None


class MaterialNameBase(OwnedTimestampFields):
    material_id: int
    name: str = Field(..., min_length=1)


class MaterialParameterBase(OwnedTimestampFields):
    material_id: int
    name: str = Field(..., min_length=1)
    value: Any
    source: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    temperature: Optional[float] = None
    pressure: Optional[float] = None
    frequency: Optional[float] = None


class MaterialParameterQualifierBase(TimestampFields):
    material_parameter_id: int
    name: str = Field(..., min_length=1)
    value: float


class CodeEntityBase(OwnedTimestampFields):
    parent_id: Optional[int] = None
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    code: str = Field(..., min_length=1)


class GeometryBase(CodeEntityBase):
    pass


class StructureBase(CodeEntityBase):
    pass


class ExperimentBase(CodeEntityBase):
    pass


class SampleBase(OwnedTimestampFields):
    structure_id: int
    vars: Dict[str, Any] = Field(default_factory=dict)
    material_parameters: Dict[str, Any] = Field(default_factory=dict)


class SetupBase(OwnedTimestampFields):
    experiment_id: int
    vars: Dict[str, Any] = Field(default_factory=dict)


class MeasurementBase(OwnedTimestampFields):
    sample_id: int
    setup_id: int


class RecordedDataBase(OwnedTimestampFields):
    measurement_id: int
    name: str = Field(..., min_length=1)
    quantity_kind: str = Field(..., min_length=1)
    tensor_order: int = Field(..., ge=0)
    dtype: str = Field(..., min_length=1)
    data: Any = None
    data_url: Optional[str] = None
    file_size: Optional[int] = Field(default=None, ge=0)


class ModelArtifactBase(OwnedTimestampFields):
    structure_id: int
    experiment_id: int
    model_url: Optional[str] = None
    file_size: Optional[int] = Field(default=None, ge=0)


class DesignerModelBase(ModelArtifactBase):
    pass


class PredictorModelBase(ModelArtifactBase):
    pass
