# Copyright (C) 2023 Jaehak Lee
import numpy as np
import matplotlib
matplotlib.use('Qt5Agg')
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg
from matplotlib.figure import Figure

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp

class ImShowComp(AbstractComp):
    scrolled = Signal(object)
    mouse_moved = Signal(object)
    mouse_pressed = Signal(object)
    mouse_released = Signal(object)

    def initUI(self):
        self.canvas = FigureCanvasQTAgg(Figure(layout="constrained"))
        self.canvas.mpl_connect('scroll_event', self.scrolled.emit)
        self.canvas.mpl_connect('motion_notify_event', self.mouse_moved.emit)
        self.canvas.mpl_connect('button_press_event', self.mouse_pressed.emit)
        self.canvas.mpl_connect('button_release_event', self.mouse_released.emit)
        self.layout().addWidget(self.canvas)
    
    def updateUI(self):
        data = self.props["data"].get()
        x_label = self.props["x_label"].get() if "x_label" in self.props.keys() \
            else list(range(data[list(data.keys())[0]]["data"].shape[1]))
        y_label = self.props["y_label"].get() if "y_label" in self.props.keys() \
            else list(range(data[list(data.keys())[0]]["data"].shape[0]))
        x_label_name = self.props["x_label_name"].get() \
            if "x_label_name" in self.props.keys() else "x"
        y_label_name = self.props["y_label_name"].get() \
            if "y_label_name" in self.props.keys() else "y"
        cmap = self.props["cmap"].get() if "cmap" in self.props.keys() else "RdBu"

        self.canvas.figure.clf()

        len_data = len(data.keys())
        if len_data == 0:
            return
        plots = []
        cols = int(np.ceil(np.sqrt(len_data)))
        rows = int(np.ceil(len_data / cols))
        for i, data_name in enumerate(data.keys()):
            plot = self.canvas.figure.add_subplot(rows, cols, i+1)
            tensor = data[data_name]["data"]
            if len(tensor.shape) == 4:
                tensor = tensor.mean(axis=2).mean(axis=2).real
            elif len(tensor.shape) == 3:
                tensor = tensor.mean(axis=2).real
            elif len(tensor.shape) == 2:
                tensor = tensor.real
            else:
                raise ValueError("Invalid tensor shape")
            pc = plot.imshow(tensor, cmap=cmap)
            cbar = self.canvas.figure.colorbar(pc,location='bottom')
            plot.set_title(data_name)
            plots.append(plot)
        for plot in plots:
            plot.set_xlabel(x_label_name)
            plot.set_ylabel(y_label_name)
        self.canvas.draw()

class ImShowCompFromLabeledTensor(AbstractComp):
    scrolled = Signal(object)
    mouse_moved = Signal(object)
    mouse_pressed = Signal(object)
    mouse_released = Signal(object)

    def initUI(self):
        self.canvas = FigureCanvasQTAgg(Figure(layout="constrained"))
        self.canvas.mpl_connect('scroll_event', self.scrolled.emit)
        self.canvas.mpl_connect('motion_notify_event', self.mouse_moved.emit)
        self.canvas.mpl_connect('button_press_event', self.mouse_pressed.emit)
        self.canvas.mpl_connect('button_release_event', self.mouse_released.emit)
        self.layout().addWidget(self.canvas)
    
    def updateUI(self):
        data_dict = self.props["data"].get()
        cmap = self.props["cmap"].get() if "cmap" in self.props.keys() else "RdBu"

        self.canvas.figure.clf()

        len_data = len(data_dict.keys())
        if len_data == 0:
            return
        plots = []
        cols = int(np.ceil(np.sqrt(len_data)))
        rows = int(np.ceil(len_data / cols))

        for i, data_name in enumerate(data_dict.keys()):
            data_lt = data_dict[data_name]["data"]        
            tensor = data_lt.data.real

            if len(tensor.shape) == 1:
                plot = self.canvas.figure.add_subplot(rows, cols, i+1)
                x_label = data_lt.get_labels()[0]
                x_label_name = data_lt.get_label_names()[0]
                pc = plot.plot(x_label, tensor)
                plot.set_title(data_name)
                plot.set_xlabel(x_label_name)
                plot.set_ylabel("Value")
                plots.append(plot)

            elif len(tensor.shape) == 2:
                plot = self.canvas.figure.add_subplot(rows, cols, i+1)
                if (tensor.shape[0] > tensor.shape[1]):
                    x_label = data_lt.get_labels()[0]
                    y_label = data_lt.get_labels()[1]
                    x_label_name = data_lt.get_label_names()[0]
                    y_label_name = data_lt.get_label_names()[1]    
                    pc = plot.imshow(tensor.T, cmap=cmap)
                else:
                    x_label = data_lt.get_labels()[1]
                    y_label = data_lt.get_labels()[0]
                    x_label_name = data_lt.get_label_names()[1]
                    y_label_name = data_lt.get_label_names()[0]    
                    pc = plot.imshow(tensor, cmap=cmap)

                cbar = self.canvas.figure.colorbar(pc,location='bottom')
                plot.set_title(data_name)
                plot.set_xlabel(x_label_name)
                plot.set_ylabel(y_label_name)

                plots.append(plot)

            else:
                raise ValueError("Invalid tensor shape")



        self.canvas.draw()



