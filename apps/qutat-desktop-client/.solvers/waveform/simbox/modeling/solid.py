from functools import partial
import numpy as np
import torch
from time import time

def getIndexStartEnd(centerPosition, radius, posToIndexMethod, spaceLength, matrixLength):
    start = max(centerPosition-radius, -0.5*spaceLength)
    end = min(centerPosition+radius, 0.5*spaceLength)
    iStart = min(max(posToIndexMethod(start), 0), matrixLength-1)
    iEnd = min(max(posToIndexMethod(end), 0), matrixLength-1)
    return start, end, iStart, iEnd

def setBlueprint(originalMatrix):
    originalMatrixType = type(originalMatrix).__name__
    if originalMatrixType == "ndarray":
        blueprint = originalMatrix
    else:
        blueprint = np.array(originalMatrix.cpu())
    return blueprint, originalMatrixType

def block(d,pos,dim,name,val,smooth_degree=10):

    blueprint, originalMatrixType = setBlueprint(d.v[name])
    #blueprint = np.array(d.v[name].cpu())

    xstart = max(pos[0]-0.5*dim[0],-0.5*d.dim[0])
    xend = min(pos[0]+0.5*dim[0],0.5*d.dim[0])
    ystart = max(pos[1]-0.5*dim[1],-0.5*d.dim[1])
    yend = min(pos[1]+0.5*dim[1],0.5*d.dim[1])
    zstart = max(pos[2]-0.5*dim[2],-0.5*d.dim[2])
    zend = min(pos[2]+0.5*dim[2],0.5*d.dim[2])
    ran_x = [[d.i(xstart)-1,d.i(xstart)],[d.i(xstart),d.i(xend)+1],[d.i(xend)+1,d.i(xend)+2]]
    ran_y = [[d.j(ystart)-1,d.j(ystart)],[d.j(ystart),d.j(yend)+1],[d.j(yend)+1,d.j(yend)+2]]
    ran_z = [[d.k(zstart)-1,d.k(zstart)],[d.k(zstart),d.k(zend)+1],[d.k(zend)+1,d.k(zend)+2]]
    fr_x = [(d.x(d.i(xstart))-xstart+0.5*d.dl[0])/d.dl[0],1,(xend-d.x(d.i(xend))+0.5*d.dl[0])/d.dl[0]]
    fr_y = [(d.y(d.j(ystart))-ystart+0.5*d.dl[1])/d.dl[1],1,(yend-d.y(d.j(yend))+0.5*d.dl[1])/d.dl[1]]
    fr_z = [(d.z(d.k(zstart))-zstart+0.5*d.dl[2])/d.dl[2],1,(zend-d.z(d.k(zend))+0.5*d.dl[2])/d.dl[2]]

    for i in range(3):
        for j in range(3):
            for k in range(3):
                temp_val = blueprint[ran_x[i][0]:ran_x[i][1],ran_y[j][0]:ran_y[j][1],ran_z[k][0]:ran_z[k][1]]
                blueprint[ran_x[i][0]:ran_x[i][1],ran_y[j][0]:ran_y[j][1],ran_z[k][0]:ran_z[k][1]] = (1-fr_x[i]*fr_y[j]*fr_z[k])*temp_val + fr_x[i]*fr_y[j]*fr_z[k]*val

    if originalMatrixType == "ndarray":
        d.v[name] = blueprint
    else:
        d.v[name] = torch.as_tensor(blueprint, device=d.device)    
    #d.v[name] = torch.as_tensor(blueprint,device=d.device)


def sphere(d,pos,dim,name,val,smooth_degree=10):
    def rot_func(z):
        r = dim[0]
        return np.abs(np.real(np.abs(r**2 - (z-r)**2)**0.5))
    solid_of_revolution(d,pos,[rot_func,2*dim[0],0],name,val,smooth_degree)

def disk(d,pos,dim,name,val,smooth_degree=10):
    solid_of_revolution(d,pos,[lambda x:dim[0],dim[1],dim[2]],name,val,smooth_degree)


def cone(d,pos,dim,name,val,smooth_degree=10):
    def rot_func(z):
        r1 = dim[0]
        r2 = dim[1]
        h = dim[2]
        return np.abs(r1 + (r2-r1)*z/h)
    solid_of_revolution(d,pos,[rot_func,dim[2],0],name,val,smooth_degree)

def so_revol_func(d,unit_length,pos,dim,props,name,val,smooth_degree=10):
    def rot_func(size, props, z):
        size = [v/unit_length for v in size]
        z = z/unit_length
        return np.abs(eval(props[0][0])*unit_length)
    solid_of_revolution(d,pos,[partial(rot_func, dim, props),dim[0],0],name,val,smooth_degree)


