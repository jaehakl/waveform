import sys, os
from dotenv import load_dotenv
def get_base_dir():
    if getattr(sys, 'frozen', False):
        # 실행파일(.exe)로 패키징된 경우
        return os.path.dirname(sys.executable)
    else:
        # 일반 파이썬 스크립트로 실행되는 경우
        return os.path.dirname(os.path.abspath(__file__))+'/..'
    
BASE_DIR = get_base_dir()
os.environ['QUTAT_BASE_DIR'] = BASE_DIR
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(env_path)
print("BASE_DIR: ", os.getenv('QUTAT_BASE_DIR'))

from PySide6.QtGui import QIcon, QAction
from PySide6.QtWidgets import QApplication, QMenuBar, QMenu, QFileDialog, QMessageBox
from PySide6.QtCore import QDate

import api.auth as auth
from api.ui_login import LoginDialog

from qleaf.core.main_window import MainWindow
from qleaf.core import setStyle

from modules import fdtd, inverse_design, model_builder
from state import MainState




modules = {
    #"Inverse Design": inverse_design,
    #"Model Builder": model_builder,
    "FDTD": fdtd
}

class MenuBar(QMenuBar):
    def __init__(self, parent):
        super().__init__(parent)

        menu_dict = {}
        menu_dict["File"] = {"_nc_0":["Save Setup","Load Setup"]}
        menu_dict["Solvers"] = fdtd.State().find_solvers()
        menu_dict["Modules"] = {"_nc_1":list(modules.keys())}
        menu_dict["Cloud"] = {"_nc_0":["Login"],
                              "_nc_1":["Serve as a Puppet"]}
        menu_dict["Help"] = {"_nc_0":["About"]}

        for menu_name in menu_dict.keys():
            menu = QMenu(menu_name, parent)
            for category in menu_dict[menu_name].keys():
                if category[:4] == "_nc_":
                    menu.addSeparator()
                    for item in menu_dict[menu_name][category]:
                        action = QAction(item, parent)
                        action.setText(item)
                        action.setData(":".join([menu_name,item]))
                        menu.addAction(action)
                    menu.addSeparator()
                else:
                    sub_menu = QMenu(category, parent)
                    for item in menu_dict[menu_name][category]:
                        if item[:11] == "_separator_":
                            sub_menu.addSeparator()
                        else:
                            action = QAction(item, parent)
                            action.setText(item)
                            action.setData(":".join([menu_name,category,item]))
                            sub_menu.addAction(action)
                    menu.addMenu(sub_menu)
            self.addMenu(menu)
                    
        self.triggered.connect(lambda action: self.actionTriggered(action))

    def actionTriggered(self, action):
        commands = action.data().split(":")
        if commands[0] == "File":
            if commands[1] == "Save Setup":
                filename = QFileDialog.getSaveFileName(None, 'Save File', 
                    './'+QDate.currentDate().toString("yyyy-MM-dd")+".setup", "json (*.json)")
                fdtd.dataio.save_setup_local(filename[0])
            elif commands[1] == "Load Setup":
                filename = QFileDialog.getOpenFileName(self, 'Open File', 
                    './', "json (*.json)")
                fdtd.dataio.load_setup_local(filename[0])
        elif commands[0] == "Solvers":
            solver = commands[1]+":"+commands[2]
            fdtd.State().solver.set(solver)
        elif commands[0] == "Modules":
            MainState().main_window.loadModule(modules[commands[1]])            
        elif commands[0] == "Cloud":
            if commands[1] == "Login":
                LoginDialog(self.parent())
            elif commands[1] == "Serve as a Puppet":
                fdtd.puppet.PuppetDialog(self.parent()).exec()
        elif commands[0] == "Help":
            if commands[1] == "About":
                with open("INFO.txt", "r") as f:
                    info = f.readlines()
                QMessageBox.about(self.parent(), "About", "".join(info))
        print(action.text(), action.data())



#class InitLoginDialog(auth.gui.LoginDialog):
#    def closeEvent(self, e):
#        user_info = auth.get_user_info()
#        if user_info and "user" in user_info.keys():
#            e.accept()
#        else:
#            print("Failed to Authorize")
#            exit()



if __name__=="__main__":
    def login_cmd():
        login_success = False
        
        if ('QUTAT_USERNAME' in os.environ) and ('QUTAT_PASSWORD' in os.environ):
            username = os.environ['QUTAT_USERNAME']
            password = os.environ['QUTAT_PASSWORD']
            print(f"로그인 시도: {username}")
            
            # waveform-server 로그인 시도
            user_auth_info = {"name": username, "password": password}
            resp = auth.login(user_auth_info)
            if resp and resp.status_code == 200:
                print("Waveform 서버 로그인 성공")

        user_info = auth.check_session()
        return user_info

    if len(sys.argv) > 2:
        if sys.argv[1] == "puppet":
            app = QApplication()
            window = MainWindow(MenuBar)
            max_puppet = int(sys.argv[2])
            user_info = login_cmd()
            if not user_info or "user" not in user_info.keys():
                print("Failed to Authorize")
                exit()
            threads = []
            for i in range(max_puppet):
                threads.append(fdtd.puppet.ServeAsPuppetRepeat(window))
                threads[-1].start()
    else:
        app = QApplication()
        window = MainWindow(MenuBar)
        window.setWindowIcon(QIcon("logo.png"))
        window.setWindowTitle("QUTAT")

        app.setStyle('Fusion')
        setStyle(window, "Qutat")
        #setStyle(window, "Adaptic")

        MainState().main_window = window

        def close_event(e):
            for key in MainState().sub_windows:
                MainState().sub_windows[key].close()
        MainState().main_window.closeEvent = close_event

        window.loadModule(fdtd)
        #window.loadModule(inverse_design)

        user_info = login_cmd()
        #while not user_info or "user" not in user_info.keys():
        #    dialog = InitLoginDialog(window)
        #    user_info = auth.get_user_info()

        #window.showMaximized()
        window.resize(1920,1080)
        #window.showFullScreen()
        #window.loadModule(inverse_design)
        window.show()
        app.exec()
