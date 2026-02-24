# Source Snapshot: C:\Users\JLee\Desktop\waveform\apps\qutat-cloud-django

## Directory Structure

```text
qutat-cloud-django
|-- app
|   |-- account
|   |   `-- email
|   |       |-- email_confirmation_message.txt
|   |       |-- email_confirmation_signup_message.txt
|   |       |-- email_confirmation_signup_subject.txt
|   |       `-- email_confirmation_subject.txt
|   |-- backend
|   |   |-- __init__.py
|   |   |-- asgi.py
|   |   |-- settings.py
|   |   |-- urls.py
|   |   |-- uwsgi.ini
|   |   `-- wsgi.py
|   |-- core
|   |   |-- __init__.py
|   |   |-- auth.py
|   |   |-- storage.py
|   |   `-- view.py
|   |-- qutat
|   |   |-- migrations
|   |   |   |-- 0001_initial.py
|   |   |   |-- 0002_output_input.py
|   |   |   |-- 0003_input.py
|   |   |   |-- 0004_input_description_input_public_input_results_exist_and_more.py
|   |   |   |-- 0005_output2.py
|   |   |   |-- 0006_output2file.py
|   |   |   |-- 0007_remove_outputfile_output_remove_process_setup_and_more.py
|   |   |   |-- 0008_input_process_exist.py
|   |   |   |-- 0009_alter_input_results_exist.py
|   |   |   |-- 0010_setup_solver.py
|   |   |   `-- __init__.py
|   |   |-- __init__.py
|   |   |-- admin.py
|   |   |-- apps.py
|   |   |-- models.py
|   |   |-- serializers.py
|   |   |-- tests.py
|   |   |-- urls.py
|   |   |-- views.py
|   |   `-- views_public.py
|   |-- users
|   |   |-- migrations
|   |   |   |-- 0001_initial.py
|   |   |   |-- 0002_identificationtoken.py
|   |   |   |-- 0003_identificationtoken_grade.py
|   |   |   |-- 0004_alter_identificationtoken_grade.py
|   |   |   `-- __init__.py
|   |   |-- __init__.py
|   |   |-- admin.py
|   |   |-- apps.py
|   |   |-- managers.py
|   |   |-- models.py
|   |   |-- serializers.py
|   |   |-- tests.py
|   |   |-- urls.py
|   |   `-- views.py
|   |-- manage.py
|   |-- nohup.out
|   `-- requirements.txt
|-- scripts
|   |-- 0_win_setup.bat
|   |-- 1_win_run_server.bat
|   |-- nginx.conf
|   |-- u1__sudo_sh_setup.sh
|   |-- u2__source_setup_node.sh
|   |-- u3_source_import_client.sh
|   |-- u4_source_import_server.sh
|   |-- u5_source_execute_client.sh
|   `-- u6_source_execute_server.sh
|-- .env
|-- .env.example
|-- db.sqlite3
|-- poetry.lock
`-- pyproject.toml
```

## Files

### app/account/email/email_confirmation_message.txt

```text
Email Confirmation Message
1
```

### app/account/email/email_confirmation_signup_message.txt

```text
안녕하세요

Qutat.net 을 이용해 주셔서 감사합니다.

이메일 인증 링크를 보내드립니다. 

아래 링크를 클릭한 뒤, 제출하신 정보로 로그인하면 사용자 등록이 완료됩니다.
{{ activate_url }}
```

### app/account/email/email_confirmation_signup_subject.txt

```text
이메일 인증 링크를 보내드립니다.
```

### app/account/email/email_confirmation_subject.txt

```text
Email Confirmation Subject
4
```

### app/backend/__init__.py

```python
```

### app/backend/asgi.py

```python
"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

application = get_asgi_application()
```

### app/backend/settings.py

```python
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
```

### app/backend/urls.py

```python
from django.contrib import admin
from django.urls import path, include

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('users/', include('users.urls')),
    path('qutat/', include('qutat.urls')),
]
#urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
#urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

### app/backend/uwsgi.ini

```ini
[uwsgi]
# Django-related settings
chdir           = /home/ubuntu/bin/server/
module          = backend.wsgi
home            = /home/ubuntu/venv/

# process-related settings
master          = true
processes       = 2

# the socket (use the full path to be safe)
#http 		= :8000
#socket		= :8000
socket          = /home/ubuntu/bin/nginx_to_django.sock

chmod-socket    = 711
vacuum          = true
```

### app/backend/wsgi.py

```python
"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

application = get_wsgi_application()
```

### app/core/__init__.py

```python
```

### app/core/auth.py

```python
import jwt
from http.cookies import SimpleCookie
from backend.settings import SIMPLE_JWT
from users.models import User

def get_user(request):
    cookie = SimpleCookie()    
    cookie.load(request.headers['Cookie'])
    cookies = {k: v.value for k, v in cookie.items()}

    key = cookies['user-auth']
    payload = jwt.decode(key, 
                         SIMPLE_JWT['SIGNING_KEY'], 
                         algorithms=[SIMPLE_JWT['ALGORITHM']])

    user = User.objects.get(pk=payload['user_id'])
    return user
```

### app/core/storage.py

```python
from storages.backends.s3boto3 import S3Boto3Storage
from storages.backends.s3boto3 import S3StaticStorage

class AwsMediaStorage(S3Boto3Storage):
    location = "media"
    default_acl = "public-read"

class AwsStaticStorage(S3StaticStorage):
    location = "static"
    default_acl = "public-read"
```

### app/core/view.py

