// @ts-nocheck
import React, { useState, PropsWithChildren } from "react";

import { TopArea } from './topArea'
import { LeftArea } from './leftArea'
import { RightArea } from './rightArea'
import { BottomArea } from './bottomArea'

const Layout = ({ children }: PropsWithChildren) => {
  if (children.type.name =="LandingPage") {
    return (
      <>
        { children }
      </>
    )
  } else {
    const [ isToggled, toggle ] = useState(false);
    return (
      <>
        <TopArea toggleBtnClicked={()=>{toggle(!isToggled)}}/>
        {/*
        <div className={isToggled?"left-area":"left-area-toggled"}>
          <LeftArea/>
          </div>
        */}
        {/*<div className="right-area">
          <RightArea/>   
          </div>*/}
        {/*<div className="bottom-area">
          <BottomArea/>
        </div>*/}
        <div className={isToggled?"main-area":"main-area-toggled"}>        
          { children }
          </div>
      </>
    )  
  }
}

export default Layout
