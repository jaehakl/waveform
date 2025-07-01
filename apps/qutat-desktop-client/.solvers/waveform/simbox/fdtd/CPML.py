import numpy as np

def set(d,addr,dims,wl=156e-9):
    #CPML is wavelength dependent. too broad source may not be correct.
    #also, grid-size should not exceed wavlength/15
    d.v["pml"] = "cpml"
    #print("box", addr ,"is cpml")
    d.v["ALPHA_0"] = 0.02/wl
    d.v["ALPHA_1"] = 0.0
    d.v["KAPPA_0"] = 1.0
    d.v["KAPPA_1"] = 11.0
    d.v["SIGMA_0"] = 0.0
    d.v["SIGMA_1"] = 0.56/wl

    for axis in range(0,3):
        def pgrade(vstart,vend,axis,i):
            len_mesh = d.mesh[axis]-2
            if len(dims[axis]) == 1:
                depth = 0.0
            else:
                if addr[axis] == 0:
                    depth = len_mesh-i-0.5
                elif addr[axis] == len(dims[axis])-1:
                    depth = i+0.5
                else:
                    depth = 0.0
            return vstart+(vend-vstart)*(depth/len_mesh)**4

        d.v["ALPHA_h"+str(axis)] = np.array([pgrade(d.v["ALPHA_0"],d.v["ALPHA_1"],axis,i+0.5) for i in range(0,d.mesh[axis]-2)])
        d.v["ALPHA_e"+str(axis)] = np.array([pgrade(d.v["ALPHA_0"],d.v["ALPHA_1"],axis,i) for i in range(0,d.mesh[axis]-2)])
        d.v["KAPPA_h"+str(axis)] = np.array([pgrade(d.v["KAPPA_0"],d.v["KAPPA_1"],axis,i+0.5) for i in range(0,d.mesh[axis]-2)])
        d.v["KAPPA_e"+str(axis)] = np.array([pgrade(d.v["KAPPA_0"],d.v["KAPPA_1"],axis,i) for i in range(0,d.mesh[axis]-2)])
        d.v["SIGMA_h"+str(axis)] = np.array([pgrade(d.v["SIGMA_0"],d.v["SIGMA_1"],axis,i+0.5) for i in range(0,d.mesh[axis]-2)])
        d.v["SIGMA_e"+str(axis)] = np.array([pgrade(d.v["SIGMA_0"],d.v["SIGMA_1"],axis,i) for i in range(0,d.mesh[axis]-2)])
        d.v["b_h"+str(axis)] = np.exp(-(d.v["SIGMA_h"+str(axis)]/d.v["KAPPA_h"+str(axis)]+d.v["ALPHA_h"+str(axis)])*(d.v["dt"]/d.v["EPS0"]))
        d.v["b_e"+str(axis)] = np.exp(-(d.v["SIGMA_e"+str(axis)]/d.v["KAPPA_e"+str(axis)]+d.v["ALPHA_e"+str(axis)])*(d.v["dt"]/d.v["EPS0"]))
        d.v["a_h"+str(axis)] = (d.v["b_h"+str(axis)]-1.0)*d.v["SIGMA_h"+str(axis)]/(d.v["SIGMA_h"+str(axis)]*d.v["KAPPA_h"+str(axis)]+(d.v["KAPPA_h"+str(axis)]**2)*d.v["ALPHA_h"+str(axis)])
        d.v["a_e"+str(axis)] = (d.v["b_e"+str(axis)]-1.0)*d.v["SIGMA_e"+str(axis)]/(d.v["SIGMA_e"+str(axis)]*d.v["KAPPA_e"+str(axis)]+(d.v["KAPPA_e"+str(axis)]**2)*d.v["ALPHA_e"+str(axis)])

        d.gen_tensor(name="KAPPA_H"+str(axis),init_val=0.0)
        d.gen_tensor(name="KAPPA_E"+str(axis),init_val=0.0)
        d.gen_tensor(name="b_H"+str(axis),init_val=0.0)
        d.gen_tensor(name="b_E"+str(axis),init_val=0.0)
        d.gen_tensor(name="a_H"+str(axis),init_val=0.0)
        d.gen_tensor(name="a_E"+str(axis),init_val=0.0)
        for i in range(0,d.mesh[axis]-2):
            def broadcasting(v_1D_name,tensor_3D_name):
                if axis == 0:
                    d.v[tensor_3D_name][i+1,:,:]=d.v[v_1D_name][i]
                elif axis == 1:
                    d.v[tensor_3D_name][:,i+1,:]=d.v[v_1D_name][i]
                elif axis == 2:
                    d.v[tensor_3D_name][:,:,i+1]=d.v[v_1D_name][i]
            broadcasting("KAPPA_h"+str(axis),"KAPPA_H"+str(axis))
            broadcasting("KAPPA_e"+str(axis),"KAPPA_E"+str(axis))
            broadcasting("b_h"+str(axis),"b_H"+str(axis))
            broadcasting("b_e"+str(axis),"b_E"+str(axis))
            broadcasting("a_h"+str(axis),"a_H"+str(axis))
            broadcasting("a_e"+str(axis),"a_E"+str(axis))
        for field_axis in range(0,3):
            if field_axis is not axis:
                d.gen_tensor(name="PSI_E"+str(field_axis)+str(axis),init_val=0.0)
                d.gen_tensor(name="PSI_H"+str(field_axis)+str(axis),init_val=0.0)

