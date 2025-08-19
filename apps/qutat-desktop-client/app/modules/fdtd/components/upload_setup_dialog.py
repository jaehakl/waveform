# Copyright (C) 2023 Jaehak Lee
from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

from ..state import State
from ..service import setup_io


class UploadSetupDialog(QDialog):
    def __init__(self, parent):
        super().__init__(parent)
        self.setWindowTitle("Qutat.net 에 셋업 등록")
        self.resize(300, 200)

        today = QDate.currentDate().toString("yyyy-MM-dd")
        title_default = "Setup "+today

        layout = QFormLayout()
        self.setLayout(layout)

        title_edit = QLineEdit(title_default)
        layout.addRow("셋업 제목", title_edit)

        thumbnail_bytes = self.nativeParentWidget().centralWidget().widget().screenShot("PNG")

        thumbnail_image = QLabel()
        thumbnail_image.setPixmap(QPixmap.fromImage(QImage.fromData(thumbnail_bytes)).scaled(200,150))
        layout.addRow("썸네일", thumbnail_image)

        description_edit = QTextEdit()
        layout.addRow("설명", description_edit)

        publish_check = QCheckBox("공개")
        layout.addRow("공개", publish_check)

        submit_button = QPushButton("등록")
        layout.addRow("", submit_button)

        def submit():
            setup_io.upload_setup(
                {
                    "title": title_edit.text(),
                    "solver": State().solver.get(),
                    "description": description_edit.toPlainText(),
                    "public": publish_check.isChecked(),                    
                },
                {
                    "thumbnail": ("thumbnail.png",thumbnail_bytes)
                }
            )
            self.close()
        
        submit_button.clicked.connect(submit)
        self.exec_()
