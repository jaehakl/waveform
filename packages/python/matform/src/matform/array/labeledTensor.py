# Copyright (C) 2024 Jaehak Lee
import base64, json
import numpy as np

class LabeledTensor(object):
    def __init__(self, data, labels=None, label_names=None):
        if type(data) == list:
            data = np.array(data)
        elif type(data).__name__ in ["int","float","complex"]:
            data = np.array([data])
        else:
            data = np.array(data)
        self.data = data
        if labels:
            self.labels = labels
        else:
            self.labels = [[i for i in range(self.data.shape[j])] for j in range(len(self.data.shape))]
        if label_names:
            self.label_names = label_names
        else:
            self.label_names = ["axis"+str(i) for i in range(len(self.data.shape))]
    
    def to_chart_data(self):
        if len(self.data.shape) == 1:
            data_dict = {"x":self.labels[0], "y":self.data}
            return data_dict, *self.label_names
        else:
            print(self.data, self.data.shape)
            print("only 1d data is supported for now.")
            return None

    def set_chart_data(self, data_dict):
        if len(self.data.shape) == 1:
            if len(self.labels) == 0:
                self.data = np.array(data_dict["y"])
            else:
                self.data = np.array(data_dict["y"])
                self.labels[0] = data_dict["x"]
        else:
            print("only 1d data is supported for now.")
            return None

    def to_np_dict(self):
        return {"data": self.data, "labels": self.labels, "label_names": self.label_names}
    
    def from_np_dict(data_dict):
        data = data_dict["data"]
        if "labels" in data_dict.keys():
            labels = data_dict["labels"]
        else:
            labels = []
        if "label_names" in data_dict.keys():
            label_names = data_dict["label_names"]
        else:
            label_names = ["axis"+str(i) for i in range(len(data.shape))]
        return LabeledTensor(data, labels, label_names)
    
    def to_b64_np_dict(self):
        dtype = self.data.dtype
        array = np.ascontiguousarray(self.data).astype(dtype)
        b64_str_value = base64.b64encode(array).decode('ascii')
        b64_ndarray = {
            "value": b64_str_value,
            "shape": array.shape,
            "dtype": str(dtype.name)
        }
        labels_stdRV = []
        for label in self.labels:
            label_stdRV = []
            for var in label:
                varType = type(var).__name__
                if varType in ["int","int64"]:
                    rv = {"type":"int","value":str(var)}
                elif varType in ["float","float64"]:
                    rv = {"type":"float","value":str(float(var))}
                elif varType == "str":
                    rv = {"type":"str","value":var}
                else:
                    print(var, varType)
                    rv = None
                label_stdRV.append(rv)
            labels_stdRV.append(label_stdRV)

        return {"data": b64_ndarray, "labels": labels_stdRV, "label_names": self.label_names}
    
    def from_b64_np_dict(data_dict):
        b64_ndarray = data_dict["data"]
        b64_str_value = b64_ndarray["value"]
        shape = b64_ndarray["shape"]
        dtype_name = b64_ndarray["dtype"]

        if dtype_name == "float":
            dtype = float
        elif dtype_name == "float64":
            dtype = np.float64
        elif dtype_name == "complex":
            dtype = complex
        elif dtype_name == "complex128":
            dtype = np.complex128
        else:
            print(dtype_name, "is not supported")
            return None

        s = np.frombuffer(
            base64.decodebytes(b64_str_value.encode('ascii')),
            dtype=dtype)
        
        ndarray = s.reshape(*shape)

        labels = []
        for label_stdRV in data_dict["labels"]:
            label = []
            for var_strRV in label_stdRV:
                if var_strRV["type"] == "int":
                    label.append(int(var_strRV["value"]))
                elif var_strRV["type"] == "float":
                    label.append(float(var_strRV["value"]))
                elif var_strRV["type"] == "str":
                    label.append(var_strRV["value"])
                else:
                    print(var_strRV, var_strRV["type"])
            labels.append(label)            

        return LabeledTensor(ndarray, labels, data_dict["label_names"])


    def to_json_dict(self):
        data_list = self.data.tolist()
        return {"data": data_list, "labels": self.labels, "label_names": self.label_names}
    
    def from_json_dict(json_dict):
        data = np.array(json_dict["data"])
        if "labels" in json_dict.keys():
            labels = json_dict["labels"]
        else:
            labels = []
        if "label_names" in json_dict.keys():
            label_names = json_dict["label_names"]
        else:
            label_names = ["axis"+str(i) for i in range(len(data.shape))]
        return LabeledTensor(data, labels, label_names)
        
    def shape(self):
        return self.data.shape

    def get_labels(self):
        labels = []
        for i in range(len(self.shape())):
            if i < len(self.labels):
                if self.shape()[i] == len(self.labels[i]):
                    labels.append(self.labels[i])
                else:
                    print("Warning: shape of labels does not match shape of data")
                    labels.append(list(range(self.shape()[i])))
            else:
                labels.append(list(range(self.shape()[i])))
        return labels
    
    def get_label_names(self):
        label_names = []
        for i in range(len(self.shape())):
            if i < len(self.label_names):
                label_names.append(self.label_names[i])
            else:
                label_names.append("axis"+str(i))
        return label_names

            
        
            

