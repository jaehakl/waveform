import jwt
from http.cookies import SimpleCookie
from backend.settings import SIMPLE_JWT
from users.models import User

def get_user(request):
    cookie = SimpleCookie()    
    cookie.load(request.headers['Cookie'])
    cookies = {k: v.value for k, v in cookie.items()}

    key = cookies['user-auth']
    payload = jwt.decode(key, 
                         SIMPLE_JWT['SIGNING_KEY'], 
                         algorithms=[SIMPLE_JWT['ALGORITHM']])

    user = User.objects.get(pk=payload['user_id'])
    return user