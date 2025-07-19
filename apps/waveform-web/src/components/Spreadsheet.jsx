import React, { useState, useCallback, useRef } from 'react';
import { Input } from 'rsuite';
import './Spreadsheet.less';

const Spreadsheet = ({ 
  initialData = [], 
  rowOptions = {
    "Type A":{
      "Type A-1":{
        "Type A-1-a":["value1","value2","value3","value4","value5","value6"],
      }
    }
  },
  rows = 10, 
  cols = 6, 
  columnNames = [],
  onDataChange,
  width = 800,
  height = 400,
  onResize
}) => {
  const [data, setData] = useState(() => {
    if (initialData.length > 0) {
      return initialData;
    }
    // 빈 데이터로 초기화 (2차원 배열)
    const emptyData = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        row.push('');
      }
      emptyData.push(row);
    }
    return emptyData;
  });

  // initialData가 변경될 때 data 상태 업데이트
  React.useEffect(() => {
    if (initialData.length > 0) {
      setData(initialData);
    }
  }, [initialData]);

  const [currentCols, setCurrentCols] = useState(cols);
  const [defaultRowValue] = useState('새 데이터');
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, rowId: null });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [currentWidth, setCurrentWidth] = useState(width);
  const [currentHeight, setCurrentHeight] = useState(height);
  const [columnWidths, setColumnWidths] = useState(() => 
    Array.from({ length: cols }, () => 50)
  );
  const [isResizingColumn, setIsResizingColumn] = useState(false);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // 드롭다운 외부 클릭 시 닫기
  const closeDropdown = useCallback(() => {
    setShowDropdown(false);
    setHoveredCategory(null);
    setActiveDropdown(null);
  }, []);

  // 컨텍스트 메뉴 닫기
  const closeContextMenu = useCallback(() => {
    setContextMenu({ show: false, x: 0, y: 0, rowId: null });
  }, []);

  // 리사이즈 시작
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: currentWidth,
      height: currentHeight
    });
  }, [currentWidth, currentHeight]);

  // 리사이즈 중
  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    
    const newWidth = Math.max(400, resizeStart.width + deltaX);
    const newHeight = Math.max(300, resizeStart.height + deltaY);
    
    setCurrentWidth(newWidth);
    setCurrentHeight(newHeight);
    
    // 부모 컴포넌트에 크기 변경 알림
    if (onResize) {
      onResize(newWidth, newHeight);
    }
  }, [isResizing, resizeStart, onResize]);

  // 리사이즈 종료
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 컬럼 리사이즈 시작
  const handleColumnResizeStart = useCallback((e, columnIndex) => {
    e.preventDefault();
    setIsResizingColumn(true);
    setResizingColumn(columnIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[columnIndex]);
  }, [columnWidths]);

  // 컬럼 리사이즈 중
  const handleColumnResizeMove = useCallback((e) => {
    if (!isResizingColumn || resizingColumn === null) return;
    
    const deltaX = e.clientX - resizeStartX;
    const newWidth = Math.max(60, resizeStartWidth + deltaX);
    
    const newColumnWidths = [...columnWidths];
    newColumnWidths[resizingColumn] = newWidth;
    setColumnWidths(newColumnWidths);
  }, [isResizingColumn, resizingColumn, resizeStartX, resizeStartWidth, columnWidths]);

  // 컬럼 리사이즈 종료
  const handleColumnResizeEnd = useCallback(() => {
    setIsResizingColumn(false);
    setResizingColumn(null);
  }, []);

  // 전역 마우스 이벤트 리스너 추가
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // 컬럼 리사이즈를 위한 전역 마우스 이벤트 리스너
  React.useEffect(() => {
    if (isResizingColumn) {
      document.addEventListener('mousemove', handleColumnResizeMove);
      document.addEventListener('mouseup', handleColumnResizeEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleColumnResizeMove);
        document.removeEventListener('mouseup', handleColumnResizeEnd);
      };
    }
  }, [isResizingColumn, handleColumnResizeMove, handleColumnResizeEnd]);

  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef(null);

  // 셀 편집 시작
  const handleCellClick = useCallback((rowIndex, colIndex) => {
    setEditingCell({ rowIndex, colIndex });
    setEditValue(data[rowIndex][colIndex] || '');
  }, [data]);

  // 행 우클릭 시 컨텍스트 메뉴 표시
  const handleRowContextMenu = useCallback((e, rowIndex) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      rowId: rowIndex
    });
  }, []);

  // 특정 행 삭제
  const removeSpecificRow = useCallback((rowIndex) => {
    const newData = data.filter((_, index) => index !== rowIndex);
    setData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
    closeContextMenu();
  }, [data, onDataChange, closeContextMenu]);

  // 셀 편집 완료
  const handleCellEdit = useCallback((rowIndex, colIndex, value) => {
    const newData = [...data];
    newData[rowIndex] = [...newData[rowIndex]];
    newData[rowIndex][colIndex] = value;
    setData(newData);
    setEditingCell(null);
    setEditValue('');
    if (onDataChange) {
      onDataChange(newData);
    }
  }, [data, onDataChange]);

  // Enter 키로 편집 완료
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingCell) {
        handleCellEdit(editingCell.rowIndex, editingCell.colIndex, editValue);
      }
    }
  }, [editingCell, editValue, handleCellEdit]);

  // 카테고리별 행 추가
  const addRowWithData = useCallback((values) => {
    const newRow = [];
    for (let j = 0; j < currentCols; j++) {
      newRow.push(values[j] || defaultRowValue);
    }
    const newData = [...data, newRow];
    setData(newData);
    if (onDataChange) {
      onDataChange(newData);
    }
    closeDropdown();
  }, [data, currentCols, defaultRowValue, onDataChange, closeDropdown]);

  // 드롭다운 토글
  const toggleDropdown = useCallback((category) => {
    if (activeDropdown === category) {
      setShowDropdown(false);
      setActiveDropdown(null);
      setHoveredCategory(null);
    } else {
      setShowDropdown(true);
      setActiveDropdown(category);
      setHoveredCategory(null);
    }
  }, [activeDropdown]);

  // 데이터 내보내기 (클립보드 복사)
  const copyToClipboard = useCallback(async () => {
    try {
      const headers = columnNames.length > 0 
        ? columnNames 
        : Array.from({ length: currentCols }, (_, i) => `Column ${i + 1}`);
      
      const tsvContent = [
        headers.join('\t'),
        ...data.map(row => 
          Array.from({ length: currentCols }, (_, i) => 
            row[i] || ''
          ).join('\t')
        )
      ].join('\n');

      await navigator.clipboard.writeText(tsvContent);
    } catch (error) {
      console.error('클립보드 복사 실패:', error);
    }
  }, [data, currentCols, columnNames]);

  // 데이터 가져오기 (클립보드 붙여넣기)
  const pasteFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const lines = clipboardText.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return;
      }

      const headers = lines[0].split('\t');
      const newData = lines.slice(1).map((line) => {
        const values = line.split('\t');
        const row = [];
        headers.forEach((_, i) => {
          row.push(values[i] || '');
        });
        return row;
      });

      setData(newData);
      setCurrentCols(headers.length);
      
      // 새로운 컬럼에 대한 기본 너비 설정
      if (headers.length > columnWidths.length) {
        const newColumnWidths = [...columnWidths];
        for (let i = columnWidths.length; i < headers.length; i++) {
          newColumnWidths.push(50);
        }
        setColumnWidths(newColumnWidths);
      }
      
      if (onDataChange) {
        onDataChange(newData);
      }
    } catch (error) {
      console.error('클립보드 붙여넣기 실패:', error);
    }
  }, [onDataChange, columnWidths]);

  // 동적 컬럼 생성
  const columns = Array.from({ length: currentCols }, (_, i) => ({
    key: i,
    label: columnNames[i] || `Column ${i + 1}`,
    width: columnWidths[i] || 50,
    resizable: true
  }));

  return (
    <div className="spreadsheet-container" style={{ width: currentWidth, height: currentHeight }} onClick={closeDropdown}>
      <div className="spreadsheet-toolbar">
        <div className="dropdown-group">
          {Object.keys(rowOptions).map(category => (
            <div key={category} className="dropdown-container">
              <button 
                className="dropdown-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDropdown(category);
                }}
                title={`${category} 선택`}
              >
                {category} ▼
              </button>
              {showDropdown && activeDropdown === category && (
                <div className="dropdown-menu">
                  {Object.keys(rowOptions[category]).map(subCategory => (
                    <div 
                      key={subCategory}
                      className="dropdown-item"
                      onMouseEnter={() => setHoveredCategory(subCategory)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      {subCategory}
                      {hoveredCategory === subCategory && (
                        <div className="submenu">
                          {Object.keys(rowOptions[category][subCategory]).map(itemKey => (
                            <div 
                              key={itemKey}
                              className="submenu-item-level2"
                              onClick={(e) => {
                                e.stopPropagation();
                                const values = rowOptions[category][subCategory][itemKey];
                                addRowWithData(values);
                              }}
                            >
                              {itemKey}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="button-group">
          <button className="spreadsheet-btn" onClick={copyToClipboard} title="클립보드에 복사">
            📋
          </button>
          <button className="spreadsheet-btn" onClick={pasteFromClipboard} title="클립보드에서 붙여넣기">
            📄
          </button>
        </div>

        <div className="spreadsheet-info">
          {data.length}행 × {currentCols}열
        </div>
      </div>

      <div className="spreadsheet-table-container">
        <div className="spreadsheet-table-wrapper">
          <table className="spreadsheet-table" style={{ minWidth: `${columnWidths.reduce((sum, width) => sum + width, 0)}px` }}>
            <thead>
              <tr>
                {columns.map(column => (
                  <th 
                    key={column.key} 
                    style={{ 
                      width: column.width, 
                      minWidth: column.width,
                      position: 'relative'
                    }}
                  >
                    {column.label}
                    <div 
                      className="column-resize-handle"
                      onMouseDown={(e) => handleColumnResizeStart(e, column.key)}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '4px',
                        cursor: 'col-resize',
                        background: 'transparent'
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map(column => {
                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === column.key;
                    return (
                      <td 
                        key={column.key}
                        className="spreadsheet-cell"
                        style={{ width: column.width, minWidth: column.width }}
                        onClick={() => handleCellClick(rowIndex, column.key)}
                        onContextMenu={(e) => handleRowContextMenu(e, rowIndex)}
                      >
                        {isEditing ? (
                          <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={setEditValue}
                            onKeyPress={handleKeyPress}
                            onBlur={() => handleCellEdit(rowIndex, column.key, editValue)}
                            autoFocus
                            size="sm"
                            style={{ width: '100%', border: 'none', background: 'transparent' }}
                          />
                        ) : (
                          <div className="spreadsheet-cell-content">
                            {row[column.key] || ''}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 리사이즈 핸들 */}
      <div 
        className="resize-handle"
        onMouseDown={handleResizeStart}
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          width: '24px',
          height: '24px',
          cursor: 'nw-resize',
          zIndex: 10000
        }}
      />

      {/* 컨텍스트 메뉴 */}
      {contextMenu.show && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div 
            className="context-menu-item"
            onClick={() => removeSpecificRow(contextMenu.rowId)}
          >
            행 삭제
          </div>
        </div>
      )}

      {/* 컨텍스트 메뉴 외부 클릭 시 닫기 */}
      {contextMenu.show && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999
          }}
          onClick={closeContextMenu}
        />
      )}
    </div>
  );
};

export default Spreadsheet; 