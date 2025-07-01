# Copyright (C) 2023 Jaehak Lee

import sys, os, io, time, json, copy
import numpy as np
import meep as mp
from meep import materials
import pandas as pd

import matplotlib
matplotlib.use('Agg')

from matform.array.axis_rotation import get_rotated_axis, rotated_axis_from_axis_and_angle, rotated_axis_from_axis_and_angle_inv
from matform.array.text_matrix_expression import write_vectors, parse_vectors, import_value, import_vector_series, import_series
from matform.array.array_to_image import get_image_file, get_image_file_polar

from detector import *

def make_pml(
        resolution,
        len_pmls = [10,10,10]
    ):
    pmls = []
    for i, direction in enumerate([mp.X, mp.Y, mp.Z]):
        if len_pmls[i] > 0:
            pmls.append(mp.PML(len_pmls[i]/resolution, direction=direction))
    return pmls


def make_mediums(material_df,material_sus_df):
    mediums = {}

    for i in range(len(material_df)):
        material = material_df.iloc[i]
        material_id = material['id']

        epsilon_diag, epsilon_offdiag = parse_vectors(material['eps'],3,2)
        D_conductivity_diag, D_conductivity_offdiag = parse_vectors(material['cond'],3,2)
        E_chi2_diag, E_chi2_offdiag = parse_vectors(material['chi2'],3,2)
        E_chi3_diag, E_chi3_offdiag = parse_vectors(material['chi3'],3,2)

        susceptibilities = []
        if len(material_sus_df) > 0:
            this_sus_df = material_sus_df[material_sus_df['material_id']==material_id]                                
            for sus_i in range(len(this_sus_df)):
                if this_sus_df['sus_class'].values[sus_i] == 'DrudeSusceptibility':
                    sus_cls = mp.DrudeSusceptibility
                elif this_sus_df['sus_class'].values[sus_i] == 'LorentzianSusceptibility':
                    sus_cls = mp.LorentzianSusceptibility

                sigma_diag, sigma_offdiag = parse_vectors(this_sus_df['sigma'].values[sus_i],3,2)

                frequency = float(this_sus_df['frequency'].values[sus_i])
                gamma = float(this_sus_df['gamma'].values[sus_i])

                susceptibilities.append(
                        sus_cls(
                        sigma_diag=sigma_diag, 
                        sigma_offdiag=sigma_offdiag,
                        frequency=frequency, 
                        gamma=gamma
                    )
                )

        mediums[material_id] = mp.Medium(
            epsilon_diag=epsilon_diag,
            epsilon_offdiag=epsilon_offdiag,
            D_conductivity_diag=D_conductivity_diag,
            D_conductivity_offdiag=D_conductivity_offdiag,
            E_chi2_diag=E_chi2_diag,
            E_chi3_diag=E_chi3_diag,
            E_susceptibilities=susceptibilities,
            valid_freq_range=mp.FreqRange(material['fmin'],material['fmax']))
    return mediums

def get_mat_func_cartesian(position, axis, props, mediums, mat_bg):
    def mat_func(p):
        pos = mp.Vector3(*position)
        p = p-pos
        
        x = p.dot(mp.Vector3(*axis[0]))
        y = p.dot(mp.Vector3(*axis[1]))
        z = p.dot(mp.Vector3(*axis[2]))
        for prop in props:
            func = prop[0]
            if type(func) == str:
                mat_in = mediums[prop[1]]
                if eval(str(func)) < 0:
                    return mat_in
        return mat_bg
    return mat_func

def get_mat_func_cylindrical(position, axis, props, mediums, mat_bg):
    def mat_func(p):
        def sin(theta):
            return np.sin(theta)
        def cos(theta):
            return np.cos(theta)
        def exp(x):
            return np.exp(x)

        pos = mp.Vector3(*position)
        p = p-pos

        x = p.dot(mp.Vector3(*axis[0]))
        y = p.dot(mp.Vector3(*axis[1]))
        z = p.dot(mp.Vector3(*axis[2]))

        r = np.sqrt(x**2+y**2)
        phi = np.arctan2(y,x)

        for prop in props:
            func = prop[0]
            if type(func) == str:
                mat_in = mediums[prop[1]]
                if eval(str(func)) < 0:
                    return mat_in
        return mat_bg
    return mat_func

