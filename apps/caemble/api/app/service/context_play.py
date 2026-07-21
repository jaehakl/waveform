import random
from dataclasses import dataclass
from typing import Any, List, Sequence

from fastapi import HTTPException, status
from sqlalchemy import Integer, column, func, literal, select, values
from sqlalchemy.dialects.postgresql import aggregate_order_by
from sqlalchemy.ext.asyncio import AsyncSession

from db import Audio, ErrorReport, Example, ExampleJpWord, Image, UserJpWordSkill
from models import ExampleBase, ExampleContextPlayRequest, ExampleContextPlayResponse
from service.analysis_text.analysis_jp_text import analyze_jp_text, _normalize_word_skills
from utils.aws_s3 import presign_get_url
from utils.crud import normalize_int_ids


@dataclass(frozen=True)
class _ContextPlaySource:
    example: Example
    prompt_embedding: Sequence[float] | None
    text_embedding: Sequence[float] | None
    audio_ids: Sequence[int] | None
    audio_object_keys: Sequence[str] | None
    jp_word_ids: Sequence[int] | None
    error_report_ids: Sequence[int] | None


def _array_agg_subquery(value: Any, order_by: Any, where_clause: Any) -> Any:
    return (
        select(func.array_agg(aggregate_order_by(value, order_by)))
        .where(where_clause)
        .correlate(Example)
        .scalar_subquery()
    )


