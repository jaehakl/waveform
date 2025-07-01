// @ts-nocheck
import type { NextPage } from 'next'
import * as React from 'react';
import Link from 'next/link'

import { Button } from '@mui/material';

import { checkLoginUser, login, logout } from 'core/network/auth/auth';
import { LoginForm } from 'core/network/auth/loginForm'


import dynamic from 'next/dynamic';

// 'qutat-3d' 패키지에서 GeometryPainter를 동적으로 임포트하고, SSR은 비활성화합니다.
const GeometryPainter = dynamic(
  () => import('qutat-3d').then((mod) => mod.GeometryPainter),
  { 
    ssr: false, // 👈 이 옵션이 서버사이드 렌더링을 끕니다.
    loading: () => <p>Loading 3D View...</p> // (선택사항) 로딩 중에 보여줄 컴포넌트
  }
);

const LandingPage: NextPage = () => {
   return (
      <Main/>
  )
}

export default LandingPage

class Main extends React.Component {
  render(){
    return (
      <div id="landing-page" align="center">
        <h1>Qutat Web Service</h1>
          {this.state.user.pk?
            <>
              Hello, {this.state.user.email} ! <br/><p/>
              <Button variant="contained" color="inherit"
                onClick={() => {logout(()=>{window.location.href="/"}
                )}}>Sign out</Button>
                &nbsp; &nbsp;
              <Button variant="contained"
                onClick={() => {window.location.href="/home"}}>Start</Button>
            </>
          :
          <>
            <GeometryPainter width={500} height={500}/>
          <LoginForm onSuccess={()=>{
            window.location.href="/home"
          }}/>
          If you don't have an account, please <a href="/signup"><b>sign up</b></a>.<br/>
          </>
          }
      <p/>      
      </div>
    )  
  }

  constructor(props) {
    super(props);
    this.state = {
      userpk:"",
      user:{},
    };
  }

  componentDidMount() {
    checkLoginUser(
      (r)=>{
        this.setState({user:r})
      },
      (err)=>{
        console.log(err)
      }
    )
  }
}

