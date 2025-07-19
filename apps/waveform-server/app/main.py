from initserver import server
from service import auth_service
from service import setup_service
from fastapi import Request, HTTPException, status, Response

# Add this import for the actor service
#from service import article_service

app = server()

@app.post("/auth/login/")
async def login(data: dict, response: Response):
    print(data)
    result = await auth_service.authenticate_user(data['name'], data['password'], response)    
    return {"message": "Login successful", "session_id": result}

@app.get("/auth/check-session/")
async def check_session(request: Request):
    return await auth_service.check_session(request)

@app.get("/auth/logout/")
async def logout(request: Request, response: Response):
    return await auth_service.logout(request, response)


@app.post("/setup/save/")
async def save_setup(data: dict, request: Request):
    return await setup_service.save_setup(data, request)


@app.get("/setup/{setup_id}")
async def get_setup(setup_id: str, request: Request):
    return await setup_service.get_setup(setup_id, request)

@app.get("/setup/list/")
async def get_setup_list(request: Request):
    return await setup_service.get_user_setups(request)


#@app.post("/save-article/")
#async def save_article(data: dict):
#    return await article_service.save_article(data)
#
#@app.get("/delete-article/{articleId}")
#async def delete_article(articleId: int):
#    return await article_service.delete_article(articleId)
#
#@app.get("/get-article/{articleId}")
#async def get_article(articleId: int):
#    return await article_service.get_article(articleId)
#
#@app.post("/find-articles/")
#async def find_articles(query: dict):