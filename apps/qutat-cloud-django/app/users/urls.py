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


