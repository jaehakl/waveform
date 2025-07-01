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




