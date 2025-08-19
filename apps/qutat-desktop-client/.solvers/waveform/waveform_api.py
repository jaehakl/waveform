# Copyright (C) 2023 Jaehak Lee

import torch

#from helper.get_freer_gpu import get_freer_gpu

import simbox as sb
from simbox import fdtd
from matform import parse_vectors, LabeledTensor

LIGHT_SPEED = 299_792_458
LENGTH_UNIT_OF_MATERIALS = 1e-6
LENGTH_UNIT = 1e-6 # um
TIME_UNIT = 1e-15 # fs
UNIT_TIME = TIME_UNIT*LIGHT_SPEED/LENGTH_UNIT_OF_MATERIALS



def make_geometry(dm, pars):
    geometry_df = pars["structure_evaluated"]
    materials_df = pars["materials"]

    for i in range(len(geometry_df)):
        values = {}
        s = geometry_df.loc[i]
        material_id = parse_vectors(s['material'])[0][0]
        if material_id == "metal":
            vname = "metal"
            epsilon = 1
        elif material_id == "~metal":
            vname = "metal"
            epsilon = 0
        else:
            try:
                vname = "eps"
                epsilon = float(material_id)
            except:
                vname = "eps"
                epsilon = 1
                print("material_id",material_id,"not found")
                continue
        values["vname"] = vname
        values["epsilon"] = epsilon
        values["position"] = parse_vectors(s['position'])[0]
        values["rotation"] = parse_vectors(s['rotation'])
        values["size"] = parse_vectors(s['size'])[0]
        for j in range(3):
            if values["size"][j] == 0:
                values["size"][j] = 0.5*pars["_settings"]["dx"]

        if s.component == "block":
            group_range = []
            for j in range(3):
                if dm.pbc[j] == 1:
                    group_range.append(0)
                    group_range.append(1)
                else:
                    group_range.append(1)
                    group_range.append(2)
                if values["size"][j] < 0:
                    values["size"][j] = 1e6
                    group_range[2*j] = 0
                    group_range[2*j+1] = 999999
            geometry_id = "geometry_"+str(i)
            dm.set_group(geometry_id,group_range)
            def func(box):
                sb.solid.block(box,values["position"],values["size"],
                                values["vname"],values["epsilon"])
            dm.op(geometry_id,func)            
        elif s.component == "sphere":
            def func(box):
                sb.solid.sphere(box,values["position"],values["size"],
                                values["vname"],values["epsilon"])
            dm.op("main",func)            
        elif s.component == "cone":
            def func(box):
                sb.solid.cone(box,values["position"],values["size"],
                                values["vname"],values["epsilon"])
            dm.op("main",func)
        elif s.component == "so_revol_func":
            values["props"] = parse_vectors(s['props'])
            unit_length = pars["constants"]["UNIT_LENGTH"]
            def func(box):
                sb.solid.so_revol_func(box,unit_length,values["position"],values["size"],values["props"],
                                values["vname"],values["epsilon"])
            dm.op("main",func)



def make_sources(dm,pars):
    sources_list = []
    source_df = pars["sources"]
    for i in range(len(source_df)):
        s = source_df.iloc[i].to_dict()

        source = {}
        source["name"] = s["name"]
        source["position"] = parse_vectors(s["position"])[0]
        source["size"] = parse_vectors(s["size"])[0]
        source["type"] = s["type"]
        source["comp"] = s["comp"]
        source["amp"] = s["amp"]
        time = parse_vectors(s["time"],2)[0]
        source["ts"] = time[0]
        source["te"] = time[1]
        freq = parse_vectors(s["freq"],2)[0]
        source["fc"] = freq[0]
        source["fw"] = freq[1]

        group_range = []
        for j in range(3):
            if dm.pbc[j] == 1:
                group_range.append(0)
                group_range.append(1)
            else:
                group_range.append(1)
                group_range.append(2)
            if source["size"][j] == 0:
                source["size"][j] = pars["settings"]["dx"]
            elif source["size"][j] < 0:
                source["size"][j] = 1e6
                group_range[2*j] = 0
                group_range[2*j+1] = 999999

        dm.set_group(source["name"],group_range)
        sources_list.append(source)
    return sources_list

