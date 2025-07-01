
from functools import partial

import numpy as np

from qleaf.core.abstract_comp import AbstractComp
from qleaf.core.prop import Prop

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *
import matform as mf
from qleaf.comp.basic import TextComp, PushButtonComp, ListViewComp, ImageComp
from qleaf.comp.chart.imShow import ImShowCompFromLabeledTensor

class LabeledTensorListViewer(AbstractComp):
    def layoutClass(self):
        return QVBoxLayout()
     
    def initUI(self):
        self.selected_lt_name = None
        self.selected_lt = Prop(mf.LabeledTensor(np.zeros((1,1))))

        LabeledTensorViewer(self,
            props={"lt":self.selected_lt})

        self.listview = QListWidget()
        self.listview.itemClicked.connect(self.list_item_clicked)
        self.layout().addWidget(self.listview)

    def updateUI(self):
        data = self.props["data"].get()

        self.listview.clear()
        for key in data.keys():
            self.listview.addItem(key)

        for i in range(self.listview.count()):
            item = self.listview.item(i)            
            item.setSelected(True)

        if self.selected_lt_name != None:
            try:
                self.selected_lt.set(data[self.selected_lt_name])
            except KeyError:
                pass

    def list_item_clicked(self, *args):
        self.selected_lt_name = args[0].text()
        self.selected_lt.set(self.props["data"].get()[self.selected_lt_name])



class LabeledTensorViewer(AbstractComp):
    def __init__(self, *args, **kwargs):
        self.selected_axes = Prop([0,0])
        self.selected_position = [0,0]
        self.selected_lt = Prop(mf.LabeledTensor(np.zeros((1,1))))
        self.label_and_names = Prop({
            "labels":[],
            "label_names":[]
        })
        super().__init__(*args, **kwargs)

    def initUI(self):    
        if self.props["lt"].get() != None:
            label_names = self.props["lt"].get().get_label_names()
            self.selected_position = [0]*len(label_names)
            LabeledTensorPlot(self,
                props={"lt":self.selected_lt})
            AxisSelector(self,
                props={"label_and_names":self.label_and_names},
                onChange=self.set_axes)
            LabelSliders(self, 
                props={"label_and_names":self.label_and_names},
                onChange=self.set_positions)
            self.set_tensor()

    def updateUI(self):
        if self.props["lt"].get() != None:
            self.label_and_names.set({
                "labels":self.props["lt"].get().get_labels(),
                "label_names":self.props["lt"].get().get_label_names()
            })
            self.selected_position = [0]*len(self.label_and_names.get()["label_names"])
        for axes in self.selected_axes.get():
            if axes >= len(self.label_and_names.get()["label_names"]):
                self.selected_axes.set([0,0])
                break
        self.set_tensor()

    def set_axes(self, axes):
        self.selected_axes.set(axes)
        self.set_tensor()

    def set_positions(self, args):
        i_values, values = args
        self.selected_position = i_values
        self.set_tensor()
    
    def set_tensor(self):
        axes = self.selected_axes.get()
        positions = self.selected_position
        tensor = self.props["lt"].get().data
        for i, pos in enumerate(positions[::-1]):
            i_axis = len(positions)-1-i
            if i_axis not in axes:
                tensor = np.take(tensor, pos, axis=i_axis)
        labels_total = self.props["lt"].get().get_labels()
        labels = [labels_total[i] for i in sorted(axes)]
        label_names_total = self.props["lt"].get().get_label_names()
        label_names = [label_names_total[i] for i in sorted(axes)]
        self.selected_lt.set(mf.LabeledTensor(tensor, labels, label_names))



class LabeledTensorPlot(AbstractComp):
    def __init__(self, *args, **kwargs):
        self.imshow_data = Prop({})
        super().__init__(*args, **kwargs)

    def initUI(self):
        self.setMinimumSize(200, 200)
        ImShowCompFromLabeledTensor(self,
            props={"data":self.imshow_data,
                   "cmap": "RdBu"})
                
    def updateUI(self):        
        lt = self.props["lt"].get()
        #if len(lt.shape()) == 1:
        #    lt = mf.LabeledTensor(np.array([lt.data]),
        #                          [[0]]+lt.get_labels(), 
        #                          [""]+lt.get_label_names())
        self.imshow_data.set({"data":{"data":lt}})



class AxisSelector(AbstractComp):
    def layoutClass(self):
        return QHBoxLayout()

    def initUI(self):
        self.axis = [0,0]
        cb_x = QComboBox(self)
        cb_y = QComboBox(self)
        for i, label in enumerate(self.props["label_and_names"].get()["label_names"]):
            cb_x.addItem(label)
            cb_y.addItem(label)
        cb_x.currentIndexChanged.connect(partial(self.set_axis, "x"))
        cb_y.currentIndexChanged.connect(partial(self.set_axis, "y"))
        self.layout().addWidget(cb_x)
        self.layout().addWidget(cb_y)

    def updateUI(self):
        self.refresh()
        
    def set_axis(self, axis_name, value_i):
        if axis_name == "x":
            self.axis[0] = value_i
        elif axis_name == "y":
            self.axis[1] = value_i
        self.changed.emit(self.axis)    

 
class LabelSliders(AbstractComp):
    def initUI(self):
        labels = self.props["label_and_names"].get()["labels"]
        label_names = self.props["label_and_names"].get()["label_names"]
        self.values = []
        self.i_values = []

        self.value_labels = []
        for i, label_name in enumerate(label_names):
            self.values.append(Prop(str(labels[i][0])))
            self.i_values.append(0)
            TextComp(self, props={"label":label_name, "text":self.values[i]})                        

            range_slider = QSlider(Qt.Horizontal)
            range_slider.setMinimum(0)
            range_slider.setMaximum(len(labels[i])-1)
            range_slider.setValue(0)
            range_slider.valueChanged.connect(partial(self.update_selector, i))
            self.layout().addWidget(range_slider)           

    def updateUI(self):
        self.refresh()

    def update_selector(self, data_i, value_i):
        labels = self.props["label_and_names"].get()["labels"]
        self.values[data_i].set(labels[data_i][value_i])
        self.i_values[data_i] = value_i
        self.changed.emit([self.i_values, self.values])
