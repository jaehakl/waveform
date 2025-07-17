import React from 'react';
import { Container, Content, Panel } from 'rsuite';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';

import 'rsuite/dist/rsuite.min.css';
import "./App.less";

function App() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="app-container">
      <Navbar />
      <Container className="main-container">
        <Content>
          {isAuthenticated ? (
            <Panel header="환영합니다!">
              <p>안녕하세요, {user.name}님!</p>
              <p>로그인이 성공적으로 완료되었습니다.</p>
              <p>여기에 메인 애플리케이션 콘텐츠가 들어갑니다.</p>
            </Panel>
          ) : (
            <Panel header="로그인이 필요합니다">
              <p>애플리케이션을 사용하려면 상단의 로그인 버튼을 클릭해주세요.</p>
            </Panel>
          )}
        </Content>
      </Container>
    </div>
  );
}

export default App;





