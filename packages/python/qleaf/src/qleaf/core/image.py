# Copyright (C) 2023 Jaehak Lee

import numpy as np
import cv2 

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *
  
def qimage_from_file_buffer(buffer, size=None):
    img_cv = cv2.imdecode(np.frombuffer(buffer, dtype=np.uint8), cv2.IMREAD_COLOR)
    height, width, channel = img_cv.shape
    bytesPerLine = 3 * width
    qImg = QImage(img_cv.data, width, height, bytesPerLine, QImage.Format_RGB888).rgbSwapped()
    if size is not None:
        qImg = qImg.scaled(size[0], size[1], Qt.KeepAspectRatio)
    return qImg