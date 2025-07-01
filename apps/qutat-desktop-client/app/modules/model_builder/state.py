# Copyright (C) 2023 Jaehak Lee

from matform import MetaSingleton
from qleaf.core.prop import Prop

class State(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        self.setup = None
        self.entity_list = Prop({})
        self.original_output = Prop({'v':{},'a':{},'n':{}})
        self.original_output_data = Prop({'v':{},'a':{},'n':{}})
        self.custom_output = Prop({})
        self.checked_output_classes = Prop({})
        self.lt_dict_display = Prop({})
        self.structure_array_dict = Prop(None)