class ContextPlayService:
    def __init__(self, db: AsyncSession, user=None):
        self.db = db
        self.user = user

    async def get_context_play(
        self,
        request: ExampleContextPlayRequest,
    ) -> ExampleContextPlayResponse:
        source = await self._get_source(request.example_id)
        selected_example_ids = await self._get_choice_ids(
            request,
            source.text_embedding,
        )

        return ExampleContextPlayResponse(
            example=self._build_example_base(
                source.example,
                source.jp_word_ids,
                source.audio_ids,
                source.error_report_ids,
            ),
            image_url=await self._get_image_url(source.prompt_embedding),
            audio_urls=[
                presign_get_url(object_key)
                for object_key in source.audio_object_keys or []
                if object_key
            ],
            analysis=await analyze_jp_text(
                source.example.jp_text,
                skills=request.skills if self.user is None else None,
                db=self.db,
                user_id=self.user.id if self.user else None,
            ),
            similar_examples=await self._get_ordered_examples(selected_example_ids),
        )

    def _build_example_base(
        self,
        example: Example,
        jp_word_ids: Sequence[int] | None,
        audio_ids: Sequence[int] | None,
        error_report_ids: Sequence[int] | None,
    ) -> ExampleBase:
        return ExampleBase.model_validate(
            {
                "id": example.id,
                "created_at": example.created_at,
                "updated_at": example.updated_at,
                "jp_text": example.jp_text,
                "kr_text": example.kr_text,
                "context": example.context,
                "prompt": example.prompt,
                "negative_prompt": example.negative_prompt,
                "jp_words": normalize_int_ids(jp_word_ids, sort=True),
                "audios": normalize_int_ids(audio_ids, sort=True),
                "error_reports": normalize_int_ids(error_report_ids, sort=True),
            }
        )

    async def _get_source(self, example_id: int) -> _ContextPlaySource:
        audio_ids = _array_agg_subquery(
            Audio.id,
            Audio.id.asc(),
            Audio.example_id == Example.id,
        )
        audio_object_keys = _array_agg_subquery(
            Audio.object_key,
            Audio.id.asc(),
            Audio.example_id == Example.id,
        )
        jp_word_ids = _array_agg_subquery(
            ExampleJpWord.jp_word_id,
            ExampleJpWord.jp_word_id.asc(),
            ExampleJpWord.example_id == Example.id,
        )
        error_report_ids = _array_agg_subquery(
            ErrorReport.id,
            ErrorReport.id.asc(),
            ErrorReport.example_id == Example.id,
        )
        row = (
            await self.db.execute(
                select(
                    Example,
                    Example.prompt_embedding,
                    Example.text_embedding,
                    audio_ids.label("audio_ids"),
                    audio_object_keys.label("audio_object_keys"),
                    jp_word_ids.label("jp_word_ids"),
                    error_report_ids.label("error_report_ids"),
                )
                .where(Example.id == example_id)
            )
        ).one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Example not found",
            )

        return _ContextPlaySource(
            example=row[0],
            prompt_embedding=row[1],
            text_embedding=row[2],
            audio_ids=row[3],
            audio_object_keys=row[4],
            jp_word_ids=row[5],
            error_report_ids=row[6],
        )

    async def _get_image_url(
        self,
        prompt_embedding: Sequence[float] | None,
    ) -> str | None:
        if prompt_embedding is None:
            return None

        distance_expr = Image.prompt_embedding.cosine_distance(prompt_embedding).label(
            "distance",
        )
        object_key = (
            await self.db.execute(
                select(Image.object_key)
                .where(Image.prompt_embedding.isnot(None))
                .order_by(distance_expr.asc(), Image.id.asc())
                .limit(1)
            )
        ).scalar_one_or_none()
        return presign_get_url(object_key) if object_key else None

    async def _get_ordered_examples(
        self,
        example_ids: Sequence[int],
    ) -> List[ExampleBase]:
        if not example_ids:
            return []

        jp_word_ids = _array_agg_subquery(
            ExampleJpWord.jp_word_id,
            ExampleJpWord.jp_word_id.asc(),
            ExampleJpWord.example_id == Example.id,
        )
        audio_ids = _array_agg_subquery(
            Audio.id,
            Audio.id.asc(),
            Audio.example_id == Example.id,
        )
        error_report_ids = _array_agg_subquery(
            ErrorReport.id,
            ErrorReport.id.asc(),
            ErrorReport.example_id == Example.id,
        )
        rows = (
            await self.db.execute(
                select(
                    Example,
                    jp_word_ids.label("jp_word_ids"),
                    audio_ids.label("audio_ids"),
                    error_report_ids.label("error_report_ids"),
                )
                .where(Example.id.in_(example_ids))
            )
        ).all()
        rows_by_id = {row[0].id: row for row in rows}

        return [
            self._build_example_base(
                rows_by_id[example_id][0],
                rows_by_id[example_id][1],
                rows_by_id[example_id][2],
                rows_by_id[example_id][3],
            )
            for example_id in example_ids
            if example_id in rows_by_id
        ]

    async def _get_choice_ids(
        self,
        request: ExampleContextPlayRequest,
        text_embedding: Sequence[float] | None,
    ) -> List[int]:
        selected_example_ids: List[int] = []
        selected_example_id_set = set()
        if text_embedding is not None:
            distance_expr = Example.context_embedding.cosine_distance(text_embedding).label(
                "distance",
            )
            similar_examples = (
                select(
                    Example.id.label("example_id"),
                    distance_expr,
                )
                .where(Example.id != request.example_id)
                .where(Example.context_embedding.isnot(None))
                .where(Example.prompt_embedding.isnot(None))
                .order_by(distance_expr.asc(), Example.id.asc())
                .limit(100)
                .cte("similar_examples")
            )

            stmt = select(
                similar_examples.c.example_id,
                literal(0.0).label("average_reading"),
            ).select_from(similar_examples)
            if self.user is not None:
                ranked_skills = (
                    select(
                        UserJpWordSkill.word_id.label("word_id"),
                        UserJpWordSkill.reading.label("reading"),
                        func.row_number()
                        .over(
                            partition_by=UserJpWordSkill.word_id,
                            order_by=UserJpWordSkill.id.desc(),
                        )
                        .label("skill_rank"),
                    )
                    .where(UserJpWordSkill.user_id == self.user.id)
                    .subquery()
                )
                latest_skills = (
                    select(
                        ranked_skills.c.word_id,
                        ranked_skills.c.reading,
                    )
                    .where(ranked_skills.c.skill_rank == 1)
                    .subquery()
                )
                stmt = (
                    select(
                        similar_examples.c.example_id,
                        func.coalesce(
                            func.avg(func.coalesce(latest_skills.c.reading, 0)),
                            0.0,
                        ).label("average_reading"),
                    )
                    .select_from(similar_examples)
                    .outerjoin(
                        ExampleJpWord,
                        ExampleJpWord.example_id == similar_examples.c.example_id,
                    )
                    .outerjoin(
                        latest_skills,
                        latest_skills.c.word_id == ExampleJpWord.jp_word_id,
                    )
                    .group_by(similar_examples.c.example_id, similar_examples.c.distance)
                )
            elif request.skills:
                payload_skills_by_word_id = _normalize_word_skills(request.skills)
                if payload_skills_by_word_id:
                    payload_skills = values(
                        column("word_id", Integer),
                        column("reading", Integer),
                        name="payload_skills",
                    ).data(
                        [
                            (word_id, skill["reading"])
                            for word_id, skill in payload_skills_by_word_id.items()
                        ]
                    ).alias("payload_skills")
                    stmt = (
                        select(
                            similar_examples.c.example_id,
                            func.coalesce(
                                func.avg(func.coalesce(payload_skills.c.reading, 0)),
                                0.0,
                            ).label("average_reading"),
                        )
                        .select_from(similar_examples)
                        .outerjoin(
                            ExampleJpWord,
                            ExampleJpWord.example_id == similar_examples.c.example_id,
                        )
                        .outerjoin(
                            payload_skills,
                            payload_skills.c.word_id == ExampleJpWord.jp_word_id,
                        )
                        .group_by(similar_examples.c.example_id, similar_examples.c.distance)
                    )

            similar_rows = (
                await self.db.execute(
                    stmt.order_by(
                        similar_examples.c.distance.asc(),
                        similar_examples.c.example_id.asc(),
                    )
                )
            ).all()
            if similar_rows:
                similar_example_ids = [row.example_id for row in similar_rows]
                similar_rank = {
                    example_id: index
                    for index, example_id in enumerate(similar_example_ids)
                }
                average_readings_by_example_id = {
                    row.example_id: float(row.average_reading)
                    for row in similar_rows
                }

                closest_example_id = similar_example_ids[0]
                selected_example_ids.append(closest_example_id)
                selected_example_id_set.add(closest_example_id)

                remaining_similar_ids = [
                    example_id
                    for example_id in similar_example_ids
                    if example_id not in selected_example_id_set
                ]
                if remaining_similar_ids:
                    lowest_reading_example_id = min(
                        remaining_similar_ids,
                        key=lambda example_id: (
                            average_readings_by_example_id[example_id],
                            similar_rank[example_id],
                        ),
                    )
                    selected_example_ids.append(lowest_reading_example_id)
                    selected_example_id_set.add(lowest_reading_example_id)

                remaining_similar_ids = [
                    example_id
                    for example_id in similar_example_ids
                    if example_id not in selected_example_id_set
                ]
                if remaining_similar_ids:
                    middle_reading_example_id = min(
                        remaining_similar_ids,
                        key=lambda example_id: (
                            abs(average_readings_by_example_id[example_id] - 50),
                            similar_rank[example_id],
                        ),
                    )
                    selected_example_ids.append(middle_reading_example_id)
                    selected_example_id_set.add(middle_reading_example_id)

                remaining_similar_ids = [
                    example_id
                    for example_id in similar_example_ids
                    if example_id not in selected_example_id_set
                ]
                if remaining_similar_ids:
                    random_similar_example_id = random.choice(remaining_similar_ids)
                    selected_example_ids.append(random_similar_example_id)
                    selected_example_id_set.add(random_similar_example_id)

        if len(selected_example_ids) < 5:
            random_example_ids = (
                await self.db.execute(
                    select(Example.id)
                    .where(Example.id != request.example_id)
                    .where(Example.id.notin_(selected_example_ids))
                    .where(Example.prompt_embedding.isnot(None))
                    .order_by(func.random())
                    .limit(5 - len(selected_example_ids))
                )
            ).scalars().all()
            for example_id in random_example_ids:
                if example_id not in selected_example_id_set:
                    selected_example_ids.append(example_id)
                    selected_example_id_set.add(example_id)

        return selected_example_ids