def make_geometry(pars, structure_df,mediums):
    geometry = []
    if structure_df.shape[1] == 0:
        return geometry
    for i in range(len(structure_df)):
        position = parse_vectors(structure_df['position'][i])[0]
        size_input = parse_vectors(structure_df['size'][i])[0]
        size = [v if v >= 0 else pars["total_size"][i] for i,v in enumerate(size_input)]
        rotation = parse_vectors(structure_df['rotation'][i],4)
        props = parse_vectors(structure_df['props'][i],3,3)
        e1, e2, e3 = rotated_axis_from_axis_and_angle(rotation[::-1],np.eye(3))

        material_id = parse_vectors(structure_df['material'][i])[0][0]
        if material_id in mediums.keys():
            material = mediums[material_id]
        else:
            try:
                eps = float(material_id)
            except:
                eps = 1
            material = mp.Medium(epsilon=eps)
       
        if structure_df['component'][i] == 'sphere':
            geometry.append(mp.Sphere(radius = size[0],center=position,material=material))
        elif structure_df['component'][i] == 'ellipsoid':
            item = mp.Ellipsoid(
                size=[2*v for v in size],
                e1=mp.Vector3(*e1),e2=mp.Vector3(*e2),e3=mp.Vector3(*e3),
                center=position,
                material=material)
            geometry.append(item)
        elif structure_df['component'][i] == 'cylinder':
            item = mp.Cylinder(radius = size[0],
                                axis = e3,
                                height = size[2],
                                center=position,
                                material=material)
            geometry.append(item)
        elif structure_df['component'][i] == 'cone':
            item = mp.Cone(radius = size[0],
                            radius2 = size[1],
                            axis = e3,
                            height = size[2],
                            center=position,
                            material=material)
            geometry.append(item)
        elif structure_df['component'][i] == 'block':
            e1_b, e2_b, e3_b = rotated_axis_from_axis_and_angle_inv(rotation[::-1],np.array(props).T).T
            item = mp.Block(
                size=size,
                e1=mp.Vector3(*e1_b),e2=mp.Vector3(*e2_b),e3=mp.Vector3(*e3_b),
                center=position,
                material=material)
            geometry.append(item)
        elif structure_df['component'][i] == 'region':
            e1_b, e2_b, e3_b = rotated_axis_from_axis_and_angle_inv(rotation[::-1],np.eye(3)).T
            item = mp.Block(
                size=size,
                e1=mp.Vector3(*e1_b),e2=mp.Vector3(*e2_b),e3=mp.Vector3(*e3_b),
                center=position,
                material=material)
            geometry.append(item)
        elif structure_df['component'][i] == 'region_func':
            e1_b, e2_b, e3_b = rotated_axis_from_axis_and_angle_inv(rotation[::-1],np.eye(3)).T
            item = mp.Block(
                size=size,
                e1=e1_b,e2=e2_b,e3=e3_b,
                center=position,
                material=get_mat_func_cartesian(position, [e1,e2,e3], props, mediums, material)
            )
            geometry.append(item)
        elif structure_df['component'][i] == 'so_revol_func':
            item = mp.Cone(
                radius = size[0],
                radius2 = size[1],
                axis = e3,
                height = size[2],
                center=position,
                material=get_mat_func_cylindrical(position, [e1,e2,e3], props, mediums, material)
            )
            geometry.append(item)

    return geometry

def make_sources(pars, source_df):
    sources = []
    for i in range(len(source_df)):
        if source_df['type'][i] == 'cw':
            src = mp.ContinuousSource(
                frequency=source_df['fc'][i],
                is_integrated=True)
        elif source_df['type'][i] == 'gaussian':
            src = mp.GaussianSource(
                frequency=source_df['fc'][i],
                fwidth=source_df['fw'][i],
                cutoff=5.0,
                is_integrated=True)
                
        if source_df['comp'][i] == 'Ex':
            source_component = mp.Ex
        elif source_df['comp'][i] == 'Ey':
            source_component = mp.Ey
        elif source_df['comp'][i] == 'Ez':
            source_component = mp.Ez
        elif source_df['comp'][i] == 'Hx':
            source_component = mp.Hx
        elif source_df['comp'][i] == 'Hy':
            source_component = mp.Hy
        elif source_df['comp'][i] == 'Hz':
            source_component = mp.Hz
        
        size_input = parse_vectors(source_df['size'][i])[0]
        size = [v if v >= 0 else pars["total_size"][i] for i,v in enumerate(size_input)]

        source = mp.Source(
            src = src,
            component=source_component,
        center=parse_vectors(source_df['position'][i])[0],
        size=size,
        amplitude=source_df['amp'][i])
        sources.append(source)
    return sources



