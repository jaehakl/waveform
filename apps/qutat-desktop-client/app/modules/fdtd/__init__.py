# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

from .state import State

from . import setup
from . import dataio

from . import puppet
from . import gui

def show_output(result):
    if result != None:
        State().setPartial("result",0, result["svfs_np"])

