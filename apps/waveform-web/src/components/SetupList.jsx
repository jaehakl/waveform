import React, { useState, useEffect } from 'react';
import { Panel, List, Button, IconButton, Modal } from 'rsuite';
import { getSetupList, deleteSetup } from '../api/api';
import { Plus } from '@rsuite/icons';
import './SetupList.less';

const SetupList = ({ onSetupSelect, onNewSetup, refreshKey }) => {
  const [setups, setSetups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSetupId, setSelectedSetupId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [setupToDelete, setSetupToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Setup 목록 조회
  const fetchSetups = async () => {
    setLoading(true);
    try {
      const response = await getSetupList();
      if (response.data.success) {
        setSetups(response.data.setups);
      } else {
        console.error(response.data.message || 'Setup 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('Setup 목록 조회 중 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 및 refreshKey 변경 시 Setup 목록 조회
  useEffect(() => {
    fetchSetups();
  }, [refreshKey]);

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

  // 삭제 확인 모달 열기
  const handleDeleteClick = (setup, e) => {
    e.stopPropagation(); // 이벤트 버블링 방지
    setSetupToDelete(setup);
    setDeleteModalOpen(true);
  };

  // Setup 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!setupToDelete) return;

    setDeleting(true);
    try {
      const response = await deleteSetup(setupToDelete.id);
      if (response.data.success) {
        // 삭제된 Setup이 현재 선택된 Setup이면 선택 해제
        if (selectedSetupId === setupToDelete.id) {
          setSelectedSetupId(null);
          onNewSetup();
        }
        
        // 목록 새로고침
        fetchSetups();
      } else {
        alert(response.data.message || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Setup 삭제 중 오류:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setSetupToDelete(null);
    }
  };

  // 삭제 취소
  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setSetupToDelete(null);
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
    <Panel header="Setup 목록" className="setup-list">
      <div className="header-actions">
        <Button 
          appearance="primary" 
          size="sm" 
          onClick={handleNewSetup}
          startIcon={<Plus />}
          className="new-setup-button"
        >
          새 Setup
        </Button>
        <Button 
          size="sm" 
          onClick={fetchSetups}
          loading={loading}
          title="새로고침"
          className="refresh-button"
        >
          새로고침
        </Button>
      </div>

      <div className="setup-list-container">
        {setups.length === 0 ? (
          <div className="empty-state">
            {loading ? '로딩 중...' : '저장된 Setup이 없습니다.'}
          </div>
        ) : (
          <List>
            {setups.map((setup) => (
              <List.Item
                key={setup.id}
                className={`setup-item ${selectedSetupId === setup.id ? 'selected' : ''}`}
                onClick={() => handleSetupSelect(setup)}
              >
                <div className="setup-title">
                  {setup.title}
                </div>
                <div className="setup-solver">
                  Solver: {setup.solver.toUpperCase()}
                  {setup.public && (
                    <span className="public-badge">
                      공개
                    </span>
                  )}
                </div>
                {setup.description && (
                  <div className="setup-description">
                    {setup.description.length > 50 
                      ? `${setup.description.substring(0, 50)}...` 
                      : setup.description
                    }
                  </div>
                )}
                <div className="setup-date">
                  {formatDate(setup.created_at)}
                </div>
                <div className="setup-actions">
                  <Button 
                    size="xs" 
                    color="red" 
                    appearance="ghost"
                    onClick={(e) => handleDeleteClick(setup, e)}
                    className="delete-button"
                  >
                    삭제
                  </Button>
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      <Modal open={deleteModalOpen} onClose={handleDeleteCancel} className="delete-modal">
        <Modal.Header>
          <Modal.Title>Setup 삭제 확인</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>"{setupToDelete?.title}"</strong> Setup을 삭제하시겠습니까?
          </p>
          <p className="warning-text">
            이 작업은 되돌릴 수 없습니다.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            onClick={handleDeleteCancel} 
            appearance="subtle"
            className="cancel-button"
          >
            취소
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="red" 
            loading={deleting}
            disabled={deleting}
            className="confirm-delete-button"
          >
            삭제
          </Button>
        </Modal.Footer>
      </Modal>
    </Panel>
  );
};

export default SetupList; 