// @ts-nocheck
import type { NextPage } from 'next'
import * as React from 'react';


const LandingPage: NextPage = () => {
   return (
      <Main/>
  )
}

export default LandingPage

class Main extends React.Component {
  render(){
    return (
      <div id="signup-page">          
          인증 메일이 발송되었습니다. 메일을 확인해주세요.<p/>
          <a href="/">홈으로</a>
      </div>
    )  
  }

  constructor(props) {
    super(props);
    this.state = {
      email:"",
      password1:"",
      password2:"",
      errormsg:"",
    };
  }
  componentDidMount() { }
}

