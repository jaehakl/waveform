def Ex0(d,pos,dim,shift=[0,0,0]):
    # at corner (0,0,0) + shift
    istart = max(1,d.i(pos[0]-0.5*dim[0])) + shift[0]
    iend = min(d.mesh[0]-1,d.i(pos[0]+0.5*dim[0])) + shift[0]
    jstart = max(1,d.j(pos[1]-0.5*dim[1])) + shift[1]
    jend = min(d.mesh[1]-1,d.j(pos[1]+0.5*dim[1])) + shift[1]
    kstart = max(1,d.k(pos[2]-0.5*dim[2])) + shift[2]
    kend = min(d.mesh[2]-1,d.k(pos[2]+0.5*dim[2])) + shift[2]
    return  0.5*(d.v["Ex"][istart:iend+1,jstart:jend+1,kstart:kend+1]+d.v["Ex"][istart-1:iend,jstart:jend+1,kstart:kend+1])

def Ey0(d,pos,dim,shift=[0,0,0]):
    # at corner (0,0,0) + shift
    istart = max(1,d.i(pos[0]-0.5*dim[0])) + shift[0]
    iend = min(d.mesh[0]-1,d.i(pos[0]+0.5*dim[0])) + shift[0]
    jstart = max(1,d.j(pos[1]-0.5*dim[1])) + shift[1]
    jend = min(d.mesh[1]-1,d.j(pos[1]+0.5*dim[1])) + shift[1]
    kstart = max(1,d.k(pos[2]-0.5*dim[2])) + shift[2]
    kend = min(d.mesh[2]-1,d.k(pos[2]+0.5*dim[2])) + shift[2]
    return  0.5*(d.v["Ey"][istart:iend+1,jstart:jend+1,kstart:kend+1]+d.v["Ey"][istart:iend+1,jstart-1:jend,kstart:kend+1])

def Ez0(d,pos,dim,shift=[0,0,0]):
    # at corner (0,0,0) + shift
    istart = max(1,d.i(pos[0]-0.5*dim[0])) + shift[0]
    iend = min(d.mesh[0]-1,d.i(pos[0]+0.5*dim[0])) + shift[0]
    jstart = max(1,d.j(pos[1]-0.5*dim[1])) + shift[1]
    jend = min(d.mesh[1]-1,d.j(pos[1]+0.5*dim[1])) + shift[1]
    kstart = max(1,d.k(pos[2]-0.5*dim[2])) + shift[2]
    kend = min(d.mesh[2]-1,d.k(pos[2]+0.5*dim[2])) + shift[2]
    return  0.5*(d.v["Ez"][istart:iend+1,jstart:jend+1,kstart:kend+1]+d.v["Ez"][istart:iend+1,jstart:jend+1,kstart-1:kend])

def dExdx(d,pos,dim,shift=[0,0,0]):
    # at corner (0,0,0) + shift
    istart = max(1,d.i(pos[0]-0.5*dim[0])) + shift[0]
    iend = min(d.mesh[0]-1,d.i(pos[0]+0.5*dim[0])) + shift[0]
    jstart = max(1,d.j(pos[1]-0.5*dim[1])) + shift[1]
    jend = min(d.mesh[1]-1,d.j(pos[1]+0.5*dim[1])) + shift[1]
    kstart = max(1,d.k(pos[2]-0.5*dim[2])) + shift[2]
    kend = min(d.mesh[2]-1,d.k(pos[2]+0.5*dim[2])) + shift[2]
    return  (d.v["Ex"][istart:iend+1,jstart:jend+1,kstart:kend+1]-d.v["Ex"][istart-1:iend,jstart:jend+1,kstart:kend+1])/d.dl[0]

def dEydy(d,pos,dim,shift=[0,0,0]):
    # at corner (0,0,0) + shift
    istart = max(1,d.i(pos[0]-0.5*dim[0])) + shift[0]
    iend = min(d.mesh[0]-1,d.i(pos[0]+0.5*dim[0])) + shift[0]
    jstart = max(1,d.j(pos[1]-0.5*dim[1])) + shift[1]
    jend = min(d.mesh[1]-1,d.j(pos[1]+0.5*dim[1])) + shift[1]
    kstart = max(1,d.k(pos[2]-0.5*dim[2])) + shift[2]
    kend = min(d.mesh[2]-1,d.k(pos[2]+0.5*dim[2])) + shift[2]
    return  (d.v["Ey"][istart:iend+1,jstart:jend+1,kstart:kend+1]-d.v["Ey"][istart:iend+1,jstart-1:jend,kstart:kend+1])/d.dl[1]

def dEzdz(d,pos,dim,shift=[0,0,0]):
    # at corner (0,0,0) + shift
    istart = max(1,d.i(pos[0]-0.5*dim[0])) + shift[0]
    iend = min(d.mesh[0]-1,d.i(pos[0]+0.5*dim[0])) + shift[0]
    jstart = max(1,d.j(pos[1]-0.5*dim[1])) + shift[1]
    jend = min(d.mesh[1]-1,d.j(pos[1]+0.5*dim[1])) + shift[1]
    kstart = max(1,d.k(pos[2]-0.5*dim[2])) + shift[2]
    kend = min(d.mesh[2]-1,d.k(pos[2]+0.5*dim[2])) + shift[2]
    return  (d.v["Ez"][istart:iend+1,jstart:jend+1,kstart:kend+1]-d.v["Ez"][istart:iend+1,jstart:jend+1,kstart-1:kend])/d.dl[2]

def Div_E(d,pos,dim,shift=[0,0,0]):
    # at corner (0,0,0) + shift
    return  (dExdx(d,pos,dim,shift)+dEydy(d,pos,dim,shift)+dEzdz(d,pos,dim,shift))

