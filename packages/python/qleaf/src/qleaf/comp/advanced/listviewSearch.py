# Copyright (C) 2023 Jaehak Lee

import requests

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

from ...core.abstract_comp import AbstractComp
from ...core.image import qimage_from_file_buffer

class ListViewSearchComp(AbstractComp):
    def layoutClass(self):
        return QVBoxLayout()

    def initUI(self):
        self.searchText = QLineEdit()
        self.searchText.setPlaceholderText("Search")
        self.searchText.textChanged.connect(self.searchTextChanged)
        self.layout().addWidget(self.searchText)

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

        items_dict = {}
        if type(items_data) == list:

            if len(items_data) == 0:
                return
            item_data = items_data[0]
            
            label_field_name = None
            if "label_field" in self.props.keys():
                label_field_name = self.props["label_field"].get()
            else:
                for field_name in ["title", "name", "id","label"]:
                    if field_name in item_data.keys():
                        label_field_name = field_name
                        break
            
            for i, item_data in enumerate(items_data):
                if label_field_name:
                    item_name = item_data[label_field_name]
                else:
                    label_field_name = "id"
                    item_name = str(i)
                items_dict[item_name] = item_data
        else:
            items_dict = items_data
            label_field_name = "name"


        if "columns" in self.props.keys():
            columns_to_display = self.props["columns"].get()
        else:
            columns_to_display = []


        if "*" in columns_to_display:
            item_name_list = list(items_dict.keys())
            if len(item_name_list) > 0:
                columns_to_display = list(items_dict[item_name_list[0]].keys())
            else:
                columns_to_display = []
        else:
            columns_to_display = [label_field_name]+columns_to_display


        if len(columns_to_display) > 1:
            self.treewidget.setHeaderLabels(columns_to_display)
            self.treewidget.setHeaderHidden(False)

        item_names = list(items_dict.keys())
        search_text = self.searchText.text()
        if search_text != "":
            item_names = [item_name for item_name in item_names if search_text.lower() in item_name.lower()]
            item_names = sorted(item_names)[:10]
        else:
            #sort by label_field_name
            item_names = sorted(item_names)[:10]

        for item_name in item_names:
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

            item = QTreeWidgetItem([str(item_data[column]) 
                for column in columns_to_display])

            if image_path:
                if image_path[:4] == "http":
                    image_file_buffer = requests.get(image_path).content
                else:
                    image_file_buffer = open(image_path, "rb").read()                    
                qImg = qimage_from_file_buffer(image_file_buffer)
                icon = QIcon(QPixmap.fromImage(qImg))
                item.setIcon(0, icon)

            if "data" in item_data.keys():
                item.setData(Qt.UserRole, item_data["data"])
            else:
                item.setData(0, Qt.UserRole, item_data)

            self.treewidget.addTopLevelItem(item)

    def item_clicked(self, item):
        self.clicked.emit(item.data(0,Qt.UserRole))

    def item_double_clicked(self, item):
        self.doubleClicked.emit(item.data(0,Qt.UserRole))

    def searchTextChanged(self):
        self.updateUI()