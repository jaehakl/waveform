# Copyright (C) 2023 Jaehak Lee

import requests
import cv2, PIL

import numpy as np

from PIL.ImageQt import ImageQt

from PySide6.QtCore import *
from PySide6.QtGui import *
from PySide6.QtWidgets import *

from ...core.abstract_comp import AbstractComp


class ImageComp(AbstractComp):
    def initUI(self):
        self.image = QLabel()
        self.image_data = None        
        self.layout().addWidget(self.image)

    def updateUI(self):
        img_data = self.props["image"].get()
        if "image_size" not in self.props:
            size = [self.image.width(), self.image.height()]
        else:
            size = self.props["image_size"].get()      
        
        if type(img_data) == str:
            img_path = img_data
        # if image_data is URL
            if img_path[:4] == "http":
                img_data = requests.get(img_path).content
        # if image_data is file path
            else:
                img_data = open(img_path, "rb").read()

        # if image_data is file buffer
        if type(img_data) == bytes:
            img_data = cv2.imdecode(np.frombuffer(img_data, dtype=np.uint8), cv2.IMREAD_COLOR)

        # if image_data is opencv image
        if type(img_data) == np.ndarray:
            height, width, channel = img_data.shape
            bytesPerLine = 3 * width
            img_data = QImage(img_data.data, width, height, bytesPerLine, QImage.Format_RGB888).rgbSwapped()

        #if image_data is PIL image
        if type(img_data) == PIL.Image.Image:
            img_data = ImageQt(img_data)
            img_data = QImage(img_data)
        
        # if image_data is QImage
        if type(img_data) == QImage:
            img_data = img_data.scaled(size[0], size[1], Qt.KeepAspectRatio)
            img_data = QPixmap.fromImage(img_data)
        
        if type(img_data) == QPixmap:
        # if image_data is QPixmap
            self.image.setPixmap(img_data)           
            self.image_data = img_data
        else:
        # if image_data is None
            self.image.setPixmap(QPixmap())
            self.image_data = None

    def get_image_size(self):
        if self.image_data is not None:
            return self.image_data.width(), self.image_data.height()
        else:
            return 0, 0