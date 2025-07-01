// @ts-nocheck
import * as React from 'react';

import { Grid, Button } from '@mui/material';

import type { NextPage } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'

import Layout from 'layout/layout'

import { getSetData } from 'core/network/auth/auth';
import { renderIfExists, renderListIfExists } from 'core/ui/rendering'

import { Experiment3D } from "lib/comp/experiment3D";
import { MarkDownViewer } from 'lib/comp/text/markdown-viewer';

import * as BACKAPI from 'backend_api'

const QutatPage: NextPage = () => {
  const router = useRouter()

  if (router.query.setup_id == undefined){
    return (
      <div>
        <h1>Setup ID is not defined</h1>
      </div>
    ) } else {
      return (
          <Layout>            
            <Main setup_id = {router.query.setup_id}/>
          </Layout>
      )
    }
}

export default QutatPage

class Main extends React.Component {
  render(){  
    return (
      <Grid container paddingLeft={2} paddingRight={2}> {
        renderIfExists(this.state.setupData.title, (d)=>{return (
          <>
{/* Title */}
            <Grid width="100%" align="center">
              <h1>{this.state.setupData.title}</h1>
              Author : {this.state.setupData.user}
            </Grid>

{/* Management */}
            <Grid width="100%" align="right" margin={2}>
            <Button variant="contained"
                onClick={()=>{window.location.href = "/setup/editor/"+this.props.setup_id+"/"}}
                > 편집 </Button>  &nbsp; 
            </Grid>

{/* Structure */}
            <Grid width="100%" align="center"> 
           {
              renderIfExists(this.state.setupData.setup_data, (d)=>{
                const width = Math.min(window.innerWidth-50, 800)
                //console.log(width)
                return (
                <Grid width={width+10} border={1}> 
                    <Experiment3D id="experiment3D" 
                      width={width} height={width*3/4}
                      setupData={this.state.setupData.setup_data}
                    /> 
                </Grid> 
                )}) }
              </Grid> 
            <p/>

{/* Description */}
            <Grid width="100%">
              <MarkDownViewer
                text={this.state.setupData.description}                                
              />
            </Grid>
            <p/>

          </>                        
          )}  )
      }
      </Grid>
    )
  }

  constructor(props) {
    super(props);
    this.state = {
      setupData:{setup_data:{}},      
      isDescriptionEditing:false,
      editedDescription:"",
      inputList:[],

      imageFiles : [],
    };
  }

  componentDidMount() {
    getSetData(BACKAPI.setup_data(this.props.setup_id),
    (d)=>{      
      this.setState({setupData:d},        
        ()=>{this.setState({editedDescription:this.state.setupData.description})})    
    })
    getSetData(BACKAPI.results(this.props.setup_id),
    (d)=>{
      this.setState({inputList:d})
    })
  }


}