def solid_of_revolution(d,pos,dim,name,val,smooth_degree=10):
    blueprint, originalMatrixType = setBlueprint(d.v[name])

    rot_func = dim[0]
    cell_div = np.array([[x,y,z] for x in np.arange((0.5/smooth_degree-0.5)*d.dl[0],0.5*d.dl[0],d.dl[0]/smooth_degree)
                                        for y in np.arange((0.5/smooth_degree-0.5)*d.dl[1],0.5*d.dl[1],d.dl[1]/smooth_degree)
                                        for z in np.arange((0.5/smooth_degree-0.5)*d.dl[2],0.5*d.dl[2],d.dl[2]/smooth_degree)])

    def isin_rot(x):
        return (x[0]**2 + x[1]**2 <= rot_func(x[2])**2)
    def fill_ratio(i,j,k,zstart,func_isin):
        xyz_list = (cell_div + np.array([d.x(i)-pos[0],d.y(j)-pos[1],d.z(k)-zstart])).T
        return func_isin(xyz_list).mean()

    zstart, zend, kstart, kend = getIndexStartEnd(pos[2], 0.5*dim[1], d.k, d.dim[2], blueprint.shape[2])
    for k in range(kstart,kend+1):
        r_z = np.abs(np.real(rot_func(d.z(k)-zstart)))

        xstart, xend, istart, iend = getIndexStartEnd(pos[0], r_z, d.i, d.dim[0], blueprint.shape[0])
        for i in range(istart,iend+1):
            ly = np.abs(np.abs(r_z**2 - (d.x(i)-pos[0])**2)**0.5)
            ystart, yend, jstart, jend = getIndexStartEnd(pos[1], ly, d.j, d.dim[1], blueprint.shape[1])
            if (k == kstart) or (k == kend) or (i==istart) or (i==iend):
                for j in range(jstart,jend+1):
                    fr = fill_ratio(i,j,k,zstart,isin_rot)
                    blueprint[i,j,k] += -fr*blueprint[i,j,k] + fr*val
            else:
                for j in [jstart,jend]:
                    fr = fill_ratio(i,j,k,zstart,isin_rot)
                    blueprint[i,j,k] += -fr*blueprint[i,j,k] + fr*val
                blueprint[i,jstart+1:jend,k] = val

    if originalMatrixType == "ndarray":
        d.v[name] = blueprint
    else:
        d.v[name] = torch.as_tensor(blueprint, device=d.device)    


def strip(d,pos,dim,name,val,smooth_degree=10):
    print("strip", name, val)
    blueprint, originalMatrixType = setBlueprint(d.v[name])
    #blueprint = np.array(d.v[name].cpu())

    rot_func = dim[0]
    cell_div = np.array([[x,z] for x in np.arange((0.5/smooth_degree-0.5)*d.dl[0],0.5*d.dl[0],d.dl[0]/smooth_degree)
                               for z in np.arange((0.5/smooth_degree-0.5)*d.dl[2],0.5*d.dl[2],d.dl[2]/smooth_degree)])
    def isin_step(x):
        return (abs(x[0]) < abs(rot_func(x[1])))
    def fill_ratio(i,k,func_isin):
        xz_list = (cell_div + np.array([d.x(i)-pos[0],d.z(k)-zstart])).T
        return func_isin(xz_list).mean()

    zstart, zend, kstart, kend = getIndexStartEnd(pos[2], 0.5*dim[1], d.k, d.dim[2], blueprint.shape[2])
    #zstart = max(pos[2]-0.5*dim[1],-0.5*d.dim[2])
    #kstart = d.k(zstart)
    #zend = min(pos[2]+0.5*dim[1],0.5*d.dim[2])
    #kend = d.k(zend)
    for k in range(kstart-1,kend+2):
        r_z = abs(rot_func(d.z(k)-zstart))

        xstart, xend, istart, iend = getIndexStartEnd(pos[0], r_z, d.i, d.dim[0], blueprint.shape[0])
        #xstart = max(pos[0]-r_z,-0.5*d.dim[0])
        #istart = d.i(xstart)
        #xend = min(pos[0]+r_z,0.5*d.dim[0])
        #iend = d.i(xend)
        for i in range(istart,iend+1):
            fr = fill_ratio(i,k,isin_step)
            blueprint[i,:,k] += -fr*blueprint[i,:,k] + fr*val

    if originalMatrixType == "ndarray":
        d.v[name] = blueprint
    else:
        d.v[name] = torch.as_tensor(blueprint, device=d.device)    
    #d.v[name] = torch.as_tensor(blueprint,device=d.device)



