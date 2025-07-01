// @ts-nocheck
import * as React from 'react';
import { Button } from '@mui/material';
import { signup } from './auth';

export class SignupForm extends React.Component {
  render(){
    const { title } = this.props;
    return (
      <div id="signup-page" align="center">
          <h1>{title}</h1>
          <h2>사용자 등록</h2>
          <input type="text" placeholder="email" required
            onChange={(e)=>{this.setState({email:e.target.value})}}
            value={this.state.email} /><p/>
          <input type="password" placeholder="password" required
            onChange={(e)=>{this.setState({password1:e.target.value})}}
            value={this.state.password1} /><p/>
          <input type="password" placeholder="password" required
            onChange={(e)=>{this.setState({password2:e.target.value})}}
            value={this.state.password2} /><p/>
          <Button variant="contained" color="primary"
            onClick={() => {
              if(this.state.password1 != this.state.password2){
                this.setState({errormsg:"비밀번호가 일치하지 않습니다."},
                ()=>{setTimeout(()=>{this.setState({errormsg:""})}, 1000)}
                )
                return
              }
              this.setState({errormsg:"데이터 검토 중입니다. 잠시만 기다려주세요."})
              signup(
                {email:this.state.email, 
                  password1:this.state.password1,
                  password2:this.state.password2},
                ()=>{window.location.href="/signup_submitted"},
                ()=>{this.setState({errormsg:"사용자 등록에 실패하였습니다."},
                ()=>{setTimeout(()=>{this.setState({errormsg:""})}, 1000)}
                )}
              )
            }}>
              인증 이메일 발송           
          </Button>           
          <p/>
          {this.state.errormsg}
          <p/>   
      </div>
    )  
  }

  constructor(props) {
    super(props);
    this.state = {
      email:"",
      password1:"",
      password2:"",
      errormsg:"",
    };
  }
  componentDidMount() { }
}


export class SignupSubmitted extends React.Component {
  render(){
    return (
      <div id="signup-page">          
          인증 메일이 발송되었습니다. 메일을 확인해주세요.<p/>
          <a href="/">홈으로</a>
      </div>
    )  
  }

  constructor(props) {
    super(props);
    this.state = {
      email:"",
      password1:"",
      password2:"",
      errormsg:"",
    };
  }
  componentDidMount() { }
}