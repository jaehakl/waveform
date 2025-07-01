# Copyright (C) 2023 Jaehak Lee

from matform.meta_singleton import MetaSingleton
from ..prop import Prop

class State(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        #본 프로그램에서 Widget과 Component 들이 공유할 데이터 등록
        self.status_message = Prop("Ready")
        self.component_toolbars = Prop({})
        self.current_component = None        