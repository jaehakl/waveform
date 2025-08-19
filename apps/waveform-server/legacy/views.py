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