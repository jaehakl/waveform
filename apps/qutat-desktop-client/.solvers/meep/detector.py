# QUTAT - Multiphysics Simulation Platform
# Copyright (C) 2023 Jaehak Lee
# SPDX-License-Identifier: GPL-3.0-only

import sys, os
import numpy as np
import meep as mp

from matform.array.text_matrix_expression import parse_vectors
from matform.array.labeledTensor import LabeledTensor


class Detector():
    def __init__(self, detector_dict, pars):
        self.type = detector_dict['type']
        self.name = detector_dict['name']
        self.position=parse_vectors(detector_dict['position'])[0]
        size_input = parse_vectors(detector_dict['size'])[0] 
        self.size = [v if v >= 0 else pars["_settings"]["cell_size"][i]-0.001 for i,v in enumerate(size_input)]
        self.direction=parse_vectors(detector_dict['direction'])[0]
        self.fc = (detector_dict['fstart']+detector_dict['fend'])/2
        self.fw = detector_dict['fend']-detector_dict['fstart']
        self.nfreqs = int(detector_dict['nfreqs'])
        self.detector_dict = detector_dict
        self.pars = pars

    #Before run empty_sim
    def is_require_reference(self):
        return False

    def make_reference(self, empty_sim):
        pass

    #After run empty_sim
    def collect_reference(self, empty_sim):
        pass

    #Before run sim
    def set(self, sim):
        self.dfts = self.set_dfts(sim)

    def set_dfts(self, sim):
        print("set_dfts is not implemented")
        return {}

    #After run sim
    def get(self):
        spectra = {}
        for dft_name in self.get_dft_names():
            spectra[dft_name] = LabeledTensor(self.get_dft_amplitudes(dft_name),
                [self.get_dft_freqs(dft_name)], ["Frequency (PHz)"]).to_np_dict()       
        return spectra

    def get_dft_names(self):
        return self.dfts.keys()

    def get_dft_freqs(self, dft_name):
        print("get_dft_freqs is not implemented")
        pass
    
    def get_dft_amplitudes(self, dft_name):
        print("get_dft_amplitudes is not implemented")
        pass

class FluxDetector(Detector):
    def set_dfts(self, sim):
        dfts = {}
        i_dir_dict = {"kx":0,"ky":1,"kz":2}
        for dir_name in i_dir_dict.keys():
            i_dir = i_dir_dict[dir_name]
            weight = self.direction[i_dir]
            if weight != 0:
                dft_name = "flux_"+dir_name
                region = mp.FluxRegion(
                    center=self.position,
                    size=self.size,
                    direction= i_dir,
                    weight=weight)
                dfts[dft_name] = sim.add_flux(self.fc,self.fw, self.nfreqs, region)
        return dfts

    def get_dft_freqs(self, dft_name):
        dft_flux = self.dfts[dft_name]
        unit_time = self.pars["_constants"]["UNIT_TIME"]
        return [freq/(1/unit_time) for freq in mp.get_flux_freqs(dft_flux)]
    
    def get_dft_amplitudes(self, dft_name):
        dft_flux = self.dfts[dft_name]
        return mp.get_fluxes(dft_flux)


class TransmittanceDetector(FluxDetector):
    def is_require_reference(self):
        return True

    def make_reference(self, empty_sim):
        self.dfts_empty = self.set_dfts(empty_sim)

    def collect_reference(self, empty_sim):
        self.dft_amplitudes_ref = {}
        for dft_name in self.dfts_empty.keys():
            self.dft_amplitudes_ref[dft_name] = mp.get_fluxes(self.dfts_empty[dft_name])

    def get(self):
        spectra = {}
        for dft_name in self.get_dft_names():
            dft_amplitudes = self.get_dft_amplitudes(dft_name)
            dft_amplitudes_ref = self.dft_amplitudes_ref[dft_name]
            spectra[dft_name] = LabeledTensor(np.array(dft_amplitudes)/np.array(dft_amplitudes_ref),
                [self.get_dft_freqs(dft_name)], ["Frequency (PHz)"]).to_np_dict()       

        return spectra


class ReflecttanceDetector(TransmittanceDetector):
    def set(self, sim):
        self.dfts = self.set_dfts(sim)
        for dft_name in self.get_dft_names():                    
            sim.load_minus_flux_data(self.dfts[dft_name], self.flux_data_ref[dft_name])

    def collect_reference(self, empty_sim):
        super().collect_reference(empty_sim)
        self.flux_data_ref = {}
        for dft_name in self.dfts_empty.keys():
            self.flux_data_ref[dft_name] = empty_sim.get_flux_data(self.dfts_empty[dft_name])


