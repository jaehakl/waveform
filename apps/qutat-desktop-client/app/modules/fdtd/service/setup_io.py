# Copyright (C) 2023 Jaehak Lee

import json, io, requests, time
import pandas as pd

from api.auth import get, post, put, delete
from api import api as RestApi

from .. import State
from . import material

def setup_list_online():
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

def get_setup(setup_id):
    resp = get(RestApi.setup_get(setup_id))
    if resp == None:
        return
    elif resp.status_code != 200:
        return
    else:
        setup_data = resp.json()['setup']['setup_data']

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
        "materials":material.NEW_MATERIAL,
        "material_sus":material.NEW_SUSCEPTIBILITY
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


def upload_setup(data, file_data={}):
    data['setup_data'] = get_setup_data()
    resp = RestApi.setup_save(data)
    return resp


def delete_current_setup_in_server():
    setup_id = State().current_setup_data.get()[0]
    resp = RestApi.setup_delete(setup_id)
    State().current_setup_data.set([None, None])
    State().current_entity_list.set([])
    return resp


def get_setup_data():
    rv = {
        "solver":State().solver.get(),
        "structure_evaluated":State().structure_evaluated.get(),
        "materials":State().material_table_model.get().exportDataFrame().to_dict(orient="records"),
        "material_sus":State().material_sus.get().to_dict(orient="records"),
    }
    for table_name in State().data_table_models.keys():
        rv[table_name] = State().data_table_models[table_name].get().exportDataFrame().to_dict(orient="records")
    for key in State().data_form_dicts.keys():
        rv[key] = State().data_form_dicts[key].get()

    #set_setup_data(rv)
    return rv

def set_setup_data(setup_data=None):
    if setup_data != None:
        State().material_table_model.get().importDataFrame(pd.DataFrame(setup_data["materials"]))
        State().material_sus.set(pd.DataFrame(setup_data["material_sus"]))

        #State().structure_evaluated.set(setup_data["structure_evaluated"])
        for table_name in State().data_table_models.keys():
            State().data_table_models[table_name].get().importDataFrame(pd.DataFrame(setup_data[table_name]))
        for key in State().data_form_dicts.keys():
            State().data_form_dicts[key].set(setup_data[key])
    else:
        State().set_solver()
