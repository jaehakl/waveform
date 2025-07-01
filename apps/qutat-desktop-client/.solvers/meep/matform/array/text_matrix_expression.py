# Copyright (C) 2024 Jaehak Lee

import numpy as np
import pandas as pd

def write_vectors(vectors,delimiter='|'):
    return delimiter.join([",".join([str(v) for v in vector]) for vector in vectors])

def parse_vectors(data,len_vector=3,num_vector=None,fill_values=[],numeric_type=float,delimiter='|'):
    input_array = [[] if el=='' else [v for v in el.split(',')]  for el in str(data).split(delimiter) ]
    output_array = []

    if len_vector == None:
        len_vector = max([len(x) for x in input_array])

    if num_vector == None:
        num_vector = len(input_array)

    for i in range(num_vector):
        if i >= len(input_array):
            if i < len(fill_values):
                output_array.append([fill_values[i]]*len_vector)
            else:
                output_array.append([0]*len_vector)
        else:            
            vector = []
            for j in range(len_vector):
                if j < len(input_array[i]):
                    v = input_array[i][j]
                elif len(input_array[i]) > 0:
                    v = input_array[i][-1]
                elif i < len(fill_values):
                    v = fill_values[i]
                elif len(fill_values) > 0:
                    v = fill_values[-1]
                else:
                    v = 0
                try:
                    v = numeric_type(v)
                except ValueError:
                    v = str(v)
                vector.append(v)
            output_array.append(vector)
    return output_array

def import_value(value, dtype=np.float64, unit=1, replace_minus=None):
    if value == "_":
        return dtype(0)
    elif replace_minus == None:
        return dtype(value)*dtype(unit)
    else:
        if value < 0:
            return dtype(replace_minus)
        else:
            return dtype(value)*dtype(unit)

def import_series(x, dtype=np.float64, unit=1):
    x_dict = x.to_dict()
    for key in x_dict.keys():
        x_dict[key] = import_value(x_dict[key], dtype=dtype, unit=unit)
    new_x = pd.Series(x_dict).astype(dtype)
    return new_x

def import_vector_series(x, dtype=np.float64, unit=1, vec_replace_minus=None):
    x_dict = x.to_dict()
    for key in x_dict.keys():
        vectors = parse_vectors(x_dict[key])
        new_vectors = []
        for vector in vectors:
            new_vector = []
            for i, value in enumerate(vector):
                if vec_replace_minus == None:
                    value = import_value(value, dtype=dtype, unit=unit)
                else:
                    value = import_value(value, dtype=dtype, unit=unit,
                        replace_minus=vec_replace_minus[i])
                new_vector.append(value)
            new_vectors.append(new_vector)
        x_dict[key] = write_vectors(new_vectors)
    new_x = pd.Series(x_dict)
    return new_x