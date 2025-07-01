# Copyright (C) 2023 Jaehak Lee

import os, json
import pandas as pd

from matform.array.text_matrix_expression import parse_vectors, import_vector_series, import_series

def input_variables():
    input_vars = {}
    input_vars["_constants"] = json.load(open(os.path.dirname(os.path.realpath(__file__))+"/../_input_variables/_constants.json"))
    input_vars["_settings"] = json.load(open(os.path.dirname(os.path.realpath(__file__))+"/../_input_variables/_settings.json"))
    for filename in os.listdir(os.path.dirname(os.path.realpath(__file__))+"/../_input_variables"):
        if filename not in ["_settings.json","_constants.json"] and filename.endswith(".json"):
            json_data = json.load(open(os.path.dirname(os.path.realpath(__file__))+"/../_input_variables/"+filename))
            key = json_data["meta"]["key"]
            input_vars[key] = json_data["columns"]
    return input_vars

def import_df(df, item_dict, constants):
    c = constants
    if df.shape[1] > 0:
        for key in item_dict.keys():
            item = item_dict[key]
            if "type" in item.keys():
                if item["type"] == "vector":
                    if "unit" in item.keys():
                        unit = eval(item["unit"])
                        df[key] = import_vector_series(df[key],unit=unit)
            else:
                if "dtype" in item.keys():
                    if item["dtype"] == "float":
                        if "unit" in item.keys():
                            unit = eval(item["unit"])
                            df[key] = import_series(df[key],dtype=float,unit=unit)
                        else:
                            df[key] = import_series(df[key],dtype=float)
                    elif item["dtype"] == "int":
                        df[key] = import_series(df[key],dtype=int)
    return df

def import_parameters(input_dict):
    input_vars = input_variables()
    keys_constants = input_vars["_constants"]["keys"]
    c = {}
    for key in keys_constants.keys():
        value = eval(input_dict["_constants"][key])
        if keys_constants[key]["type"] == "int":
            c[key] = int(value)
        elif keys_constants[key]["type"] == "float":
            c[key] = float(value)
        else:
            c[key] = value

    rv = {}
    rv["_constants"] = c

    keys_settings = input_vars["_settings"]["keys"]
    setting = {}
    for key in keys_settings.keys():
        item = keys_settings[key] 
        if "type" in item.keys():
            if item["type"] == "vector":
                if "unit" in item.keys():
                    unit = eval(item["unit"])
                    setting[key] = [v*unit for v in parse_vectors(input_dict["_settings"][key])[0]]
                else:
                    setting[key] = parse_vectors(input_dict["_settings"][key])[0]
        else:
            if "dtype" in item.keys():
                if item["dtype"] == "float":
                    if "unit" in item.keys():
                        unit = eval(item["unit"])
                        setting[key] = float(input_dict["_settings"][key])*unit
                    else:
                        setting[key] = float(input_dict["_settings"][key])
                elif item["dtype"] == "int":
                    setting[key] = int(input_dict["_settings"][key])

    rv["_settings"] = setting
    rv["structure_evaluated"] = import_df(pd.DataFrame(input_dict["structure_evaluated"]), input_vars["structures"], c)
    rv["material"] = import_df(pd.DataFrame(input_dict["material"]), input_vars["materials"], c)
    rv["material_sus"] = import_df(pd.DataFrame(input_dict["material_sus"]), input_vars["materials_sus"], c)

    for key in input_vars.keys():
        if key in ["_constants","_settings"]:
            continue
        try:
            rv[key] = import_df(pd.DataFrame(input_dict[key]), input_vars[key], c)
        except:
            rv[key] = pd.DataFrame(input_dict[key])

    return rv

