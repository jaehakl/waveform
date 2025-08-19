# Copyright (C) 2023 Jaehak Lee

import json, io, requests, time
import pandas as pd

from api.auth import get, post, put, delete
from api import api as RestApi

from .. import State
from .. import setup

def save_setup_local(filename=''):
    data_json = json.dumps(setup.get_setup_data())
    if filename != '':
        with open(filename, 'w') as f:
            f.write(data_json)

def load_setup_local(filename=''):
    setup_data = None
    if filename != '':
        with open(filename, 'r') as f:
            data = json.load(f)
        if data != None:
            setup.set_setup_data(data)
    return setup_data

def import_setup_data_from_url(url):
    setup_data = requests.get(url).json()

    def check_columns(json_data, ref_data):
        for key in ref_data.keys():
            if key not in json_data.keys():
                return False
            else:
                if type(json_data[key]) == type(ref_data[key]):
                    pass
                elif type(json_data[key]) in [int, float, bool] and type(ref_data[key]) in [int, float, bool]:
                    pass
                else:
                    if json_data[key] == "":
                        return False
        return True

    
    original_data = {
        #"detector":setup.detector.default_detector(),
        #"structure":default_structure(),
        #"structure_evaluated":default_structure(),
        #"component":default_structure(),
        #"source":setup.source.NEW_SOURCE_GAUSSIAN,        
        #"simulation":setup.simulation.DEFAULT_PARS,
        "materials":setup.material.NEW_MATERIAL,
        "material_sus":setup.material.NEW_SUSCEPTIBILITY
    }

    for name in original_data.keys():
        if name == "simulation":
            data_list = [setup_data[name]]
        else:
            data_list = setup_data[name]
        ref_data = original_data[name]
        for i in range(len(data_list)):
            if not check_columns(data_list[i], ref_data):
                print("Invalid setup data")
                return None
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

def upload_setup_data(setup_data, file_data={}):
    setup_data_json = json.dumps(setup.get_setup_data())
    file_data['setup_data'] = ("setup.json",setup_data_json)
    resp = post(RestApi.model_setup("var"), setup_data, files=file_data )
    get_setup_data_list_online()
    return resp

def upload_input(setup_id, entity_array_dict):
    file_data = {"file":("input.json",json.dumps(entity_array_dict))}
    resp = post(RestApi.model_input("var"),{
        "title": time.strftime("%Y-%m-%d %H:%M:%S"),
        "setup_id":setup_id,
    }, files=file_data)
    return resp

def delete_current_setup_data():
    setup_id = State().current_setup_data.get()[0]
    resp = delete(RestApi.model_setup(setup_id))
    get_setup_data_list_online()
    State().current_setup_data.set([None, None])
    State().current_entity_list.set([])
    return resp







def get_setup_data_list_online():
    resp = get(RestApi.setup_list())
    if resp == None:
        return
    elif resp.status_code != 200:
        return
    else:
        setup_list = resp.json()['setups']
        print(setup_list)
        setup_data_dict = {}
        for setup in setup_list:
            solver = setup["solver"]
            if solver not in setup_data_dict.keys():
                setup_data_dict[solver] = []
            setup_data_dict[solver].append(setup)
        State().setup_data_list.set(setup_data_dict)