```python

import uuid, os, io, json, random, requests, sys, uuid

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import Http404

from rest_framework.permissions import IsAuthenticated, AllowAny

from core.auth import get_user


class ModelView(APIView):
    permission_classes = [IsAuthenticated]
    model = None
    serializer = None
    def get(self, request, var=None, **filter_values):
        n_page = int(var.split("_")[0])
        i_page = int(var.split("_")[1])

        user = get_user(request)
        model_data = self.model.objects.filter(user=user.pk).filter(**filter_values)
        serializer = self.serializer(model_data, many=True)
        rv = serializer.data
        rv = rv[max(0,min(n_page*i_page,len(rv))):
                max(0,min(n_page*(i_page+1),len(rv)))]
        return Response(rv)
    
    def post(self, request, var=None, format=None):
        user = get_user(request)
        data = request.data
        print(request.data)
        item = self.model()
        if hasattr(item, "id"):
            item.id = str(uuid.uuid4().hex)
        if hasattr(item, "user"):
            item.user = user
        elif hasattr(item, "user_id"):
            item.user_id = user.pk   
        if hasattr(item, "ip_address"):
            item.ip_address = request.META['REMOTE_ADDR']
        elif hasattr(item, "ip_addr"):
            item.ip_addr = request.META['REMOTE_ADDR']
        elif hasattr(item, "ip"):
            item.ip = request.META['REMOTE_ADDR']
        for key in data.keys():
            if hasattr(item, key):
                if hasattr(item.__dict__[key],"name"):
                    if hasattr(item, "id"):
                        data[key].name = item.id + "." + data[key].name
                setattr(item, key, data[key])
        print(item.__dict__)
        try:
            item.save()
        except:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        return Response(self.serializer(item).data,status=status.HTTP_201_CREATED)

    def put(self, request, var, format=None):
        user = get_user(request)
        data = request.data

        item = self.get_item_if_owner(var, user)
    
        for key in data.keys():
            if hasattr(item, key):
                setattr(item, key, data[key])

        try:
            item.save()
        except:
            return Response(status=status.HTTP_400_BAD_REQUEST)        
        return Response(self.serializer(item).data,status=status.HTTP_200_OK)

    def delete(self, request, var, format=None):
        user = get_user(request)
        item = self.get_item_if_owner(var, user)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_item_if_owner(self, pk, user):
        user_items = self.model.objects.filter(user=user.pk)
        try:
            if hasattr(self.model, "id"):
                item = user_items.get(id=pk)
            else:
                item = user_items.get(pk=pk)            
        except self.model.DoesNotExist:
            raise Http404
        return item 
```

### app/manage.py

```python
#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys

def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
```

### app/qutat/__init__.py

```python
```

### app/qutat/admin.py

```python
from django.contrib import admin
from .models import *

# Register your models here.
admin.site.register(Setup)
admin.site.register(Process2)
admin.site.register(Input)
admin.site.register(Output2)
admin.site.register(Output2File)
admin.site.register(ResultFile)
admin.site.register(ImageFile)
```

### app/qutat/apps.py

```python
from django.apps import AppConfig

class QutatConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'qutat'  
```

### app/qutat/migrations/0001_initial.py

```python
# Generated by Django 4.2.4 on 2023-11-24 07:12

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Output',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('title', models.CharField(default='Untitled', max_length=200)),
                ('public', models.BooleanField(default=False)),
                ('description', models.TextField(blank=True, null=True)),
                ('thumbnail', models.ImageField(blank=True, null=True, upload_to='result/image/')),
            ],
        ),
        migrations.CreateModel(
            name='Setup',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=200)),
                ('setup_data', models.FileField(upload_to='setup/json/')),
                ('public', models.BooleanField(default=False)),
                ('work_request', models.IntegerField(default=0)),
                ('description', models.TextField(blank=True, null=True)),
                ('thumbnail', models.ImageField(blank=True, null=True, upload_to='setup/image/')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='Process',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('ip_address', models.CharField(max_length=200)),
                ('status', models.CharField(blank=True, max_length=200, null=True)),
                ('preview', models.ImageField(blank=True, null=True, upload_to='process/image/')),
                ('setup', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='qutat.setup')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='OutputFile',
            fields=[
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('file', models.FileField(upload_to='result/json/')),
                ('output', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='qutat.output')),
            ],
        ),
        migrations.AddField(
            model_name='output',
            name='setup',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='qutat.setup'),
        ),
        migrations.AddField(
            model_name='output',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
        ),
        migrations.CreateModel(
            name='ImageFile',
            fields=[
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('file', models.ImageField(upload_to='etc/image/')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
```

### app/qutat/migrations/0002_output_input.py

```python
# Generated by Django 4.2.4 on 2023-12-05 06:09

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qutat', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='output',
            name='input',
            field=models.FileField(blank=True, null=True, upload_to='result/json/'),
        ),
    ]
```

### app/qutat/migrations/0003_input.py

```python
# Generated by Django 4.2.4 on 2024-02-13 08:00

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('qutat', '0002_output_input'),
    ]

    operations = [
        migrations.CreateModel(
            name='Input',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('title', models.CharField(default='Untitled', max_length=200)),
                ('file', models.FileField(blank=True, null=True, upload_to='input/json/')),
                ('setup', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='qutat.setup')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
```

### app/qutat/migrations/0004_input_description_input_public_input_results_exist_and_more.py

```python
# Generated by Django 4.2.4 on 2024-02-13 08:55

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('qutat', '0003_input'),
    ]

    operations = [
        migrations.AddField(
            model_name='input',
            name='description',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='input',
            name='public',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='input',
            name='results_exist',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='input',
            name='thumbnail',
            field=models.ImageField(blank=True, null=True, upload_to='result/image/'),
        ),
        migrations.CreateModel(
            name='ResultFile',
            fields=[
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('file', models.FileField(upload_to='result/json/')),
                ('input', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='qutat.input')),
            ],
        ),
        migrations.CreateModel(
            name='Process2',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('ip_address', models.CharField(max_length=200)),
                ('status', models.CharField(blank=True, max_length=200, null=True)),
                ('preview', models.ImageField(blank=True, null=True, upload_to='process/image/')),
                ('input', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='qutat.input')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
```

### app/qutat/migrations/0005_output2.py