def Esqr(d,pos,dim,shift=[0,0,0]):
    # at corner (0,0,0) + shift
    return  (Ex0(d,pos,dim,shift)**2+Ey0(d,pos,dim,shift)**2+Ez0(d,pos,dim,shift)**2)


def E_Div_E(d,pos,dim):
    # at edge of each directions Ex: (0.5,0,0) or Ey: (0,0.5,0) or Ez: (0,0,0.5)
    istart = max(1,d.i(pos[0]-0.5*dim[0]))
    iend = min(d.mesh[0]-1,d.i(pos[0]+0.5*dim[0]))
    jstart = max(1,d.j(pos[1]-0.5*dim[1]))
    jend = min(d.mesh[1]-1,d.j(pos[1]+0.5*dim[1]))
    kstart = max(1,d.k(pos[2]-0.5*dim[2]))
    kend = min(d.mesh[2]-1,d.k(pos[2]+0.5*dim[2]))
    return [d.v["Ex"][istart:iend+1,jstart:jend+1,kstart:kend+1]*0.5*(Div_E(d,pos,dim) + Div_E(d,pos,dim,[1,0,0])),
            d.v["Ey"][istart:iend+1,jstart:jend+1,kstart:kend+1]*0.5*(Div_E(d,pos,dim) + Div_E(d,pos,dim,[0,1,0])),
            d.v["Ez"][istart:iend+1,jstart:jend+1,kstart:kend+1]*0.5*(Div_E(d,pos,dim) + Div_E(d,pos,dim,[0,0,1]))] 

def Grad_Esqr(d,pos,dim):
    # at edge of each directions Ex: (0.5,0,0) or Ey: (0,0.5,0) or Ez: (0,0,0.5)
    return [(Esqr(d,pos,dim,[1,0,0])-Esqr(d,pos,dim))/d.dl[0],
            (Esqr(d,pos,dim,[0,1,0])-Esqr(d,pos,dim))/d.dl[1],
            (Esqr(d,pos,dim,[0,0,1])-Esqr(d,pos,dim))/d.dl[2]]

def E_dot_Nabla_E(d,pos,dim):
    # at edge of each directions Ex: (0.5,0,0) or Ey: (0,0.5,0) or Ez: (0,0,0.5)
    istart = max(1,d.i(pos[0]-0.5*dim[0]))
    iend = min(d.mesh[0]-1,d.i(pos[0]+0.5*dim[0]))
    jstart = max(1,d.j(pos[1]-0.5*dim[1]))
    jend = min(d.mesh[1]-1,d.j(pos[1]+0.5*dim[1]))
    kstart = max(1,d.k(pos[2]-0.5*dim[2]))
    kend = min(d.mesh[2]-1,d.k(pos[2]+0.5*dim[2]))

    return [d.v["Ex"][istart:iend+1,jstart:jend+1,kstart:kend+1]*(d.v["Ex"][istart+1:iend+2,jstart:jend+1,kstart:kend+1]-d.v["Ex"][istart-1:iend,jstart:jend+1,kstart:kend+1])/(2*d.dl[0])+
                         (Ey0(d,pos,dim,[1,0,0])+Ey0(d,pos,dim))*(d.v["Ex"][istart:iend+1,jstart+1:jend+2,kstart:kend+1]-d.v["Ex"][istart:iend+1,jstart-1:jend,kstart:kend+1])/(2*d.dl[1])+
                         (Ez0(d,pos,dim,[1,0,0])+Ez0(d,pos,dim))*(d.v["Ex"][istart:iend+1,jstart:jend+1,kstart+1:kend+2]-d.v["Ex"][istart:iend+1,jstart:jend+1,kstart-1:kend])/(2*d.dl[2]),
                         (Ex0(d,pos,dim,[0,1,0])+Ex0(d,pos,dim))*(d.v["Ey"][istart+1:iend+2,jstart:jend+1,kstart:kend+1]-d.v["Ey"][istart-1:iend,jstart:jend+1,kstart:kend+1])/(2*d.dl[0])+
            d.v["Ey"][istart:iend+1,jstart:jend+1,kstart:kend+1]*(d.v["Ey"][istart:iend+1,jstart+1:jend+2,kstart:kend+1]-d.v["Ey"][istart:iend+1,jstart-1:jend,kstart:kend+1])/(2*d.dl[1])+
                         (Ez0(d,pos,dim,[0,1,0])+Ez0(d,pos,dim))*(d.v["Ey"][istart:iend+1,jstart:jend+1,kstart+1:kend+2]-d.v["Ey"][istart:iend+1,jstart:jend+1,kstart-1:kend])/(2*d.dl[2]),
                         (Ex0(d,pos,dim,[0,0,1])+Ex0(d,pos,dim))*(d.v["Ez"][istart+1:iend+2,jstart:jend+1,kstart:kend+1]-d.v["Ez"][istart-1:iend,jstart:jend+1,kstart:kend+1])/(2*d.dl[0])+
                         (Ey0(d,pos,dim,[0,0,1])+Ey0(d,pos,dim))*(d.v["Ez"][istart:iend+1,jstart+1:jend+2,kstart:kend+1]-d.v["Ez"][istart:iend+1,jstart-1:jend,kstart:kend+1])/(2*d.dl[1])+
            d.v["Ez"][istart:iend+1,jstart:jend+1,kstart:kend+1]*(d.v["Ez"][istart:iend+1,jstart:jend+1,kstart+1:kend+2]-d.v["Ez"][istart:iend+1,jstart:jend+1,kstart-1:kend])/(2*d.dl[2])]
