// @ts-nocheck
import * as React from 'react';
import { Grid } from '@mui/material';

import type { NextPage } from 'next'
import Link from 'next/link'

import Layout from 'layout/layout';

import { getSetData, postSetData} from 'core/network/auth/auth';
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
      <Grid container>
        <Grid width="100%" align="center" padding={1}>
          <h1> Library </h1>
        </Grid>          
        <Grid width="100%" align="center">
        {renderListIfExists(this.state.setupList, ([key, setup])=>{ return(
          <>
            <Grid container width="100%" key={key} border={0.1} borderColor="gray" padding={1}>
            <Link href={"/setup/shared-data/"+setup.id+"/"}>
              <Grid style={{ display: "flex", alignItems: "center" }}>
                <img width="100px" src={setup.thumbnail}/>
                &nbsp;&nbsp;&nbsp;&nbsp;<b>{setup.title}</b>
              </Grid>
            </Link>
          </Grid>  
          </>
        )},()=>{return <></>}
        )}
        </Grid>          
      </Grid>
    )
  }

  constructor(props) {
    super(props);
    this.state = {
      setupList:[{Status:"Loading Shared Setup Data list ..."}],
    };
  }

  componentDidMount() {
    getSetData(BACKAPI.public_setup_list(),
      (d)=>{
        this.setState({setupList:d})
      })
  }
}


