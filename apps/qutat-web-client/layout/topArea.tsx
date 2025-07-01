// @ts-nocheck
import { Grid } from '@mui/material';
import * as React from 'react';
import Link from 'next/link';
import { COMPANY_URL,  APP_URL } from 'config'

export class TopArea extends React.Component {
  render() {
    
    return (
        <Grid container sx={{
          padding:2 ,
          color:"white",
          backgroundColor:"#009FE8",          
          borderBottom:"1px solid #e0e0e0",
          boxShadow:"0px 1px 5px 0px rgba(0,0,0,0.1)",                  
          }}
        >
          <Grid item width='20%'>
            <Link href={"/home"}><b>Home</b></Link> &nbsp; &nbsp;
          </Grid>
          <Grid item width='80%' align='right'>
            <Link href={"/setup/share"}><b>Library</b></Link>&nbsp;&nbsp;&nbsp;&nbsp;
            <Link href={"/account"}><b>Account</b></Link> &nbsp;&nbsp;&nbsp;
            {/*<Link href={COMPANY_URL}><b>Waveform</b></Link> &nbsp;*/}
          </Grid>
        </Grid>
      );
  }

  constructor(props) {
    super(props);
    this.state = { };
  }

  componentDidMount() {

  }


}



