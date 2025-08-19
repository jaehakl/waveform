# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

import requests, json, time, uuid, copy, os
import pickle
import numpy as np

import pandas as pd
import platform

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

from matform import MetaSingleton
from qleaf.comp.basic import LineEditComp
from qleaf.core.prop import Prop
from qleaf.proc import SubprocDict

from api import auth

from matform import eval_structure

from . import dataio


import configparser
SOLVERS = configparser.ConfigParser()
SOLVERS.optionxform = str
SOLVERS.read(os.getenv('QUTAT_BASE_DIR')+'/SOLVERS.ini')

from api import api as RestApi

class PuppetDialogState(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        self.max_threads = Prop("4")

class PuppetDialog(QDialog):
    def __init__(self, parent):
        super().__init__(parent)
        self.threads = []
        self.setWindowTitle("Puppet Mode Manager")
        
        self.setLayout(QVBoxLayout())

        middle_layout = QHBoxLayout()
        self.layout().insertLayout(0, middle_layout)

        def set_max_threads(text):
            PuppetDialogState().max_threads.set(text)
        middle_layout.addWidget(
            LineEditComp(self,
                onChange=set_max_threads,
                props = {"label":Prop("실행할 쓰레드의 수"),"text":PuppetDialogState().max_threads})
        )

        manual_layout = QHBoxLayout()
        self.layout().insertLayout(1, manual_layout)

        repeat_button = QPushButton("실행")
        repeat_button.clicked.connect(self.run_threads)
        manual_layout.addWidget(repeat_button)

    def closeEvent(self, event):
        for th in self.threads:
            th.is_running = False

    def run_threads(self):
        max_threads = int(PuppetDialogState().max_threads.get())
        for i in range(max_threads):
            self.threads.append(ServeAsPuppetRepeat(self))
            self.threads[-1].start()

class ServeAsPuppetRepeat(QThread):
    update = Signal(object)
    finished_once = Signal(object)
    def __init__(self, parent=None):
        super().__init__(parent)
        self.is_running = True
        parent.destroyed.connect(self.stop)

    def run(self):
        n_repeat = 0
        while self.is_running:
            print("Awaiting task..",n_repeat)
            task = get_task_list(RestApi.process_request_task2())
            if task == None:
                time.sleep(0.5+5*np.random.rand())
                continue
            setup_data = dataio.import_setup_data_from_url(task["setup_data"])
            input_data = requests.get(task["input_data"]).json()
            if setup_data == None or input_data == None:
                auth.put(RestApi.model_input(task["input_id"]),
                    {"results_exist":False})
                continue
            else:
                process_data = register_process(task["input_id"])
                if process_data == None:
                    continue
                setup_data["structure_evaluated"], setup_data["structure_evaluated_array_dict"] = eval_structure(
                    pd.DataFrame(setup_data["structures"]),
                    pd.DataFrame(setup_data["components"]),
                    array_dicts_init=input_data
                    )
                setup_item = {
                    "id": task["setup_id"],
                    "setup_data": setup_data,
                    "solver": task["setup_solver"]
                }

                subproc_id = str(uuid.uuid4().hex)
                output_data = execute_simulation(setup_item,None,subproc_id=subproc_id)
                process_id = process_data["id"]
                return_process(process_id, output_data)
                SubprocDict().close_subproc(subproc_id)

            time.sleep(0.5)
            n_repeat += 1

    def stop(self):
        self.running = False
        self.quit()
        self.wait()

def get_task_list(url):
    resp = auth.get(url)
    if resp == None:
        task_list = None
    elif resp.status_code != 200:
        task_list = None
    else:
        task_list = resp.json()
    return task_list

def execute_simulation(setup_item,return_func=None,subproc_id="sim"):
    setup_data = setup_item["setup_data"]
    solver = setup_item["solver"]
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
        port = SubprocDict().open_subproc(subproc_id,*args)

        if port != None:
            if return_func == None:
                return SubprocDict().execute_subproc_sync(subproc_id,"run",setup_data)
            else:
                SubprocDict().execute_subproc("simulation"+str(uuid.uuid4().hex),subproc_id,None,return_func,"run",setup_data)
    else:
        print("Not a valid solver")



def register_process(input_id):
    resp = auth.post(RestApi.model_process2("var"),
        data={
            "input": input_id
        })
    if resp.status_code != 201:
        process_data = None
    else:
        process_data = resp.json()
    return process_data


def return_process(process_id, output_data):
    file_data = {}
    if "images" in output_data.keys():
        if len(output_data["images"]) > 0:
            file_data["thumbnail"] = ('thumbnail.png',list(output_data["images"])[0])
    output = {
        "arrays": output_data["arrays"],
    }
    file_data["output_data"] = ("output.pickle", pickle.dumps(output))
    for name in output_data["images"].keys():
        file_data[name] = (name+".png",output_data["images"][name])

    resp = auth.post(RestApi.process2_return(process_id),{},
        files=file_data)
    