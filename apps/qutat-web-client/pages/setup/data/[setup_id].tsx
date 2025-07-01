// @ts-nocheck
import * as React from 'react';

import { Grid, Button, Checkbox, TextField } from '@mui/material';

import type { NextPage } from 'next'
import Link from 'next/link'
import { useRouter } from 'next/router'

import Layout from '/layout/layout'

import { getSetData, putSetData, deleteSetData } from 'core/network/auth/auth';
import { renderIfExists, renderListIfExists } from 'core/ui/rendering'

import { Experiment3D } from "lib/comp/experiment3D";
import { MarkDownEditViewer } from 'lib/comp/text/markdown';

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
              <p/>
              Solver : {this.state.setupData.solver}
            </Grid>

{/* Management */}
            <Grid width="100%" align="right" margin={2}>
              <Checkbox
                checked={this.state.setupData.public}
                onChange={()=>{this.togglePublic(this.props.setup_id)}}
              /> 공유 &nbsp;
              <TextField
                onChange={(e)=>{this.setState({numAddInput:e.target.value})}}                
                value={this.state.numAddInput}                
              />
              <Button 
                onClick={()=>{this.generateInput(this.props.setup_id)}}>작업 요청</Button> &nbsp;
                {this.state.setupData.work_request} &nbsp;

                <p/>
                <table>
                {this.state.processList.length>0?
                  <>
                    <h5>Current Processes</h5>
                      <tr>
                         <th>No.</th>
                         <th>Entity Name</th>
                         <th>Process IP</th>
                         <th>Elapsed Time</th> 
                         {/* <th>Status</th> */}
                         {/*<th>Preview</th>*/}
                     </tr>
                     </>
                    :null}
                {renderListIfExists(this.state.processList, ([key, process])=>{
                  return ( <tr>
                      <td align="center">{key}</td>
                      <td align="center">{process.input.title} s</td>
                      <td align="center">{process.ip_address}</td>
                      <td align="center">{process.time_elapsed} s</td>
                      {/* <td align="center">{process.status}</td> */}
                      {/*<td align="center"><img src={process.preview} width={200}/></td>*/}
                  </tr>)
                }) }
                  </table>
                  <p/>
                <table>
                {this.state.inputRemainList.length>0?
                  <>
                    <h5>Remain Tasks</h5>
                      <tr>
                         <th>No.</th>
                         <th>Entity Name</th>
                         <th>Created Time</th> 
                         {/* <th>Status</th> */}
                         {/*<th>Preview</th>*/}
                     </tr>
                     </>
                    :null}
                {renderListIfExists(this.state.inputRemainList, ([key, input])=>{
                  return ( <tr>
                      <td align="center">{key}</td>
                      <td align="center">{input.title}</td>
                      <td align="center">{input.created_at} s</td>
                      {/* <td align="center">{process.status}</td> */}
                      {/*<td align="center"><img src={process.preview} width={200}/></td>*/}
                  </tr>)
                }) }
                  </table>

                <p/>
              <Button variant="contained"
                onClick={()=>{window.location.href = "/setup/editor/"+this.props.setup_id+"/"}}
                > 편집 </Button>  &nbsp; 
              <Button variant="contained" color="error"
                onClick={()=>{this.deleteSetupData(this.props.setup_id)}}
                > 삭제 </Button>
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
              <h3>Description</h3>
              <MarkDownEditViewer
                text={this.state.setupData.description}                                
                imageUploadUrl={BACKAPI.image_upload()}
                submitApi={[BACKAPI.model_setup(this.props.setup_id), "description"]}
              />
            </Grid>
            <p/>

{/* Results */}
            {renderIfExists(this.state.inputList, (d)=>{return (
              <Grid width="100%" align="center"><h2>Results</h2></Grid>)})}
            {renderListIfExists(this.state.inputList, ([key, input])=>{
              if (input.results_exist == false){
                return null
              } else {
                return (
                  <Grid key={key} width="100%" align="center">
                    <Link href={"/output/data/"+input.id}>
                      {/*<img src={input.thumbnail} width={200}/><p/>*/}
                      {key} | {input.id} | {input.title}
                    </Link>    
                  </Grid>)    
              }
            }) }
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
      numAddInput:1,
      processList:[],
      inputRemainList:[],
      inputList:[],
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
    getSetData(BACKAPI.setup_tasks(this.props.setup_id),
    (tasks_remain)=>{
      this.setState({inputRemainList:tasks_remain['inputs']})
      this.setState({processList:tasks_remain['processes']})
    })
  }

  togglePublic(setup_id:string){
    putSetData(BACKAPI.model_setup(setup_id),
    {public:!this.state.setupData.public},
    (d)=>{
      window.location.reload()
    })
  }

  generateInput(setup_id:string){
    getSetData(BACKAPI.input_generate(setup_id,this.state.numAddInput),
    (item_id_list)=>{      
      const new_input_id = item_id_list[0]
      window.location.reload()
    })
  }

  deleteSetupData(setup_id:string){
    deleteSetData(BACKAPI.model_setup(setup_id),
    (d)=>{
      window.location.href = "/home"
    })
  }

}