```python
# Generated by Django 4.2.4 on 2024-02-14 01:14

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('qutat', '0004_input_description_input_public_input_results_exist_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Output2',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('title', models.CharField(default='Untitled', max_length=200)),
                ('public', models.BooleanField(default=False)),
                ('description', models.TextField(blank=True, null=True)),
                ('thumbnail', models.ImageField(blank=True, null=True, upload_to='result/image/')),
                ('input', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='qutat.input')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
```

### app/qutat/migrations/0006_output2file.py

```python
# Generated by Django 4.2.4 on 2024-02-14 01:23

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('qutat', '0005_output2'),
    ]

    operations = [
        migrations.CreateModel(
            name='Output2File',
            fields=[
                ('id', models.CharField(max_length=200, primary_key=True, serialize=False)),
                ('file', models.FileField(upload_to='result/json/')),
                ('output', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='qutat.output2')),
            ],
        ),
    ]
```

### app/qutat/migrations/0007_remove_outputfile_output_remove_process_setup_and_more.py

```python
# Generated by Django 4.2.4 on 2024-02-14 06:41

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('qutat', '0006_output2file'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='outputfile',
            name='output',
        ),
        migrations.RemoveField(
            model_name='process',
            name='setup',
        ),
        migrations.RemoveField(
            model_name='process',
            name='user',
        ),
        migrations.DeleteModel(
            name='Output',
        ),
        migrations.DeleteModel(
            name='OutputFile',
        ),
        migrations.DeleteModel(
            name='Process',
        ),
    ]
```

### app/qutat/migrations/0008_input_process_exist.py

```python
# Generated by Django 4.2.4 on 2024-02-14 08:14

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qutat', '0007_remove_outputfile_output_remove_process_setup_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='input',
            name='process_exist',
            field=models.BooleanField(default=False),
        ),
    ]
```

### app/qutat/migrations/0009_alter_input_results_exist.py

```python
# Generated by Django 4.2.4 on 2024-02-19 13:38

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qutat', '0008_input_process_exist'),
    ]

    operations = [
        migrations.AlterField(
            model_name='input',
            name='results_exist',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
```

### app/qutat/migrations/0010_setup_solver.py

```python
# Generated by Django 4.2.4 on 2024-09-03 04:00

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qutat', '0009_alter_input_results_exist'),
    ]

    operations = [
        migrations.AddField(
            model_name='setup',
            name='solver',
            field=models.TextField(default='FDTD:PEEM'),
            preserve_default=False,
        ),
    ]
```

### app/qutat/migrations/__init__.py

```python
```

### app/qutat/models.py

```python
from django.db import models
from users.models import User
#from django.dispatch import receiver
#from django.utils.translation import ugettext_lazy as _

class Setup(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    id = models.CharField(max_length=200, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)    
    title = models.CharField(max_length=200)
    solver = models.TextField()
    setup_data = models.FileField(upload_to='setup/json/')
    public = models.BooleanField(default=False)
    work_request = models.IntegerField(default=0)
    description = models.TextField(null=True,blank=True)
    thumbnail = models.ImageField(upload_to='setup/image/',null=True,blank=True)

class Input(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    id = models.CharField(max_length=200, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200, default="Untitled")
    setup = models.ForeignKey(Setup, on_delete=models.CASCADE, db_index=True)
    file = models.FileField(upload_to='input/json/',null=True,blank=True)
    public = models.BooleanField(default=False)
    process_exist = models.BooleanField(default=False)
    results_exist = models.BooleanField(default=False, db_index=True)
    description = models.TextField(null=True,blank=True)
    thumbnail = models.ImageField(upload_to='result/image/',null=True,blank=True)

class Output2(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    id = models.CharField(max_length=200, primary_key=True) 
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200, default="Untitled")
    input = models.ForeignKey(Input, on_delete=models.CASCADE)
    public = models.BooleanField(default=False)
    description = models.TextField(null=True,blank=True)
    thumbnail = models.ImageField(upload_to='result/image/',null=True,blank=True)

class ImageFile(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    file = models.ImageField(upload_to='etc/image/')

class Output2File(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    output = models.ForeignKey(Output2, on_delete=models.CASCADE)
    file = models.FileField(upload_to='result/json/')

class Process2(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    id = models.CharField(max_length=200, primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    ip_address = models.CharField(max_length=200)
    input = models.ForeignKey(Input, null=True, blank=True, on_delete=models.CASCADE)
    status = models.CharField(null=True, blank=True, max_length=200)
    preview = models.ImageField(upload_to='process/image/',null=True,blank=True)

class ResultFile(models.Model):
    id = models.CharField(max_length=200, primary_key=True)
    input = models.ForeignKey(Input, on_delete=models.CASCADE, db_index=True)
    file = models.FileField(upload_to='result/json/')

'''
@receiver(models.signals.post_delete, sender=Setup)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.setup_data:
        instance.setup_data.delete(save=False)
    if instance.thumbnail:
        instance.thumbnail.delete(save=False)

@receiver(models.signals.post_delete, sender=Input)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)
    if instance.thumbnail:
        instance.thumbnail.delete(save=False)

@receiver(models.signals.post_delete, sender=Output2)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.thumbnail:
        instance.thumbnail.delete(save=False)

@receiver(models.signals.post_delete, sender=ImageFile)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)

@receiver(models.signals.post_delete, sender=Output2File)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)

@receiver(models.signals.post_delete, sender=Process2)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.preview:
        instance.preview.delete(save=False)

@receiver(models.signals.post_delete, sender=ResultFile)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)
'''
```

### app/qutat/serializers.py