def ring(d,pos,dim,name,val,smooth_degree=10):
    blueprint, originalMatrixType = setBlueprint(d.v[name])
    #blueprint = np.array(d.v[name].cpu())

    r_in = dim[0]-0.5*dim[2]
    r_out = dim[0]+0.5*dim[2]


    xstart, xend, istart, iend = getIndexStartEnd(pos[0], r_out, d.i, d.dim[0], blueprint.shape[0])
    xstart_in, xend_in, istart_in, iend_in = getIndexStartEnd(pos[0], r_in, d.i, d.dim[0], blueprint.shape[0])

    #xstart = max(pos[0]-r_out,-0.5*d.dim[0])
    #xstart_in = max(pos[0]-r_in,-0.5*d.dim[0])
    #istart = d.i(xstart)
    #istart_in = d.i(xstart_in)

    #xend = min(pos[0]+r_out,0.5*d.dim[0])
    #xend_in = min(pos[0]+r_in,0.5*d.dim[0])
    #iend = d.i(xend)
    #iend_in = d.i(xend_in)

    zstart, zend, kstart, kend = getIndexStartEnd(pos[2], 0.5*dim[1], d.k, d.dim[2], blueprint.shape[2])
    #zstart = max(pos[2]-0.5*dim[1],-0.5*d.dim[2])
    #kstart = d.k(zstart)-1
    #zend = min(pos[2]+0.5*dim[1],0.5*d.dim[2])
    #kend = d.k(zend)+1

    cell_div = np.array([[x,y] for x in np.arange((0.5/smooth_degree-0.5)*d.dl[0],0.5*d.dl[0],d.dl[0]/smooth_degree)
                                        for y in np.arange((0.5/smooth_degree-0.5)*d.dl[1],0.5*d.dl[1],d.dl[1]/smooth_degree)])
    def isin_rot(x):
        return (x[0]**2 + x[1]**2 <= r_out**2)*(x[0]**2 + x[1]**2 >= r_in**2)
    def fill_ratio(i,j,k,func_isin):
        xyz_list = (cell_div + np.array([d.x(i)-pos[0],d.y(j)-pos[1]])).T
        return func_isin(xyz_list).mean()

    for k in range(kstart-1,kend+2):
        for i in range(istart,iend+1):
            if (i==istart):
                ly_out = abs((r_out**2 - (d.x(i)+0.5*d.dl[0]-pos[0])**2)**0.5)
            elif (i==iend):
                ly_out = abs((r_out**2 - (d.x(i)-0.5*d.dl[0]-pos[0])**2)**0.5)
            else:
                ly_out = abs((r_out**2 - (d.x(i)-pos[0])**2)**0.5)
            if (i==istart_in):
                ly_in = max(r_in**2 - (d.x(i)+0.5*d.dl[0]-pos[0])**2,0)**0.5
            elif (i==iend_in):
                ly_in = max(r_in**2 - (d.x(i)-0.5*d.dl[0]-pos[0])**2,0)**0.5
            else:
                ly_in = max(r_in**2 - (d.x(i)-pos[0])**2,0)**0.5

            ystart, yend, jstart, jend = getIndexStartEnd(pos[1], ly_out, d.j, d.dim[1], blueprint.shape[1])
            ystart_in, yend_in, jstart_in, jend_in = getIndexStartEnd(pos[1], ly_in, d.j, d.dim[1], blueprint.shape[1])

            #ystart = max(pos[1] - ly_out,-0.5*d.dim[1])
            #jstart = d.j(ystart)
            #yend = min(pos[1] + ly_out,0.5*d.dim[1])
            #jend = d.j(yend)
            #ystart_in = max(pos[1] - ly_in,-0.5*d.dim[1])
            #jstart_in = d.j(ystart_in)
            #yend_in = min(pos[1] + ly_in,0.5*d.dim[1])
            #jend_in = d.j(yend_in)
            for j in range(jstart,jstart_in+1):
                fr = fill_ratio(i,j,k,isin_rot)
                blueprint[i,j,k] += -fr*blueprint[i,j,k] + fr*val
            for j in range(jend_in,jend+1):
                fr = fill_ratio(i,j,k,isin_rot)
                blueprint[i,j,k] += -fr*blueprint[i,j,k] + fr*val

    if originalMatrixType == "ndarray":
        d.v[name] = blueprint
    else:
        d.v[name] = torch.as_tensor(blueprint, device=d.device)    
    #d.v[name] = torch.as_tensor(blueprint,device=d.device)
