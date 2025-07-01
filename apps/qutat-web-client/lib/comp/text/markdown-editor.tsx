// @ts-nocheck
import * as React from 'react';

import { Grid, Button, TextField} from '@mui/material';

import { postSetData, putSetData} from 'core/network/auth/auth';
import { renderListIfExists } from 'core/ui/rendering'
import { MarkDownViewer } from './markdown-viewer';

export class MarkDownEditor extends React.Component {
  render(){
    const {
      initValue,
      imageUploadUrl,
      submitApi,
    } = this.props
    return (
    <div>
      <p/>
      <Button onClick={()=>{this.setState({previewMode:false})}}>코드보기</Button>
      <Button onClick={()=>{this.setState({previewMode:true})}}>미리보기</Button>
    {this.state.previewMode?
    <>
    <hr/>
      <MarkDownViewer text = {this.state.text} />
    <hr/>
    </>:
      <>
        <TextField fullWidth multiline={true} rows={20}
          value={this.state.text}
          onChange={
            (e)=>{
              if (this.props.onChange){this.props.onChange(e.target.value)}
              this.setState({text:e.target.value})}
            }
          onDragOver={(e)=>{this.handleDragOver(e)}}
          onDrop={(e)=>{this.handleDrop(e, imageUploadUrl)}}
           />

      <p/>
        {renderListIfExists(this.state.imageFiles,([key, url])=>{
          return (<img key={key} src={url} width={50}/>)
        })}
      <p/>
    </>
    }
    {this.props.submitApi?
      <Button onClick={()=>{this.submitText(submitApi[0],submitApi[1])}}>업데이트</Button>
      :null}
      <p/>
    </div>)}

  constructor(props) {
    super(props);
    this.state = {
      text:"",      
      imageFiles:[],
      previewMode:false,
    };
  }

  componentDidMount() {
    this.setState({text:this.props.initValue})
  }

  submitText(url, dbkey){
    putSetData(url,{[dbkey]:this.state.text},
      (d)=>{
        window.location.reload()
      }
    )
  }

  handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  handleDrop(e, imageUploadUrl) {
    e.preventDefault();
    e.stopPropagation();
    const { files } = e.dataTransfer;
    postSetData(imageUploadUrl,files,
      (d)=>{this.setImageUrls(d.urls)},'form'
    )
  }

  setImageUrls = (urls)=>{
    this.setState({imageFiles:[...this.state.imageFiles, ...urls] })
    var urlText = ""
    urls.map((url)=>{urlText += "\n![img]("+url+")"})      
    this.setState({text:this.state.text+"\n"+urlText})
  }

}