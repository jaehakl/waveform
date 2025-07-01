import numpy as np
import torch
from ..box import Box

class Matrix:
    def __init__(self,xyz_dims,xyz_meshs,pbc=[0,0,0], device="cpu", device_cutoff=1e5):
        self.xyz_dims = xyz_dims
        self.xyz_meshs = xyz_meshs
        self.pbc=pbc
        self.nx = len(xyz_meshs[0])
        self.ny = len(xyz_meshs[1])
        self.nz = len(xyz_meshs[2])
        total_list = []
        for i in range(0,self.nx):
            zy_sum = []
            for j in range(0,self.ny):
                z_sum = []
                for k in range(0,self.nz):
                    if (xyz_meshs[0][i]*xyz_meshs[1][j]*xyz_meshs[2][k] > device_cutoff):
                        # if domain is small, cpu is much more efficient
                        d = Box([xyz_dims[0][i],xyz_dims[1][j],xyz_dims[2][k]],
                                [xyz_meshs[0][i],xyz_meshs[1][j],xyz_meshs[2][k]],device)
                    else:
                        d = Box([xyz_dims[0][i],xyz_dims[1][j],xyz_dims[2][k]],
                                [xyz_meshs[0][i],xyz_meshs[1][j],xyz_meshs[2][k]],"cpu")
                    z_sum.append(d)
                    #print("box",i,j,k,"with grid size",d.mesh,"is assigned to",d.device)
                zy_sum.append(z_sum)
            total_list.append(zy_sum)
        self.b = total_list
        for i in range(0,self.nx):
            for j in range(0,self.ny):
                for k in range(0,self.nz):
                    d = self.b[i][j][k]
                    if i==0:
                        d.mul_xm = self.b[self.nx-1][j][k] if self.pbc[0]==1 else 0
                    else:
                        d.mul_xm = self.b[i-1][j][k]
                    if i==self.nx-1:
                        d.mul_xp = self.b[0][j][k] if self.pbc[0]==1 else 0
                    else:
                        d.mul_xp = self.b[i+1][j][k]
                    if j==0:
                        d.mul_ym = self.b[i][self.ny-1][k] if self.pbc[1]==1 else 0
                    else:
                        d.mul_ym = self.b[i][j-1][k]
                    if j==self.ny-1:
                        d.mul_yp = self.b[i][0][k] if self.pbc[1]==1 else 0
                    else:
                        d.mul_yp = self.b[i][j+1][k]
                    if k==0:
                        d.mul_zm = self.b[i][j][self.nz-1] if self.pbc[2]==1 else 0
                    else:
                        d.mul_zm = self.b[i][j][k-1]
                    if k==self.nz-1:
                        d.mul_zp = self.b[i][j][0] if self.pbc[2]==1 else 0
                    else:
                        d.mul_zp = self.b[i][j][k+1]

    def op(self,group_name,operator,*par):
        return_list = []
        for box, addr in self.get_group(group_name):
            return_list.append(operator(box,*par))
        return return_list

    # If relational position of the box is reqired.
    def op_nonlocal(self,group_name,operator,*par):
        return_list = []
        for box, addr in self.get_group(group_name):
            return_list.append(operator(box,addr,self.xyz_dims,*par))
        return return_list

    def sync(self,group_name,name,to="minimum"):
        temp_value = self.b[0][0][0].v[name]
        if to == "minimum":
            for box, addr in self.get_group(group_name):
                if box.v[name] < temp_value:
                    temp_value = box.v[name]
        elif to == "maximum":
            for box, addr in self.get_group(group_name):
                if box.v[name] > temp_value:
                    temp_value = box.v[name]
        for box, addr in self.get_group(group_name):
            box.v[name] = temp_value

    def cross_section(self,name,direction,pos_d,pos_i):
        img_arr = []
        if direction == 0:
            for k in range(0,self.nz):
                img_list = []
                for j in range(0,self.ny):
                    img_list.append(self.b[pos_d][j][k].cross_section(name,direction,pos_i))
                img_arr.append(torch.cat(img_list))
        elif direction == 1:
            for k in range(0,self.nz):
                img_list = []
                for i in range(0,self.nx):
                    img_list.append(self.b[i][pos_d][k].cross_section(name,direction,pos_i))
                img_arr.append(torch.cat(img_list))
        elif direction == 2:
            for j in range(0,self.ny):
                img_list = []
                for i in range(0,self.nx):
                    img_list.append(self.b[i][j][pos_d].cross_section(name,direction,pos_i))
                img_arr.append(torch.cat(img_list))
        return torch.cat(img_arr,axis=1)

    def delete(self):
        for zy_sum in self.b:
            for z_sum in zy_sum:
                for d in z_sum:
                    keys = list(d.v.keys())
                    for key in keys:
                        del d.v[key]
                    del d.v
                    del d
        del self.b
        torch.cuda.empty_cache()

    def set_group(self,group_name,group_range):
        gr = group_range
        for i in range(max(0,gr[0]),min(self.nx,gr[1])):
            for j in range(max(0,gr[2]),min(self.ny,gr[3])):
                for k in range(max(0,gr[4]),min(self.nz,gr[5])):
                    self.b[i][j][k].group.append(group_name)

    def del_group(self,group_name,group_range):
        gr = group_range
        for i in range(max(0,gr[0]),min(self.nx,gr[1])):
            for j in range(max(0,gr[2]),min(self.ny,gr[3])):
                for k in range(max(0,gr[4]),min(self.nz,gr[5])):
                    self.b[i][j][k].group.remove(group_name)

    def get_group(self,group_name,group_range=[0,99,0,99,0,99]):
        group_list = []
        gr = group_range
        for i in range(max(0,gr[0]),min(self.nx,gr[1])):
            for j in range(max(0,gr[2]),min(self.ny,gr[3])):
                for k in range(max(0,gr[4]),min(self.nz,gr[5])):
                    if group_name in self.b[i][j][k].group:
                        group_list.append([self.b[i][j][k],[i,j,k]])
        return group_list


