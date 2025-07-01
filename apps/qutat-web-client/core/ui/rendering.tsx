// @ts-nocheck


function isExists(data){
  if (
    data == undefined ||
    data == null ||
    data == "undefined" ||
    data == "null" ||
    data == "None" ||
    data == "[]" ||
    data == "{}"    
  ) {
    return false
  } else {
    return true
  }
}

export function renderIfExists(data, renderingFunc, 
  alternativeRenderingFunc=()=>{return null}){
  if (isExists(data)){
    return renderingFunc(data)
  } else {
    return alternativeRenderingFunc()
  }
}


export function renderListIfExists(data, renderingFunc,
  alternativeRenderingFunc=()=>{return null}){
  if (isExists(data)){
    if (Array.isArray(data)){
      return <> {
        data.map((value, key)=>{
          if (isExists(value)){
            return renderIfExists([key, value], renderingFunc)
          } else {
            return null
          }
        })} </>
    } else {
      return <> {
        Object.entries(data).map(([key, value])=>{
          if (isExists(value)){
            return renderIfExists([key, value], renderingFunc)
          } else {
            return null
          }
        })}</>
    }
  } else {    
    return alternativeRenderingFunc()
  }
}