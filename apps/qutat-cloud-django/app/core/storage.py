from storages.backends.s3boto3 import S3Boto3Storage
from storages.backends.s3boto3 import S3StaticStorage

class AwsMediaStorage(S3Boto3Storage):
    location = "media"
    default_acl = "public-read"

class AwsStaticStorage(S3StaticStorage):
    location = "static"
    default_acl = "public-read"