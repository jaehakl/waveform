# Copyright (C) 2023 Jaehak Lee
import json, os
import numpy as np
import configparser

from matform import MetaSingleton
from qleaf.core.prop import Prop
from qleaf.comp.basic.table import TableEditorModel

from matform import eval_structure
from state import MainState

SOLVERS = configparser.ConfigParser()
SOLVERS.read(os.getenv('QUTAT_BASE_DIR')+'/SOLVERS.ini')
print(SOLVERS)

class State(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        self.solver = Prop("FDTD:MEEP")
        self.solver.updated.connect(self.set_solver)
        self.solvers = {}

        self.data_table_models = {}
        self.data_form_dicts = {}
        self.data_form_keys = {}
        self.color_regions_rendered = {}
        self.display = {
            "space":Prop(True)
        }


        self.input_vars_defined = Prop({})
        #self.input_vars_defined.updated.connect(self.set_input_vars)

        self.current_setup_data = Prop([None, None])
        self.current_process_list = Prop([])
        self.current_entity_list = Prop([])
        self.setup_data_list = Prop({})

        self.structure_evaluated = Prop([{}])
        self.entity_array_dict = Prop({})

        self.fig_update = [Prop(None) for i in range(3)]
        self.result_spectra = Prop({})
        self.result_arrays = Prop({})
        self.result_images = Prop({})

        self.gl_eye = Prop(np.array([10.0,10.0,10.0]))
        print("fdtd/state/State (Metasingleton) is created : ,",MainState().account_id.get())


    def find_solvers(self):
        self.solvers = {}
        for solver in SOLVERS.sections():
            category = solver.split(":")[0]
            solver_name = solver.split(":")[1]
            if category in self.solvers.keys():
                self.solvers[category].append(solver_name)
            else:
                self.solvers[category] = [solver_name]
            if "IS_DEFAULT" in SOLVERS[solver].keys():
                if SOLVERS[solver]["IS_DEFAULT"] == "1":
                    self.solver.set(solver)
        return self.solvers
    
    def set_solver(self):
        solver = self.solver.get()

        input_vars_path = os.getenv('QUTAT_BASE_DIR')+"/"+SOLVERS[solver]["input_variables"]

        dict_by_order = {}
        for filename in os.listdir(input_vars_path):
            input_vars = json.load(open(input_vars_path+"/"+filename))

            meta = input_vars["meta"]
            if meta["order"] not in dict_by_order.keys():
                dict_by_order[meta["order"]] = []
            dict_by_order[meta["order"]].append(input_vars)

        self.set_setup_data(input_vars_all=dict_by_order)
        print("Solver set to",self.solver.get())


    def eval_setup_data(self):
        structure_evaluated, array_dict = eval_structure(
                self.data_table_models["structures"].get().exportDataFrame(),
                self.data_table_models["components"].get().exportDataFrame()
        )
        self.structure_evaluated.set(structure_evaluated)
        self.entity_array_dict.set(array_dict)

    def set_setup_data(self, input_vars_all):
        #for key in self.data_table_models.keys():
        #    self.data_table_models[key].get().dataChanged.disconnect()
        self.data_table_models = {}
        self.data_form_keys = {}
        self.data_form_dicts = {}
        self.color_regions_rendered = {}
        self.display = {
            "space":Prop(True)
        }

        for order in sorted(input_vars_all.keys()):
            for input_vars in input_vars_all[order]:
                meta = input_vars["meta"]

                if meta['type'] == "table":
                    table_name = meta["key"]
                    table_model = TableEditorModel(
                        defaultRowDict=input_vars["default_values"],
                        row_direction="vertical"
                    )
                    self.data_table_models[table_name] = Prop(table_model)
                    for i in input_vars["init_values"].keys():
                        table_model.appendDict(input_vars["init_values"][i])

                    if "color" in meta.keys():
                        self.color_regions_rendered[table_name] = meta["color"]
                        self.display[table_name] = Prop(True)
                elif meta['type'] == "dict":
                    self.data_form_keys[meta["key"]] = Prop(input_vars["keys"])
                    self.data_form_dicts[meta["key"]] = Prop(input_vars["default_values"])
                                            
        for key in ["structures","components"]:
            self.data_table_models[key].get().dataChanged.connect(self.eval_setup_data)
        self.eval_setup_data()

        State().input_vars_defined.set(input_vars_all)




