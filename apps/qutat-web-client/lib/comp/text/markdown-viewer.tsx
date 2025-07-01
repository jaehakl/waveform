// @ts-nocheck
import * as React from 'react';
import ReactMarkdown from 'react-markdown'

export class MarkDownViewer extends React.Component {
  render(){  
    return (
      <ReactMarkdown                 
        components={{img: ({node, ...props}) => <img style={{maxWidth: '90%'}}
          {...props} alt=""/>}}
        children={this.props.text} />
    )
  }
}