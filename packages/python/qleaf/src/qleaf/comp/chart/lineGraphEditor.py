# Copyright (C) 2023 Jaehak Lee
import copy

import numpy as np

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp


from .lineGraph import LineGraphComp

class LineGraphEditorComp(AbstractComp):
    def initUI(self):
        self.line_graph = LineGraphComp(self,props=self.props)
        self.line_graph.mouse_moved.connect(self.mouse_moved)
        self.line_graph.mouse_pressed.connect(self.mouse_pressed)
        self.line_graph.mouse_released.connect(self.mouse_released)

    def mouse_pressed(self, event):
        self.mouse_moved(event)

    def mouse_moved(self, event):
        data = self.props["data"].get()

        if event.button == 1:
            _selected_row_editing = data["_selected_row_editing"]
            _selected_row_editing['y'][self.selected_row[1]] = event.ydata
            data["_selected_row_editing"] = _selected_row_editing
            self.props["data"].set(data)            
        elif event.button == 3:
            edit_range = 0.08
            istart = max(0,self.selected_row[1] - int(edit_range*len(data[self.selected_row[0]]['x'])))
            iend = min(self.selected_row[1] + 1 + int(edit_range*len(data[self.selected_row[0]]['x'])),
                          len(data[self.selected_row[0]]['x']))
            _selected_row_editing = data["_selected_row_editing"]
            y_start = _selected_row_editing['y'][istart]
            y_end = _selected_row_editing['y'][iend-1]
            y_put = event.ydata
            for i in range(istart,iend):
                _selected_row_editing['y'][i] = y_start + (y_end-y_start)*(i-istart)/(iend-istart) + (y_put-y_start)*(iend-i)/(iend-istart) + (y_put-y_end)*(i-istart)/(iend-istart)
            data["_selected_row_editing"] = _selected_row_editing
            self.props["data"].set(data)
        elif event.xdata and event.ydata:
            self.selected_row = None                
            for row_name in data.keys():
                row = data[row_name]
                if row['editable']:
                    idx = (np.abs(np.array(row['x'])-event.xdata).argmin())
                    dy = np.abs(row['y'][idx]-event.ydata)
                    if self.selected_row:
                        if self.selected_row[2] > np.abs(row['y'][idx]-event.ydata):
                            self.selected_row = (row_name, idx, dy)
                    else:
                        self.selected_row = (row_name, idx, dy)
            
            if self.selected_row:
                _selected_row_editing= copy.deepcopy(data[self.selected_row[0]])
                _selected_row_editing['editable'] = False
                data["_selected_row_editing"] = _selected_row_editing
                self.props["data"].set(data)

                    
    def mouse_released(self, event):        
        data = self.props["data"].get()
        if "_selected_row_editing" in data.keys():
            data[self.selected_row[0]] = data["_selected_row_editing"]
            data[self.selected_row[0]]["editable"] = True
            del data["_selected_row_editing"]
        self.props["data"].set(data)        
        self.selected_row = None
        self.changed.emit(data)

# Test code
'''
LineGraphEditorComp(self,
                    onChange=print,
                    props={"data":{
                        "input_a":{
                            "x":np.arange(30),
                            "y":np.random.rand(30),
                            "editable":True,
                        },"input_b":{
                            "x":np.arange(30),
                            "y":np.random.rand(30),
                            "editable":True
                        },"output":{
                            "x":np.arange(30),
                            "y":np.random.rand(30),
                            "editable":False
                        }
                    }})
'''