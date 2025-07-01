import numpy as np
import torch
import sys

from torch.fft import fft, fftfreq
import torch.nn.functional as F

def savenp(d,name):
    filename=name+"_"+str(d.addr[0])+str(d.addr[1])+str(d.addr[2])
    np.save(filename,np.array(d.v[name]))

def volume_average(d,name,pos,dim,label_record,mask=1):
    if type(name)==list:
        temp_result = 0
        for n in name:
            temp_result += ((d.Vsub(n,pos,dim)[:-1,:-1,:]**2).cpu()*mask).mean()
        result = temp_result**0.5
    else:
        result = ((d.Vsub(name,pos,dim)[:-1,:-1,:]).cpu()*mask).mean()
    if label_record not in d.v:
        d.v[label_record] = np.array([result])
    else:
        d.v[label_record] = np.append(d.v[label_record],result)
    return result

def time_integral(d,name,pos,dim,label_record):
    if type(name)==list:
        temp_result = d.Vsub(name[0],pos,dim)**2
        for i, n in enumerate(name):
            temp_result += d.Vsub(name[i],pos,dim)**2
        result = temp_result**0.5
    else:
        result = d.Vsub(name,pos,dim)
    if label_record not in d.v:
        d.v[label_record] = result
    else:
        d.v[label_record] += result
    return d.v[label_record]

def record_volume(d,name,pos,dim,xstep,ystep,zstep,label):
    temp_array = torch.stack([d.Vsub(name,pos,dim)[::xstep,::ystep,::zstep].cpu()])
    if label+"_cash" not in d.v:
        d.v[label+"_cash"] = temp_array
    else:
        cash_size = d.v[label+"_cash"].shape[0]
        if cash_size%50 != 0:
            d.v[label+"_cash"] = torch.cat([d.v[label+"_cash"],temp_array],dim=0)
        else:
            if label not in d.v:
                d.v[label] = d.v[label+"_cash"]
            else:
                d.v[label] = torch.cat([d.v[label],d.v[label+"_cash"]],dim=0)
            d.v[label+"_cash"] = temp_array

def spectrum_map(d,name,point_source,fmin,fmax):
    int_time = 2*point_source.shape[0]
    sou_t = F.pad(point_source,(0,point_source.shape[0]),'constant')

    rec = torch.cat([d.v[name],d.v[name+"_cash"]]).cpu()
    rec_t = F.pad(rec,(0,0,0,0,0,0,0,rec.shape[0]),'constant')

    fst = int(fmin*int_time*d.v["dt"])
    fen = int(fmax*int_time*d.v["dt"])

    fft_sou = fft(sou_t)[fst:fen]

    sum_fft = []
    for i in range(rec.shape[1]):
        sum_i = []
        for j in range(rec.shape[2]):
            sum_j = []
            for k in range(rec.shape[3]):
                fft_det = fft(rec_t[:,i,j,k])[fst:fen]
                spec_temp = fft_det/fft_sou
                sum_j.append(spec_temp)
            sum_i.append(torch.stack(sum_j))
        sum_fft.append(torch.stack(sum_i))
    fft_arr = torch.stack(sum_fft)

    freq_list = fftfreq(rec_t.shape[0],d.v["dt"])[fst:fen]
    return fft_arr, freq_list