class ScatteringDetector(ReflecttanceDetector): 
    #Before run sim
    def set_dfts(self, sim):
        dfts = {}
        i_dir_dict = {"kx":0,"ky":1,"kz":2}
        for dir_name in i_dir_dict.keys():
            i_dir = i_dir_dict[dir_name]
            for sign in [-1,1]:
                dft_name = "flux_"+dir_name+"_"+str(sign)
                new_center = self.position.copy()
                new_center[i_dir] = new_center[i_dir] + sign*self.size[i_dir]/2                    
                new_size = self.size.copy()
                new_size[i_dir] = 0
                region = mp.FluxRegion(
                    center=new_center,
                    size=new_size,
                    direction = i_dir,
                    weight= float(sign)
                )
                dfts[dft_name] = sim.add_flux(self.fc,self.fw, self.nfreqs, region)
        return dfts

    def get(self):
        spectra = {}
        amplitudes = []
        amplitudes_ref = []

        i_dir_dict = {"kx":0,"ky":1,"kz":2}
        for dir_name in i_dir_dict.keys():
            i_dir = i_dir_dict[dir_name]
            weight = self.direction[i_dir]
            for sign in [-1,1]:
                dft_name = "flux_"+dir_name+"_"+str(sign)
                is_valid = True
                if weight == -1*sign:
                    is_valid = False
                if is_valid:
                    freq = self.get_dft_freqs(dft_name)
                    amplitudes_ref.append(self.dft_amplitudes_ref[dft_name])
                amplitudes.append(self.get_dft_amplitudes(dft_name))

        amplitudes_ref_total = np.array(amplitudes_ref).sum(axis=0)
        amplitudes_total = np.array(amplitudes).sum(axis=0)
        
        spectra["efficiency"] = LabeledTensor(amplitudes_total/amplitudes_ref_total, 
            [freq], ["Frequency (PHz)"]).to_np_dict()       
        return spectra

class EnergyDetector(Detector):
    def set_dfts(self, sim):
        dfts = {}
        region = mp.EnergyRegion(
            center=self.position,
            size=self.size)
        dfts["energy"] = sim.add_energy(self.fc,self.fw, self.nfreqs, region)
        return dfts

    def get_dft_freqs(self, dft_name):
        dft_flux = self.dfts[dft_name]
        unit_time = self.pars["_constants"]["UNIT_TIME"]
        return [freq/(1/unit_time) for freq in mp.get_energy_freqs(dft_flux)]
    
    def get_dft_amplitudes(self, dft_name):
        dft_flux = self.dfts[dft_name]
        return mp.get_total_energy(dft_flux)


class ForceDetector(Detector):
    #Before run sim
    def set_dfts(self, sim):
        dfts = {}
        i_dir_dict = {"kx":0,"ky":1,"kz":2}
        for dir_name in i_dir_dict.keys():
            i_dir = i_dir_dict[dir_name]
            weight = self.direction[i_dir]
            if weight != 0:
                dft_name = 'force_'+dir_name
                regions = []

                is_valid = True
                for other_direction in range(3):
                    if self.size[other_direction] == 0:
                        is_valid = False

                if is_valid:
                    for sign in [-1,1]:
                        new_center = self.position.copy()
                        new_center[i_dir] = new_center[i_dir] + sign*self.size[i_dir]/2                    
                        new_size = self.size.copy()
                        new_size[i_dir] = 0
                        region = mp.ForceRegion(
                            center=new_center,
                            size=new_size,
                            direction= i_dir,
                            weight= float(sign)
                            )
                        regions.append(region)
                    dfts[dft_name] = sim.add_force(self.fc,self.fw, self.nfreqs, *regions)
        return dfts

    #After run sim
    def get_dft_freqs(self, dft_name):
        dft_flux = self.dfts[dft_name]
        unit_time = self.pars["_constants"]["UNIT_TIME"]
        return [freq/(1/unit_time) for freq in mp.get_force_freqs(dft_flux)]

    def get_dft_amplitudes(self, dft_name):
        dft_flux = self.dfts[dft_name]
        return mp.get_forces(dft_flux)




