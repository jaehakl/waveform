// @ts-nocheck
import type { NextPage } from 'next'
import * as React from 'react';

import { Button } from '@mui/material';

import { signup } from 'core/network/auth/auth';

const LandingPage: NextPage = () => {
   return (
      <Main/>
  )
}

export default LandingPage

class Main extends React.Component {
  render(){
    return (
      <div id="signup-page" align="center">
          <h1>Qutat Waveform</h1>
          <h2>Register Your Account</h2>
          <input type="text" placeholder="email" required
            onChange={(e)=>{this.setState({email:e.target.value})}}
            value={this.state.email} /><p/>          
          <p>Passwords must be at least 8 characters long.</p>
          <input type="password" placeholder="password" required
            onChange={(e)=>{this.setState({password1:e.target.value})}}
            value={this.state.password1} /><p/>
          <input type="password" placeholder="password" required
            onChange={(e)=>{this.setState({password2:e.target.value})}}
            value={this.state.password2} /><p/>
          <Button variant="contained" color="primary"
            onClick={() => {
              if(this.state.password1 != this.state.password2){
                this.setState({errormsg:"Passwords do not match."},
                    ()=>{setTimeout(()=>{this.setState({errormsg:""})}, 1000)}
                )
                return
              }
              this.setState({errormsg:"Please wait while we process your data."})
              signup(
                {email:this.state.email, 
                  password1:this.state.password1,
                  password2:this.state.password2},
                //()=>{window.location.href="/signup_submitted"},
                ()=>{window.location.href="/home"},
                  ()=>{this.setState({errormsg:"Failed to register user."},
                ()=>{setTimeout(()=>{this.setState({errormsg:""})}, 1000)}
                )}
              )
            }}>
            Register
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

