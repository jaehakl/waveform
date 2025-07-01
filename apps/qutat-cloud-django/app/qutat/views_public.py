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
        

