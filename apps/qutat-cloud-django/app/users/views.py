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