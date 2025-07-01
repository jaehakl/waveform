import numpy as np
import torch

class Box:
    def __init__(self,dimension,mesh,device="cpu"):
        self.group=["all"]
        self.device=device
        self.dim=dimension
        self.mesh=mesh
        self.dl=[self.dim[i]/(self.mesh[i]-2) for i in range(0,len(mesh))]
        self.v=dict()
        self.addr = [0,0,0]
    def x(self,i): return (-1+i+0.5)*self.dl[0]-0.5*self.dim[0]
    def y(self,j): return (-1+j+0.5)*self.dl[1]-0.5*self.dim[1]
    def z(self,k): return (-1+k+0.5)*self.dl[2]-0.5*self.dim[2]
    def i(self,x): return 1 + int((x+0.5*self.dim[0])/self.dl[0])
    def j(self,y): return 1 + int((y+0.5*self.dim[1])/self.dl[1])
    def k(self,z): return 1 + int((z+0.5*self.dim[2])/self.dl[2])
    def gen_tensor(self,name,init_val):
        self.v[name] = torch.full(self.mesh,init_val,dtype=torch.float,
                                  device=self.device)

    def Vsub(self,name,pos,dim,shift=[0,0,0]):
        d=self
        istart = max(1,self.i(pos[0]-0.5*dim[0])) + shift[0]
        iend = min(self.mesh[0]-1,self.i(pos[0]+0.5*dim[0])) + shift[0]
        jstart = max(1,self.j(pos[1]-0.5*dim[1])) + shift[1]
        jend = min(self.mesh[1]-1,self.j(pos[1]+0.5*dim[1])) + shift[1]
        kstart = max(1,self.k(pos[2]-0.5*dim[2])) + shift[2]
        kend = min(self.mesh[2]-1,self.k(pos[2]+0.5*dim[2])) + shift[2]
        return self.v[name][istart:iend+1,jstart:jend+1,kstart:kend+1]
    def Csub(self,name,pos,dim,shift=[0,0,0]):
        return self.Vsub(name,pos,dim,shift).detach().clone()

    def V(self,name,i=0,j=0,k=0):
        return self.v[name][1+i:self.mesh[0]-1+i,1+j:self.mesh[1]-1+j,1+k:self.mesh[2]-1+k]
    def C(self,name,i=0,j=0,k=0):
        return self.v[name][1+i:self.mesh[0]-1+i,1+j:self.mesh[1]-1+j,1+k:self.mesh[2]-1+k].detach().clone()

    def dVdx(self,name,p=0):
        return (self.V(name,i=p)-self.V(name,i=p-1))/self.dl[0]
    def dVdy(self,name,p=0):
        return (self.V(name,j=p)-self.V(name,j=p-1))/self.dl[1]
    def dVdz(self,name,p=0):
        return (self.V(name,k=p)-self.V(name,k=p-1))/self.dl[2]

    def AX(self,name,i):
        try:
            return self.v[name][i,1:-1,1:-1]
        except KeyError:
            return torch.full([self.mesh[1]-2,self.mesh[2]-2],0,dtype=torch.float,device=self.device)
    def AY(self,name,j):
        try:
            return self.v[name][1:-1,j,1:-1]
        except KeyError:
            return torch.full([self.mesh[0]-2,self.mesh[2]-2],0,dtype=torch.float,device=self.device)
    def AZ(self,name,k):
        try:
            return self.v[name][1:-1,1:-1,k]
        except KeyError:
            return torch.full([self.mesh[0]-2,self.mesh[1]-2],0,dtype=torch.float,device=self.device)
    # Value at Edge
    def VEX(self,name): return 0.25*(self.V(name,j=-1,k=-1)+self.V(name,j=-1)+self.V(name,k=-1)+self.V(name))
    def VEY(self,name): return 0.25*(self.V(name,i=-1,k=-1)+self.V(name,i=-1)+self.V(name,k=-1)+self.V(name))
    def VEZ(self,name): return 0.25*(self.V(name,i=-1,j=-1)+self.V(name,i=-1)+self.V(name,j=-1)+self.V(name))

    # Cashed versions of VEX, VEY and VEZ (faster but memory consuming)
    def CEX(self,name):
        if name+"_vex" not in self.v: self.v[name+"_vex"] = self.VEX(name)
        return self.v[name+"_vex"]
    def CEY(self,name):
        if name+"_vey" not in self.v: self.v[name+"_vey"] = self.VEY(name)
        return self.v[name+"_vey"]
    def CEZ(self,name):
        if name+"_vez" not in self.v: self.v[name+"_vez"] = self.VEZ(name)
        return self.v[name+"_vez"]
    def VEsub(self,name,pos,dim,shift=[0,0,0]):
        istart = max(1,self.i(pos[0]-0.5*dim[0])) + shift[0]
        iend = min(self.mesh[0]-1,self.i(pos[0]+0.5*dim[0])) + shift[0]
        jstart = max(1,self.j(pos[1]-0.5*dim[1])) + shift[1]
        jend = min(self.mesh[1]-1,self.j(pos[1]+0.5*dim[1])) + shift[1]
        kstart = max(1,self.k(pos[2]-0.5*dim[2])) + shift[2]
        kend = min(self.mesh[2]-1,self.k(pos[2]+0.5*dim[2])) + shift[2]
        return [0.25*(self.v[name][istart:iend+1,jstart-1:jend,kstart-1:kend]+
                      self.v[name][istart:iend+1,jstart:jend+1,kstart-1:kend]+
                      self.v[name][istart:iend+1,jstart-1:jend,kstart:kend+1]+
                      self.v[name][istart:iend+1,jstart:jend+1,kstart:kend+1]),
                0.25*(self.v[name][istart-1:iend,jstart:jend+1,kstart-1:kend]+
                      self.v[name][istart-1:iend,jstart:jend+1,kstart:kend+1]+
                      self.v[name][istart:iend+1,jstart:jend+1,kstart-1:kend]+
                      self.v[name][istart:iend+1,jstart:jend+1,kstart:kend+1]),
                0.25*(self.v[name][istart-1:iend,jstart-1:jend,kstart:kend+1]+
                      self.v[name][istart-1:iend,jstart:jend+1,kstart:kend+1]+
                      self.v[name][istart:iend+1,jstart-1:jend,kstart:kend+1]+
                      self.v[name][istart:iend+1,jstart:jend+1,kstart:kend+1])]
    def cross_section(self,name,direction,position):
        if type(name)==list:
            result = 0
            if direction == 0:
                for nm in name:
                    result += self.AX(nm,self.i(position)).cpu()**2
            elif direction == 1:
                for nm in name:
                    result += self.AY(nm,self.j(position)).cpu()**2
            elif direction == 2:
                for nm in name:
                    result += self.AZ(nm,self.k(position)).cpu()**2
            return result**0.5
        else:
            if direction == 0:
                return self.AX(name,self.i(position)).cpu()
            elif direction == 1:
                return self.AY(name,self.j(position)).cpu()
            elif direction == 2:
                return self.AZ(name,self.k(position)).cpu()