```python
import json, io, sys
from rest_framework.response import Response
from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework import status

import pandas as pd

import uuid
from django.utils import timezone

from rest_framework import serializers

from .models import *

class SetupSerializer(serializers.ModelSerializer):
    setup_data = serializers.FileField(max_length=None, use_url=True)

    class Meta:
        model = Setup
        fields = ['created_at','id', 'user', 'title', 'solver', 'setup_data','public','work_request','description','thumbnail']


class InputSerializer(serializers.ModelSerializer):
    file = serializers.FileField(max_length=None, use_url=True)
    class Meta:
        model = Input
        fields = ['created_at','id', 'user', 'title', 'setup','file','public','results_exist','description','thumbnail']

class ResultsSerializer(serializers.ModelSerializer):
    file = serializers.FileField(max_length=None, use_url=True)
    output_data_files = serializers.SerializerMethodField('get_output_file_url')
    class Meta:
        model = Input
        fields = ['created_at','id', 'user', 'title', 'setup','file','output_data_files','public','results_exist','description','thumbnail']

    def get_output_file_url(self, obj):
        try:
            output_data_urls = {}
            output_data_files = Output2File.objects.filter(output__input=obj)
            for file in output_data_files:
                output_data_urls[file.id] =  file.file.url
            return output_data_urls
        except:
            return None


class Output2Serializer(serializers.ModelSerializer):
    output_data_files = serializers.SerializerMethodField('get_output_file_url')

    class Meta:
        model = Output2
        fields = ['created_at','id', 'user', 'title', 'input','public','description','thumbnail',
                  'output_data_files']
            
    def get_output_file_url(self, obj):
        try:
            output_data_urls = {}
            output_data_files = Output2File.objects.filter(output=obj)
            for file in output_data_files:
                output_data_urls[file.id] =  file.file.url
            return output_data_urls
        except:
            return None


class Output2Parser():
    def __init__(self, user_pk, multipart_formdata):
        self.data = {}        
        self.data["id"] = str(uuid.uuid4().hex)
        self.data["user"] = user_pk
        self.data["title"] = multipart_formdata['title']
        self.data['input'] = multipart_formdata['input_id']
        if 'thumbnail' in multipart_formdata.keys():
            self.data["thumbnail"] = multipart_formdata['thumbnail']
            self.data["thumbnail"].name = self.data["id"] + "_thumbnail.png"

        self.files = {}
        for key in multipart_formdata.keys():
            data = multipart_formdata[key]
            if type(data).__name__ == "InMemoryUploadedFile":
                if key == "thumbnail":
                    pass
                else:
                    self.files[key] = {}
                    data.name = self.data["id"] + "." + data.name
                    self.files[key]["id"] = data.name
                    self.files[key]["output"] = self.data["id"]
                    self.files[key]["file"] = data

    def write_data(self):
        serializer = Output2Serializer(data=self.data) #create          
        if serializer.is_valid():
            serializer.save()
        else:
            print(serializer.errors)

        for key in self.files.keys():
            serializer = Output2FileSerializer(data=self.files[key]) #create
            if serializer.is_valid():
                serializer.save()
            else:
                print(serializer.errors)


class Output2FileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Output2File
        fields = ['id','output', 'file']


class ResultFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResultFile
        fields = ['id', 'input', 'file']


class Process2Parser():
    def __init__(self, user_pk, ip_address, multipart_formdata):
        self.data = multipart_formdata.copy()
        self.data["user"] = user_pk
        self.data["ip_address"] = ip_address
        if 'preview' in self.data.keys():
            self.data["preview"].name = str(uuid.uuid4().hex) + ".png"

    def write_data(self):
        if "id" not in self.data.keys():
            self.data["id"] = str(uuid.uuid4().hex)
            serializer = Process2Serializer(data=self.data) #create          
        else:
            process = Process2.objects.get(id=self.data["id"])
            serializer = Process2Serializer(process, data=self.data) #update

        if serializer.is_valid():
            serializer.save()
        else:
            print(serializer.errors)
        return serializer.data

    
class Process2Serializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)
    time_elapsed = serializers.SerializerMethodField('get_time_elapsed')
    class Meta:
        model = Process2
        fields = ['created_at','id', 'user', 'ip_address', 'input','status','preview',
                  'time_elapsed']
        
    def get_time_elapsed(self, obj):
        current_time = timezone.now()
        time_elapsed = current_time - obj.created_at
        return int(time_elapsed.total_seconds())
```

### app/qutat/tests.py

```python
from django.test import TestCase

# Create your tests here.
```

### app/qutat/urls.py

```python
from django.urls import path
from rest_framework.urlpatterns import format_suffix_patterns
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAuthenticatedOrReadOnly

from core.view import ModelView

from .models import *
from .serializers import *
from .views import *
from .views_public import *

urlpatterns = [
    path('public/setup/list/',PublicSetupListView.as_view()),
    path('public/setup/data/<str:setup_id>/',PublicSetupDataView.as_view()),
    path('public/setup/evaluate/',EvaluateSetupView.as_view()),

    path('public/process2/search/setup/<str:setup_id>/',PublicProcessSearchBySetupView.as_view()),
    path('setup/data/<str:setup_id>/',PublicSetupDataView.as_view()),

    path('input/generate/<str:setup_id>/<str:num_input>/',InputGenerationView.as_view()),
    path('model/setup/<str:var>/',ModelView.as_view(model=Setup,serializer=SetupSerializer)),
    path('model/input/<str:var>/',ModelView.as_view(model=Input,serializer=InputSerializer)),    
    path('find/input/<str:var>/<str:setup_id>/',ModelView.as_view(model=Input,serializer=InputSerializer)),    
    path('results/<str:setup_id>/',SetupResultsView.as_view()),
    path('results_wo_output/<str:setup_id>/',SetupResultsWoOutputView.as_view()),

    path('setup/tasks/<str:setup_id>/',SetupRemainTasksView.as_view()),
    path('output2/files/<str:input_id>/',Output2FilesView.as_view()),
    path('results/files/<str:input_id>/',ResultsFilesView.as_view()),
    path('entity/data/<str:input_id>/',EntityDataView.as_view()),

    path('process/request-task2/',RequestTask2View.as_view()),
    path('model/process2/<str:var>/',Process2View.as_view()),
    path('process2/return/<str:process_id>/',Process2ReturnView.as_view()),

    path('image/upload/',ImageFileUploadView.as_view()),
]

urlpatterns = format_suffix_patterns(urlpatterns)
```

