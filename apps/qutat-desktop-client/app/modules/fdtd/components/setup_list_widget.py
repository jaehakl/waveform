from PySide6.QtWidgets import QTabWidget
from PySide6.QtCore import QThread

from qleaf.core.abstract_comp import AbstractComp
from qleaf.core.prop import Prop
from qleaf.comp.basic import ListViewComp
from qleaf.core import cout

from ..state import State
from ..service import setup_io
from api import api as RestApi
from api.auth import add_post_login_func, get

class SetupListTabsWidget(QTabWidget):
    def __init__(self):
        super().__init__()        
        add_post_login_func(setup_io.setup_list_online)
        State().setup_data_list.updated.connect(self.update_tabs)

    def update_tabs(self):
        self.clear()
        for solver in State().setup_data_list.get().keys():
            self.addTab(SetupListComp(
                props={"solver":solver}
            ),solver)


class SetupListComp(AbstractComp): 
    def initUI(self):
        self.selected_item = None
        solver = self.props["solver"].get()
        items = State().setup_data_list.get()
        ListViewComp(self,
            onClick=self.item_selected,
            props={
                "items":Prop(items[solver]),
                "icon_size":Prop(30)}
            )
        
    def item_selected(self, setup_item):
        self.selected_item = setup_item
        self.setDisabled(True) #Lost Focus Due to this
        self.th = HandleSetupSelected(setup_item)
        self.th.start()
        self.th.finished.connect(self.enable)

    def enable(self):
        self.setDisabled(False) #Focus is not Recovered


class HandleSetupSelected(QThread):
    def __init__(self, setup_item):
        super().__init__()
        self.setup_item = setup_item
        if setup_item["solver"] != State().solver.get():
            State().solver.set(setup_item["solver"])

    def run(self, *args):
        State().current_entity_list.set([])
        cout("recieving data")

        setup_item = self.setup_item
        setup_data = setup_io.get_setup(setup_item["id"])
        cout("recieving data ■")

        if setup_data != None:
            State().current_setup_data.set([setup_item["id"],setup_item["title"]])
            setup_io.set_setup_data(setup_data)
            cout("recieving data ■■ ")

            #setup_id = setup_item["id"]
            #dataio.import_entity_list(setup_id)
            #cout("recieving data ■■■ ")
            #dataio.import_process_list(setup_id)
            #cout("recieving data ■■■■ done")

