// @ts-nocheck
import * as React from 'react';
import { Grid } from '@mui/material';

import type { NextPage } from 'next'
import Link from 'next/link'

import Layout from 'layout/layout';

import { getSetData } from 'core/network/auth/auth';
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
        {/*
        <Grid container>
          <h1>Worker Nodes</h1>
          {Object.keys(this.state.workerSessionList).map((k)=>{
            return (
              <div>
                {k}
                <ul key = {k}>
                  {Object.keys(this.state.workerSessionList[k]).map((kk)=>{
                    return (
                      <>
                      {(kk=="id")?null:
                        <li key = {kk}>
                        {kk} : {this.state.workerSessionList[k][kk]}
                      </li>}
                      </>
                    )
                  })
                  }
                </ul>
              </div>
            )})}
        </Grid>
        <Grid container>
          <h1>Processes</h1>
          {Object.keys(this.state.processList).map((k)=>{
            return (
              <div>
                {k}
                <ul key = {k}>
                  {Object.keys(this.state.processList[k]).map((kk)=>{
                    return (
                      <li key = {kk}>
                        {kk} : {this.state.processList[k][kk]}
                      </li>
                    )
                  })
                  }
                </ul>
              </div>
            )})}
        </Grid>
        */}

        <Grid width="100%" align="center" padding={1}>
          <h1>My Simulations</h1>
        </Grid>
        <Grid width="100%" align="center">
        {renderListIfExists(this.state.taskList, ([key, task])=>{ return( 
            <Grid container width="100%" key={key} border={0.1} borderColor="gray" padding={1}>
            <Link href={"/setup/data/"+task.id+"/"}>
              <Grid style={{ display: "flex", alignItems: "center" }}>
                <img width="100px" src={task.thumbnail}/>
                &nbsp;&nbsp;&nbsp;&nbsp;<b>{task.title}</b>
              </Grid>
            </Link>
          </Grid>)})}
        </Grid>
        {/*
        <h1>Output Data</h1>
        {Object.keys(this.state.dataList).map((k)=>{
          return (
            <div>
              <Link href={APP_URL+"/output/data/"+this.state.dataList[k]['id']+"/"}>
              {k}
              <ul key = {k}>
                {Object.keys(this.state.dataList[k]).map((kk)=>{
                  return (
                    <li key = {kk}>
                      {kk} : {this.state.dataList[k][kk]}
                    </li>
                  )
                })
                }
              </ul>
              </Link>
            </div>
          )})}          
        */}
        </Grid>
    )
  }

  constructor(props) {
    super(props);
    this.state = {
      workerSessionList:[{Status:"Loading Worker Session list ..."}],      
      processList:[{Status:"Loading Process list ..."}],      
      taskList:[{Status:"Loading Task list ..."}],
      dataList:[{Status:"Loading Data list ..."}],
    };
  }

  componentDidMount() {
    getSetData(BACKAPI.model_setup("1000_0"),
      (d)=>{
        this.setState({taskList:d})
      })
  }
}


