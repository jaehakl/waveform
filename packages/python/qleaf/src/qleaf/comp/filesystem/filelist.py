# Copyright (C) 2023 Jaehak Lee

import os

from PySide6.QtWidgets import QLayout


from ...core import cout
from ...core.abstract_comp import AbstractComp
from ...core.prop import Prop

from ...comp.basic import TextComp, TextEditComp, ListViewComp, PushButtonComp, FormComp
from .path import PathComp


class FileListComp(AbstractComp):
    def initUI(self):
        self.file_list = Prop([])

        if "path" not in self.props.keys():
            self.path = Prop(os.getcwd())
        else:            
            self.path = self.props["path"]

        if "filters" not in self.props.keys():
            self.filters = Prop(["*"])
        else:
            self.filters = self.props["filters"]

        PathComp(self,                 
            props={"path":self.path,
                   "directory":True})
        ListViewComp(self,
            onClick=self.item_selected,
            props={"items":self.file_list})

        self.path.updated.connect(self.loadFileList)
        self.filters.updated.connect(self.loadFileList)
        self.loadFileList(self.path)
        

    def loadFileList(self, directory_prop):
        file_list = []
        for filename in os.listdir(directory_prop.get()):
            for f in self.filters.get():
                data = {"name":filename,
                        "path":directory_prop.get()+"/"+filename}
                if f == "*":
                    file_list.append(data)
                    break
                elif filename.endswith(f):
                    file_list.append(data)
                    break                
        self.file_list.set(file_list)


    def item_selected(self, setup_item):
        self.clicked.emit(setup_item["path"])
