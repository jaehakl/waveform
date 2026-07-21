# aws_s3.py
import mimetypes
import uuid
from typing import BinaryIO

import boto3
from botocore.client import Config

from settings import settings

ALLOWED_IMAGE_CT = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_AUDIO_CT = {
    "audio/aac",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/x-wav",
}


def get_s3():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        endpoint_url=settings.S3_ENDPOINT_URL,
        config=Config(s3={"addressing_style": "virtual"}),
    )


def is_allowed_content_type(ct: str | None, kind: str = "image") -> bool:
    allowed_content_types = ALLOWED_AUDIO_CT if kind == "audio" else ALLOWED_IMAGE_CT
    return (ct or "") in allowed_content_types


def build_object_key(kind: str, filename: str | None) -> str:
    ext = ""
    if filename and "." in filename:
        ext = "." + filename.rsplit(".", 1)[-1].lower()
    if not ext:
        fallback_mime = "image/jpeg" if kind == "image" else "audio/mpeg"
        ext = mimetypes.guess_extension(fallback_mime) or ""

    prefix = "images" if kind == "image" else "audios"
    return f"{prefix}/{uuid.uuid4()}{ext}"


def upload_fileobj(fp: BinaryIO, key: str, content_type: str):
    s3 = get_s3()
    s3.upload_fileobj(
        Fileobj=fp,
        Bucket=settings.S3_BUCKET,
        Key=key,
        ExtraArgs={
            "ContentType": content_type,
            "ACL": "private",
            "CacheControl": "public, max-age=31536000",
        },
    )


def presign_get_url(key: str, expires: int = 7200) -> str:
    cdn_base = (settings.CDN_URL or "").strip()
    if cdn_base:
        cdn_base = cdn_base.rstrip("/")
        return f"{cdn_base}/{key}"

    s3 = get_s3()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key},
        ExpiresIn=expires,
    )


def delete_object(key: str):
    s3 = get_s3()
    s3.delete_object(Bucket=settings.S3_BUCKET, Key=key)