def make_detectors(empty_sim, detector_df, pars):
    detectors = {}
    for i in range(len(detector_df)):
        name = detector_df['name'][i]
        if name in detectors.keys():
            name = name+'_'+str(i)

        if detector_df['type'][i] == 'flux':
            detectors[name] = FluxDetector(detector_df.iloc[i], pars)
        elif detector_df['type'][i] == 'transmission':
            detectors[name] = TransmittanceDetector(detector_df.iloc[i], pars)
        elif detector_df['type'][i] == 'reflection':
            detectors[name] = ReflecttanceDetector(detector_df.iloc[i], pars)
        elif detector_df['type'][i] == 'scattering':
            detectors[name] = ScatteringDetector(detector_df.iloc[i], pars)
        elif detector_df['type'][i] == 'energy':
            detectors[name] = EnergyDetector(detector_df.iloc[i], pars)
        elif detector_df['type'][i] == 'force':
            detectors[name] = ForceDetector(detector_df.iloc[i], pars)
        elif detector_df['type'][i] == 'nf_box':
            detectors[name] = NearToFarDetector(detector_df.iloc[i], pars)
        #elif detector_df['type'][i] == 'norm_nf':
        #    detectors[name] = NormNearFieldDetector(detector_df.iloc[i], pars)
        else:
            pass

    empty_sim_required = False
    for detector in detectors.values():
        if detector.is_require_reference():
            detector.make_reference(empty_sim)
        empty_sim_required = empty_sim_required or detector.is_require_reference()
    
    if empty_sim_required:
        empty_sim.run(until=pars["_settings"]["simulationTime"])
        for detector in detectors.values():
            detector.collect_reference(empty_sim)

    return detectors

def set_detectors(sim, detectors):
    for detector in detectors.values():
        detector.set(sim)


def get_spectra(detectors):
    spectra = {}
    for name in detectors.keys():
        if detectors[name].type not in ['nf_box', 'norm_nf']:
            detector_spectra = detectors[name].get()
            for region_name in detector_spectra.keys():
                spectra[name+"_"+region_name] = detector_spectra[region_name]
    return spectra


def get_cross_section(sim, axis, component):
    if component == "Ex":
        total_field = sim.get_efield_x()
    elif component == "Ey":
        total_field = sim.get_efield_y()
    elif component == "Ez":
        total_field = sim.get_efield_z()
    elif component == "E2":
        total_fields = sim.get_efield()
        total_field = np.sqrt(np.sum(np.square(total_fields),axis=3))
    elif component == "eps":
        total_field = sim.get_epsilon()
    else:
        total_field = np.zeros((1,1,1))
    
    if len(total_field.shape) == 3:            
        if axis == "x":
            field = total_field[int(total_field.shape[0]/2),:,:].transpose()
        elif axis == "y":
            field = total_field[:,int(total_field.shape[1]/2),:].transpose()
        elif axis == "z":
            field = total_field[:,:,int(total_field.shape[2]/2)]
        else:
            field = np.zeros((1,1))
    elif len(total_field.shape) == 2:
        field = total_field
    elif len(total_field.shape) == 1:
        field = np.array([total_field])
    return field

