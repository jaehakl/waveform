// @ts-nocheck
import { dot, e, isArray, isInteger, isNumeric, isObject, isString } from 'mathjs';

export const isReallyNumeric = (value)=>{
    const parsed = parseFloat(value)
    return !isNaN(parsed) && isFinite(parsed)
  }

export const toNumeric = (value, editingFinished=true)=>{  
    if (isArray(value)){
        return value.map((v)=>{return toNumeric(v)})
    } else if (isObject(value)){
        Object.entries(value).forEach(([k,v])=>{
        value[k] = toNumeric(v, editingFinished)
        })
        return value
    } else if (isReallyNumeric(value)) {
        if (editingFinished){
            return parseFloat(value)
        } else {
            const dotIndices = []
            for (var i=0; i<value.length; i++){
                if (value[i] == ".") {
                    dotIndices.push(i)
                }
            }
            if (dotIndices.length == 1){
                if (value[value.length-1] == "0" || value[value.length-1] == "."){
                    return value
                } else {
                    return parseFloat(value)
                }
            } else if (dotIndices.length > 1){
                return value
            } else if (dotIndices.length == 0){
                return parseFloat(value)
            }    
        }
    } else {
        return value
    }
}