# Copyright (C) 2023 Jaehak Lee

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

import pandas as pd
from matform.database import DB

from ...core.abstract_comp import AbstractComp

class TableEditorModel(QStandardItemModel):
    updated = Signal(object)
    def __init__(self, defaultRowDict={}, row_direction="vertical", parent=None):
        super().__init__(parent)
        self.row_direction = row_direction
        self.checkedIndex = []
        self.defaultRowDict = defaultRowDict
        self.data_types = {}
        #self.appendDict(defaultRowDict)
        self.rowsRemoved.connect(self.dataChanged.emit)
        self.dataChanged.connect(self.update)

    def update(self):
        self.updated.emit(self)

    def appendDict(self,dictRow):
        df = self.exportDataFrame()
        if len(df) == 0:
            df = pd.DataFrame([dictRow.values()], columns=dictRow.keys())
        else:
            df = pd.concat([df,pd.DataFrame([dictRow.values()], columns=dictRow.keys())],ignore_index=True).fillna("")
        self.importDataFrame(df)

    def appendListRow(self,listRow):
        textItemList = []
        for item in listRow:
            textItem = QStandardItem()
            textItem.setText(str(item))
            textItemList.append(textItem)
        if self.row_direction == "vertical":
            self.insertRow(self.rowCount(), textItemList)
        elif self.row_direction =="horizontal":
            self.insertColumn(self.columnCount(), textItemList)

    def paste_dataFrame(self,df_paste,row_start,col_start):
        row_end = row_start + df_paste.shape[0]
        col_end = col_start + df_paste.shape[1]

        df_old = self.exportDataFrame()
        if self.row_direction == "horizontal":
            df_old = df_old.T
                
        index = list(df_old.index)
        columns = list(df_old.columns)
        if row_end >= df_old.shape[0]:
            for i in range(df_old.shape[0],row_end):
                index.append(i)
        if col_end >= df_old.shape[1]:
            for i in range(df_old.shape[1],col_end):
                columns.append(i)
        df_new = pd.DataFrame(df_old, index=index,columns=columns)
        for i in range(row_start,row_end):
            for j in range(col_start,col_end):
                df_new.iloc[i,j] = df_paste.iloc[i-row_start,j-col_start]
        df_new.fillna("",inplace=True)

        if self.row_direction == "horizontal":
            df_new = df_new.T

        self.importDataFrame(df_new)

    def importDataFrame(self,df):
        self.data_types = df.dtypes.to_list()
        self.clear()
        self.checkedIndex = []
        if self.row_direction == "vertical":
            self.setHorizontalHeaderLabels(df.columns)
        elif self.row_direction =="horizontal":
            self.setVerticalHeaderLabels(df.columns)
        for i in range(df.shape[0]):
            self.appendListRow(df.iloc[i,:])
        if self.row_direction == "vertical":            
            self.setVerticalHeaderLabels([str(i) for i in df.index])
        elif self.row_direction =="horizontal":
            self.setHorizontalHeaderLabels([str(i) for i in df.index])
        self.dataChanged.emit(QModelIndex(),QModelIndex())

    def importMatrix(self,mat):
        self.clear()
        self.checkedIndex = []
        for i in range(mat.shape[0]):
            self.appendListRow(mat[i,:])

    def exportDataFrame(self):
        if self.row_direction == "vertical":
            columns = [self.horizontalHeaderItem(i).text() for i in range(self.columnCount())]
        elif self.row_direction =="horizontal":
            columns = [self.verticalHeaderItem(i).text() for i in range(self.rowCount())]
        return pd.DataFrame(self.exportList2D(), columns=columns)

    def exportList2D(self):
        list2D = []
        if self.row_direction == "vertical":
            for row in range(self.rowCount()):
                list2D.append([])
                for col in range(self.columnCount()):
                    text = self.item(row,col).text()
                    if self.data_types[col] == int:
                        value = int(text)
                    elif self.data_types[col] == float:
                        value = float(text)
                    else:
                        value = text
                    list2D[row].append(value)
        elif self.row_direction == "horizontal":
            for col in range(self.columnCount()):
                list2D.append([])
                for row in range(self.rowCount()):
                    text = self.item(row,col).text()
                    if self.data_types[row] == int:
                        value = int(text)
                    elif self.data_types[row] == float:
                        value = float(text)
                    else:
                        value = text
                    list2D[col].append(value)

        return list2D