def domain_matrix(main_dim,dr,buffer=["none","none","none"],pbc=[1,1,1],device="cpu",device_cutoff=1e5):
    dims = []
    meshs = []
    buffer_ranges = []
    for i in range(0,3):
        dim = []
        mesh = []
        buffer_range = []

        if buffer[i] != "none":
            buf_e1 = buffer[i][2]
            buf_e2 = buffer[i][3]

            if pbc[i] == 0:
                dim.append(dr[i]*10*buf_e1)
                mesh.append(12)

            buffer_range.append(len(dim))
            dim.append(buffer[i][0])
            mesh.append(2+int((1/buf_e1)*buffer[i][0]/dr[i]))

            buffer_range.append(len(dim))
            dim.append(main_dim[i])
            mesh.append(2+int(main_dim[i]/dr[i]))

            buffer_range.append(len(dim))
            dim.append(buffer[i][1])
            mesh.append(2+int((1/buf_e2)*buffer[i][1]/dr[i]))

            if pbc[i] == 0:
                dim.append(dr[i]*10*buf_e2)
                mesh.append(12)
        else:
            if pbc[i] == 0:
                dim.append(dr[i]*10)
                mesh.append(12)
            buffer_range.append(len(dim))
            dim.append(main_dim[i])
            mesh.append(2+int(main_dim[i]/dr[i]))
            if pbc[i] == 0:
                dim.append(dr[i]*10)
                mesh.append(12)

        dims.append(dim)
        meshs.append(mesh)
        buffer_ranges.append(buffer_range)
    mat_temp = Matrix(dims,meshs,pbc,device,device_cutoff)

    xci=int(0.5*(len(dims[0])-1))
    yci=int(0.5*(len(dims[1])-1))
    zci=int(0.5*(len(dims[2])-1))
    mat_temp.set_group("main",[xci,xci+1,yci,yci+1,zci,zci+1])
    mat_temp.set_group("border",[0,99,0,99,0,99])
    mat_temp.del_group("border",[1,mat_temp.nx-1,1,mat_temp.ny-1,1,mat_temp.nz-1])
    return mat_temp
