
from rest_framework import serializers

from .models import *

class IdentificationTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = IdentificationToken
        fields = ['id', 'token', 'user', 'grade', 'created_at', 'updated_at']

