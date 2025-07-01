# Copyright (C) 2024 Jaehak Lee

import io
import numpy as np
from matplotlib import pyplot as plt

def get_image_file(array2d, vmin='auto',cmap='seismic'):
    array2d_real = np.real(array2d)
    with io.BytesIO() as buffer:
        vmax = max(-array2d_real.min(),array2d_real.max())
        if vmin == 'auto':
            vmin = -vmax
        figure = plt.Figure(figsize=(3,3))
        ax = figure.add_subplot(111)
        if array2d.shape[0] == 1:
            pc = ax.plot(array2d_real[0,:], color='black', linewidth=1.0)
        elif array2d.shape[1] == 1: 
            pc = ax.plot(array2d_real[:,0], color='black', linewidth=1.0)           
        else:        
            pc = ax.imshow(array2d_real, cmap=cmap, vmin=vmin,vmax=vmax, origin='lower')
            cbar = figure.colorbar(pc,location='bottom')
        
        figure.tight_layout()
        figure.savefig(buffer, format='png')
        image_file_bytes = buffer.getvalue()
    return image_file_bytes

def get_image_file_fast(array2d, vmin='auto',cmap='seismic'):
    array2d_real = np.real(array2d)
    with io.BytesIO() as buffer:
        vmax = max(-array2d_real.min(),array2d_real.max())
        if vmin == 'auto':
            vmin = -vmax
        plt.imsave(buffer, array2d_real, format='png', cmap=cmap,vmin=vmin,vmax=vmax, origin='lower')
        #plt.imsave(buffer, array2d_real, format='png', cmap='gist_ncar',vmin=0)
        image_file_bytes = buffer.getvalue()
    return image_file_bytes

def get_image_file_polar(array2d, vmin='auto'):
    theta = np.linspace(0,0.5*np.pi,array2d.shape[0])
    phi = np.linspace(0,2*np.pi,array2d.shape[1])
    X, Y = np.meshgrid(theta,phi)
    if vmin == 'auto':
        vmin = 0
    with io.BytesIO() as buffer:
        figure = plt.Figure(figsize=(3,3))
        ax = figure.add_subplot(111,polar=True)
        pc = ax.pcolormesh(Y,X, array2d.T,shading="auto",vmin=vmin,vmax=array2d.max(),cmap="gist_ncar")    
        cbar = figure.colorbar(pc)
        figure.tight_layout()
        figure.savefig(buffer, format='png')
        image_file_bytes = buffer.getvalue()
    return image_file_bytes
