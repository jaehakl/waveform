
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