class NearToFarDetector(Detector):
    #Before run sim
    def set_dfts(self, sim):
        dfts = {}
        i_dir_dict = {"kx":0,"ky":1,"kz":2}

        n_bloch = int(self.detector_dict['nbloch'])

        regions = []
        for dir_name in i_dir_dict.keys():
            i_dir = i_dir_dict[dir_name]
            weight = self.direction[i_dir]
            for sign in [-1,1]:
                is_valid = True
                if weight == -1*sign:
                    is_valid = False
                if is_valid:              
                    new_center = self.position.copy()
                    new_center[i_dir] = new_center[i_dir] + sign*self.size[i_dir]/2                    
                    new_size = self.size.copy()
                    new_size[i_dir] = 0
                    region = mp.Near2FarRegion(
                        center=new_center,
                        size=new_size,
                        direction = i_dir,
                        weight= float(sign)
                    )
                    regions.append(region)
        dfts["nf_box"] = sim.add_near2far(self.fc,self.fw, self.nfreqs, *regions, nperiods=n_bloch)
        return dfts

    def get_regions(self):
        regions = {}
        i_dir_dict = {"kx":0,"ky":1,"kz":2}
        for dir_name in i_dir_dict.keys():
            i_dir = i_dir_dict[dir_name]
            weight = self.direction[i_dir]
            for sign in [-1,1]:
                is_valid = True
                if weight == -1*sign:
                    is_valid = False
                if is_valid:              
                    new_center = self.position.copy()
                    new_center[i_dir] = new_center[i_dir] + sign*self.size[i_dir]/2                    
                    new_size = self.size.copy()
                    new_size[i_dir] = 0
                    region = mp.Near2FarRegion(
                        center=new_center,
                        size=new_size,
                        direction = i_dir,
                        weight= float(sign)
                    )
                    regions[dir_name+"_"+str(sign)] = region
        return regions

    #After run sim
    def get_far_field_freqs(self, dfts=None):
        if dfts == None:
            dfts = self.dfts
        nf_box = dfts["nf_box"]
        unit_time = self.pars["_constants"]["UNIT_TIME"]
        return [freq/(1/unit_time) for freq in mp.get_near2far_freqs(nf_box)]
    
    
    def get_far_field_intensity(self, sim, res_ff, r_ff, axis):
        nf_box = self.dfts["nf_box"]
        ff_list = []
        for theta in np.linspace(0,np.pi,res_ff*2):
            ff_list_theta = []
            for phi in np.linspace(0,2*np.pi,res_ff*2):
                if axis in ['x','X']:
                    x = mp.Vector3(r_ff*np.cos(theta),
                                r_ff*np.sin(theta)*np.cos(phi),
                                r_ff*np.sin(theta)*np.sin(phi))
                elif axis in ['y','Y']:
                    x = mp.Vector3(r_ff*np.sin(theta)*np.sin(phi),
                                r_ff*np.cos(theta),
                                r_ff*np.sin(theta)*np.cos(phi))
                else:
                    x = mp.Vector3(r_ff*np.sin(theta)*np.cos(phi),
                                r_ff*np.sin(theta)*np.sin(phi),
                                r_ff*np.cos(theta))
                ff = sim.get_farfield(nf_box,x)
                ff_list_theta.append(np.array(ff).reshape(-1,6))
            ff_list.append(ff_list_theta)
        ff_array = np.array(ff_list)
        ff_array_esqr = (abs(ff_array[:,:,:,:3])**2).sum(axis=3)
        return ff_array_esqr

    def get_near_fields(self, sim, dfts=None):
        if dfts == None:
            dfts = self.dfts
        nf_box = dfts["nf_box"]

        res_ff = self.detector_dict['res_ff']

        near_fields = {}
        freqs = self.get_far_field_freqs(dfts=dfts)
        regions = self.get_regions()

        for region_name in regions.keys():
            position = regions[region_name].center
            size = regions[region_name].size
            near_field = sim.get_farfields(nf_box, res_ff, center=position, size=size)
            region_fields = {}
            for field_name in ["Ex","Ey","Ez"]:
                field = near_field[field_name]
                labels = [list(range(shape)) for shape in field.shape]
                labels[-1] = freqs
                label_names = [str(i)+'('+str(shape)+')' for i, shape in enumerate(field.shape)]
                label_names[-1] = "Frequency (PHz)"
                region_fields[field_name] = LabeledTensor(field, labels, label_names).to_np_dict()
            near_fields[region_name] = region_fields
        return near_fields

    def get_fresnel_field_intensity(self, sim, res_ff, position, size):
        nf_box = self.dfts["nf_box"]
        fresnel_field = sim.get_farfields(nf_box, res_ff, center=position, size=size)

        fresnel_field_intensity = []
        for i_freq, freq in enumerate(self.get_far_field_freqs()):
            fresnel_field_intensity.append(np.array(
                [abs(fresnel_field[dir][:,:,i_freq])**2 for dir in ["Ex","Ey","Ez"]]
            ).sum(axis=0))
        return fresnel_field_intensity

