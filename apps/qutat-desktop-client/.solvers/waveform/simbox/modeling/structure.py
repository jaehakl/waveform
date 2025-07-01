import os
import numpy as np
import pandas as pd
from . import solid

class Structure():
    def __init__(self, name, rootdir):
        self.dir = rootdir+"/"+name+"/"
        self.default_recipe_data={'target':['main'], 'fname':['block'],
            'xmin':[0],'xmax':[0],'ymin':[0],'ymax':[0],'zmin':[0],'zmax':[0],
            'd0min':[0],'d0max':[0.1],'d1min':[0],'d1max':[0.2],'d2min':[0],'d2max':[0.3],
            'narray':[1],'pmin':[0.4],'pmax':[0.5],'vname':["eps"],'vmin':[1.47],'vmax':[2.1]}

    def new_recipe(self,recipe_data="default"):
        if recipe_data == "default":
            new_recipe_data = self.default_recipe_data
        else:
            new_recipe_data = recipe_data

        recipe_path = self.dir+"/recipe.csv"
        if os.path.isdir(self.dir) is False:
            os.makedirs(self.dir)
        else:
            print("A directory already exists at", self.dir)
        if os.path.isfile(recipe_path) is False:
            recipe = pd.DataFrame(data=new_recipe_data)
            recipe.to_csv(recipe_path,index=False)
        else:
            print("A recipe already exists at",recipe_path)

    def load_recipe(self):
        recipe_path = self.dir+"/recipe.csv"
        if os.path.isfile(recipe_path) is True:
            recipe = pd.read_csv(recipe_path)
            print(recipe)
            self.recipe=recipe
        else:
            print("No recipe exists at", recipe_path)

    def gen_entity(self):
        values = []
        for i in range(0,len(self.recipe)):
            s = self.recipe.loc[i]
            pitch = np.random.uniform(float(s.pmin),float(s.pmax))
            N = int(s.narray)
            for i in range(0,N):
                for j in range(0,N):
                    x = pitch*(-0.5*N+0.5+i) + np.random.uniform(float(s.xmin),float(s.xmax))
                    y = pitch*(-0.5*N+0.5+j) + np.random.uniform(float(s.ymin),float(s.ymax))
                    z = np.random.uniform(float(s.zmin),float(s.zmax))
                    value = [s.target,s.fname,x,y,z,
                             np.random.uniform(float(s.d0min),float(s.d0max)),
                             np.random.uniform(float(s.d1min),float(s.d1max)),
                             np.random.uniform(float(s.d2min),float(s.d2max)),
                             s.narray,pitch,
                             s.vname,np.random.uniform(float(s.vmin),float(s.vmax))]
                    values.append(value)
        entity = pd.DataFrame(values,columns = ['target','fname','x','y','z','d0','d1','d2','narray','pitch','vname','v'])
        entity.name = str(np.random.randint(1e8,1e9))
        return entity

    def save_entity(self,entity):
        path = self.dir + "/" + entity.name + "/"
        if os.path.isdir(path) is False:
            os.makedirs(path)
        entity.to_csv(path+"struct.csv",index=False)
        return path

def make_struct(box,entity):
    for i in range(0,len(entity)):
        s = entity.loc[i]
        if s.target in box.group:
            if s.vname == "eps":
                v = max(1.0,float(s.v))
            else:
                v = float(s.v)
            fname_to_func(s.fname)(box,[float(s.x),float(s.y),float(s.z)],[float(s.d0),float(s.d1),float(s.d2)],s.vname,v)

def fname_to_func(fname):
    if fname == "block":
        function = solid.block
    elif fname == "disk":
        function = solid.disk
    elif fname == "ring":
        function = solid.ring
    return function

if __name__=="__main__":
    ns = Structure()
