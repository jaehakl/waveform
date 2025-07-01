# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

from functools import partial

from PySide6.QtGui import *
from PySide6.QtWidgets import *
from PySide6.QtCore import *

from qleaf.core.prop import Prop
from qleaf.comp.basic import LineEditComp

from ._auth import State, login, logout, check_login_user

class LoginDialog(QDialog):
    def __init__(self, parent):
        super().__init__(parent)
        self.setWindowTitle("Qutat.net 계정 정보")
        self.resize(300, 200)

        is_logged_in = False
        user_info = check_login_user()

        if "email" in user_info:
            is_logged_in = True

        if is_logged_in:
            self.email = QLabel()
            self.email.setText("로그인 계정 : "+user_info["email"])
            self.logout_button = QPushButton("Logout")
            self.logout_button.clicked.connect(self.logout)
    
            layout = QVBoxLayout()
            layout.addWidget(self.email)
            layout.addWidget(self.logout_button)
            self.setLayout(layout)
        else:
            self.id = QLineEdit()
            self.pw = QLineEdit()
            self.pw.setEchoMode(QLineEdit.Password)
            self.login_button = QPushButton("Login")
            self.login_button.clicked.connect(self.login)
            self.message = QLabel()

            layout = QFormLayout()
            self.setLayout(layout)
            LineEditComp(self,
                onChange=State().auth_host.set,
                props={"label":Prop("Auth Host"),"text":State().auth_host})
                
            layout.addRow("ID", self.id)
            layout.addRow("PW", self.pw)
            layout.addRow("", self.login_button)
            layout.addRow("", self.message)

        self.exec()

    def login(self):
        id = self.id.text()
        pw = self.pw.text()
        if login({"email":id,"password":pw}) == None:
            self.message.setText("Authorization Failed")
        else:
            self.message.setText("Authorizated Successfully")
            self.close()

    def logout(self):
        logout()
        self.close()

