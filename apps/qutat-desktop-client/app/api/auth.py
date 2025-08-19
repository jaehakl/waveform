# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

import requests, json, os

from matform import MetaSingleton
from qleaf.core.prop import Prop

from . import api

WAVEFORM_COOKIE_PATH = os.getenv('QUTAT_BASE_DIR')+"/waveform_cookies.json"

class AuthState(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        self.user_info = Prop({})
        self.cookies = Prop({})
        self.waveform_host = Prop(os.getenv('WAVEFORM_HOST', 'http://localhost:8000'))
        self.post_login_func = []
        self.post_logout_func = []

        if os.path.exists(WAVEFORM_COOKIE_PATH):
            print("waveform cookie file exists")
            with open(WAVEFORM_COOKIE_PATH, "r") as f:
                try:
                    cookies = json.load(f)         
                    self.cookies.set(cookies)
                except:
                    print("Invalid waveform cookie file")


def get(url, **kwargs):
    return http_request(url, requests.get, **kwargs)

def post(url, *args, **kwargs):
    return http_request(url, requests.post, *args, **kwargs)

def put(url, *args, **kwargs):
    return http_request(url, requests.put, *args, **kwargs)

def delete(url, **kwargs):
    return http_request(url, requests.delete, **kwargs)

def http_request(url, http_method, *args, **kwargs):
    cookies = AuthState().cookies.get()
    kwargs["cookies"] = cookies
    waveform_host = AuthState().waveform_host.get()  

    if http_method == requests.post and args and isinstance(args[0], dict):
        kwargs["json"] = args[0]
        args = args[1:]  # 첫 번째 인자를 제거 (json으로 전송하므로)
    try:        
        resp = http_method(waveform_host+url, *args, **kwargs)
        cookies.update(requests.utils.dict_from_cookiejar(resp.cookies))
        AuthState().cookies.set(cookies)
        return resp
    except Exception as e:
        print(f"HTTP request error: {e}")
        return None


def login(user_auth_info):
    resp = post(api.auth_login(), user_auth_info)
    if resp == None:
        print("로그인 요청 실패: 응답이 None")
        return None
    elif resp.status_code != 200:
        print(f"로그인 실패: 상태 코드 {resp.status_code}")
        print(f"오류 내용: {resp.text}")
        return None
    else:
        with open(WAVEFORM_COOKIE_PATH, "w") as f:
            json.dump(AuthState().cookies.get(), f)        
        for func in AuthState().post_login_func:
            func()
        return resp

def logout():
    resp = post(api.auth_logout(), {})    
    if resp and resp.status_code == 200:
        if os.path.exists(WAVEFORM_COOKIE_PATH):
            os.remove(WAVEFORM_COOKIE_PATH)        
        for func in AuthState().post_logout_func:
            func()        
        AuthState().cookies.set({})    
    return resp

def get_user_info():
    return AuthState().user_info.get()

def check_session():
    resp = get(api.auth_check_session())
    if resp != None:
        if resp.status_code == 401:
            if os.path.exists(WAVEFORM_COOKIE_PATH):
                os.remove(WAVEFORM_COOKIE_PATH)
            AuthState().cookies.set({})
            return None
        else:
            user_info = json.loads(resp.text)
            AuthState().user_info.set(user_info)
            return user_info
    else:
        return None

def add_post_login_func(func):
    AuthState().post_login_func.append(func)

def add_post_logout_func(func):
    AuthState().post_logout_func.append(func)