def cal_E(d):
    dHa = d.dVdy("Hz",0)
    dHb = d.dVdz("Hy",0)
    d.v["PSI_E01"][1:-1,1:-1,1:-1]=d.V("b_E1")*d.V("PSI_E01")+d.V("a_E1")*dHa
    d.v["PSI_E02"][1:-1,1:-1,1:-1]=d.V("b_E2")*d.V("PSI_E02")+d.V("a_E2")*dHb
    d.v["Ex"][1:-1,1:-1,1:-1] += (dHa/d.V("KAPPA_E1")-dHb/d.V("KAPPA_E2")+d.V("PSI_E01")-d.V("PSI_E02"))*d.v["dt"]/d.v["EPS0"]/d.CEX("eps")

    dHa = d.dVdz("Hx",0)
    dHb = d.dVdx("Hz",0)
    d.v["PSI_E12"][1:-1,1:-1,1:-1]=d.V("b_E2")*d.V("PSI_E12")+d.V("a_E2")*dHa
    d.v["PSI_E10"][1:-1,1:-1,1:-1]=d.V("b_E0")*d.V("PSI_E10")+d.V("a_E0")*dHb
    d.v["Ey"][1:-1,1:-1,1:-1] += (dHa/d.V("KAPPA_E2")-dHb/d.V("KAPPA_E0")+d.V("PSI_E12")-d.V("PSI_E10"))*d.v["dt"]/d.v["EPS0"]/d.CEY("eps")

    dHa = d.dVdx("Hy",0)
    dHb = d.dVdy("Hx",0)
    d.v["PSI_E20"][1:-1,1:-1,1:-1]=d.V("b_E0")*d.V("PSI_E20")+d.V("a_E0")*dHa
    d.v["PSI_E21"][1:-1,1:-1,1:-1]=d.V("b_E1")*d.V("PSI_E21")+d.V("a_E1")*dHb
    d.v["Ez"][1:-1,1:-1,1:-1] += (dHa/d.V("KAPPA_E0")-dHb/d.V("KAPPA_E1")+d.V("PSI_E20")-d.V("PSI_E21"))*d.v["dt"]/d.v["EPS0"]/d.CEZ("eps")

def cal_H(d):
    cb = d.v["dt"]/d.v["MU0"]
    dEa = d.dVdy("Ez",1)
    dEb = d.dVdz("Ey",1)
    d.v["PSI_H01"][1:-1,1:-1,1:-1] = d.V("b_H1")*d.V("PSI_H01") + d.V("a_H1")*dEa
    d.v["PSI_H02"][1:-1,1:-1,1:-1] = d.V("b_H2")*d.V("PSI_H02") + d.V("a_H2")*dEb
    d.v["Hx"][1:-1,1:-1,1:-1] -= cb*(dEa/d.V("KAPPA_H1")-dEb/d.V("KAPPA_H2")+d.V("PSI_H01")-d.V("PSI_H02"))

    dEa = d.dVdz("Ex",1)
    dEb = d.dVdx("Ez",1)
    d.v["PSI_H12"][1:-1,1:-1,1:-1] = d.V("b_H2")*d.V("PSI_H12") + d.V("a_H2")*dEa
    d.v["PSI_H10"][1:-1,1:-1,1:-1] = d.V("b_H0")*d.V("PSI_H10") + d.V("a_H0")*dEb
    d.v["Hy"][1:-1,1:-1,1:-1] -= cb*(dEa/d.V("KAPPA_H2")-dEb/d.V("KAPPA_H0")+d.V("PSI_H12")-d.V("PSI_H10"))

    dEa = d.dVdx("Ey",1)
    dEb = d.dVdy("Ex",1)
    d.v["PSI_H20"][1:-1,1:-1,1:-1] = d.V("b_H0")*d.V("PSI_H20") + d.V("a_H0")*dEa
    d.v["PSI_H21"][1:-1,1:-1,1:-1] = d.V("b_H1")*d.V("PSI_H21") + d.V("a_H1")*dEb
    d.v["Hz"][1:-1,1:-1,1:-1] -= cb*(dEa/d.V("KAPPA_H0")-dEb/d.V("KAPPA_H1")+d.V("PSI_H20")-d.V("PSI_H21"))
