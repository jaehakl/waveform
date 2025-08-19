# Copyright (C) 2023 Jaehak Lee

import pandas as pd
from .. import State

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
