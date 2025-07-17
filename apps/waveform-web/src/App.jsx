import React, { useState } from 'react';
import { Container, Content, Sidebar, Button } from 'rsuite';
import { useLocation, matchPath, useNavigate } from 'react-router-dom';


import 'rsuite/dist/rsuite.min.css';
import "./App.less";

function App() {

  return (
    <Container style={{ whiteSpace: "pre-wrap", minWidth: "800px", minHeight: "500px" }}>      
      <Sidebar style={{ minWidth: "500px" }}>

      </Sidebar>
      <Content>

      </Content>
    </Container>
  );
}

export default App;