### app/qutat/views.py

```python
import uuid, os, io, json, random, requests, sys, uuid, copy, datetime
import time

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import Http404

from core.view import ModelView
from .serializers import *
from .models import *

from rest_framework.permissions import IsAuthenticated, AllowAny
from matform import eval_structure

import pandas as pd

from core.auth import get_user


class ImageFileUploadView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, format=None):
        user = get_user(request)
        files = request.data.getlist('files[]')
        urls = []       
        for file in files:
            file.name = str(uuid.uuid4().hex) + ".png"
            image_file = ImageFile(id=file.name, user=user, file=file)
            image_file.save()
            urls.append(image_file.file.url)
        return Response({"urls":urls}, status=status.HTTP_201_CREATED)


class SetupResultsView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, setup_id, format=None):
        inputs = Input.objects.filter(setup=setup_id, results_exist=True)
        time_0 = time.time()

        input_serializer = InputSerializer(inputs, many=True)
        input_item_dict = {}
        for input_item in input_serializer.data:
            input_item["output_data_files"] = []
            input_item_dict[input_item["id"]] = input_item

        result_files = ResultFile.objects.filter(input__setup=setup_id)                

        for i, file in enumerate(result_files):
            if file.id.endswith(".json"):
                input_item_dict[file.input_id]['output_data_files'].append(
                    {
                        'id': file.id,
                        'input': file.input_id,
                        'file': file.file.url
                    }
                )
            elif file.id.endswith(".pickle"):
                input_item_dict[file.input_id]['output_data_files'].append(
                    {
                        'id': file.id,
                        'input': file.input_id,
                        'file': file.file.url
                    }
                )

        input_data = []
        for input_item in input_serializer.data:
            if "output_data_files" not in input_item.keys():
                continue
            elif len(input_item['output_data_files'])==0:
                continue
            else:
                input_data.append(input_item)

        return Response(input_data)

class SetupResultsWoOutputView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, setup_id, format=None):
        inputs = Input.objects.filter(setup=setup_id, results_exist=True)
        input_serializer = InputSerializer(inputs, many=True)
        return Response(input_serializer.data)  


class SetupRemainTasksView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, setup_id, format=None):
        user = get_user(request)

        inputs_remain = Input.objects.filter(setup=setup_id, user=user.pk, results_exist=False)
        inputs_remain_serializer = InputSerializer(inputs_remain, many=True)
        inputs_remain_data = inputs_remain_serializer.data

        processes_remain = Process2.objects.filter(input__setup=setup_id, user=user.pk)
        processes_remain_serializer = Process2Serializer(processes_remain, many=True)
        processes_remain_data = processes_remain_serializer.data
        for process in processes_remain_data:
            process_input = Input.objects.get(id=process["input"])
            process_input_serializer = InputSerializer(process_input)
            process["input_id"] = process["input"]
            process["input"] = process_input_serializer.data

        tasks_remain = {"inputs":inputs_remain_data, "processes":processes_remain_data}
        return Response(tasks_remain)

class Output2View(ModelView):
    permission_classes = [IsAuthenticated]
    model = Output2
    serializer = Output2Serializer
    def post(self, request, var=None, format=None):
        user = get_user(request)
        data = request.data
        parser = Output2Parser(user.pk, data)
        parser.write_data() 
        return Response(status=status.HTTP_201_CREATED)


class Output2FilesView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, input_id, format=None):
        outputs = Output2.objects.filter(input=input_id)
        output_serializer = Output2Serializer(outputs, many=True)
        return Response(output_serializer.data)    


class ResultsFilesView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, input_id, format=None):

        result_files = ResultFile.objects.filter(input=input_id)
        result_files_serializer = ResultFileSerializer(result_files, many=True)

        return Response(result_files_serializer.data)    


class EntityDataView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, input_id, format=None):
        model_data = Input.objects.get(id=input_id)
        serializer = InputSerializer(model_data)    
        rv = serializer.data

        rv["user"] = model_data.user.email
        rv["setup_title"] = model_data.setup.title
        if model_data.setup.thumbnail:
            rv["setup_thumbnail"] = model_data.setup.thumbnail.url        

        if model_data.description==None:
            rv["description"] = ""
        else:
            rv["description"] = model_data.description

        setup_data = requests.get(model_data.setup.setup_data.url).json()
        array_dict = requests.get(model_data.file.url).json()

        structure_evaluated, array_dicts = eval_structure(
            pd.DataFrame(setup_data['structures']),
            pd.DataFrame(setup_data['components']),
            array_dicts_init=array_dict)
        rv["setup_data"] = setup_data
        rv["setup_data"]["structure_evaluated"] = structure_evaluated

        rv["data"] = {}
        rv["images"] = {}
        rv["files"] = {}
        result_files = ResultFile.objects.filter(input=input_id)
        for result_file in result_files:
            id = result_file.id
            url = result_file.file.url
            if url.endswith(".json"):                             
                json_file = requests.get(url)
                json_dict = json.loads(json_file.content)
                rv["data"][id] = json_dict
            elif url.endswith(".png"):
                rv["images"][id.split('.')[1]] = url
            else:
                rv["files"][id] = url
        return Response(rv, status=status.HTTP_200_OK)


class InputGenerationView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, setup_id, num_input, format=None):
        num_input = int(num_input)
        user = get_user(request)
        setup = Setup.objects.get(id=setup_id)
        setup_data = requests.get(setup.setup_data.url).json()

        item_list = []
        for i in range(num_input):
            item = Input()
            item.id = str(uuid.uuid4().hex)
            item.title = datetime.datetime.now().strftime("%Y%m%d%H%M%S") + str(i) 

            item.user = user
            item.setup = setup
            structure_evalulated, array_dicts = eval_structure(
                pd.DataFrame(setup_data['structures']),
                pd.DataFrame(setup_data['components']))

            file = InMemoryUploadedFile(
                io.BytesIO(json.dumps(array_dicts).encode()),
                None,
                item.id + ".json",
                'application/json',
                sys.getsizeof(json.dumps(array_dicts)),
                None)
            item.file = file
            item.save()
            item_list.append(item.id)
        return Response(item_list, status=status.HTTP_201_CREATED)


class RequestTask2View(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, format=None):        
        user = get_user(request)
        model_data = Input.objects.filter(user=user.pk).exclude(results_exist=True)

        if len(model_data)==0:
            return Response(status=status.HTTP_204_NO_CONTENT)

        i_data = random.randint(0,len(model_data)-1)
        item = model_data[i_data]

        rv = {"setup_id":item.setup.id,
              "setup_data":item.setup.setup_data.url,
              "setup_solver":item.setup.solver,
              "input_id":item.id,
              "input_data":item.file.url}
        return Response(rv)


class Process2View(ModelView):
    permission_classes = [IsAuthenticated]
    model = Process2
    serializer = Process2Serializer
    def post(self, request, var=None, format=None):
        user = get_user(request)
        input = Input.objects.get(id=request.data["input"])

        if Process2.objects.filter(input=input).exists():
            return Response(status=status.HTTP_400_BAD_REQUEST)

        item = self.model()
        item.id = str(uuid.uuid4().hex)
        item.user = user
        item.ip_address = request.META['REMOTE_ADDR']
        item.input = input                

        try:
            item.save()
        except:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        
        return Response(self.serializer(item).data,status=status.HTTP_201_CREATED)

    def delete(self, request, var, format=None):
        resp = super().delete(request, var)
        if resp.status_code == 204:
            input = Input.objects.get(id=Process2.objects.get(id=var).input.id)
            input.results_exist = False
            input.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class Process2ReturnView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, process_id, format=None):
        user = get_user(request)
        data = request.data
        data["title"] = Process2.objects.get(id=process_id).input.title + " 결과"
        data["input_id"] = Process2.objects.get(id=process_id).input.id
        Process2.objects.get(id=process_id).delete()

        for key in data.keys():
            if type(data[key]).__name__ == "InMemoryUploadedFile":
                if key == "thumbnail":
                    pass
                else:
                    data[key].name = data["input_id"] + "." + data[key].name
                    file_data = {
                        "id": data[key].name,
                        "input": data["input_id"],
                        "file": data[key]
                    }

                    serializer = ResultFileSerializer(data=file_data) #create
                    if serializer.is_valid():
                        serializer.save()
                    else:                        
                        print(serializer.errors)
                        break

        input = Input.objects.get(id=data["input_id"])
        input.results_exist = True
        input.save()

        return Response(status=status.HTTP_201_CREATED)
```

