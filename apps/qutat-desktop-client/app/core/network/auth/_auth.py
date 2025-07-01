# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

import requests, json, os

from matform import MetaSingleton
from qleaf.core.prop import Prop

from core.network.backend_api import RestApi

COOKIE_PATH = os.getenv('QUTAT_BASE_DIR')+"/cookies.json"

class State(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        self.user_info = Prop({})
        self.cookies = Prop({})
        self.auth_host = Prop(os.getenv('AUTH_HOST'))
        self.post_login_func = []
        self.post_logout_func = []

        if os.path.exists(COOKIE_PATH):
            with open(COOKIE_PATH, "r") as f:
                try:
                    cookies = json.load(f)         
                    self.cookies.set(cookies)
                except:
                    print("Invalid cookie file")


def get(url, **kwargs):
    return http_request(url, requests.get, **kwargs)

def post(url, *args, **kwargs):
    return http_request(url, requests.post, *args, **kwargs)

def put(url, *args, **kwargs):
    return http_request(url, requests.put, *args, **kwargs)

def delete(url, **kwargs):
    return http_request(url, requests.delete, **kwargs)

def http_request(url, http_method, *args, **kwargs):
    cookies = State().cookies.get()
    kwargs["cookies"] = cookies
    auth_host = State().auth_host.get()    

    try:        
        resp = http_method(auth_host+url, *args, **kwargs)
        cookies.update(requests.utils.dict_from_cookiejar(resp.cookies))
        State().cookies.set(cookies)
        return resp
    except:
        return None


def login(user_auth_info):
    resp = post(RestApi.users_login(),user_auth_info)

    if resp == None:
        return None
    elif resp.status_code != 200:
        return None
    else:
        if os.getenv('AUTH_AUTO_LOGIN'):
            with open(COOKIE_PATH, "w") as f:
                json.dump(State().cookies.get(), f)        
        check_login_user()
        for func in State().post_login_func:
            func()
        return resp

def logout():
    resp = post(RestApi.users_logout(),{})
    cookies = requests.utils.dict_from_cookiejar(resp.cookies)
    State().cookies.set(cookies)

    if os.getenv('AUTH_AUTO_LOGIN'):
        if os.path.exists(COOKIE_PATH):
            os.remove(COOKIE_PATH)

    for func in State().post_logout_func:
        func()
    State().user_info.set({})
    return resp

def get_user_info():
    return State().user_info.get()

def check_login_user():
    resp = get(RestApi.users_user())
    if resp != None:
        if resp.status_code == 401:
            if os.path.exists(COOKIE_PATH):
                os.remove(COOKIE_PATH)
            State().cookies.set({})
        else:
            State().user_info.set(json.loads(resp.text))
        return json.loads(resp.text)
    else:
        return {}

def add_post_login_func(func):
    State().post_login_func.append(func)

def add_post_logout_func(func):
    State().post_logout_func.append(func)