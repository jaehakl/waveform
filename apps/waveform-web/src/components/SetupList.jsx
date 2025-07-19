import React, { useState, useEffect } from 'react';
import { Panel, List, Button, IconButton, Message } from 'rsuite';
import { getSetupList } from '../api/api';
import { Plus } from '@rsuite/icons';

const SetupList = ({ onSetupSelect, onNewSetup }) => {
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSetupId, setSelectedSetupId] = useState(null);

  // Setup 목록 조회
  const fetchSetups = async () => {
    setLoading(true);
    try {
      const response = await getSetupList();
      if (response.data.success) {
        setSetups(response.data.setups);
      } else {
        Message.error(response.data.message || 'Setup 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Setup 목록 조회 중 오류:', error);
      Message.error('Setup 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 Setup 목록 조회
  useEffect(() => {
    fetchSetups();
  }, []);

  // Setup 선택 핸들러
  const handleSetupSelect = (setup) => {
    setSelectedSetupId(setup.id);
    onSetupSelect(setup);
  };

  // 새 Setup 생성 핸들러
  const handleNewSetup = () => {
    setSelectedSetupId(null);
    onNewSetup();
  };

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Panel header="Setup 목록" style={{ height: '100%' }}>
      <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          appearance="primary" 
          size="sm" 
          onClick={handleNewSetup}
          startIcon={<Plus />}
        >
          새 Setup
        </Button>
        <Button 
          size="sm" 
          onClick={fetchSetups}
          loading={loading}
          title="새로고침"
        >
          새로고침
        </Button>
      </div>

      <div style={{ height: 'calc(100% - 60px)', overflowY: 'auto' }}>
        {setups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            {loading ? '로딩 중...' : '저장된 Setup이 없습니다.'}
          </div>
        ) : (
          <List>
            {setups.map((setup) => (
              <List.Item
                key={setup.id}
                style={{
                  cursor: 'pointer',
                  padding: '10px',
                  border: selectedSetupId === setup.id ? '2px solid #1675e0' : '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  backgroundColor: selectedSetupId === setup.id ? '#f0f8ff' : 'white'
                }}
                onClick={() => handleSetupSelect(setup)}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  {setup.title}
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                  Solver: {setup.solver.toUpperCase()}
                  {setup.public && (
                    <span style={{ marginLeft: '8px', color: '#1675e0' }}>
                      공개
                    </span>
                  )}
                </div>
                {setup.description && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    {setup.description.length > 50 
                      ? `${setup.description.substring(0, 50)}...` 
                      : setup.description
                    }
                  </div>
                )}
                <div style={{ fontSize: '11px', color: '#999' }}>
                  {formatDate(setup.created_at)}
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </div>
    </Panel>
  );
};

export default SetupList; 