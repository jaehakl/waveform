def import_boundary(box,names):
    xp = box.mul_xp
    xm = box.mul_xm
    yp = box.mul_yp
    ym = box.mul_ym
    zp = box.mul_zp
    zm = box.mul_zm
    if str(box.device) == "cpu":
        for name in names:
            box.v[name][-1,1:-1,1:-1]=box.AX(name,-2) if xp==0 else box.AX(name,-2) + (xp.AX(name,1).cpu()-box.AX(name,-2))*2*box.dl[0]/(box.dl[0]+xp.dl[0])
            box.v[name][1:-1,-1,1:-1]=box.AY(name,-2) if yp==0 else box.AY(name,-2) + (yp.AY(name,1).cpu()-box.AY(name,-2))*2*box.dl[1]/(box.dl[1]+yp.dl[1])
            box.v[name][1:-1,1:-1,-1]=box.AZ(name,-2) if zp==0 else box.AZ(name,-2) + (zp.AZ(name,1).cpu()-box.AZ(name,-2))*2*box.dl[2]/(box.dl[2]+zp.dl[2])
            box.v[name][0,1:-1,1:-1]=box.AX(name,1) if xm==0 else box.AX(name,1) + (xm.AX(name,-2).cpu()-box.AX(name,1))*2*box.dl[0]/(box.dl[0]+xm.dl[0])
            box.v[name][1:-1,0,1:-1]=box.AY(name,1) if ym==0 else box.AY(name,1) + (ym.AY(name,-2).cpu()-box.AY(name,1))*2*box.dl[1]/(box.dl[1]+ym.dl[1])
            box.v[name][1:-1,1:-1,0]=box.AZ(name,1) if zm==0 else box.AZ(name,1) + (zm.AZ(name,-2).cpu()-box.AZ(name,1))*2*box.dl[2]/(box.dl[2]+zm.dl[2])
    else:
        for name in names:
            box.v[name][-1,1:-1,1:-1]=box.AX(name,-2) if xp==0 else box.AX(name,-2) + (xp.AX(name,1).cuda(device=box.device)-box.AX(name,-2))*2*box.dl[0]/(box.dl[0]+xp.dl[0])
            box.v[name][1:-1,-1,1:-1]=box.AY(name,-2) if yp==0 else box.AY(name,-2) + (yp.AY(name,1).cuda(device=box.device)-box.AY(name,-2))*2*box.dl[1]/(box.dl[1]+yp.dl[1])
            box.v[name][1:-1,1:-1,-1]=box.AZ(name,-2) if zp==0 else box.AZ(name,-2) + (zp.AZ(name,1).cuda(device=box.device)-box.AZ(name,-2))*2*box.dl[2]/(box.dl[2]+zp.dl[2])
            box.v[name][0,1:-1,1:-1]=box.AX(name,1) if xm==0 else box.AX(name,1) + (xm.AX(name,-2).cuda(device=box.device)-box.AX(name,1))*2*box.dl[0]/(box.dl[0]+xm.dl[0])
            box.v[name][1:-1,0,1:-1]=box.AY(name,1) if ym==0 else box.AY(name,1) + (ym.AY(name,-2).cuda(device=box.device)-box.AY(name,1))*2*box.dl[1]/(box.dl[1]+ym.dl[1])
            box.v[name][1:-1,1:-1,0]=box.AZ(name,1) if zm==0 else box.AZ(name,1) + (zm.AZ(name,-2).cuda(device=box.device)-box.AZ(name,1))*2*box.dl[2]/(box.dl[2]+zm.dl[2])

# For FDTD module
def import_boundary_Yee(d,names):
    xp = d.mul_xp
    xm = d.mul_xm
    yp = d.mul_yp
    ym = d.mul_ym
    zp = d.mul_zp
    zm = d.mul_zm
    if str(d.device) == "cpu":
        for name in names:
            if name in ["Ey","Ez"]: d.v[name][-1,1:-1,1:-1]=d.AX(name,-2) if xp==0 else d.AX(name,-2) + (xp.AX(name,1).cpu()-d.AX(name,-2))*2*d.dl[0]/(d.dl[0]+xp.dl[0])
            if name in ["Ex","Ez"]: d.v[name][1:-1,-1,1:-1]=d.AY(name,-2) if yp==0 else d.AY(name,-2) + (yp.AY(name,1).cpu()-d.AY(name,-2))*2*d.dl[1]/(d.dl[1]+yp.dl[1])
            if name in ["Ex","Ey"]: d.v[name][1:-1,1:-1,-1]=d.AZ(name,-2) if zp==0 else d.AZ(name,-2) + (zp.AZ(name,1).cpu()-d.AZ(name,-2))*2*d.dl[2]/(d.dl[2]+zp.dl[2])
            if name in ["Hy","Hz"]: d.v[name][0,1:-1,1:-1]=d.AX(name,1) if xm==0 else d.AX(name,1) + (xm.AX(name,-2).cpu()-d.AX(name,1))*2*d.dl[0]/(d.dl[0]+xm.dl[0])
            if name in ["Hx","Hz"]: d.v[name][1:-1,0,1:-1]=d.AY(name,1) if ym==0 else d.AY(name,1) + (ym.AY(name,-2).cpu()-d.AY(name,1))*2*d.dl[1]/(d.dl[1]+ym.dl[1])
            if name in ["Hx","Hy"]: d.v[name][1:-1,1:-1,0]=d.AZ(name,1) if zm==0 else d.AZ(name,1) + (zm.AZ(name,-2).cpu()-d.AZ(name,1))*2*d.dl[2]/(d.dl[2]+zm.dl[2])
    else:
        for name in names:
            if name in ["Ey","Ez"]: d.v[name][-1,1:-1,1:-1]=d.AX(name,-2) if xp==0 else d.AX(name,-2) + (xp.AX(name,1).cuda(device=d.device)-d.AX(name,-2))*2*d.dl[0]/(d.dl[0]+xp.dl[0])
            if name in ["Ex","Ez"]: d.v[name][1:-1,-1,1:-1]=d.AY(name,-2) if yp==0 else d.AY(name,-2) + (yp.AY(name,1).cuda(device=d.device)-d.AY(name,-2))*2*d.dl[1]/(d.dl[1]+yp.dl[1])
            if name in ["Ex","Ey"]: d.v[name][1:-1,1:-1,-1]=d.AZ(name,-2) if zp==0 else d.AZ(name,-2) + (zp.AZ(name,1).cuda(device=d.device)-d.AZ(name,-2))*2*d.dl[2]/(d.dl[2]+zp.dl[2])
            if name in ["Hy","Hz"]: d.v[name][0,1:-1,1:-1]=d.AX(name,1) if xm==0 else d.AX(name,1) + (xm.AX(name,-2).cuda(device=d.device)-d.AX(name,1))*2*d.dl[0]/(d.dl[0]+xm.dl[0])
            if name in ["Hx","Hz"]: d.v[name][1:-1,0,1:-1]=d.AY(name,1) if ym==0 else d.AY(name,1) + (ym.AY(name,-2).cuda(device=d.device)-d.AY(name,1))*2*d.dl[1]/(d.dl[1]+ym.dl[1])
            if name in ["Hx","Hy"]: d.v[name][1:-1,1:-1,0]=d.AZ(name,1) if zm==0 else d.AZ(name,1) + (zm.AZ(name,-2).cuda(device=d.device)-d.AZ(name,1))*2*d.dl[2]/(d.dl[2]+zm.dl[2])
