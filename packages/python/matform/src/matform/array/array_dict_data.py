# Copyright (C) 2024 Jaehak Lee

#Standard library modules
#from core.extern_libs import *
import numpy as np

class ArrayDictData():
    def __init__(self, data):
        self.data_shapes = {}
        self.data = self.serialize(data)

    def set_1d(self, data_1d):
        self.data = data_1d

    def to_1d(self):
        return self.data    

    def to_dict(self, as_list=False):
        return self.recover(self.data, as_list)['']

    def set_1_level_dict(self, data_1_level_dict):
        data = self.unflatten(data_1_level_dict)['']
        self.data = self.serialize(data)

    def to_1_level_dict(self, data=None, address=""):
        if data is None:
            data = self.to_dict()
        if type(data) == dict:
            data_flatten = {}
            for key in data.keys():
                data_flatten.update(self.to_1_level_dict(data[key], address + "." + key))
            return data_flatten
        else:
            return {address:data}

    def serialize(self, data):
        tensor_1d = np.concatenate(list(self.flatten(data).values()))
        return tensor_1d

    def flatten(self, data, address = ""):
        if type(data) == dict:
            data_flatten = {}
            for key in data.keys():
                data_flatten.update(self.flatten(data[key], address + "." + key))
            return data_flatten
        else:
            data_np = np.array(data)
            self.data_shapes[address] = data_np.shape
            return {address:data_np.flatten()}
        
    def recover(self, data_flatten, as_list=True):
        data_recover = {}
        i_data =0
        for key in self.data_shapes.keys():
            shape = self.data_shapes[key]
            n = np.prod(shape)
            if as_list:
                data_recover[key] = data_flatten[i_data:i_data+n].reshape(shape).tolist()
            else:
                data_recover[key] = data_flatten[i_data:i_data+n].reshape(shape)
            i_data += n
        return self.unflatten(data_recover)
    
    def unflatten(self, data_flatten):
        data = {}
        for key in data_flatten.keys():
            keys = key.split(".")
            data_temp = data
            for i in range(len(keys)-1):
                if keys[i] not in data_temp.keys():
                    data_temp[keys[i]] = {}
                data_temp = data_temp[keys[i]]
            data_temp[keys[-1]] = data_flatten[key]
        return data