def apply_source(dm,sources_list):
    for source in sources_list:
        name = source["name"]
        position = source["position"]
        size = source["size"]
        comp = source["comp"]
        amp = source["amp"]
        ts = source["ts"]
        te = source["te"]
        fc = source["fc"]
        fw = source["fw"]
        
        if source["type"] == "gaussian":
            dm.op(name,fdtd.Source.soft_dipole,comp,position,size,fc,0,
                    fdtd.Source.gaussian_ft(amp,fw,5,ts,te),"_ref_"+name)
        elif source["type"] == "cw":
            dm.op(name,fdtd.Source.soft_dipole,comp,position,size,fc,0,
                    fdtd.Source.CW_tapered(amp,fw,5,ts,te),"_ref_"+name)
        else:
            print("source type",source["type"],"not found")


def make_detectors(dm,pars):
    detectors_list = []
    detector_df = pars["detectors"]
    for i in range(len(detector_df)):
        s = detector_df.iloc[i].to_dict()

        detector = {}
        detector["name"] = s["name"]
        detector["type"] = s["type"]
        detector["frange"] = parse_vectors(s["frange"])[0]
        detector["fmin"] = detector["frange"][0]
        detector["fmax"] = detector["frange"][1]
        detector["fstep"] = detector["frange"][2]
        detector["fields"] = s["fields"].split(",")
        detector["ref_source"] = s["ref_source"]
        detector["position"] = parse_vectors(s["position"])[0]
        detector["size"] = parse_vectors(s["size"])[0]
        detector["dr"] = parse_vectors(s["dr"])[0]
        detector["dx"] = int(detector["dr"][0]/pars["settings"]["dx"])
        detector["dy"] = int(detector["dr"][1]/pars["settings"]["dx"])
        detector["dz"] = int(detector["dr"][2]/pars["settings"]["dx"])
        detectors_list.append(detector)

        for j in range(3):
            if detector["size"][j] == 0:
                detector["size"][j] = pars["settings"]["dx"]
            elif detector["size"][j] < 0:
                detector["size"][j] = pars["settings"]["cell_size"][j]\
                                      - pars["settings"]["dx"]

    return detectors_list

def detect_signal(dm, detectors_list):
    for detector in detectors_list:
        name = detector["name"]
        fields = detector["fields"]
        position = detector["position"]
        size = detector["size"]
        dx = detector["dx"]
        dy = detector["dy"]
        dz = detector["dz"]

        if detector["type"] == "spectral":
            for field in fields:
                label = "_".join([name,field])
                dm.op("main",fdtd.Output.record_volume,field,position,size,dx,dy,dz,label)        
        else:
            print("detector type",type,"not found")

    return detectors_list


def get_detector_data(dm, detectors_list):
    data_dict = {}
    for detector in detectors_list:
        if detector["type"] == "spectral":
            ref_source_name = detector["ref_source"]
            ref = dm.get_group(detector["ref_source"])[0][0].v["_ref_"+ref_source_name]
            fmin = detector["fmin"]
            fmax = detector["fmax"]
            fstep = detector["fstep"]
            dx = detector["dx"]
            dy = detector["dy"]
            dz = detector["dz"]

            fft_dict = {}
            for field in detector["fields"]:
                label = "_".join([detector["name"],field])
                fft_field, freq = dm.op("main",fdtd.Output.spectrum_map,label,ref,fmin,fmax)[0]
                fft_dict[field] = fft_field
                fft_dict["freq"] = freq

            main_box = dm.get_group("main")[0][0]
            dl = main_box.dl
            dt = main_box.v["dt"]

            data = torch.stack([fft_dict[field] for field in detector["fields"]])
            labels = [
                detector["fields"],
                [detector["position"][0]-0.5*detector["size"][0]+i*dx*dl[0]
                    for i in range(data.shape[1])],
                [detector["position"][1]-0.5*detector["size"][1]+i*dy*dl[1]
                    for i in range(data.shape[2])],
                [detector["position"][2]-0.5*detector["size"][2]+i*dz*dl[2]
                    for i in range(data.shape[3])],
                    fft_dict["freq"].tolist()
                ]
            label_names = ["Field","X","Y","Z","Frequency"]
            lt = LabeledTensor(data, labels, label_names)
            data_dict[detector["name"]] = lt
            print(data.shape)
            #svfs_complex = torch.stack([fft_x[:-1,:-1,-1,:],fft_y[:-1,:-1,-1,:],fft_z[:-1,:-1,-1,:]]).swapaxes(3,2).swapaxes(2,1).swapaxes(1,0)
            #svfs_tensor = torch.stack([svfs_complex.real,svfs_complex.imag])
        else:
            # Time Domain Field
            # Time, Fields, X, Y, Z
            # Time = [tstart, tend, tstep]
            # Fields = [Ex, Ey, Ez, Hx, Hy, Hz]
            # X, Y, Z = position, size, [dx, dy, dz]

            print("detector type",type,"not found")
    return data_dict