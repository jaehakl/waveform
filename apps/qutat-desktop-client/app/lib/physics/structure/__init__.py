# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

import json, os
from matform import MetaSingleton

class State(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        with open(os.getenv('QUTAT_BASE_DIR')+"/.materials/material_color.json") as json_file:
            self.material_color = json.load(json_file)