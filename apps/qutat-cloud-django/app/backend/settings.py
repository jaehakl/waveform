import os
from pathlib import Path
import django
from datetime import timedelta
import pymysql
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(env_path)

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('QUTAT_CLOUD_DRF_SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True
ALLOWED_HOSTS = ['*']

DRF_HOST = os.getenv('DRF_HOST')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'qutat',

    'rest_framework',#DRF
    'corsheaders', #DRF

    #사용자 인증 기능
    'users', # 앱
    'rest_framework.authtoken',
    'dj_rest_auth',
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    #사용자 인증 기능 END
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
#DATABASES = {
#    'default': {
#        'ENGINE': 'django.db.backends.mysql',
#        'NAME': os.getenv('QUTAT_CLOUD_DRF_DB_NAME'),
#        'USER': os.getenv('QUTAT_CLOUD_DRF_DB_USER'),
#        'PASSWORD': os.getenv('QUTAT_CLOUD_DRF_DB_PASSWORD'),
#        'HOST': os.getenv('QUTAT_CLOUD_DRF_DB_HOST'),
#        'PORT': os.getenv('QUTAT_CLOUD_DRF_DB_PORT'),
#    }
#}
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
pymysql.version_info = (1, 4, 6, 'final', 0)
pymysql.install_as_MySQLdb()

# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'ko-kr'
TIME_ZONE = 'Asia/Seoul'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)

#...
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
#MEDIA_URL = '/media/'
#MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# (Optional) If you want to use AWS S3 storage for static files and media files,
#AWS_STORAGE_BUCKET_NAME = os.getenv('QUTAT_CLOUD_DRF_AWS_STORAGE_BUCKET_NAME')
#AWS_S3_ACCESS_KEY_ID = os.getenv('QUTAT_CLOUD_DRF_AWS_S3_ACCESS_KEY_ID')
#AWS_S3_SECRET_ACCESS_KEY = os.getenv('QUTAT_CLOUD_DRF_AWS_S3_SECRET_ACCESS_KEY')
#AWS_S3_REGION_NAME = "ap-northeast-2"
#AWS_QUERYSTRING_AUTH = False
#if AWS_S3_ACCESS_KEY_ID and AWS_S3_SECRET_ACCESS_KEY and AWS_STORAGE_BUCKET_NAME:
#    if django.VERSION < (4, 2):
#        DEFAULT_FILE_STORAGE = "core.storage.AwsMediaStorage"
#        STATICFILES_STORAGE = "core.storage.AwsStaticStorage"
#    else:
#        STORAGES = {
#            "default": {
#                "BACKEND": "core.storage.AwsMediaStorage",
#            },
#            "staticfiles": {
#                "BACKEND": "core.storage.AwsStaticStorage",
#            },
#        }


# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

CORS_ORIGIN_ALLOW_ALL = True
CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication',
    )
}

AUTH_USER_MODEL = 'users.User'
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
}

REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'user-auth', #Modify this
    'JWT_AUTH_REFRESH_COOKIE': 'user-refresh',#Modify this
    'JWT_AUTH_HTTPONLY':False,
}

SITE_ID = 1
ACCOUNT_AUTHENTICATION_METHOD = 'email'
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_USERNAME_REQUIRED = False