# Copyright (C) 2023 Jaehak Lee

import json
import pandas as pd

from qleaf.core.abstract_comp import AbstractComp
from qleaf.core.prop import Prop
from qleaf.comp.basic.table import TableEditorModel

import os
from ..state import State

NEW_MATERIAL = {
    "id": "",
    "name":"",
    "eps":1,
    "cond":0,
    "chi2":0,
    "chi3":0,
    "sus":0,
    "fmin":0,
    "fmax":1,
}

MATERIAL_ID_LIST = {
    "Silicon":{
        "Si":"Silicon (Si)",
        "cSi":"Crystalline Silicon",
        "aSi":"Amorphous Silicon",
        "aSi_H":"Amorphous Silicon_H",
        "SiO2":"Silicon Dioxide (SiO2)",
        "SiO2_aniso":"Silicon Dioxide (SiO2) Anisotrophic",
        "Si3N4":"Silicon Nitride (Si3N4)",
        "Si3N4_VISNIR":"Silicon Nitride (Si3N4) at VIS-NIR",
        "Si3N4_NIR":"Silicon Nitride (Si3N4) at NIR",
        "SiN":"Silicon Nitride (SiN)",
        },
    "Noble Metal":{
        "Ag":"Silver (Ag)",
        #"Ag_visible":"Silver (Ag) (Johnson and Christy, visible)",
        "Au":"Gold (Au)",
        "Au_JC_visible":"Gold (Au) (Johnson and Christy, visible)",
        #"Au_visible":"Gold (Au) (Johnson and Christy, visible)",
        "Pt":"Platinum (Pt)",
    },
    "Aluminum":{
        "Al":"Aluminum (Al)",
        "Al2O3":"Aluminum Oxide (Al2O3)",
        "Al2O3_aniso":"Aluminum Oxide (Al2O3) Anisotrophic",
        "AlAs":"Aluminum Arsenide (AlAs)",
        "AlN":"Aluminum Nitride (AlN)",
        "AlN_aniso":"Aluminum Nitride (AlN) Anisotrophic",
        "Al_drude":"Aluminum (Al) (Drude)",
        #"Al_visible":"Aluminum (Al) (Johnson and Christy, visible)",
    },
    "Other Metal":{
        "Ti":"Titanium (Ti)",
        "Ti_drude":"Titanium (Ti) (Drude)",
        #"Ti_visible":"Titanium (Ti) (Johnson and Christy, visible)",
        "Cr":"Chromium (Cr)",
        "Cr_visible":"Chromium (Cr) (Johnson and Christy, visible)",
        "Cu":"Copper (Cu)",
        "Be":"Beryllium (Be)",
        "Ni":"Nickel (Ni)",
        "Pd":"Palladium (Pd)",
        "W":"Tungsten (W)",
        "Co":"Cobalt (Co)",
        "Mo":"Molybdenum (Mo)",
        "NiCr":"Nickel-Chromium (NiCr)",
        "NiFe":"Nickel-Iron (NiFe)",
    },
    "Semiconductor":{
        "InP":"Indium Phosphide (InP)",
        "Ge":"Germanium (Ge)",
        "GaN":"Gallium Nitride (GaN)",
        "GaAs":"Gallium Arsenide (GaAs)",
        },
    "Dielectric":{
        "PMMA":"Polymethyl Methacrylate (PMMA)",
        "PC":"Polycarbonate (PC)",
        "PS":"Polystyrene (PS)",
        "CLS":"Cyclic Olefin Copolymer (COC)",
        "BaB2O4":"Barium Borate (BaB2O4)",
        "LiNbO3":"Lithium Niobate (LiNbO3)",
        "CaWO4":"Calcium Tungstate (CaWO4)",
        "CaCO3":"Calcium Carbonate (CaCO3)",
        "Y2O3":"Yttrium Oxide (Y2O3)",
        "YAG":"Yttrium Aluminum Garnet (YAG)",
        "CdTe":"Cadmium Telluride (CdTe)",
        },
    "Other":{
        "ITO":"Indium Tin Oxide (ITO)",
        "BK7":"BK7",
        "fused_quartz":"Fused Quartz",
    }       
}

NEW_SUSCEPTIBILITY = {
    "material_id": "",
    "sus_class": "",
    "sigma": "",
    "frequency": "",
    "gamma": "",
}

def init_state():
    if getattr(init_state, "called", False):
        return
    init_state.called = True
    State().material_table_model = Prop(TableEditorModel(
        defaultRowDict=NEW_MATERIAL,
        row_direction="vertical"
    ))
    State().material_sus = Prop(pd.DataFrame(columns=["material_id","sus_class",
        "sigma","frequency","gamma"]))
    with open(os.getenv('QUTAT_BASE_DIR')+"/.materials/meep_material_lib.json") as f:
        State().material_lib_json = json.load(f)

    for id in ["cSi","SiO2","Au_JC_visible"]:
        add_material_from_lib(id)

def add_material_from_lib(id, name=None):
    material_lib_json = State().material_lib_json
    material_dict = {}
    material_dict["id"] = id
    material_dict["name"] = id if name==None else name
    material_dict["eps"] = get_mat_or_num(material_lib_json[id],"epsilon")
    material_dict["cond"]=get_mat_or_num(material_lib_json[id],"D_conductivity")
    material_dict["chi2"]=get_mat_or_num(material_lib_json[id],"E_chi2")
    material_dict["chi3"]=get_mat_or_num(material_lib_json[id],"E_chi3")
    material_dict["sus"]=get_susceptibilities(id, material_lib_json[id],"E_susceptibilities")
    material_dict["fmin"]=regular(material_lib_json[id]["valid_freq_range"][0])
    material_dict["fmax"]=regular(material_lib_json[id]["valid_freq_range"][1])
    State().material_table_model.get().appendDict(material_dict)

def regular(v):
    new_v = float(v)
    if new_v < -1000:
        return f"{new_v:.6e}"
    elif new_v > 1000:
        return f"{new_v:.6e}"
    else:
        return str(round(new_v,6))
    return str(v)

def get_mat_or_num(material, key, delimiter="|"):
    if key+"_diag" in material.keys():
        diags = material[key+"_diag"]
        if diags[0] == diags[1] == diags[2]:
            rv = regular(diags[0])
        else:
            rv = ",".join([regular(v) for v in diags])
        if key+"_offdiag" in material.keys():          
            offdiags = material[key+"_offdiag"]
            if offdiags[0] == offdiags[1] == offdiags[2]:
                rv += delimiter+regular(offdiags[0])
            else:
                rv += ",".join([regular(v) for v in offdiags])
    elif key in material.keys():
        rv = round(material[key],3)
    else:
        rv = "?"
    return rv

def get_susceptibilities(material_id, material, key):
    if key not in material.keys():
        return 0
    else:
        sus_df = State().material_sus.get()
        if 'material_id' in sus_df.columns:
            for sus in material[key]:
                sus_dict = {}
                sus_dict["material_id"] = material_id
                sus_dict["sus_class"] = sus["sus_class"]
                sus_dict["sigma"] = get_mat_or_num(sus,"sigma")
                sus_dict["frequency"] = regular(sus["frequency"])
                sus_dict["gamma"] = sus["gamma"]
                sus_df.loc[len(sus_df)] = sus_dict
        return len(material[key])

init_state()