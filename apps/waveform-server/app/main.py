from initserver import server
from service import auth_service
from service import setup_service
from fastapi import Request, HTTPException, status, Response
from pydantic_models import LoginRequest

app = server()

@app.post("/auth/login/")
async def login(data: LoginRequest, response: Response):
    print(data, "login")
    result = await auth_service.authenticate_user(data.name, data.password, response)    
    return {"message": "Login successful", "session_id": result}

@app.get("/auth/check-session/")
async def check_session(request: Request):
    return await auth_service.check_session(request)

@app.get("/auth/logout/")
async def logout(request: Request, response: Response):
    return await auth_service.logout(request, response)


#Setup
#path('results/<str:setup_id>/',SetupResultsView.as_view()),
#path('results_wo_output/<str:setup_id>/',SetupResultsWoOutputView.as_view()),

@app.post("/setup/save/")
async def save_setup(data: dict, request: Request):
    return await setup_service.save_setup(data, request)

@app.get("/setup/{setup_id}")
async def get_setup(setup_id: str, request: Request):
    return await setup_service.get_setup(setup_id, request)

@app.get("/setup/list/")
async def get_setup_list(request: Request):
    return await setup_service.get_user_setups(request)

@app.delete("/setup/{setup_id}")
async def delete_setup(setup_id: str, request: Request):
    return await setup_service.delete_setup(setup_id, request)

@app.put("/setup/{setup_id}")
async def update_setup(setup_id: str, data: dict, request: Request):
    return await setup_service.update_setup(setup_id, data, request)

@app.get("/input-variables/")
async def get_input_variables():
    """
    input_variables JSON 파일들의 데이터를 반환합니다.
    """
    return setup_service.get_input_variables_data()


#Entity
#path('input/generate/<str:setup_id>/<str:num_input>/',InputGenerationView.as_view()),
#path('find/input/<str:var>/<str:setup_id>/',ModelView.as_view(model=Input,serializer=InputSerializer)),    
#path('model/input/<str:var>/',ModelView.as_view(model=Input,serializer=InputSerializer)),    
#path('entity/data/<str:input_id>/',EntityDataView.as_view()),

#Output
#path('output2/files/<str:input_id>/',Output2FilesView.as_view()),
#path('results/files/<str:input_id>/',ResultsFilesView.as_view()),

#Process
#path('setup/tasks/<str:setup_id>/',SetupRemainTasksView.as_view()),
#path('process/request-task2/',RequestTask2View.as_view()),
#path('model/process2/<str:var>/',Process2View.as_view()),
#path('process2/return/<str:process_id>/',Process2ReturnView.as_view()),
#path('public/process2/search/setup/<str:setup_id>/',PublicProcessSearchBySetupView.as_view()),
