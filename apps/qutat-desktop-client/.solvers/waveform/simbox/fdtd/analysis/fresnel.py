import numpy as np
import torch

class Fresnel():
    def __init__(self,wl=(0.6500793588639542)*1e-6,z=3000e-9,N=108,stride=1,dx=50e-9,pad=0,device="cuda:0"):
        self.wl=wl
        self.z=z
        self.N=N
        self.stride=stride
        self.dx=dx
        self.pad=pad
        self.device=device
        self.mapper_real, self.mapper_imag = self.make_mapper()

    def make_mapper(self):
        wl = self.wl
        z = self.z
        N = self.N
        stride=self.stride
        dx = self.dx
        pad = self.pad
        Nm = int((N-2*pad)/stride)
        X = np.zeros([Nm,Nm,N,N])
        Y = np.zeros([Nm,Nm,N,N])
        for ic in range(X.shape[0]):
            for jc in range(X.shape[1]):
                for i in range(X.shape[2]):
                    X[ic,jc,i,:] = (i-ic*stride-pad)*dx
                for j in range(X.shape[3]):
                    Y[ic,jc,:,j] = (j-jc*stride-pad)*dx
        R = (X**2+Y**2+z**2)**0.5
        mapper = (1/(complex(1j)*wl))*np.exp(-(2*np.pi/wl)*R*complex(1j))*(1/R)*(z/R)*dx*dx
        mapper_real = torch.as_tensor(np.real(mapper),dtype=torch.float,device=self.device)
        mapper_imag = torch.as_tensor(np.imag(mapper),dtype=torch.float,device=self.device)
        print("fresnel mapper ",int(z*1e9),"nm")
        return mapper_real, mapper_imag

    def mapE2(self,E):
        exmap_real = torch.sum(-E[0,:,:]*self.mapper_imag+E[1,:,:]*self.mapper_real,axis=(2,3))
        eymap_real = torch.sum(-E[2,:,:]*self.mapper_imag+E[3,:,:]*self.mapper_real,axis=(2,3))
        ezmap_real = torch.sum(-E[4,:,:]*self.mapper_imag+E[5,:,:]*self.mapper_real,axis=(2,3))
        exmap_imag = torch.sum(E[0,:,:]*self.mapper_real+E[1,:,:]*self.mapper_imag,axis=(2,3))
        eymap_imag = torch.sum(E[2,:,:]*self.mapper_real+E[3,:,:]*self.mapper_imag,axis=(2,3))
        ezmap_imag = torch.sum(E[4,:,:]*self.mapper_real+E[5,:,:]*self.mapper_imag,axis=(2,3))
        result = exmap_imag**2+exmap_real**2+eymap_imag**2+eymap_real**2+ezmap_imag**2+ezmap_real**2
        return result.cpu().float().detach().numpy()

    def mapE2array(self,E):
        for i in range(E.shape[0]):
            exmap_real = torch.sum(-E[i,0,:,:]*self.mapper_imag+E[i,1,:,:]*self.mapper_real,axis=(2,3))
            eymap_real = torch.sum(-E[i,2,:,:]*self.mapper_imag+E[i,3,:,:]*self.mapper_real,axis=(2,3))
            ezmap_real = torch.sum(-E[i,4,:,:]*self.mapper_imag+E[i,5,:,:]*self.mapper_real,axis=(2,3))
            exmap_imag = torch.sum(E[i,0,:,:]*self.mapper_real+E[i,1,:,:]*self.mapper_imag,axis=(2,3))
            eymap_imag = torch.sum(E[i,2,:,:]*self.mapper_real+E[i,3,:,:]*self.mapper_imag,axis=(2,3))
            ezmap_imag = torch.sum(E[i,4,:,:]*self.mapper_real+E[i,5,:,:]*self.mapper_imag,axis=(2,3))
            result = torch.stack([exmap_imag**2+exmap_real**2+eymap_imag**2+eymap_real**2+ezmap_imag**2+ezmap_real**2])
            if i == 0:
                results = result
            else:
                results = torch.cat([results,result],axis=0)
        return results


if __name__=='__main__':
    fs = Fresnel(z=2100e-9)

#    test = SaveFresnel(mapper_name="fresnel_2100nm")
