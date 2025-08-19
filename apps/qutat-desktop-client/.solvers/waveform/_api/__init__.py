import sys, time

from ._input import import_parameters
from ._subprocess import AbstractSubprocessModel, execute_socket_server

class AbstractSimulation(AbstractSubprocessModel):
    def __init__(self):
        self._status = "Intializing"
        self._pars = {}

    def run(self, *args):
        self._pars = import_parameters(args[0])
        print(self._pars)
        rv = self.run_simulation()
        return rv
    
    def run_simulation(self):
        pass