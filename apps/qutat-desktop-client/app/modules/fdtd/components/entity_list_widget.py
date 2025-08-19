from PySide6.QtWidgets import QTabWidget
import time
import pickle
import requests
import pandas as pd

from PySide6.QtCore import QThread

from qleaf.core import cout
from qleaf.core.abstract_comp import AbstractComp
from qleaf.core.prop import Prop
from qleaf.comp.basic import TextComp, PushButtonComp, ListViewComp

from ..state import State
from ..service import setup_io
from .. import dataio
from api import api as RestApi
from api.auth import add_post_login_func, get


class EntityListTabsWidget(QTabWidget):
    def __init__(self):
        super().__init__()
        self.addTab(ResultListComp(),"Results")
        self.addTab(ProcessListComp(),"Processes")


class ResultListComp(AbstractComp):
    def __init__(self):
        self.input_id = Prop(None)
        super().__init__()

    def initUI(self):
        TextComp(self, props={"label":"ID : ","text":self.input_id})
        button = PushButtonComp(self, 
                                onClick=self.delete_entity,
                                props={"label":"Delete"})
        #button.setStyleSheet("background-color: red")

        ListViewComp(self,
            onClick=self.item_selected,
            props={"items":State().current_entity_list})
         
    def item_selected(self, entity_item):
        self.input_id.set(entity_item["id"])
        self.setDisabled(True)
        self.th = HandleEntitySelected(entity_item)
        self.th.start()
        self.th.finished.connect(self.enable)

    def enable(self):
        self.setDisabled(False)

    def delete_entity(self, *args):        
        entity_id = self.input_id.get()
        dataio.delete_entity(entity_id)

class HandleEntitySelected(QThread):
    def __init__(self, entity_item):
        super().__init__()
        self.entity_item = entity_item

    def run(self, *args):
        time_0 = time.time()
        cout("recieving data")  

        entity_item = self.entity_item

        structure_evaluated, array_dict = eval_structure(
            pd.DataFrame(setup_io.get_setup_data()["structures"]),
            pd.DataFrame(setup_io.get_setup_data()["components"]),
            array_dicts_init=requests.get(entity_item["file"]).json()
        )
        State().structure_evaluated.set(structure_evaluated)
        cout("recieving data ■■■ ")

        entity_json = get(RestApi.entity_data(entity_item["id"]))
        
        entity_data = entity_json.json()
        images = {}
        for key, value in entity_data['images'].items():
            images[key] = requests.get(value).content

        for i, key in enumerate(images.keys()):
            State().fig_update[i].set(images[key])
            if i > 2:
                break

        State().result_images.set(images)
        cout("recieving data ■■■■ ")
        for url in entity_data['files'].values():
            if url.endswith("output.pickle"):
                data = pickle.loads(requests.get(url).content)
                State().result_arrays.set(data["arrays"])
    cout("recieving data ■■■■■■■ done")


class ProcessListComp(AbstractComp):
    def __init__(self):
        self.process_id = Prop(None)
        super().__init__()

    def initUI(self):
        TextComp(self, props={"label":"ID : ","text":self.process_id})
        button = PushButtonComp(self, 
                                onClick=self.delete_process,
                                props={"label":"Delete"})
        #button.setStyleSheet("background-color: red")

        ListViewComp(self,
            onClick=self.item_selected,
            props={"items":State().current_process_list})
         
    def item_selected(self, entity_item):
        self.process_id.set(entity_item["id"])

    def delete_process(self, *args):        
        process_id = self.process_id.get()
        dataio.delete_process(process_id)
