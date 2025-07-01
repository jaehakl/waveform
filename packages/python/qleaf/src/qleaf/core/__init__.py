# Copyright (C) 2023 Jaehak Lee

from . import main_window
from . import abstract_comp
from . import image
from . import prop

from .main_window import show_status
import os, shutil

CURRENT_SOURCE_CODE_FILE_PATH = os.path.abspath(__file__)

def cout(*args):
    show_status(" ".join([str(arg) for arg in args]))

def setStyle(widget, style_name):
    dir_path = os.path.dirname(CURRENT_SOURCE_CODE_FILE_PATH)
    parent_dir = os.path.dirname(dir_path)
    sshFile=os.path.join(parent_dir,'style',style_name,style_name+'.qss')
    with open(sshFile,"r") as fh:
        widget.setStyleSheet(fh.read())