import numpy as np
import torch

def soft_dipole(d,name,pos,dim,freq,phase=0,envelope_func=lambda x: 1,record_to=None):
    wc = 2*np.pi*freq
    t = d.v['t']
    dV = envelope_func(t)*np.sin(wc*t+phase)
    #print(t, dV)

    location = d.Vsub(name,pos,dim)
    location += dV

    if record_to != None:
        if record_to not in d.v:
            d.v[record_to] = torch.tensor([dV])
        else:
            d.v[record_to] = torch.cat([d.v[record_to],torch.tensor([dV])])

def gaussian_ft(amp, df, cutoff=5, tstart=0, tend=np.inf):
    if df == 0:
        def envelope_func(t):
            return amp*(t > tstart)*(t < tend)
    else:
        DT = 1/df
        def envelope_func(t):
            return amp*np.exp(-0.5*((t-tstart-cutoff*DT)/DT)**2)
    return envelope_func

def CW_tapered(amp, df, cutoff=5, tstart=0, tend=np.inf):
    if df == 0:
        def envelope_func(t):
            return amp*(t > tstart)*(t < tend)
    else:
        DT = 1/df
        def envelope_func(t):
            value = amp
            value *= (t < tstart + cutoff*DT)*np.exp(-0.5*((t-(tstart + cutoff*DT))/DT)**2) \
                     + (t >= tstart + cutoff*DT)*(t <= tend ) \
                     + (t > tend )*np.exp(-0.5*((t-tend)/DT)**2)                      
            return value
    return envelope_func
