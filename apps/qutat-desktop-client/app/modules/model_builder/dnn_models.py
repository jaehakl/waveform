# Copyright (C) 2023 Jaehak Lee

import torch

class DNNLinear(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        dtype = conf["dtype"]
        self.inout=torch.nn.Linear(N_in,N_ou).type(dtype)
        print("Linear", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        i_pred = self.inout(input).view(x.size(0),-1)
        return i_pred


class DNN_1(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[0],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_1", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred

class DNN_2(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[1],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_2", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred

class DNN_3(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.mid2=torch.nn.Linear(N_neurons[1],N_neurons[2]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[2],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_3", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        h_relu = self.dropout(self.relu(self.mid2(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred



class DNN_4(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.mid2=torch.nn.Linear(N_neurons[1],N_neurons[2]).type(dtype)
        self.mid3=torch.nn.Linear(N_neurons[2],N_neurons[3]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[3],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_4", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        h_relu = self.dropout(self.relu(self.mid2(h_relu)))
        h_relu = self.dropout(self.relu(self.mid3(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred


class DNN_5(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.mid2=torch.nn.Linear(N_neurons[1],N_neurons[2]).type(dtype)
        self.mid3=torch.nn.Linear(N_neurons[2],N_neurons[3]).type(dtype)
        self.mid4=torch.nn.Linear(N_neurons[3],N_neurons[4]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[4],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_5", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        h_relu = self.dropout(self.relu(self.mid2(h_relu)))
        h_relu = self.dropout(self.relu(self.mid3(h_relu)))
        h_relu = self.dropout(self.relu(self.mid4(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred



class DNN_6(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.layers_dict = {}                    
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.mid2=torch.nn.Linear(N_neurons[1],N_neurons[2]).type(dtype)
        self.mid3=torch.nn.Linear(N_neurons[2],N_neurons[3]).type(dtype)
        self.mid4=torch.nn.Linear(N_neurons[3],N_neurons[4]).type(dtype)
        self.mid5=torch.nn.Linear(N_neurons[4],N_neurons[5]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[5],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_6", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        h_relu = self.dropout(self.relu(self.mid2(h_relu)))
        h_relu = self.dropout(self.relu(self.mid3(h_relu)))
        h_relu = self.dropout(self.relu(self.mid4(h_relu)))
        h_relu = self.dropout(self.relu(self.mid5(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred

class DNN_7(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.layers_dict = {}                    
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.mid2=torch.nn.Linear(N_neurons[1],N_neurons[2]).type(dtype)
        self.mid3=torch.nn.Linear(N_neurons[2],N_neurons[3]).type(dtype)
        self.mid4=torch.nn.Linear(N_neurons[3],N_neurons[4]).type(dtype)
        self.mid5=torch.nn.Linear(N_neurons[4],N_neurons[5]).type(dtype)
        self.mid6=torch.nn.Linear(N_neurons[5],N_neurons[6]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[6],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_7", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        h_relu = self.dropout(self.relu(self.mid2(h_relu)))
        h_relu = self.dropout(self.relu(self.mid3(h_relu)))
        h_relu = self.dropout(self.relu(self.mid4(h_relu)))
        h_relu = self.dropout(self.relu(self.mid5(h_relu)))
        h_relu = self.dropout(self.relu(self.mid6(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred
    
class DNN_8(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.layers_dict = {}                    
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.mid2=torch.nn.Linear(N_neurons[1],N_neurons[2]).type(dtype)
        self.mid3=torch.nn.Linear(N_neurons[2],N_neurons[3]).type(dtype)
        self.mid4=torch.nn.Linear(N_neurons[3],N_neurons[4]).type(dtype)
        self.mid5=torch.nn.Linear(N_neurons[4],N_neurons[5]).type(dtype)
        self.mid6=torch.nn.Linear(N_neurons[5],N_neurons[6]).type(dtype)
        self.mid7=torch.nn.Linear(N_neurons[6],N_neurons[7]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[7],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_8", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        h_relu = self.dropout(self.relu(self.mid2(h_relu)))
        h_relu = self.dropout(self.relu(self.mid3(h_relu)))
        h_relu = self.dropout(self.relu(self.mid4(h_relu)))
        h_relu = self.dropout(self.relu(self.mid5(h_relu)))
        h_relu = self.dropout(self.relu(self.mid6(h_relu)))
        h_relu = self.dropout(self.relu(self.mid7(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred
    
class DNN_9(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.layers_dict = {}                    
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.mid2=torch.nn.Linear(N_neurons[1],N_neurons[2]).type(dtype)
        self.mid3=torch.nn.Linear(N_neurons[2],N_neurons[3]).type(dtype)
        self.mid4=torch.nn.Linear(N_neurons[3],N_neurons[4]).type(dtype)
        self.mid5=torch.nn.Linear(N_neurons[4],N_neurons[5]).type(dtype)
        self.mid6=torch.nn.Linear(N_neurons[5],N_neurons[6]).type(dtype)
        self.mid7=torch.nn.Linear(N_neurons[6],N_neurons[7]).type(dtype)
        self.mid8=torch.nn.Linear(N_neurons[7],N_neurons[8]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[8],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_9", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        h_relu = self.dropout(self.relu(self.mid2(h_relu)))
        h_relu = self.dropout(self.relu(self.mid3(h_relu)))
        h_relu = self.dropout(self.relu(self.mid4(h_relu)))
        h_relu = self.dropout(self.relu(self.mid5(h_relu)))
        h_relu = self.dropout(self.relu(self.mid6(h_relu)))
        h_relu = self.dropout(self.relu(self.mid7(h_relu)))
        h_relu = self.dropout(self.relu(self.mid8(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred
    
class DNN_10(torch.nn.Module):
    def __init__(self,conf):
        super().__init__()
        N_in = conf["inshape"]
        N_ou = conf["oushape"]
        N_neurons = conf["n_neurons"]
        dropout = conf["r_dropout"]
        dtype = conf["dtype"]
        self.relu = torch.nn.ReLU()
        self.layers_dict = {}                    
        self.input=torch.nn.Linear(N_in,N_neurons[0]).type(dtype)
        self.mid1=torch.nn.Linear(N_neurons[0],N_neurons[1]).type(dtype)
        self.mid2=torch.nn.Linear(N_neurons[1],N_neurons[2]).type(dtype)
        self.mid3=torch.nn.Linear(N_neurons[2],N_neurons[3]).type(dtype)
        self.mid4=torch.nn.Linear(N_neurons[3],N_neurons[4]).type(dtype)
        self.mid5=torch.nn.Linear(N_neurons[4],N_neurons[5]).type(dtype)
        self.mid6=torch.nn.Linear(N_neurons[5],N_neurons[6]).type(dtype)
        self.mid7=torch.nn.Linear(N_neurons[6],N_neurons[7]).type(dtype)
        self.mid8=torch.nn.Linear(N_neurons[7],N_neurons[8]).type(dtype)
        self.mid9=torch.nn.Linear(N_neurons[8],N_neurons[9]).type(dtype)
        self.ouput=torch.nn.Linear(N_neurons[9],N_ou).type(dtype)
        self.dropout = torch.nn.Dropout(p=dropout)
        print("DNN_10", "n_params:",sum(p.numel() for p in self.parameters() if p.requires_grad))
    def forward(self, x):
        input = x.view(x.size(0),-1)
        h_relu = self.dropout(self.relu(self.input(input)))
        h_relu = self.dropout(self.relu(self.mid1(h_relu)))
        h_relu = self.dropout(self.relu(self.mid2(h_relu)))
        h_relu = self.dropout(self.relu(self.mid3(h_relu)))
        h_relu = self.dropout(self.relu(self.mid4(h_relu)))
        h_relu = self.dropout(self.relu(self.mid5(h_relu)))
        h_relu = self.dropout(self.relu(self.mid6(h_relu)))
        h_relu = self.dropout(self.relu(self.mid7(h_relu)))
        h_relu = self.dropout(self.relu(self.mid8(h_relu)))
        h_relu = self.dropout(self.relu(self.mid9(h_relu)))
        i_pred = self.ouput(h_relu).view(x.size(0),-1)
        return i_pred
    

