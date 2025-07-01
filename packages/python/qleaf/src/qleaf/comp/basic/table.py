# Copyright (C) 2023 Jaehak Lee

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp
from ...core.prop import Prop

import pandas as pd

class TableEditorModel(QStandardItemModel):
    def __init__(self, defaultRowDict={}, row_direction="vertical", parent=None):
        super().__init__(parent)
        self.row_direction = row_direction
        self.checkedIndex = []
        self.defaultRowDict = defaultRowDict

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
            if type(item)==str:
                textItem.setText(item)
            elif int(item) == int(str(int(item))):
                textItem.setText(str(item))
            else:
                textItem.setText(f'{item:.3f}')
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
                    done = False
                    try:                        
                        if int(text) == int(str(int(text))):
                            list2D[row].append(int(text))
                            done = True
                    except ValueError:
                        pass
                    if done == False:
                        try:
                            list2D[row].append(float(text))
                        except ValueError:
                            list2D[row].append(text)
        elif self.row_direction == "horizontal":
            for col in range(self.columnCount()):
                list2D.append([])
                for row in range(self.rowCount()):
                    text = self.item(row,col).text()
                    done = False
                    try:                        
                        if int(text) == int(str(int(text))):
                            list2D[col].append(int(text))
                            done = True
                    except ValueError:
                        pass
                    if done == False:
                        try:
                            list2D[col].append(float(text))
                        except ValueError:
                            list2D[col].append(text)
        return list2D

class TableView(QTableView):
    selection_changed = Signal(QItemSelection, QItemSelection)
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFocusPolicy(Qt.StrongFocus)
        self.setAcceptDrops(True)
        self.actions = {}
        self.actions["addUnit"] = QAction("Add Unit",self)
        self.actions["addUnit"].triggered.connect(self.addUnit)

    def setModel(self,*args):
        super().setModel(*args)
        self.model().dataChanged.connect(self.resizeColumnsToContents)
            
    def selectAll(self):
        self.model().checkedIndex = [self.model().item(row, col).index() for col in range(self.model().columnCount()) for row in range(self.model().rowCount())]
        for itemIndex in self.model().checkedIndex:
            self.model().itemFromIndex(itemIndex).setBackground(QColor(125,125,125))

    def dragEnterEvent(self, e):
        e.accept()

    def dragMoveEvent(self, e):
        e.accept()

    def dropEvent(self, e):    
        e.accept()

    def selectionChanged(self, selected, deselected):
        self.selection_changed.emit(selected, deselected)

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

    def addUnit(self):
        self.model().appendDict(self.model().defaultRowDict)

    def mousePressEvent(self,e):
        super().mousePressEvent(e)
        if e.button()==Qt.RightButton:
            self.handleRightClick(e)
        elif e.button()==Qt.LeftButton:
            self.handleLeftClick(e)

    def handleRightClick(self,e):
        for itemIndex in self.selectedIndexes():
            if itemIndex in self.model().checkedIndex:
                self.model().checkedIndex.remove(itemIndex)
                self.model().itemFromIndex(itemIndex).setBackground(QColor(255,255,255))
            else:
                self.model().checkedIndex.append(itemIndex)
                self.model().itemFromIndex(itemIndex).setBackground(QColor(125,125,125))

    def handleLeftClick(self,e):
        pass

    def getChecked(self):
        return [[itemIndex.row(), itemIndex.column()] for itemIndex in self.model().checkedIndex]

    
    def keyPressEvent(self,event):
        if event.modifiers()==(Qt.ControlModifier):
            if event.key() == Qt.Key_C:
                self.c_copyContent()
            elif event.key() == Qt.Key_V:
                self.c_pasteContent()
        else:
            if event.key()==Qt.Key_Delete:       
                if self.model().row_direction == "vertical":
                    currentRows = []
                    for itemIndex in self.selectedIndexes():
                        row = itemIndex.row()
                        if row not in currentRows:
                            currentRows.append(row)
                    self.model().removeRows(currentRows[0],len(currentRows))
                elif self.model().row_direction == "horizontal":
                    currentColumns = []
                    for itemIndex in self.selectedIndexes():
                        column = itemIndex.column()
                        if column not in currentColumns:
                            currentColumns.append(column)
                    self.model().removeColumns(currentColumns[0],len(currentColumns))
                self.model().dataChanged.emit(QModelIndex(),QModelIndex())
            elif event.key()==Qt.Key_Insert:
                self.addUnit()

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


class TableEditorComp(AbstractComp):
    def initUI(self):
        self.table = TableView()
        self.layout().addWidget(self.table)
        table_model = self.props["model"].get()
        self.table.setModel(table_model)
        #self.table.selection_changed.connect(self.selection_changed)

        self.current_text = Prop("")
        self.current_text.updated.connect(self.update_cell)

    def updateUI(self):
        self.table.resizeColumnsToContents()
        self.table.resizeRowsToContents()

    def add_context_menu_function(self, label, func, submenus = []):            
        end_dict = self.table.actions
        for submenu in submenus:
            if submenu not in end_dict.keys():
                end_dict[submenu] = {}
            end_dict = end_dict[submenu]
        end_dict[label] = QAction(label,self.table)
        end_dict[label].triggered.connect(func)

    def toolbars(self):
        toolbar = TableEditorToolbar(self,
            props={"text":self.current_text})
        return {"bottom":toolbar}
    
    def update_cell(self, *args):
        self.table.model().setData(self.table.selectedIndexes()[0],self.current_text.get())

    def selection_changed(self, selected, deselected):
        if len(selected.indexes()) == 0:
            self.deactivate()
        else:
            self.current_text.set(self.table.model().itemFromIndex(selected.indexes()[0]).text())
        if len(deselected.indexes()) == 0:
            self.activate()

class TableEditorToolbar(QToolBar):
    def __init__(self, parent, props={}):
        super().__init__(parent)
        self.props = props
        self.props["text"].updated.connect(self.updateUI)
        self.initUI()

    def initUI(self):
        self.text = QLineEdit()
        self.text.editingFinished.connect(self.submit_text)
        self.addWidget(self.text)
        self.updateUI()

    def updateUI(self):
        self.text.setText(self.props["text"].get())

    def submit_text(self):
        self.props["text"].set(self.text.text())