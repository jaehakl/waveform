# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

import numpy as np
from matform import MetaSingleton
from qleaf.core.prop import Prop

class State(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        self.setup = None

        self.entity_list = Prop({})
        self.current_entity_item_data = None

        self.setup_data = None
        self.structure_array_dict = Prop(None)

        self.prediction_model = None
        self.output_dict = Prop({})

        self.target_data_for_inverse_design = Prop({})

        self.gl_eye = Prop(np.array([0.001,0.0,10.0]))
