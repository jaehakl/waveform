# nuitka-project: --standalone
# nuitka-project: --enable-plugin=pyside6
# nuitka-project: --follow-import-to=_api
# nuitka-project: --follow-import-to=helper
# nuitka-project: --follow-import-to=simbox
# nuitka-project: --follow-import-to=waveform_api
# nuitka-project: --nofollow-import-to=torch.utils.cpp_extension

# Copyright (C) 2023 Jaehak Lee

import sys, time
import numpy as np
import torch

from matform.array.array_to_image import get_image_file, get_image_file_fast
from _api import AbstractSimulation, execute_socket_server

import simbox as sb
from simbox import fdtd

import waveform_api

WAVELENGTH = 1536e-9 # (m)

class Simulation(AbstractSimulation):
    def run_simulation(self):
        pars = self._pars

        self._status = "Waveform : Generating Matrix"
        self.dm=sb.domain_matrix(
            main_dim = pars["_settings"]["cell_size"],
            dr = [pars["_settings"]["dx"] for i in range(3)],
            pbc= pars["_settings"]["pbc"],
            device = "cuda:0",
            device_cutoff=1e5
        )

        self.dm.op("all",fdtd.parameters)        
        self.dm.sync("all","dt",to="minimum")

        self._status = "Waveform : Setting PML"        
        self.dm.op_nonlocal("border",fdtd.CPML.set,WAVELENGTH)

        f_p = pars["_settings"]["f_p"]
        w_p = f_p[0]*2*np.pi
        w_c = f_p[1]*2*np.pi
        eps_inf = pars["_settings"]["eps_inf"]
        #if par["metalType"] == "Au":
        #    w_p = 2.15e15*2*np.pi
        #    w_c = 17.14*1e12*2*np.pi
        #elif par["metalType"] == "Al":
        #    w_p = 2.911e15*2*np.pi
        #    w_c = 31.12*1e12*2*np.pi
        self.dm.op("all",fdtd.Drude_RC.set,[w_p, w_c, eps_inf])

        self._status = "Waveform : Implementing structures"
        waveform_api.make_geometry(self.dm,pars)
        #self.dm.op("main", waveform_api.make_geometry, pars)

        dx = pars["_settings"]["dx"]
        dt = dx*0.5/pars["_constants"]["LIGHT_SPEED"]
        total_step = int(pars["_settings"]["simulation_time"]/dt)

        sources = waveform_api.make_sources(self.dm,pars)
        detectors = waveform_api.make_detectors(self.dm,pars)

        for i_T in range(total_step):
            #source
            waveform_api.apply_source(self.dm,sources)

            #step
            self.dm.op("all",sb.import_boundary_Yee,["Ex","Ey","Ez"])
            self.dm.op("all",fdtd.Propagate.cal_H)
            self.dm.op("all",sb.import_boundary_Yee,["Hx","Hy","Hz"])
            self.dm.op("all",fdtd.Propagate.cal_E)

            #record
            waveform_api.detect_signal(self.dm, detectors)

            self._status = "Waveform: Calculating..."+str(i_T)+"/"+str(total_step)
            if i_T%50==0:
                print(i_T,"/",total_step)
                #print("FDTD_",self.dm.cross_section("Ez",0,1,0).sum())

        #record
        self._status = "Waveform : Recording data"
        data_dict = waveform_api.get_detector_data(self.dm, detectors)

        # Time Domain Field
        # Time, Fields, X, Y, Z
        # Time = [tstart, tend, tstep]
        # Fields = [Ex, Ey, Ez, Hx, Hy, Hz]
        # X, Y, Z = position, size, [dx, dy, dz]

        # Frequency Domain Field
        # (imag, real), Freq, Fields, X, Y, Z
        # Freq = [fstart, fend, fstep] # fstep 에 맞게 Time 을 채워서 맞추면 됨.
        # Fields = [Ex, Ey, Ez, Hx, Hy, Hz]
        # X, Y, Z = position, size, [dx, dy, dz]

        '''
        ref = self.dm.get_group("source_0")[0][0].v["ref"]
        fmin = 4e14
        fmax = 8e14

        freqs_tensor = fft_x_freq

        svfs_np = svfs_tensor.numpy()
        freqs_np = freqs_tensor.numpy()

        ou_var_dict = {"var_type":"svfs"}
        ou_var_dict["svfs_np"] = svfs_np
        ou_var_dict["freqs_np"] = freqs_np
        ou_var_dict["pbc"] = [par["pbcX"],par["pbcY"],par["pbcZ"]]
        ou_var_dict["dx"] = par["dx"]*5
        ou_var_dict["dy"] = par["dx"]*5
        print("deleting dm")
        dm.delete()
        del dm
        print("emptying cache")
        torch.cuda.empty_cache()
        print("returning value")
        '''

        rv = self.send_update()      
        rv['arrays'] = data_dict
        rv['images'] = rv["figures"]

        self.dm.delete()
        del self.dm
        torch.cuda.empty_cache()

        self.status = "Waveform : Simulation Finished"
        return rv

    def send_update(self, *inputVars):
        efield_xy = np.zeros((1,1))
        efield_xz = np.zeros((1,1))
        efield_yz = np.zeros((1,1))
        eps_x = np.zeros((1,1))
        eps_y = np.zeros((1,1))
        eps_z = np.zeros((1,1))
        try:
            pbc = self._pars["_settings"]["pbc"]
            #efield_x = self.dm.b[1][1][1].cross_section("Ez",0,0).numpy()
            #efield_y = self.dm.b[1][1][1].cross_section("Ez",1,0).numpy()
            #efield_z = self.dm.b[1][1][1].cross_section("Ez",2,0).numpy()
            #print(np.array(self.dm.cross_section("Ez",0,1,0)).shape)
            efield_xy = self.dm.cross_section(["Ex","Ey","Ez","metal","eps"],2,int(1-pbc[2]),0).numpy().T - 1.0
            efield_xz = self.dm.cross_section(["Ex","Ey","Ez","metal","eps"],1,int(1-pbc[1]),0).numpy().T - 1.0
            efield_yz = self.dm.cross_section(["Ex","Ey","Ez","metal","eps"],0,int(1-pbc[0]),0).numpy().T - 1.0
            #eps_x = self.dm.cross_section("eps",0,1,0).numpy()
            #eps_y = self.dm.cross_section("eps",1,1,0).numpy()
            #eps_z = self.dm.cross_section("eps",2,1,0).numpy()
        except:
            pass
        rv = {
            "status":self._status,
            "figures":{
              "CS_XY":get_image_file(efield_xy, vmin=0, cmap="gist_ncar"),
              "CS_XZ":get_image_file(efield_xz, vmin=0, cmap="gist_ncar"),
              "CS_YZ":get_image_file(efield_yz, vmin=0, cmap="gist_ncar"),
              #"eps_x":get_image_file(eps_x),
              #"eps_y":get_image_file(eps_y),
              #"eps_z":get_image_file(eps_z),
            }
        }
        return rv

if __name__ == "__main__":
    port = sys.argv[1]
    print("Starting subprocess, port:",port)
    execute_socket_server(Simulation, port)