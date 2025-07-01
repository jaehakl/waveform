# Copyright (C) 2023 Jaehak Lee

import json, copy
import numpy as np

from .array.axis_rotation import rotated_axis_from_axis_and_angle_inv
from .array.text_matrix_expression import write_vectors, parse_vectors

VARS_STRUCTURE ={
    "component_id":{
        "dtype":"str"
    },
    "component":{
        "dtype":"str"
    },            
    "position":{
        "type":"vector",
        "dtype":"float",
        "unit":"c['UNIT_LENGTH']"
    },
    "rotation":{
        "type":"matrix",
        "dtype":"float"
    },
    "size":{
        "type":"vector",
        "dtype":"float",
        "unit":"c['UNIT_LENGTH']"
    },
    "props":{
        "type":"matrix",
    },
    "material":{
        "dtype":"str"
    },
    "array":{
        "type":"matrix"
    }
}

def eval_structure(structures_df, components_df, array_axis=np.eye(3), address = "", array_dicts_init = None,
                   parent_size=None, parent_props=None, parent_material=None, parsed=False):

    entity_list = []
    if array_dicts_init == None:
        array_dicts = {}
    else:
        array_dicts = copy.deepcopy(array_dicts_init)

    for i in range(len(structures_df)):
        component_address = address + "/" + str(i)
        
        if component_address in array_dicts.keys():
            array_dict = array_dicts[component_address]
        else:
            array_dict = {}

        array_dict, array_dict_random = eval_entity(structures_df.iloc[i], parent_size, parent_props, parent_material, array_dict)
        array_dicts[component_address] = array_dict_random

        n_array = array_dict['array'][0]
        size_array = array_dict['array'][1]
        for i_x in range(int(n_array[0])):
            for i_y in range(int(n_array[1])):
                for i_z in range(int(n_array[2])):
                    element_address = component_address + "(" + str(i_x) + "," + str(i_y) + "," + str(i_z) + ")"
                    
                    element_dict = copy.deepcopy({
                        'component': array_dict['component'],
                        'component_id': array_dict['component_id'],
                        'array': array_dict['array'],
                        'index': [i_x,i_y,i_z],
                        'position': array_dict['position'][i_x][i_y][i_z],
                        'rotation': array_dict['rotation'][i_x][i_y][i_z],
                        'size': array_dict['size'][i_x][i_y][i_z],
                        'props': array_dict['props'][i_x][i_y][i_z],
                        'material': array_dict['material'][i_x][i_y][i_z],
                    })
                    element_dict['position'][0] = (np.array(element_dict['position'][0])
                        +np.matmul(array_axis,np.array([i_x-(n_array[0]-1)/2,
                                   i_y-(n_array[1]-1)/2,
                                   i_z-(n_array[2]-1)/2])*np.array(size_array))
                        ).tolist()
                    if element_dict['component'] in ['sphere','ellipsoid','cone','block','region','region_func','so_revol_func']:
                        entity_list.append(element_dict)
        
                    elif 'component_id' in components_df.columns:
                        components_unit_df = components_df[components_df['component_id']==element_dict['component']]
                        element_axis = rotated_axis_from_axis_and_angle_inv(element_dict['rotation'])
                        entity_list_partial, array_dicts_partial = eval_structure(components_unit_df, components_df, element_axis, element_address, array_dicts,
                            element_dict['size'][0], element_dict['props'], element_dict['material'][0], parsed=True)
                                           
                        for entity in entity_list_partial:
                            entity['position'][0] = (np.array(element_dict['position'][0])+ np.matmul(element_axis,entity['position'][0])).tolist()
                            entity['rotation'] = entity['rotation'] +  element_dict['rotation']
                            entity_list.append(entity)

                        for key in array_dicts_partial.keys():
                            array_dicts[key] = array_dicts_partial[key]
                    else:
                        pass

    if parsed == False:
        entity_list = [write_entity(entity) for entity in entity_list]

    return entity_list, array_dicts



def eval_entity(entity, size, props, material, array_dict={}):
    entity_parsed = parse_entity(entity.to_dict())
    rv = {}
    rv_random = {}
    for key in entity_parsed.keys():
        if key not in ['array', 'position', 'rotation', 
                       'size', 'props', 'material']:
            rv[key] = entity_parsed[key]


    rv['array'] = ([[eval_f(f,size,props,material) 
                     for f in f_list] 
                     for f_list in entity_parsed['array']] 
                   if 'array' not in array_dict.keys() 
                   else array_dict['array'])    
    for i in range(len(entity_parsed['array'])):
        for j in range(len(entity_parsed['array'][0])):
            if str(entity_parsed['array'][i][j])[0] == "%":
                rv_random['array'] = rv['array']
                break

    n_array = rv['array'][0]

    def eval_array(keyword):
        rv[keyword] = ([[[ [[eval_f(f,size,props,material) 
                                for f in f_list] 
                                for f_list in entity_parsed[keyword]] 
                            for i_z in range(int(n_array[2]))] 
                            for i_y in range(int(n_array[1]))] 
                            for i_x in range(int(n_array[0]))] 
                            if keyword not in array_dict.keys() 
                            else array_dict[keyword])
        for i in range(len(entity_parsed[keyword])):
            for j in range(len(entity_parsed[keyword][0])):
                if str(entity_parsed[keyword][i][j])[0] == "%":
                    rv_random[keyword] = rv[keyword]
                    break

    eval_array('position')
    eval_array('rotation')
    eval_array('size')
    eval_array('props')
    eval_array('material')

    return rv, rv_random

def parse_entity(entity):
    entity_parsed = entity.copy()
    entity_parsed['position'] = parse_vectors(entity['position'],3,1)
    entity_parsed['rotation'] = parse_vectors(entity['rotation'],4)
    entity_parsed['array'] = parse_vectors(entity['array'],3,2)

    entity_parsed['size'] = parse_vectors(entity['size'],3,1)
    entity_parsed['props'] = parse_vectors(entity['props'],None)
    entity_parsed['material'] = parse_vectors(entity['material'],3,1)
    return entity_parsed

def write_entity(entity_parsed):
    entity = entity_parsed.copy()
    entity['position'] = write_vectors(entity_parsed['position'])
    entity['rotation'] = write_vectors(entity_parsed['rotation'])
    entity['array'] = write_vectors(entity_parsed['array'])

    entity['size'] = write_vectors(entity_parsed['size'])
    entity['props'] = write_vectors(entity_parsed['props'])
    entity['material'] = write_vectors(entity_parsed['material'])
    return entity     
   

def eval_f(f,size=None,props=None,material=None):
    if str(f)[0] == '$':
        def Sin(x):
            return np.sin(x)
        def Cos(x):
            return np.cos(x)
        rv = eval(str(f)[1:])
        return rv
    elif str(f)[0] == '%':
        xmin, xmax = f[1:].split('~')
        return np.random.uniform(float(xmin),float(xmax))
    else:
        return f
    


