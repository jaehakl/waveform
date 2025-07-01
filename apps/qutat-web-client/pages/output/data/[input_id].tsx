// @ts-nocheck
import * as React from 'react';

import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Link from 'next/link'

import { Grid, Button, TextField} from '@mui/material';

import { create, all } from 'mathjs'
const config = { }
const math = create(all, config)

import dynamic from 'next/dynamic';
const Plot = dynamic(()=>import('react-plotly.js'),{ssr:false})

import { getSetData, postSetData, putSetData, deleteSetData} from 'core/network/auth/auth';
import { renderIfExists, renderListIfExists } from 'core/ui/rendering'

import Layout from '/layout/layout';

import { MarkDownEditViewer } from 'lib/comp/text/markdown';
import { Experiment3D } from "lib/comp/experiment3D";

import * as BACKAPI from 'backend_api'

const QutatPage: NextPage = () => {
  const router = useRouter()

  if (router.query.input_id == undefined){
    return (
      <div>
        <h1>Entity ID is not defined</h1>
      </div>
    ) } else {
      return (
        <Layout>
          <Main input_id = {router.query.input_id}/>
        </Layout>
      )
    }
}

export default QutatPage

class Main extends React.Component {
  render(){
    return (
      <div>
        <Grid width="100%" align="center">
          <h1>{this.state.inputData.title}</h1>        
          Author : {this.state.inputData.user}
        </Grid>

        <Grid width="100%" align="right" marginBottom={1}>
          {this.state.inputData.public?
          <Button variant="contained"
            onClick={()=>{this.togglePublic(this.props.input_id)}}
          >데이터 공유 해제 (현재 공유중)</Button>
          :
          <Button variant="outlined"
            onClick={()=>{this.togglePublic(this.props.input_id)}}
          >공유 (현재 공유중이 아님)</Button>
          } &nbsp;            
          <Button variant="outlined" color="error"
            onClick={()=>{this.deleteInputData(this.props.input_id)}}
            > 삭제 </Button>
        </Grid>


{/* Description */}
      <Grid width="100%" padding = {3}>
        <h1>Description</h1>
          <MarkDownEditViewer
            text={this.state.inputData.description}                                
            imageUploadUrl={BACKAPI.image_upload()}
            submitApi={[BACKAPI.model_input(this.props.input_id),"description"]}
          />
        </Grid>

      <Grid width="100%" padding = {3}>      
          <Link href={"/setup/data/"+this.state.inputData.setup}>
            <h1>Setup</h1>
              <h3>{this.state.inputData.input_title}</h3>
          </Link><p/>
          <Grid item sm={12} padding={1} align="center">
              {
                  renderIfExists(this.state.inputData.setup_data, (d)=>{
                    var width = Math.min(window.innerWidth-50, 900)
                    return (
                    <Grid width={width+10} border={1}> 
                        <Experiment3D id="experiment3D" 
                          width={width} height={width*3/4}
                          setupData={this.state.inputData.setup_data}
                        /> 
                    </Grid> 
                    )}) }
          </Grid>

        </Grid>

        {renderIfExists(this.state.inputData.images, 
          (d)=>{return <h2>Images</h2>})}        
        <Grid container width="100%" padding = {3}>  
        {renderListIfExists(this.state.inputData.images, 
          ([key, d])=>{return <Grid item md={6} lg={4} xl={3} padding={1}>
            <h3>{key}</h3>
            <img key={key} src={d} width={300}/>
          </Grid>
          })}
        </Grid>
        <Grid width="100%" padding = {3}> 
        {renderIfExists(this.state.inputData.data, 
          (d)=>{return <h2>Output</h2>})}
        {renderListIfExists(this.state.inputData.data, ([key, fileData])=>{return (
          <Grid container key={key}> {
            renderListIfExists(fileData, ([name, data])=>{return (
            <Grid key={name} align="center" marginBottom={1}>
              <h3>{name}</h3>
              <Plot layout={{width:300}}
                data={[{x: Object.values(data.labels[0]),
                y: Object.values(data.data), type: 'line',}]}/>
            </Grid>)})}
          </Grid>)})}                         
        </Grid>



      </div>
    )
  }

  constructor(props) {
    super(props);
    this.state = {
      inputData:{
      }
    };
  }

  componentDidMount() {
    getSetData(BACKAPI.entity_data(this.props.input_id),
    (d)=>{
      this.setState({inputData:d})
    })
  }

  togglePublic(input_id:string){
    putSetData(BACKAPI.model_input(input_id),
      {"public":!this.state.inputData.public},
    (d)=>{
      window.location.reload()
    })
  }

  deleteInputData(input_id:string){
    deleteSetData(BACKAPI.model_input(input_id),
    (d)=>{
      window.location.href = "/setup/data/"+this.state.inputData.setup
    })
  }


}