def get_arrays(sim, detector_df, detectors):
    vffs = {}
    arrays = {}
    images = {}
    for i in range(len(detector_df)):
        if detector_df['type'][i] == 'slice':
            vmin = 'auto'
            comp = detector_df['target'][i]
            comp_dict = {"Ex":mp.Ex,"Ey":mp.Ey,"Ez":mp.Ez}
            center=parse_vectors(detector_df['position'][i])[0]
            size=parse_vectors(detector_df['size'][i])[0]

            def get_array(center, size, component):
                array_complex = sim.get_array(center=mp.Vector3(*center),
                    size=mp.Vector3(*size), component=comp_dict[component])                
                return np.real(array_complex)
            if comp in comp_dict.keys():
                array = get_array(center, size, comp)
            elif comp == 'E^2':
                array = (get_array(center, size, 'Ex')**2 
                       + get_array(center, size, 'Ey')**2 
                       + get_array(center, size, 'Ez')**2)
                vmin = 0
            else:
                array = np.zeros((1,1))

            axis = size.index(min(size))

            if (len(array.shape) == 3):
                array2d = np.sum(array, axis=axis)
            else:
                array2d = array

            if axis == 1:
                array2d = np.rot90(array2d)
            images[detector_df['name'][i]] = get_image_file(array2d,vmin=vmin)
            arrays[detector_df['name'][i]] = array2d

        elif detector_df['type'][i] == 'nf_box':
            nf_detector = detectors[detector_df['name'][i]]
            res_ff = int(detector_df['res_ff'][i])
            near_fields = nf_detector.get_near_fields(sim)
            for region_name in near_fields.keys():
                for field_name in near_fields[region_name].keys():
                    key = '.'.join([detector_df['name'][i],region_name,field_name])
                    vffs[key] = near_fields[region_name][field_name]

        elif detector_df['type'][i] == 'ff_angle':
            name = detector_df['name'][i]
            res_ff = int(detector_df['res_ff'][i])
            r_ff = detector_df['r_ff'][i]
            axis = detector_df['target'][i]

            nf_detector = detectors[detector_df['target'][i]]
            freqs = nf_detector.get_far_field_freqs()
            ff_intensity = nf_detector.get_far_field_intensity(sim, res_ff, r_ff, axis)
            
            for i_freq, freq in enumerate(freqs):
                new_name = name + ''.join("{:.3f}".format(freq).split('.'))
                images[new_name+"u"] = get_image_file_polar(ff_intensity[:res_ff,:,i_freq])
                images[new_name+"l"] = get_image_file_polar(np.flip(ff_intensity[res_ff:,:,i_freq],axis=0))
                arrays[new_name+"u"] = ff_intensity[:res_ff,:,i_freq]
                arrays[new_name+"l"] = np.flip(ff_intensity[res_ff:,:,i_freq],axis=0)

        elif detector_df['type'][i] == 'ff_plane':
            nf_detector = detectors[detector_df['target'][i]]
            freqs = nf_detector.get_far_field_freqs()

            position=parse_vectors(detector_df['position'][i])[0]
            size=parse_vectors(detector_df['size'][i])[0]
            res_ff = detector_df['res_ff'][i]

            fresnel_field_intensity = nf_detector.get_fresnel_field_intensity(sim, res_ff, position, size)

            for i_freq, freq in enumerate(freqs):
                name = detector_df['name'][i] + ''.join("{:.3f}".format(freq).split('.'))
                images[name] = get_image_file(fresnel_field_intensity[i_freq])
                arrays[name] = fresnel_field_intensity[i_freq]
    return vffs, arrays, images




def save_material_library(filename):
    UNIT_TIME = 1e-15
    rv = {}
    for material_key in materials.__dict__.keys():
        material = materials.__dict__[material_key]
        material_json = {}
        if material.__class__.__name__ == "Medium":
            for vector3_data_key in ["epsilon_diag","epsilon_offdiag",
                                     "mu_diag","mu_offdiag",
                                     "E_chi2_diag","E_chi3_diag",
                                     "H_chi2_diag","H_chi3_diag",
                                     "D_conductivity_diag","D_conductivity_offdiag",
                                     "B_conductivity_diag","B_conductivity_offdiag"]:
                if vector3_data_key in material.__dict__.keys():
                    material_json[vector3_data_key] = list(material.__dict__[vector3_data_key])
            
            for number_data_key in ["epsilon","index","mu","chi2","chi3",
                                    "D_conductivity","B_conductivity",
                                    "E_chi2","E_chi3","H_chi2","H_chi3"]:
                if number_data_key in material.__dict__.keys():
                    material_json[number_data_key] = material.__dict__[number_data_key]


            def get_sus_json(sus):
                sus_json = {}

                sus_class = sus.__class__.__name__
                sus_json["sus_class"] = sus_class
            
                if "sigma_diag" in sus.__dict__.keys():
                    sus_json["sigma_diag"] = list(sus.__dict__["sigma_diag"])
                if "sigma_offdiag" in sus.__dict__.keys():
                    sus_json["sigma_offdiag"] = list(sus.__dict__["sigma_offdiag"])
                if "sigma" in sus.__dict__.keys():
                    sus_json["sigma"] = sus.__dict__["sigma"]
                
                if sus_class in ["DrudeSusceptibility","LorentzianSusceptibility"]:
                    sus_json["frequency"] = sus.__dict__["frequency"]/(1/UNIT_TIME)
                    sus_json["gamma"] = sus.__dict__["gamma"]/(1/UNIT_TIME)

                return sus_json

            material_json["E_susceptibilities"] = [get_sus_json(sus) for sus in material.__dict__["E_susceptibilities"]]
            material_json["H_susceptibilities"] = [get_sus_json(sus) for sus in material.__dict__["H_susceptibilities"]]

            material_json["valid_freq_range"] = [material.__dict__["valid_freq_range"].min/(1/UNIT_TIME),
                                                 material.__dict__["valid_freq_range"].max/(1/UNIT_TIME)]

            rv[material_key] = material_json
        
    with open(filename, 'w') as outfile:
        json.dump(rv, outfile, indent=4)

