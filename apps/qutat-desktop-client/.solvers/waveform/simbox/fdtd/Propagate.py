import time
from . import Drude_TRC, Drude_RC, CPML

def cal_E(d):
    if d.v["model"] == "Drude_TRC":
        Drude_TRC.cal_E(d)
    elif d.v["model"] == "Drude_RC":
        Drude_RC.cal_E(d)
    else:
        if d.v["pml"] == "cpml":
            CPML.cal_E(d)
        else:
            cb = d.v["dt"]/d.v["EPS0"]/d.CEX("eps")
            d.v["Ex"][1:-1,1:-1,1:-1] += cb*(d.dVdy("Hz",0)-d.dVdz("Hy",0))
            d.v["Ey"][1:-1,1:-1,1:-1] += cb*(d.dVdz("Hx",0)-d.dVdx("Hz",0))
            d.v["Ez"][1:-1,1:-1,1:-1] += cb*(d.dVdx("Hy",0)-d.dVdy("Hx",0))
    d.v['t'] += 0.5*d.v["dt"]

def cal_H(d):
    if d.v["pml"] == "cpml":
        CPML.cal_H(d)
    else:
        cb = d.v["dt"]/d.v["MU0"]
        d.v["Hx"][1:-1,1:-1,1:-1] -= cb*(d.dVdy("Ez",1)-d.dVdz("Ey",1))
        d.v["Hy"][1:-1,1:-1,1:-1] -= cb*(d.dVdz("Ex",1)-d.dVdx("Ez",1))
        d.v["Hz"][1:-1,1:-1,1:-1] -= cb*(d.dVdx("Ey",1)-d.dVdy("Ex",1))
    d.v['t'] += 0.5*d.v["dt"]