class TableView(QTableView):
    delete_event = Signal(object)
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFocusPolicy(Qt.StrongFocus)
        self.actions = {}

    def setModel(self,*args):
        super().setModel(*args)
        self.model().dataChanged.connect(self.dataChanged)
        self.dataChanged()

    def dataChanged(self,*args):
        self.resizeColumnsToContents()

    def contextMenuEvent(self, event):        
        menu = QMenu(self)
        def add_submenu_reculsive(menu,actions):
            for label in actions.keys():
                if type(actions[label]) == dict:
                    subMenu = menu.addMenu(label)
                    add_submenu_reculsive(subMenu,actions[label])
                else:
                    menu.addAction(actions[label])
        add_submenu_reculsive(menu,self.actions)
        menu.exec(event.globalPos())

    def add_context_menu_function(self, label, func, submenus = []):            
        end_dict = self.actions
        for submenu in submenus:
            if submenu not in end_dict.keys():
                end_dict[submenu] = {}
            end_dict = end_dict[submenu]
        end_dict[label] = QAction(label,self)
        end_dict[label].triggered.connect(func)


    def keyPressEvent(self,event):
        if event.modifiers()==(Qt.ControlModifier):
            if event.key() == Qt.Key_C:
                self.c_copyContent()
            elif event.key() == Qt.Key_V:
                self.c_pasteContent()
        else:
            if event.key()==Qt.Key_Delete:
                self.delete_event.emit(self.selectedIndexes())

            if event.key() in [Qt.Key_Left,Qt.Key_Right,Qt.Key_Up,Qt.Key_Down]:
                currentRow = self.selectedIndexes()[0].row()
                currentColumn = self.selectedIndexes()[0].column()
                if event.key()==Qt.Key_Left:                
                    sibling = self.selectedIndexes()[0].sibling(currentRow, currentColumn-1)
                elif event.key()==Qt.Key_Right:                
                    sibling = self.selectedIndexes()[0].sibling(currentRow, currentColumn+1)
                elif event.key()==Qt.Key_Up:                
                    sibling = self.selectedIndexes()[0].sibling(currentRow-1, currentColumn)
                elif event.key() in [Qt.Key_Down, Qt.Key_Return]:                
                    sibling = self.selectedIndexes()[0].sibling(currentRow+1, currentColumn)
                if (sibling.row(), sibling.column()) != (-1,-1):
                    self.setCurrentIndex(sibling)



    def c_copyContent(self):
        indexes = sorted([(itemIndex.row(),itemIndex.column()) for itemIndex in self.selectedIndexes()])
        rowRange=[indexes[0][0],indexes[-1][0]]
        colRange=[indexes[0][1],indexes[-1][1]]
        for index in indexes:
            if index[0] < rowRange[0]:
                rowRange[0] = index[0]
            if index[0] >= rowRange[1]:
                rowRange[1] = index[0]+1
            if index[1] < colRange[0]:
                colRange[0] = index[1]
            if index[1] >= colRange[1]:
                colRange[1] = index[1]+1
        text=""
        for row in range(*rowRange):
            for col in range(*colRange):
                if (row,col) in indexes:
                    text += self.model().data(self.selectedIndexes()[0].sibling(row, col))
                if col < colRange[1] - 1:
                    text+="\t"
            if row < rowRange[1] - 1:
                text+="\n"
        QApplication.clipboard().setText(text)

    def c_pasteContent(self):
        df = pd.read_clipboard(sep="\t",header=None)
        rowStart = self.selectedIndexes()[0].row()
        colStart = self.selectedIndexes()[0].column()
        self.model().paste_dataFrame(df,rowStart,colStart)


class DatabaseTableComp(AbstractComp):
    itemSelected = Signal(object)
    def initUI(self):
        self.table = TableView()
        self.layout().addWidget(self.table)
        self.table.setModel(TableEditorModel())

        self.props["db_path"].updated.connect(self.set_db_table)
        self.props["table_name"].updated.connect(self.set_db_table)
        self.table.add_context_menu_function("Add Row",self.addRow)
        self.table.add_context_menu_function("Set Data",self.change_data)
        self.table.delete_event.connect(self.delete_rows)
        self.table.pressed.connect(self.show_item)

    def addRow(self):
        DB(self.props["db_path"]).table(self.props["table_name"].get()).append()

    def updateUI(self):
        self.table.resizeColumnsToContents()
        self.table.resizeRowsToContents()

    def set_db_table(self, *args):
        db_path = self.props["db_path"]
        table_name = self.props["table_name"]
        table_df = DB(db_path).table(table_name.get()).get()
        self.table.model().importDataFrame(table_df)

    def change_data(self):
        df = self.table.model().exportDataFrame()
        DB(self.props["db_path"]).table(self.props["table_name"].get()).set(df)

    def delete_rows(self, indexes):
        for index in indexes:
            row = index.row()
            id = self.table.model().item(row,0).text()
            DB(self.props["db_path"]).table(self.props["table_name"].get()).item(id).delete()
            break

    def show_item(self, index):
        row = index.row()
        id = self.table.model().item(row,0).text()
        self.itemSelected.emit(DB(self.props["db_path"]).table(self.props["table_name"].get()).item(id).get())        