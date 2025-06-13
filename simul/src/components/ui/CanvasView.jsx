// src/components/ui/CanvasView.jsx
import React, { useRef, useEffect } from 'react';
import { FIRE_STATES } from '../../utils/fuelModelParams';

export default function CanvasView({
  terrainData,
  fuelModelData,
  fireGrid,
  ignitionPoints,
  canopyCoverData,
  showCanopy,
  showFuelMap,
  onCanvasClick
}) {
  const canvasRef = useRef(null);
  
  // 디버깅
  useEffect(() => {
    console.log('CanvasView 디버깅:', {
      terrainData: terrainData,
      elevation: terrainData?.elevation,
      elevationLength: terrainData?.elevation?.length,
      elevationFirstRow: terrainData?.elevation?.[0]?.length,
      size: terrainData?.size,
      rows: terrainData?.rows,
      cols: terrainData?.cols
    });
  }, [terrainData]);

  // 캔버스 크기 계산 - 실제 데이터 크기 사용
  const rows = terrainData?.elevation?.length || terrainData?.rows || terrainData?.size || 0;
  const cols = terrainData?.elevation?.[0]?.length || terrainData?.cols || terrainData?.size || 0;
  const maxCanvasSize = 600; // 최대 캔버스 크기 (픽셀)
  
  // 가로세로 비율 유지하면서 스케일 계산
  const scaleX = cols > 0 ? Math.floor(maxCanvasSize / cols) : 1;
  const scaleY = rows > 0 ? Math.floor(maxCanvasSize / rows) : 1;
  const scale = Math.max(1, Math.min(scaleX, scaleY)); // 최소 1, 더 작은 스케일 사용
  
  const canvasWidth = cols * scale;
  const canvasHeight = rows * scale;

  useEffect(() => {
    console.log('캔버스 크기 계산:', {
      rows, cols, scale, canvasWidth, canvasHeight
    });
    
    if (!canvasRef.current) {
      console.log('canvasRef.current가 없습니다');
      return;
    }
    
    if (!terrainData) {
      console.log('terrainData가 없습니다');
      return;
    }
    
    if (!terrainData.elevation) {
      console.log('terrainData.elevation이 없습니다');
      return;
    }
    
    if (rows === 0 || cols === 0) {
      console.log('rows 또는 cols가 0입니다:', { rows, cols });
      return;
    }
    
    const ctx = canvasRef.current.getContext('2d');
    const { elevation } = terrainData;
    
    // 캔버스 크기 설정
    canvasRef.current.width = canvasWidth;
    canvasRef.current.height = canvasHeight;
    
    console.log('캔버스 크기 설정됨:', canvasWidth, 'x', canvasHeight);
    
    // 배경 그리기
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 고도 범위 계산
    let minElev = Infinity, maxElev = -Infinity;
    elevation.forEach(row => {
      if (Array.isArray(row)) {
        row.forEach(val => {
          if (typeof val === 'number' && !isNaN(val)) {
            if (val < minElev) minElev = val;
            if (val > maxElev) maxElev = val;
          }
        });
      }
    });
    const elevRange = maxElev - minElev || 1;
    
    console.log('고도 범위:', { minElev, maxElev, elevRange });
    
    // 지형 그리기
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const elev = elevation[i]?.[j];
        if (elev === undefined || elev === null) continue;
        
        const normalized = (elev - minElev) / elevRange;
        
        // 연료 맵 표시
        if (showFuelMap && fuelModelData) {
          const fuel = fuelModelData[i]?.[j] || 0;
          const fuelColors = {
            0: '#e8f5e9',   // 연료 없음 - 매우 연한 초록
            1: '#fff59d',   // 짧은 풀 - 밝은 노랑
            2: '#ffeb3b',   // 목재 풀 - 진한 노랑
            3: '#ffd54f',   // 긴 풀 - 황금색
            4: '#ff8a65',   // 관목 - 연한 주황
            5: '#ff7043',   // 덤불 - 주황색
            6: '#8d6e63',   // 휴면 덤불 - 갈색
            7: '#81c784',   // 남부 거친 지역 - 연한 초록
            8: '#66bb6a',   // 폐쇄된 목재 - 초록
            9: '#4caf50',   // 활엽수 - 진한 초록
            10: '#43a047',  // 하층 목재 - 더 진한 초록
            11: '#6d4c41',  // 가벼운 벌목 - 연한 갈색
            12: '#5d4037',  // 중간 벌목 - 갈색
            13: '#4e342e'   // 무거운 벌목 - 진한 갈색
          };
          ctx.fillStyle = fuelColors[fuel] || '#cccccc';
        } else {
          // 지형 그라데이션 (더 선명한 색상)
          const gray = Math.floor(normalized * 150 + 80); // 80-230 범위로 조정
          ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
        }
        
        ctx.fillRect(j * scale, i * scale, scale, scale);
        
        // 수관 오버레이
        if (showCanopy && canopyCoverData) {
          const canopy = canopyCoverData[i]?.[j] || 0;
          if (canopy > 0) {
            // 수관 밀도에 따른 초록색 농도
            const greenIntensity = Math.floor(100 - canopy * 0.5);
            ctx.fillStyle = `rgba(0, ${greenIntensity + 100}, 0, ${canopy / 150})`;
            ctx.fillRect(j * scale, i * scale, scale, scale);
          }
        }
      }
    }
    
    // 화재 그리기
    if (fireGrid) {
      const fireRows = Math.min(rows, fireGrid.length);
      const fireCols = Math.min(cols, fireGrid[0]?.length || 0);
      
      for (let i = 0; i < fireRows; i++) {
        for (let j = 0; j < fireCols; j++) {
          const cell = fireGrid[i]?.[j];
          if (!cell) continue;
          
          if (cell.state === FIRE_STATES.ACTIVE || cell.state === FIRE_STATES.IGNITING) {
            const intensity = cell.intensity || 50;
            const alpha = Math.min(intensity / 100, 0.9);
            
            if (cell.fireType === 'CROWN') {
              // 수관화 - 밝은 보라색/분홍색
              const r = 255;
              const g = Math.floor(105 - intensity * 0.5);
              const b = 180;
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            } else {
              // 지표화 - 주황색에서 빨간색으로 변화
              const r = 255;
              const g = Math.floor(200 - intensity * 1.5);
              const b = 0;
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
            ctx.fillRect(j * scale, i * scale, scale, scale);
            
            // 중심부 강조 - 밝은 노란색/흰색
            if (intensity > 70) {
              ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.8})`;
              const innerSize = scale * 0.4;
              const offset = (scale - innerSize) / 2;
              ctx.fillRect(j * scale + offset, i * scale + offset, innerSize, innerSize);
            }
          } else if (cell.state === FIRE_STATES.BURNED) {
            // 소실 지역 - 진한 회색/검정
            ctx.fillStyle = 'rgba(33, 33, 33, 0.9)';
            ctx.fillRect(j * scale, i * scale, scale, scale);
            
            // 약간의 재 효과
            ctx.fillStyle = 'rgba(66, 66, 66, 0.3)';
            const ashSize = scale * 0.8;
            const ashOffset = (scale - ashSize) / 2;
            ctx.fillRect(j * scale + ashOffset, i * scale + ashOffset, ashSize, ashSize);
          } else if (cell.state === FIRE_STATES.DECLINING) {
            // 감소 중인 화재 - 어두운 빨간색/주황색
            const intensity = cell.intensity || 20;
            const alpha = Math.min(intensity / 100, 0.8);
            const r = 200;
            const g = Math.floor(50 + intensity);
            const b = 0;
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fillRect(j * scale, i * scale, scale, scale);
          }
        }
      }
    }
    
    // 발화점 표시 (더 눈에 띄게)
    ignitionPoints.forEach(({ x, y }) => {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        // 빨간 테두리
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.strokeRect(x * scale, y * scale, scale, scale);
        
        // 내부 노란색 채우기
        ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
        ctx.fillRect(x * scale + 1, y * scale + 1, scale - 2, scale - 2);
        
        // X 표시
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x * scale + 2, y * scale + 2);
        ctx.lineTo((x + 1) * scale - 2, (y + 1) * scale - 2);
        ctx.moveTo((x + 1) * scale - 2, y * scale + 2);
        ctx.lineTo(x * scale + 2, (y + 1) * scale - 2);
        ctx.stroke();
      }
    });
    
    // 격자선 (선택적)
    if (scale > 5) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 0.5;
      // 세로선
      for (let j = 0; j <= cols; j++) {
        ctx.beginPath();
        ctx.moveTo(j * scale, 0);
        ctx.lineTo(j * scale, canvasHeight);
        ctx.stroke();
      }
      // 가로선
      for (let i = 0; i <= rows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * scale);
        ctx.lineTo(canvasWidth, i * scale);
        ctx.stroke();
      }
    }
    
    console.log('캔버스 렌더링 완료');
    
  }, [terrainData, fireGrid, ignitionPoints, canopyCoverData, showCanopy, showFuelMap, fuelModelData, rows, cols, scale, canvasWidth, canvasHeight]);

  // 클릭 핸들러 수정
  const handleClick = (e) => {
    if (!onCanvasClick) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / scale);
    const y = Math.floor((e.clientY - rect.top) / scale);
    
    console.log('캔버스 클릭:', { x, y, scale });
    
    // 수정된 이벤트 객체 전달
    const modifiedEvent = {
      ...e,
      currentTarget: {
        ...e.currentTarget,
        getBoundingClientRect: () => rect,
        scale: scale // scale 정보 추가
      },
      clientX: e.clientX,
      clientY: e.clientY
    };
    
    onCanvasClick(modifiedEvent);
  };

  if (!terrainData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
        <p className="text-gray-500">지형 데이터를 로드해주세요</p>
      </div>
    );
  }
  
  if (!terrainData.elevation) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
        <p className="text-gray-500">지형 elevation 데이터가 없습니다</p>
      </div>
    );
  }
  
  if (rows === 0 || cols === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded">
        <p className="text-gray-500">데이터 크기가 0입니다 (rows: {rows}, cols: {cols})</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <canvas
        ref={canvasRef}
        className="border border-gray-300 rounded cursor-crosshair"
        onClick={handleClick}
        style={{
          imageRendering: 'pixelated', // 픽셀 선명하게
          maxWidth: '100%',
          height: 'auto'
        }}
      />
      <div className="mt-2 text-xs text-gray-600">
        크기: {rows}×{cols} | 스케일: 1:{scale} | 셀 크기: {terrainData.cellSize}m
      </div>
    </div>
  );
}