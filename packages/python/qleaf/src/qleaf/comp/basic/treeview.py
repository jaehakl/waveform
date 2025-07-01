# Copyright (C) 2023 Jaehak Lee
import requests

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp
from ...core.image import qimage_from_file_buffer


class TreeViewComp(AbstractComp):
    def layoutClass(self):
        return QVBoxLayout()

    def initUI(self):
        self.treewidget = QTreeWidget()
        self.treewidget.itemClicked.connect(self.item_clicked)
        self.treewidget.itemDoubleClicked.connect(self.item_double_clicked)
        #self.listview.setViewMode(QListView.IconMode)
        if "icon_size" in self.props:
            icon_size = self.props["icon_size"].get()
        else:
            icon_size = 45
        self.treewidget.setIconSize(QSize(icon_size,icon_size))
        self.treewidget.setHeaderHidden(True)
        self.layout().addWidget(self.treewidget)

    def updateUI(self):
        self.treewidget.clear()
        items_data = self.props["items"].get()
        items_dict = items_data

        if "columns" in self.props.keys():
            columns_to_display = self.props["columns"].get()
        else:
            columns_to_display = []

        if len(columns_to_display) > 1:
            self.treewidget.setHeaderLabels(columns_to_display)
            self.treewidget.setHeaderHidden(False)


        self.setBranch(items_data, columns_to_display)
       
    def setBranch(self, items_dict, columns_to_display=[], parent_item=None):
        for item_name in items_dict.keys():
            item_data = items_dict[item_name]

            if "image_off" in self.props.keys():
                image_off = self.props["image_off"].get()
            else:
                image_off = False

            if image_off == True:
                image_path = None
            elif "image" in item_data.keys():
                image_path = item_data["image"]
            elif "icon" in item_data.keys():
                image_path = item_data["icon"]
            elif "thumbnail" in item_data.keys():
                image_path = item_data["thumbnail"]
            else:
                image_path = None

            if "name" in item_data.keys():
                name = item_data["name"]
            else:
                name = item_name
            item = QTreeWidgetItem([name]+[str(item_data[column]) 
                for column in columns_to_display])

            if image_path:
                if image_path[:4] == "http":
                    image_file_buffer = requests.get(image_path).content
                else:
                    image_file_buffer = open(image_path, "rb").read()                    
                qImg = qimage_from_file_buffer(image_file_buffer)
                icon = QIcon(QPixmap.fromImage(qImg))
                item.setIcon(0, icon)

            item.setData(0, Qt.UserRole, item_data)

            if parent_item:
                parent_item.addChild(item)
            else:
                self.treewidget.addTopLevelItem(item)

            if "items" in item_data.keys():
                self.setBranch(item_data["items"], columns_to_display, item)
                item.setIcon(0, QIcon())

    def item_clicked(self, item):
        self.clicked.emit(item.data(0,Qt.UserRole))

    def item_double_clicked(self, item):
        self.doubleClicked.emit(item.data(0,Qt.UserRole))
