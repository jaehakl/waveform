def parameters(d):
    d.v["LIGHT_SPEED"] = 299792458.0
    d.v["MU0"] = 1.256637061435917295e-6
    d.v["EPS0"] = 8.854187817620389850e-12
    d.v["dt"] = min(d.dl[0],d.dl[1],d.dl[2])/(2*d.v["LIGHT_SPEED"])
    d.v["t"] = 0.0
    d.v["model"] = "nondispersive"
    d.v["pml"] = "none"
    for field in ['E','H']:
        for axis in ['x','y','z']:
            d.gen_tensor(name=field+axis,init_val=0.0)
    d.gen_tensor(name="eps",init_val=1.0)
