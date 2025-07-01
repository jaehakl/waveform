// @ts-nocheck
import type { NextPage } from 'next'
import Link from 'next/link'

import * as React from 'react';
import {Grid, Stack, Button, TextField, Box, Card} from '@mui/material';

import { checkLoginUser, login, logout, getSetData, deleteSetData } from 'core/network/auth/auth';
import { LoginForm } from 'core/network/auth/loginForm';
import Layout from 'layout/layout';
import { renderListIfExists } from 'core/ui/rendering'

import * as BACKAPI from 'backend_api'

const QutatPage: NextPage = () => {
   return (
      <Layout>
        <Main/>
      </Layout>
  )
}

export default QutatPage

class Main extends React.Component {
  render(){
    return (
      <div id="landing-page" align="center">        
          {this.state.user.pk?
            <>
              <h3>Username</h3>
              {this.state.user.email} <br/>
              <p/>
              <Button
                onClick={() => {logout(()=>{window.location.href="/"}
                )}}>Logout</Button>
            {/*
              <h3>Identification Tokens</h3>
              <Stack spacing={2} direction="column" width="100%">

                {this.state.tokens.map((token, index) => (                  
                  <Stack spacing={2}
                    justifyContent="center" direction="row" width="100%" >
                  <Card key={index}>
                    <Box padding={1} width="160px">
                    {token.grade>1?<b>Premium License</b>:"Trial License"}
                    </Box>
                  </Card>
                  <Card key={index}>
                    <Box padding={1} width="350px">
                      {token.token}
                    </Box>
                  </Card>

                  <Button color="error"
                    onClick={() => {
                      deleteSetData('users/token/view/'+token.id+'/', (r)=>{
                        getSetData('users/token/view/1000_0/', (r)=>{
                          this.setState({tokens:r})
                        })
                      })
                    }}
                    >Delete</Button>
                  </Stack>
                  
                ))}
                </Stack>
                <Button color="primary"
                    onClick={() => {
                      getSetData('users/token/new/', (r)=>{
                        getSetData('users/token/view/1000_0/', (r)=>{
                          this.setState({tokens:r})
                        })
                      })
                    }}
                    >Create a Trial Token</Button>
              <p/>
          */}
            </>
          :
          <>
          <LoginForm onSuccess={()=>{
            window.location.href="/home"
          }}/>
          If you don't have an account, please <a href="/signup"><b>sign up</b></a>.<br/>
          <br/>
          <p>Need Help ? : ask@qutat.net</p>
          </>
          }
      </div>

    )
  }

  constructor(props) {
    super(props);
    this.state = {
      user:{},
      tokens:[]
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
    getSetData(BACKAPI.token_view('1000_0'), (r)=>{
      this.setState({tokens:r})
    })
  }
}
