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