### app/qutat/views_public.py

```python
import requests

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from matform import eval_structure
from .serializers import *
from .models import *

from rest_framework.permissions import AllowAny


class PublicSetupListView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, format=None):              
        model_data = Setup.objects.filter(public=True)
        serializer = SetupSerializer(model_data, many=True)
        return Response(serializer.data)


class PublicSetupDataView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, setup_id, format=None):
        model_data = Setup.objects.get(id=setup_id)

        serializer = SetupSerializer(model_data)
        setup_data = serializer.data
        setup_data["user"] = model_data.user.email
        setup_data['created_at'] = model_data.created_at.strftime("%Y-%m-%d %H:%M:%S")

        setup_url = setup_data['setup_data']
        resp = requests.get(setup_url)
        if resp.status_code == 200:
            setup_json = requests.get(setup_url).json()
            setup_data['setup_data'] = setup_json
        else:
            setup_data['setup_data'] = {}
        return Response(setup_data,status=status.HTTP_200_OK)
    
class EvaluateSetupView(APIView):
    permission_classes = [AllowAny]
    def post(self,request,format=None):
        if 'structure' in request.data.keys():            
            structure_df = pd.DataFrame(request.data['structures'])
        else:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        if 'component' in request.data.keys():
            component_df = pd.DataFrame(request.data['components'])
        else:
            component_df = pd.DataFrame()
        entity_list, array_dicts = eval_structure(structure_df, component_df)
        return Response([entity_list,array_dicts],status=status.HTTP_200_OK)

class PublicProcessSearchBySetupView(APIView):
    permission_classes = [AllowAny]
    def get(self, request, setup_id, format=None):
        processes = Process2.objects.filter(input__setup=setup_id)
        serializer = Process2Serializer(processes, many=True)
        return Response(serializer.data)
        
```

### app/requirements.txt

```text
asgiref==3.7.2
boto3==1.28.27
botocore==1.31.27
certifi==2023.7.22
cffi==1.15.1
charset-normalizer==3.2.0
contourpy==1.1.0
cryptography==38.0.4
cycler==0.11.0
DateTime==5.2
defusedxml==0.7.1
Deprecated==1.2.14
dj-rest-auth==4.0.1
Django==4.2.4
django-allauth==0.54.0
django-cors-headers==4.2.0
django-storages==1.13.2
djangorestframework==3.14.0
djangorestframework-simplejwt==5.2.2
et-xmlfile==1.1.0
fonttools==4.42.0
idna==3.4
jmespath==1.0.1
kiwisolver==1.4.4
matform==0.1.6
matplotlib==3.9.2
multipledispatch==1.0.0
numpy==1.25.2
oauthlib==3.2.2
openpyxl==3.1.2
packaging==23.1
pandas==2.0.3
Pillow==10.0.1
psutil==5.9.5
pycparser==2.21
PyJWT==2.8.0
PyMySQL==1.1.0
pyparsing==3.0.9
python-dateutil==2.8.2
python3-openid==3.2.0
pytz==2023.3
requests==2.31.0
requests-oauthlib==1.3.1
s3transfer==0.6.2
six==1.16.0
sqlparse==0.4.4
typing_extensions==4.7.1
tzdata==2023.3
urllib3==1.26.16
wrapt==1.15.0
xlrd==2.0.1
zope.interface==6.0
```

