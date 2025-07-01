// @ts-nocheck
import * as React from 'react';

export class BottomArea extends React.Component {
  render() {    
    return (
      <>
        <a href="http://www.qutat.org">공식 홈페이지 : https://www.qutat.org </a>
        이용 문의 : jaehak@qutat.org
      </>
      );
  }

  constructor(props) {
    super(props);
    this.state = { };
  }

  componentDidMount() { }

}



