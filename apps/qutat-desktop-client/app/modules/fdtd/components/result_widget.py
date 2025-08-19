from qleaf.core.abstract_comp import AbstractComp
from lib.labeled_tensor_list import LabeledTensorListViewer
from ..state import State

class ResultWidget(AbstractComp):
    def initUI(self):
        LabeledTensorListViewer(self,
            props={"data":State().result_arrays})