### app/users/__init__.py

```python
```

### app/users/admin.py

```python
from django.contrib import admin
from .models import *

# Register your models here.
admin.site.register(User)
```

### app/users/apps.py

```python
from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'
```

### app/users/managers.py

```python
from django.contrib.auth.base_user import BaseUserManager
from django.utils.translation import gettext_lazy as _

class UserManager(BaseUserManager):
    def create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError(_('The Email must be set'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save()
        return user
    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        return self.create_user(email, password, **extra_fields)
    


    
```

### app/users/migrations/0001_initial.py

```python
# Generated by Django 4.2.4 on 2023-10-05 08:55

from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('first_name', models.CharField(blank=True, max_length=150, verbose_name='first name')),
                ('last_name', models.CharField(blank=True, max_length=150, verbose_name='last name')),
                ('is_staff', models.BooleanField(default=False, help_text='Designates whether the user can log into this admin site.', verbose_name='staff status')),
                ('is_active', models.BooleanField(default=True, help_text='Designates whether this user should be treated as active. Unselect this instead of deleting accounts.', verbose_name='active')),
                ('date_joined', models.DateTimeField(default=django.utils.timezone.now, verbose_name='date joined')),
                ('email', models.EmailField(max_length=254, unique=True, verbose_name='email address')),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'verbose_name': 'user',
                'verbose_name_plural': 'users',
                'abstract': False,
            },
        ),
    ]
```

### app/users/migrations/0002_identificationtoken.py

```python
# Generated by Django 4.2.4 on 2024-09-02 07:20

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='IdentificationToken',
            fields=[
                ('id', models.AutoField(primary_key=True, serialize=False)),
                ('token', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
```

### app/users/migrations/0003_identificationtoken_grade.py

```python
# Generated by Django 4.2.4 on 2024-09-02 07:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_identificationtoken'),
    ]

    operations = [
        migrations.AddField(
            model_name='identificationtoken',
            name='grade',
            field=models.IntegerField(default=0),
        ),
    ]
```

### app/users/migrations/0004_alter_identificationtoken_grade.py

```python
# Generated by Django 4.2.4 on 2024-09-03 01:01

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_identificationtoken_grade'),
    ]

    operations = [
        migrations.AlterField(
            model_name='identificationtoken',
            name='grade',
            field=models.IntegerField(default=1),
        ),
    ]
```

### app/users/migrations/__init__.py

```python
```

### app/users/models.py

```python
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _
# Create your models here.
from .managers import UserManager


class IdentificationToken(models.Model):
    id = models.AutoField(primary_key=True)
    token = models.TextField()
    user = models.ForeignKey('User', on_delete=models.CASCADE)
    grade = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.email} - {self.token}'


class User(AbstractUser):
    username = None
    email = models.EmailField(_('email address'), unique=True)

    USERNAME_FIELD = 'email'    
    REQUIRED_FIELDS = []

    objects = UserManager()
    def __str__(self):
        return self.email
```

### app/users/serializers.py

```python

from rest_framework import serializers

from .models import *

class IdentificationTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = IdentificationToken
        fields = ['id', 'token', 'user', 'grade', 'created_at', 'updated_at']
```

### app/users/tests.py

```python
from django.test import TestCase

# Create your tests here.
```

### app/users/urls.py

```python
from django.urls import path, include, re_path

from dj_rest_auth.registration.views import VerifyEmailView

from core.view import ModelView
from .serializers import IdentificationTokenSerializer
from .models import IdentificationToken
from .views import CustomRegisterView, GenerateIdentificationTokenView, CheckIdentificationTokenView

urlpatterns = [
    path('', include('dj_rest_auth.urls')),

    # 일반 회원 회원가입
    #path('registration/', include('dj_rest_auth.registration.urls')),
    path('registration/', CustomRegisterView.as_view(), name='rest_register'),
    # 유효한 이메일이 유저에게 전달    
    #re_path(r'^account-confirm-email/$', VerifyEmailView.as_view(), name='account_email_verification_sent'),
    # 유저가 클릭한 이메일(=링크) 확인
    #re_path(r'^account-confirm-email/(?P<key>[-:\w]+)/$', ConfirmEmailView.as_view(), name='account_confirm_email'),
    path('token/new/',GenerateIdentificationTokenView.as_view()),
    path('token/view/<str:var>/',ModelView.as_view(model=IdentificationToken,serializer=IdentificationTokenSerializer)),
    path('token/check/',CheckIdentificationTokenView.as_view())
]
```

### app/users/views.py

