// @ts-nocheck

import { toNumeric } from './type';

export function writeVectors(vectors, delimiter = '|') {
    var output = ''
    var line = []
    for (let i = 0; i < vectors.length; i++) {
        line.push(vectors[i].join(','))
    }
    output = line.join(delimiter)
    return output
}

export function parseVectors(data,len_vector=3,num_vector=-1,fill_values=[],delimiter='|') {
    const vectors = String(data).split(delimiter);
    const input_array = []
    for (let i = 0; i < vectors.length; i++) {
        let vector = vectors[i].split(',');
        input_array.push(vector);
    }

    const output_array = []
    if (num_vector < 0) {
        num_vector = input_array.length
    }

    for (let i = 0; i < num_vector; i++) {
        const output_vector = []
        if (i >= input_array.length){
            let fill_value = 0
            if (i < fill_values.length){                
                let fill_value = fill_values[i]
            }
            for (let j = 0; j < len_vector; j++) {
                output_vector.push(fill_value)
            }
        } else {
            for (let j = 0; j < len_vector; j++) {
                let v = 0
                if (j < input_array[i].length){
                    v = input_array[i][j]
                } else if ( input_array[i].length > 0) {
                    v = input_array[i][input_array[i].length-1]
                } else if ( i < fill_values.length) {
                    v = fill_values[i]
                } else if (fill_values.length > 0) {
                    v = fill_values[fill_values.length-1]
                } else {
                    v = 0
                }
                v = toNumeric(v)
                output_vector.push(v)
            }
        }
        output_array.push(output_vector)
    }
    return output_array
}

