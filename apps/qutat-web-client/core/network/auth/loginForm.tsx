// @ts-nocheck
import * as React from 'react';
import {Grid, Stack, Button, TextField, Box, Card} from '@mui/material';
import { login, logout } from './auth';

export class LoginForm extends React.Component {
  render(){
    const { onSuccess } = this.props;
    return (
      <>
        <Grid container spacing={2} sx={{
          fontFamily:"HCRDotum",fontSize:15 ,lineHeight:2, 
          maxWidth:"92%", paddingTop: '0%'}} margin={{xs:0, sm:2, md:5}}>

          <Grid item xs={12} sm={12} md={12}>
            <h2>Sign in</h2>
          </Grid>

          <Grid item xs={12} sm={12} md={12}>
            <TextField id="outlined-basic" label="email" required variant="outlined" 
              onChange={(e)=>{this.setState({email:e.target.value})}}
              value={this.state.email} />
          </Grid>
          <Grid item xs={12} sm={12} md={12}>
            <TextField id="outlined-basic" label="password" required type="password" variant="outlined"
              onChange={(e)=>{this.setState({password:e.target.value})}}
              onKeyPress={(e)=>{if(e.key=="Enter"){this.login()}}}
              value={this.state.password} />
              <p/>
            {this.state.errormsg}
          </Grid>
          <Grid item xs={12} sm={12} md={12}>
            <Button variant="inherit" color="primary" 
              onClick={()=>{this.login()}}>
              Sign in
            </Button>  
          </Grid>
        </Grid>   
      </>
    )
  }

  constructor(props) {
    super(props);
    this.state = {
      email:"",
      password:"",
      errormsg:"",
    };
  }  

  componentDidMount() { }

  login() {
    login(
      {email:this.state.email, password:this.state.password},
      this.props.onSuccess,
      ()=>{this.setState({errormsg:"사용자 정보를 확인해주세요."},
        ()=>{setTimeout(()=>{this.setState({errormsg:""})}, 1000)}
      )},
    )
  }
}


