from qleaf.core.abstract_comp import AbstractComp
from qleaf.core.prop import Prop
from qleaf.comp.basic.image import ImageComp
from ..state import State

class MonitorWidget(AbstractComp):
    def initUI(self):
        ImageComp(self,
            props={"image":State().fig_update[0],
                   "image_size":Prop([300,300])})
        ImageComp(self,
            props={"image":State().fig_update[1],
                   "image_size":Prop([300,300])})
        ImageComp(self,
            props={"image":State().fig_update[2],
                   "image_size":Prop([300,300])})