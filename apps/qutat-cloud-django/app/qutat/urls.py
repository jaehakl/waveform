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