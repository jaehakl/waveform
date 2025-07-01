# Copyright (C) 2023 Jaehak Lee

import time, os, sys

from PySide6.QtCore import QThread, Signal

from matform.meta_singleton import MetaSingleton
from matform.subprocess import ClientAPI
import platform

class SubprocDict(metaclass=MetaSingleton):
    def __init__(self):
        super().__init__()
        self.subprocs = {}

    def open_subproc(self, name, *args):
        if name not in self.subprocs.keys():
            client = ClientAPI()
            port = client.openLocalServer(*args)
            self.subprocs[name] = client
            return port
        return None

    def close_subproc(self, name, callback=None):
        #self.subprocs[name].proc.terminate()
        self.subprocs[name].proc.kill()
        del self.subprocs[name]
        if callback is not None:
            callback()

    def execute_subproc(self, task_name, subproc_name, func_update, func_return, command, *inputVars):
        subproc = self.subprocs[subproc_name]
        subproc.thread = ExecuteSubprocTask(subproc, command, *inputVars)
        subproc.thread.update.connect(func_update)
        subproc.thread.finished.connect(func_return)
        subproc.thread.start()

    def execute_subproc_sync(self,subproc_name, command, *inputVars):
        subproc = self.subprocs[subproc_name]
        return subproc.execute_sync_task(command, *inputVars)


class ExecuteSubprocTask(QThread):
    update = Signal(object)
    finished = Signal(object)
    def __init__(self, *args, parent=None):
        super().__init__(parent)
        self.args = args

    def run(self):
        subproc = self.args[0]
        command = self.args[1]
        inputVars = self.args[2:]
        #rv = subproc.execute_sync_task(command, *inputVars)

        task_id = subproc.execute_async_task(command, *inputVars)
        if task_id == "_cancel_":
            rv = "_cancel_"
        else:
            rv = subproc.get_return_value(task_id)
            while rv == "_none_":
                self.update.emit(subproc.execute_sync_task("get_update"))
                #self.update_value = subproc.execute_sync_task("get_update")
                time.sleep(0.5)
                rv = subproc.get_return_value(task_id)
        self.finished.emit(rv)
        #self.return_value = rv
        return None
