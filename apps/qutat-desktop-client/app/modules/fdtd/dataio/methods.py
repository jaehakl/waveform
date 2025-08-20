# Copyright (C) 2023 Jaehak Lee
# Legacy Methods (2025.08.19)

import json, io, requests, time
import pandas as pd

from api.auth import get, post, put, delete
from api import api as RestApi

from .. import State
from ..service import setup_io

def save_setup_local(filename=''):
    data_json = json.dumps(setup_io.get_setup_data())
    if filename != '':
        with open(filename, 'w') as f:
            f.write(data_json)

def load_setup_local(filename=''):
    setup_data = None
    if filename != '':
        with open(filename, 'r') as f:
            data = json.load(f)
        if data != None:
            setup_io.set_setup_data(data)
    return setup_data


def import_entity_list(setup_id):
    entity_list = get(RestApi.results(setup_id)).json()
    for i, entity in enumerate(entity_list):
        entity["title"] = str(i) + '_' + entity["title"]
    State().current_entity_list.set(entity_list)

def import_process_list(setup_id):
    process_list = get(RestApi.public_process_search_by_setup(setup_id)).json()
    for i, process in enumerate(process_list):
        process["title"] = str(i) + '_' + process["input"]
    State().current_process_list.set(process_list)


def delete_entity(input_id):
    delete(RestApi.model_input(input_id))
    setup_id = State().current_setup_data.get()[0]
    import_entity_list(setup_id)

def delete_process(process_id):
    delete(RestApi.model_process2(process_id))
    setup_id = State().current_setup_data.get()[0]
    import_process_list(setup_id)

def get_result_data_as_excel():
    spectra = State().result_spectra.get()
    if spectra:
        with io.BytesIO() as buffer:
            with pd.ExcelWriter(buffer) as w:
                for name in spectra.keys():
                    pd.DataFrame(spectra[name]).to_excel(w, sheet_name=name)
            return buffer.getvalue()
    else:
        return None

def upload_input(setup_id, entity_array_dict):
    file_data = {"file":("input.json",json.dumps(entity_array_dict))}
    resp = post(RestApi.model_input("var"),{
        "title": time.strftime("%Y-%m-%d %H:%M:%S"),
        "setup_id":setup_id,
    }, files=file_data)
    return resp










