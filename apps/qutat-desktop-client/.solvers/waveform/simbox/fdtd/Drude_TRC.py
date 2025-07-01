import numpy as np

def set(d, omega_list):
    d.v["model"] = "Drude_TRC"
    d.gen_tensor(name="Jx",init_val=0.0)
    d.gen_tensor(name="Jy",init_val=0.0)
    d.gen_tensor(name="Jz",init_val=0.0)
    d.gen_tensor(name="metal",init_val=0)
    d.v["omega_p"] = omega_list[0]
    d.v["omega_c"] = omega_list[1]
    d.v["eps_inf"] = omega_list[2]
    #TRC parameters, "PTL, VOL. 21, NO. 2, JANUARY 15, 2009, p100, Jun Shibayama"
    dt = d.v["dt"]
    wp = d.v["omega_p"]
    vc = d.v["omega_c"]
    d.v["chi0"] = (wp**2)*dt/vc - ((wp/vc)**2)*(1-np.exp(-vc*dt))
    d.v["dchi0"] = -((wp/vc)*(1-np.exp(-vc*dt)))**2
    d.v["1/(e+ch)"] = 1.0/(d.v["eps_inf"] + 0.5*d.v["chi0"])
    d.v["e-ch"] = d.v["eps_inf"] - 0.5*d.v["chi0"]
    d.v["dt/eps0"] = d.v["dt"]/d.v["EPS0"]
    d.v["e^(-omega_c*dt)"] = np.exp(-vc*dt)

def cal_E(d):
    if d.v["pml"] == "cpml":
        dHa = d.dVdy("Hz",0)
        dHb = d.dVdz("Hy",0)
        d.v["PSI_E01"][1:-1,1:-1,1:-1]=d.V("b_E1")*d.V("PSI_E01")+d.V("a_E1")*dHa
        d.v["PSI_E02"][1:-1,1:-1,1:-1]=d.V("b_E2")*d.V("PSI_E02")+d.V("a_E2")*dHb
        E_old = d.C("Ex")
        d.v["Ex"][1:-1,1:-1,1:-1] = ((1-d.CEX("metal"))*(d.V("Ex")+(dHa/d.V("KAPPA_E1")-dHb/d.V("KAPPA_E2")+d.V("PSI_E01")-d.V("PSI_E02"))*d.v["dt/eps0"]/d.CEX("eps"))
            +d.CEX("metal")*d.v["1/(e+ch)"]*(d.v["e-ch"]*d.V("Ex")+(dHa/d.V("KAPPA_E1")-dHb/d.V("KAPPA_E2")+d.V("PSI_E01")-d.V("PSI_E02"))*d.v["dt/eps0"] - d.V("Jx")))
        d.v["Jx"][1:-1,1:-1,1:-1]=d.v["e^(-omega_c*dt)"]*d.V("Jx")-d.v["dchi0"]*(d.V("Ex")+E_old)/2

        dHa = d.dVdz("Hx",0)
        dHb = d.dVdx("Hz",0)
        d.v["PSI_E12"][1:-1,1:-1,1:-1]=d.V("b_E2")*d.V("PSI_E12")+d.V("a_E2")*dHa
        d.v["PSI_E10"][1:-1,1:-1,1:-1]=d.V("b_E0")*d.V("PSI_E10")+d.V("a_E0")*dHb
        E_old = d.C("Ey")
        d.v["Ey"][1:-1,1:-1,1:-1] = ((1-d.CEY("metal"))*(d.V("Ey")+(dHa/d.V("KAPPA_E2")-dHb/d.V("KAPPA_E0")+d.V("PSI_E12")-d.V("PSI_E10"))*d.v["dt/eps0"]/d.CEY("eps"))
            +d.CEY("metal")*d.v["1/(e+ch)"]*(d.v["e-ch"]*d.V("Ey")+(dHa/d.V("KAPPA_E2")-dHb/d.V("KAPPA_E0")+d.V("PSI_E12")-d.V("PSI_E10"))*d.v["dt/eps0"] - d.V("Jy")))
        d.v["Jy"][1:-1,1:-1,1:-1]=d.v["e^(-omega_c*dt)"]*d.V("Jy")-d.v["dchi0"]*(d.V("Ey")+E_old)/2

        dHa = d.dVdx("Hy",0)
        dHb = d.dVdy("Hx",0)
        d.v["PSI_E20"][1:-1,1:-1,1:-1]=d.V("b_E0")*d.V("PSI_E20")+d.V("a_E0")*dHa
        d.v["PSI_E21"][1:-1,1:-1,1:-1]=d.V("b_E1")*d.V("PSI_E21")+d.V("a_E1")*dHb
        E_old = d.C("Ez")
        d.v["Ez"][1:-1,1:-1,1:-1] = ((1-d.CEZ("metal"))*(d.V("Ez")+(dHa/d.V("KAPPA_E0")-dHb/d.V("KAPPA_E1")+d.V("PSI_E20")-d.V("PSI_E21"))*d.v["dt/eps0"]/d.CEZ("eps"))
            +d.CEZ("metal")*d.v["1/(e+ch)"]*(d.v["e-ch"]*d.V("Ez")+(dHa/d.V("KAPPA_E0")-dHb/d.V("KAPPA_E1")+d.V("PSI_E20")-d.V("PSI_E21"))*d.v["dt/eps0"] - d.V("Jz")))
        d.v["Jz"][1:-1,1:-1,1:-1]=d.v["e^(-omega_c*dt)"]*d.V("Jz")-d.v["dchi0"]*(d.V("Ez")+E_old)/2

    else:
        cH = d.dVdy("Hz",0)-d.dVdz("Hy",0)
        E_old = d.C("Ex")
        d.v["Ex"][1:-1,1:-1,1:-1]=((1-d.CEX("metal"))*(d.V("Ex")+cH*d.v["dt/eps0"]/d.CEX("eps"))
            + d.CEX("metal")*d.v["1/(e+ch)"]*(d.v["e-ch"]*d.V("Ex")-d.V("Jx") + d.v["dt/eps0"]*cH))
        d.v["Jx"][1:-1,1:-1,1:-1]=d.v["e^(-omega_c*dt)"]*d.V("Jx")-d.v["dchi0"]*(d.V("Ex")+E_old)/2

        cH =d.dVdz("Hx",0)-d.dVdx("Hz",0)
        E_old = d.C("Ey")
        d.v["Ey"][1:-1,1:-1,1:-1]=((1-d.CEY("metal"))*(d.V("Ey")+cH*d.v["dt/eps0"]/d.CEY("eps"))
            + d.CEY("metal")*d.v["1/(e+ch)"]*(d.v["e-ch"]*d.V("Ey")-d.V("Jy") + d.v["dt/eps0"]*cH))
        d.v["Jy"][1:-1,1:-1,1:-1]=d.v["e^(-omega_c*dt)"]*d.V("Jy")-d.v["dchi0"]*(d.V("Ey")+E_old)/2

        cH =d.dVdx("Hy",0)-d.dVdy("Hx",0)
        E_old = d.C("Ez")
        d.v["Ez"][1:-1,1:-1,1:-1]=((1-d.CEZ("metal"))*(d.V("Ez")+cH*d.v["dt/eps0"]/d.CEZ("eps"))
            + d.CEZ("metal")*d.v["1/(e+ch)"]*(d.v["e-ch"]*d.V("Ez")-d.V("Jz") + d.v["dt/eps0"]*cH))
        d.v["Jz"][1:-1,1:-1,1:-1]=d.v["e^(-omega_c*dt)"]*d.V("Jz")-d.v["dchi0"]*(d.V("Ez")+E_old)/2
