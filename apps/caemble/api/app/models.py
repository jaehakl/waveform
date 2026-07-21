from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import (
    BaseModel as PydanticBaseModel,
    EmailStr,
    Field,
    field_serializer,
    model_validator,
)

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


class ExampleListRequest(GetListRequestBase):
    require_prompt_embedding: bool = False


class UpsertResponseBase(BaseModel):
    id: int
    fk_not_found: Optional[Dict[str, List[int]]] = None


class CopyResponseBase(BaseModel):
    db_table: str
    source_ids: List[int]
    copied_ids: List[int]
    not_found_ids: List[int]
    copied_ids_by_table: Dict[str, List[int]]


class TimestampFields(BaseModel):
    id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ExampleBase(TimestampFields):
    jp_text: str
    kr_text: str
    context: Optional[str] = None
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    jp_words: Optional[List[int]] = None
    audios: Optional[List[int]] = None
    error_reports: Optional[List[int]] = None


class ExampleContextPlayRequest(BaseModel):
    example_id: int
    skills: Optional[Any] = None


class ExampleContextPlayResponse(BaseModel):
    example: ExampleBase
    image_url: Optional[str] = None
    audio_urls: List[str]
    analysis: Dict[str, Any]
    similar_examples: List[ExampleBase]


class ExampleUpsert(ExampleBase):
    context_embedding: Optional[List[float]] = Field(default=None, min_length=768, max_length=768)
    text_embedding: Optional[List[float]] = Field(default=None, min_length=768, max_length=768)
    prompt_embedding: Optional[List[float]] = Field(default=None, min_length=768, max_length=768)


class EmbeddingSimilarityRequest(BaseModel):
    embedding: List[float] = Field(..., min_length=768, max_length=768)
    top_n: int = Field(default=10, ge=1, le=100)


class SimilarityResult(BaseModel):
    id: int
    score: float


class ExampleSortSimilarItem(ExampleBase):
    similar_prompt_image: Optional[SimilarityResult] = None
    similar_context_text_example: Optional[SimilarityResult] = None
    similar_text_context_example: Optional[SimilarityResult] = None


class ExampleSortSimilarListResponse(BaseModel):
    total: int
    items: List[ExampleSortSimilarItem]


class SyncExampleJpWordsRequest(BaseModel):
    start_id: int = Field(..., ge=1)
    end_id: int = Field(..., ge=1)
    limit: int = Field(default=100, ge=1, le=100)

    @model_validator(mode="after")
    def validate_range(self):
        if self.start_id > self.end_id:
            raise ValueError("start_id must be less than or equal to end_id")
        return self


class SyncExampleJpWordsResponse(BaseModel):
    examples_checked: int
    examples_updated: int
    jp_words_added: int
    lemma_ids_without_jp_word: List[int]
    last_example_id: Optional[int] = None
    next_start_id: Optional[int] = None


class AutoFlowSeedResponse(BaseModel):
    source_sentence: str
    seed_word: str


class JpWordBase(TimestampFields):
    lemma_id: int
    lemma: str
    kr_mean: str
    examples: Optional[List[int]] = None
    user_word_skills: Optional[List[int]] = None


class ImageBase(TimestampFields):
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    object_key: Optional[str] = None


class ImageUpsert(ImageBase):
    prompt_embedding: Optional[List[float]] = Field(default=None, min_length=768, max_length=768)


class ImagePromptSimilarityRequest(BaseModel):
    image_id: int
    limit: int = Field(..., ge=1, le=100)


class ImagePromptSimilarityResponse(BaseModel):
    similar_image_ids: List[int]
    similar_example_ids: List[int]


class AudioBase(TimestampFields):
    example_id: int
    speaker: str
    object_key: Optional[str] = None


class UserJpWordSkillBase(TimestampFields):
    user_id: Optional[str] = None
    word_id: int
    reading: int = 0
    listening: int = 0
    speaking: int = 0


class UserTextBase(TimestampFields):
    user_id: Optional[str] = None
    title: str
    text: str
    tags: str
    youtube_url: Optional[str] = None


class ErrorReportBase(TimestampFields):
    user_id: Optional[str] = None
    example_id: int
    error_type: str
    error_description: str
    is_resolved: bool = False


class TextAnalyzeJpRequest(BaseModel):
    text: str = Field(..., min_length=1)
    skills: Optional[Any] = None
