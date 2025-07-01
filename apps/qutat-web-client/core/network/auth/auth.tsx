// @ts-nocheck
import axios from "axios"
import { DRF_ADDRESS } from 'config';

import * as BACKAPI from 'backend_api'

export function getSetData(
    restApiUrl, setData, 
    setDataError=(e)=>{console.log(e)}
  ) {
  axios.get(DRF_ADDRESS+"/"+restApiUrl)
  .then((response) => {
      setData(response.data)
  })
  .catch((error) => {
      console.log(error)
      setDataError(error)
  })
}

export function postSetData(
    restApiUrl, postedData, setData, type="json",
    setDataError=(e)=>{console.log(e)}
  ) {
    if (type=="json"){
      var contentType = 'application/json;charset=UTF-8';
    } else if (type=="form"){
      var contentType = 'multipart/form-data';
    }
    axios.post(DRF_ADDRESS+"/"+restApiUrl, postedData,
    {headers: {'Content-Type': contentType}} )
  .then((response) => {
      setData(response.data)
  })
  .catch((error) => {
      console.log(error)
      setDataError(error)
  })
}

export function putSetData(
  restApiUrl, postedData, setData, type="json",
  setDataError=(e)=>{console.log(e)}
) {
  if (type=="json"){
    var contentType = 'application/json;charset=UTF-8';
  } else if (type=="form"){
    var contentType = 'multipart/form-data';
  }
  axios.put(DRF_ADDRESS+"/"+restApiUrl, postedData,
  {headers: {'Content-Type': contentType}} )
.then((response) => {
    setData(response.data)
})
.catch((error) => {
    console.log(error)
    setDataError(error)
})
}

export function deleteSetData(  
  restApiUrl, setData, 
  setDataError=(e)=>{console.log(e)}
) {
axios.delete(DRF_ADDRESS+"/"+restApiUrl)
.then((response) => {
    setData(response.data)
})
.catch((error) => {
    console.log(error)
    setDataError(error)
})
}

export function signup(userSignupInfo,
  setResult=(r)=>{console.log(r);location.reload()},
  setError=(e)=>{console.log(e)}) {
  reset_cookie() // 쿠키 리셋 (혹시 만료된 쿠키값이 삭제되지 않고 남아있을 경우 에러가 발생하므로 )
  postSetData(BACKAPI.registration(),
    userSignupInfo,(d)=>{setResult(d)},(e)=>{setError(e)})
}

export function login(userAuthInfo, 
  setResult=(r)=>{console.log(r);location.reload()},
  setError=(e)=>{console.log(e)}) {    
  reset_cookie() // 쿠키 리셋 (혹시 만료된 쿠키값이 삭제되지 않고 남아있을 경우 에러가 발생하므로 )
  postSetData(BACKAPI.users_login(),
    userAuthInfo,(d)=>{setResult(d)},(e)=>{setError(e)})
}
  
export function logout(
  setResult=(r)=>{console.log(r);location.reload()},
  setError=(e)=>{console.log(e)}
) {
    postSetData(BACKAPI.users_logout(),{},
    (d)=>{setResult(d)},(e)=>{setError(e)})
}

export function checkLoginUser(setResult, setError) {
  /* 로그인 여부 체크 dj-rest-auth 의 API endpoint 활용 */
  getSetData(BACKAPI.users_user(),
    (d)=>{setResult(d)},(e)=>{setError(e)})
}

export function reset_cookie(){
  document.cookie.split(";").forEach(
    function(c) { document.cookie = c.replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); });
}