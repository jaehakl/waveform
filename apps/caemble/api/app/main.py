from initserver import server
from routers import (
    audio,
    creator_helpers,
    error_report,
    example,
    gps_access_token,
    image,
    jp_word,
    text_analysis,
    user_jp_word_skill,
    user_text,
    users,
)

app = server()

app.include_router(example.router)
app.include_router(gps_access_token.router)
app.include_router(jp_word.router)
app.include_router(image.router)
app.include_router(creator_helpers.router)
app.include_router(audio.router)
app.include_router(user_jp_word_skill.router)
app.include_router(user_text.router)
app.include_router(error_report.router)
app.include_router(users.router)
app.include_router(text_analysis.router)
