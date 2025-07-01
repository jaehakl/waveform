# Copyright (C) 2023 Jaehak Lee

# 이 파일을 복사하여 각 모듈별로 수정하여 사용한다.
import time
import sys, os
import numpy as np
import meep as mp

from matform.array.array_to_image import get_image_file, get_image_file_fast
from matform import LabeledTensor

from _api import AbstractSimulation, execute_socket_server
import meep_api

class Simulation(AbstractSimulation):
    def run_simulation(self):
        pars = self._pars

        pars["resolution"] = 1/(float(pars["_settings"]["dx"]))
        pars["total_size"] = [
            pars["_settings"]["cell_size"][0]+2*pars["_settings"]["len_pml"][0]/pars["resolution"],
            pars["_settings"]["cell_size"][1]+2*pars["_settings"]["len_pml"][1]/pars["resolution"],
            pars["_settings"]["cell_size"][2]+2*pars["_settings"]["len_pml"][2]/pars["resolution"]
        ]

        self.pmls = meep_api.make_pml(pars["resolution"],pars["_settings"]["len_pml"])
        self.mediums = meep_api.make_mediums(pars["material"],pars["material_sus"])
        self.geometry = meep_api.make_geometry(pars, pars["structure_evaluated"],self.mediums)
        self.sources = meep_api.make_sources(pars, pars["sources"])

        self.sim = mp.Simulation(cell_size=pars["total_size"],
                    boundary_layers=self.pmls,
                    extra_materials=list(self.mediums.values()),
                    sources=self.sources,
                    k_point=mp.Vector3(*pars["_settings"]["phase_pbc"]),
                    resolution=pars["resolution"])

        self.detectors = meep_api.make_detectors(empty_sim=self.sim ,detector_df=pars["detectors"], pars=pars)
        self.sim.reset_meep()
        self.sim = mp.Simulation(cell_size=pars["total_size"],
                    boundary_layers=self.pmls,
                    geometry=self.geometry,
                    extra_materials=list(self.mediums.values()),
                    sources=self.sources,
                    k_point=mp.Vector3(*pars["_settings"]["phase_pbc"]),
                    resolution=pars["resolution"])
        meep_api.set_detectors(self.sim, self.detectors)

        self.sim.run(until=pars["_settings"]["simulationTime"])

        self._status = "MEEP : Simulation is Completed"

        rv = self.send_update()        

        spectra = meep_api.get_spectra(self.detectors)
        vffs, arrays, images = meep_api.get_arrays(self.sim, pars["detectors"], self.detectors)

        rv["images"] = images
        rv["arrays"] = {}
        for key in spectra.keys():
            rv["arrays"][key] = LabeledTensor.from_json_dict(spectra[key])
        for key in arrays.keys():
            rv["arrays"][key] = LabeledTensor(arrays[key])
        for key in vffs.keys():
            rv["arrays"][key] = LabeledTensor(vffs[key])

        efield_x = meep_api.get_cross_section(self.sim, "x", "Ez")
        efield_y = meep_api.get_cross_section(self.sim, "y", "Ez")
        efield_z = meep_api.get_cross_section(self.sim, "z", "Ez")
        rv["images"]["efield_x"] = get_image_file(efield_x)    
        rv["images"]["efield_y"] = get_image_file(efield_y)    
        rv["images"]["efield_z"] = get_image_file(efield_z)    
        rv["arrays"]["efield_x"] = LabeledTensor(efield_x)
        rv["arrays"]["efield_y"] = LabeledTensor(efield_y)
        rv["arrays"]["efield_z"] = LabeledTensor(efield_z)

        eps_x = meep_api.get_cross_section(self.sim, "x", "eps")
        eps_y = meep_api.get_cross_section(self.sim, "y", "eps")
        eps_z = meep_api.get_cross_section(self.sim, "z", "eps")
        rv["images"]["eps_x"] = get_image_file(eps_x)    
        rv["images"]["eps_y"] = get_image_file(eps_y)    
        rv["images"]["eps_z"] = get_image_file(eps_z)    
        rv["arrays"]["eps_x"] = LabeledTensor(eps_x)
        rv["arrays"]["eps_y"] = LabeledTensor(eps_y)
        rv["arrays"]["eps_z"] = LabeledTensor(eps_z)
            
        return rv

    def send_update(self, *inputVars):
        try:
            efield_x = meep_api.get_cross_section(self.sim, "x", "Ez")
            efield_y = meep_api.get_cross_section(self.sim, "y", "Ez")
            efield_z = meep_api.get_cross_section(self.sim, "z", "Ez")
        except:
            efield_x = np.zeros((1,1))
            efield_y = np.zeros((1,1))
            efield_z = np.zeros((1,1))
        rv = {
            "status":self._status,
            "figures":{
              "efield_x":get_image_file(efield_x),
              "efield_y":get_image_file(efield_y),
              "efield_z":get_image_file(efield_z)
            }
        }
        return rv



if __name__ == "__main__":
    port = sys.argv[1]
    print("Starting subprocess, port:",port)
    execute_socket_server(Simulation, port)