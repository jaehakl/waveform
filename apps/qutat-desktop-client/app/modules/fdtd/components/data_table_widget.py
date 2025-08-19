import copy
from functools import partial
from PySide6.QtWidgets import QLineEdit
from PySide6.QtCore import Qt

from qleaf.core.abstract_comp import AbstractComp
from qleaf.comp.basic.table import TableEditorComp
from qleaf.comp.basic.form import FormComp

from ..state import State
from ..service import material
from .susceptibility_editor_dialog import SusceptibilityEditorDialog


class DictFormWidget(AbstractComp):
    def __init__(self, key):
        super().__init__(props = {
            "data":State().data_form_dicts[key],
            "keys":State().data_form_keys[key]
        })

    def initUI(self):
        component = DictFormComp(self,
            onChange=lambda v: self.props["data"].set(v),
            props=self.props)

class DictFormComp(FormComp):
    def add_rows(self):
        keys = self.props["keys"].get()
        for key in keys.keys():
            self.add_row(QLineEdit, key, keys[key]["title"])


class DataTableWidget(AbstractComp):
    def __init__(self, table_name, input_vars):
        self.table_name = table_name
        self.input_vars = input_vars
        super().__init__()

    def initUI(self):   
        input_vars = self.input_vars
        table_model = State().data_table_models[self.table_name].get()
        component = TableEditorComp(self,  
            props = {"model":State().data_table_models[self.table_name]})

        def appendDictList(dict_list):
            if type(dict_list).__name__ == "list":
                for v in dict_list:
                    table_model.appendDict(v)
            else:
                table_model.appendDict(dict_list)

        for category in input_vars["options"].keys():
            for id in input_vars["options"][category].keys():
                item = input_vars["options"][category][id]
                component.add_context_menu_function(id,
                    partial(appendDictList, copy.deepcopy(item)),[category])   

class MaterialTableWidget(AbstractComp):
    def initUI(self):
        table = MaterialEditorComp(self,
            props = {"model":State().material_table_model})
        
        for category in material.MATERIAL_ID_LIST.keys():
            for id in material.MATERIAL_ID_LIST[category].keys():
                name = material.MATERIAL_ID_LIST[category][id]
                table.add_context_menu_function(name,
                    partial(material.add_material_from_lib, id, name), [category])


class MaterialEditorComp(TableEditorComp):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs)
        self.table.doubleClicked.connect(self.cell_clicked)

    def cell_clicked(self, index):
        clicked_cell_column_name = self.table.model().headerData(index.column(),Qt.Horizontal)
        if clicked_cell_column_name == "sus":
            self.table.model().itemFromIndex(index).setEditable(False)
            material = self.table.model().exportDataFrame().iloc[index.row()]
            SusceptibilityEditorDialog(material.id, index, self)
            
