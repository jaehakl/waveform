# Copyright (C) 2023 Jaehak Lee

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ..comp.chart.lineGraph import LineGraphComp
from ..comp.chart.imShow import ImShowComp
from ..core.abstract_comp import AbstractComp
from ..core.prop import Prop
from matform.array.labeledTensor import LabeledTensor


class ChartWithList(AbstractComp):
    def layoutClass(self):
        return QHBoxLayout()

    def initUI(self):
        self.chart_data = Prop({})
        self.x_label = Prop("")
        #self.canvas = FigureCanvasQTAgg(Figure())
        self.canvas = LineGraphComp(self,
            props={"data":self.chart_data,
                   "x_label":self.x_label})

        self.listview = QListWidget()
        self.listview.itemClicked.connect(self.list_item_clicked)
        self.listview.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.layout().addWidget(self.canvas)
        self.layout().addWidget(self.listview)

    def updateUI(self):
        data = self.props["data"].get()
        self.listview.clear()
        for key in data.keys():
            self.listview.addItem(key)

        for i in range(self.listview.count()):
            item = self.listview.item(i)            
            item.setSelected(True)

        self.list_item_clicked()

    def list_item_clicked(self, *args):
        chart_data = {}
        for item in self.listview.selectedItems():
            data_name = item.text()
            data = self.props["data"].get()[data_name]
            if type(data) == dict:
                print(type(data["data"]))
                if type(data["data"]) == list:
                    lt = LabeledTensor.from_json_dict(data)
                else:
                    print("from_np_dict")
                    lt = LabeledTensor.from_np_dict(data)
            elif type(data) == LabeledTensor:
                lt = data
            data_dict, *label_names = lt.to_chart_data()
            chart_data[item.text()] = data_dict
            self.x_label.set(label_names[0])
        self.chart_data.set(chart_data)

class ImShowWithList(AbstractComp):
    def layoutClass(self):
        return QHBoxLayout()

    def initUI(self):
        self.tensor_data = Prop({})
        self.x_label = Prop("")
        #self.canvas = FigureCanvasQTAgg(Figure())
        self.canvas = ImShowComp(self,
            props={"data":self.tensor_data})

        self.listview = QListWidget()
        self.listview.itemClicked.connect(self.list_item_clicked)
        self.listview.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.layout().addWidget(self.canvas)
        self.layout().addWidget(self.listview)

    def updateUI(self):
        data = self.props["data"].get()
        self.listview.clear()
        for key in data.keys():
            self.listview.addItem(key)

        for i in range(self.listview.count()):
            item = self.listview.item(i)            
            item.setSelected(True)

        self.list_item_clicked()

    def list_item_clicked(self, *args):
        tensor_data = {}
        for item in self.listview.selectedItems():
            data_name = item.text()
            data = self.props["data"].get()[data_name].data
            tensor_data[item.text()] = {"data":data}
        self.tensor_data.set(tensor_data)