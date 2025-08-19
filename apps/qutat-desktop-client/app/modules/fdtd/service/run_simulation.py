
# Copyright (C) 2023 Jaehak Lee

import configparser
import os
import pickle, platform

from qleaf.core.main_window import show_status
from qleaf.proc import SubprocDict

from ..state import State
from ..service import setup_io

SOLVERS = configparser.ConfigParser()
SOLVERS.optionxform = str
SOLVERS.read(os.getenv('QUTAT_BASE_DIR')+'/SOLVERS.ini')    

def run_simulation():
    solver = State().solver.get()
    if solver in SOLVERS.sections():
        args = []
        if platform.system() == "Windows":
            for arg_key in ["WIN_ARG_0","WIN_ARG_1","WIN_ARG_2","WIN_ARG_3"]:
                if arg_key in SOLVERS[solver].keys():
                    args.append(SOLVERS[solver][arg_key])
        elif platform.system() == "Linux":
            for arg_key in ["LINUX_ARG_0","LINUX_ARG_1","LINUX_ARG_2","LINUX_ARG_3"]:
                if arg_key in SOLVERS[solver].keys():
                    args.append(SOLVERS[solver][arg_key])
        else:
            for arg_key in ["LINUX_ARG_0","LINUX_ARG_1","LINUX_ARG_2","LINUX_ARG_3"]:
                if arg_key in SOLVERS[solver].keys():
                    args.append(SOLVERS[solver][arg_key])                
        port = SubprocDict().open_subproc("sim",*args)

        if port != None:
            print("Executing "+solver + "using port" + str(port))
            SubprocDict().execute_subproc("sim_execute","sim",update_sim,lambda r: return_result(r),"run",setup_io.get_setup_data())
        else:
            print("Cannot execute "+solver)
    else:
        print("Not a valid solver")



def update_sim(r):
    show_status(r["status"])
    if "figures" in r.keys():
        for i, key in enumerate(r["figures"].keys()):
            State().fig_update[i].set(r["figures"][key])
            if i > 2:
                break

def return_result(r):
    if r != None:
        update_sim(r)
        pickle.dump(r, open("sim_result.pkl","wb"))
        State().result_arrays.set(r["arrays"])

        '''
        print(r["arrays"])
        output = {
            "spectra": {},
            "arrays": {},
        }
        for key, value in r["arrays"].items():
            if len(value.shape()) == 1:
                output["spectra"][key] = value
            else:
                output["arrays"][key] = value.data

        State().result_arrays.set(output["arrays"])
        State().result_images.set(r["images"])
        State().result_spectra.set(output["spectra"])
        '''

    SubprocDict().close_subproc("sim")