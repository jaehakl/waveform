from initserver import server

# Add this import for the actor service
#from service import article_service

app = server()

#@app.post("/analyze-article/")
#async def analyze_article(data: dict):
#    return await article_service.analyze_article(data)
#
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
#    return await article_service.find_articles_by_filters(query)