```python
import uuid

from django.shortcuts import render

# Create your views here.


from django.http import HttpResponseRedirect

from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from dj_rest_auth.registration.views import RegisterView
from .models import *


class GenerateIdentificationTokenView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        token = str(uuid.uuid4())
        user = request.user
        identification_token = IdentificationToken.objects.create(token=token, user=user)
        return Response({'token': token}, status=status.HTTP_200_OK)    


class CheckIdentificationTokenView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):        
        token = request.data['token']
        try:      
            identification_token = IdentificationToken.objects.get(token=token)
            print(identification_token.user.id)
            return Response({
                'grade': identification_token.grade,
                "user": identification_token.user.email,
            }, status=status.HTTP_200_OK)
        except IdentificationToken.DoesNotExist:
            return Response({
                'grade': 0,
                "user": "Unknown",
            }, status=status.HTTP_200_OK)
        

class CustomRegisterView(RegisterView):
    permission_classes = [AllowAny]
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        data = self.get_response_data(user)

        # Deactivate user until email is confirmed
        #user.is_active = False
        # Just Activate user (No email confirmation)
        user.is_active = True
        user.save()

        if data:
            response = Response(
                data,
                status=status.HTTP_201_CREATED,
                headers=headers,
            )
        else:
            response = Response(status=status.HTTP_204_NO_CONTENT, headers=headers)

        return response


#class ConfirmEmailView(APIView):
#    permission_classes = [AllowAny]
#
#    def get(self, *args, **kwargs):
#        self.object = confirmation = self.get_object()
#
#        # Activate user if email confirmation is successful
#        user = confirmation.email_address.user
#        user.is_active = True
#        user.save()        
#
#        confirmation.confirm(self.request)
#        # A React Router Route will handle the failure scenario
#        #return HttpResponseRedirect('http://localhost:3000/qutat/account/') # 인증성공
#        return HttpResponseRedirect('http://www.qutat.net/qutat/account/') # 인증성공
#
#    def get_object(self, queryset=None):
#        key = self.kwargs['key']
#        email_confirmation = EmailConfirmationHMAC.from_key(key)
#        if not email_confirmation:
#            if queryset is None:
#                queryset = self.get_queryset()
#            try:
#                email_confirmation = queryset.get(key=key.lower())
#            except EmailConfirmation.DoesNotExist:
#                # A React Router Route will handle the failure scenario
#                return HttpResponseRedirect('/') # 인증실패
#        return email_confirmation
#
#    def get_queryset(self):
#        qs = EmailConfirmation.objects.all_valid()
#        qs = qs.select_related("email_address__user")
#        return qs
#
```

### pyproject.toml

```toml
# /apps/backend-fastapi/pyproject.toml

[tool.poetry]
name = "qutat-cloud-django"
version = "0.0.1"
description = "Qutat Cloud Server"
authors = ["Jaehak Lee <leejaehak87@gmail.com>"]
package-mode = false

[tool.poetry.dependencies]
matform = { path = "../../packages/python/matform", develop = true }
python = ">=3.10, <3.13"
django = "^5.2.3"
pymysql = "^1.1.1"
dotenv = "^0.9.9"
djangorestframework = "^3.16.0"
django-cors-headers = "^4.7.0"
django-allauth = "^65.9.0"
dj-rest-auth = "^7.0.1"
djangorestframework-simplejwt = "^5.5.0"
requests = "^2.32.4"

[tool.poetry.group.dev.dependencies]
pytest = "^8.2.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
```

### scripts/0_win_setup.bat

```bat
@echo off
call _config.bat

rem tar -zxf ./src.tar.gz -C ./

rem setup node client
xcopy %cPath%\src\client\ %cPath%\bin\client\ /eYq
cd %cPath%\bin\client\
call npm i --force
cd %cPath%

rem setup python server
python -m virtualenv --copies %cPath%\venv\server\
call %cPath%\venv\server\Scripts\activate.bat
xcopy %cPath%\src\server\ %cPath%\bin\server\ /eYq
pip install -r %cPath%\bin\server\requirements.txt
python %cPath%\bin\server\manage.py makemigrations
python %cPath%\bin\server\manage.py migrate
python %cPath%\bin\server\manage.py createsuperuser
call %cPath%\venv\server\Scripts\deactivate.bat


rem setup python desktop
python -m virtualenv --copies %cd%\venv\
call %cd%\venv\Scripts\activate.bat
xcopy %cd%\src\ %cd%\bin\ /eYq
pip install -r %cd%\bin\requirements.txt
rem call %cPath%\venv\desktop\Scripts\deactivate.bat
```

### scripts/1_win_run_server.bat

```bat
poetry run python ..\app\manage.py runserver
```

### scripts/u1__sudo_sh_setup.sh

```bash
#!/bin/sh
export HOME_PATH=/home/ubuntu

apt update
apt-get install nginx

apt install snapd
snap install --classic certbot
ln -s /snap/bin/certbot /usr/bin/certbot
certbot --nginx


#도메인 바뀔 시 nginx.conf 수정 필수
#certbot --nginx 까지 실행시킨 후, 
#default.bak 을 참고하여 nginx.conf 수정
cp /etc/nginx/conf.d/default /etc/nginx/conf.d/default.bak
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
cp $HOME_PATH/nginx.conf /etc/nginx/
nginx -s reload

apt install python3-pip
#apt install libglu1-mesa-dev
```

### scripts/u2__source_setup_node.sh

```bash
#!/bin/sh
source ./_config.sh

wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.36.0/install.sh | bash
source ~/.bashrc
nvm install 18
mkdir ~/bin
```

### scripts/u3_source_import_client.sh

```bash
#!/bin/sh
source ./_config.sh

rm -rf ~/bin/client/.next/
rm ~/bin/client/package.json

tar -xvf ~/client.tar.gz -C ~/bin/

cd ~/bin/client
npm install --force
cd ~
```

### scripts/u4_source_import_server.sh

```bash
#!/bin/sh
source ./_config.sh

rm -rf ~/bin/server/
rm -rf ~/src/

tar -xvf ~/src.tar.gz -C ~
cp ~/src/server/ ~/bin/server/ -r

python3 -m pip install virtualenv
python3 -m virtualenv --copies $PYTHON_VENV_PATH
source $PYTHON_VENV_PATH/bin/activate
pip install -r ~/bin/server/requirements.txt --no-cache-dir
pip install uwsgi

python ~/bin/server/manage.py makemigrations
python ~/bin/server/manage.py migrate
deactivate
```

### scripts/u5_source_execute_client.sh

```bash
#!/bin/sh
source ./_config.sh

cd ~/bin/client
nohup npm run start &
```

### scripts/u6_source_execute_server.sh

```bash
#!/bin/sh
source ./_config.sh

source $PYTHON_VENV_PATH/bin/activate

nohup uwsgi --ini ~/bin/server/backend/uwsgi.ini & 
#nohup python ~/bin/server/manage.py runserver 0:8001 & #runserver
```
