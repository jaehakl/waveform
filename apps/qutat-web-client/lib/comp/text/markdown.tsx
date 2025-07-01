// @ts-nocheck
import * as React from 'react';

import { Button} from '@mui/material';

import { MarkDownEditor } from './markdown-editor';
import { MarkDownViewer } from './markdown-viewer';

export class MarkDownEditViewer extends React.Component {
  render(){  
    const {
      text,
      onChange,
      imageUploadUrl,
      submitApi
    } = this.props  
    return (
      <>
        {this.state.isEditing?
          <>
            <Button onClick={()=>{this.setState({isEditing:false})}}>편집 취소</Button>
            <MarkDownEditor
              initValue={text}
              onChange={onChange}
              imageUploadUrl={imageUploadUrl}
              submitApi={submitApi}
            />
          </>
          :
          <>
            <Button onClick={()=>{this.setState({isEditing:true})}}>편집</Button>
            <MarkDownViewer text = {text} /> <p/>  
          </>}
      </>
    )
  }

  constructor(props) {
    super(props);
    this.state = {
      isEditing:false,
    };
  }

  componentDidMount() {

  }
}