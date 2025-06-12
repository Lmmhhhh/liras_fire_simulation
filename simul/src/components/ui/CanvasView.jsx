import React, { useRef, useEffect } from 'react';
import { FIRE_STATES } from '../../utils/fuelModelParams';

export default function CanvasView({ 
  terrainData, 
  fireGrid, 
  ignitionPoints,
  canopyCoverData,  // 추가
  showCanopy = false,  // 캐노피 표시 토글
  onCanvasClick 
}) {
  const canvasRef = useRef(null);
  const size = terrainData?.size || 0;

  useEffect(() => {
    if (!terrainData) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scale = 5;
    const W = size * scale;
    const H = size * scale;
    
    // 캔버스 크기 설정
    canvas.width = W;
    canvas.height = H;

    // 1. 지형 그리기 (배경)
    terrainData.elevation.forEach((row, i) => {
      row.forEach((elev, j) => {
        // 고도에 따른 음영
        const normalizedElev = Math.min(255, Math.max(0, (elev / 1000) * 255));
        
        // 캐노피 데이터가 있고 표시 옵션이 켜져있으면 캐노피와 합성
        if (showCanopy && canopyCoverData?.[i]?.[j] !== undefined) {
          const canopy = canopyCoverData[i][j];
          // 캐노피가 높을수록 녹색 추가
          const r = normalizedElev * 0.7 - canopy * 0.3;
          const g = normalizedElev * 0.8 + canopy * 0.4;
          const b = normalizedElev * 0.6 - canopy * 0.2;
          ctx.fillStyle = `rgb(${Math.max(0, r)}, ${Math.min(255, g)}, ${Math.max(0, b)})`;
        } else {
          // 기본 지형 색상
          const r = normalizedElev * 0.8;
          const g = normalizedElev * 0.9;
          const b = normalizedElev * 0.7;
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        }
        ctx.fillRect(j * scale, i * scale, scale, scale);
      });
    });

    // 2. 화재 그리기
    if (fireGrid) {
      fireGrid.forEach((row, i) => {
        row.forEach((cell, j) => {
          if (cell.state === FIRE_STATES.ACTIVE || cell.state === FIRE_STATES.IGNITING) {
            const intensity = Math.min(100, cell.intensity || 0);
            const alpha = 0.6 + (intensity / 100) * 0.4; // 0.6 ~ 1.0
            
            // 화재 유형에 따른 색상 차별화
            if (cell.fireType === 'CROWN') {
              // 수관화: 보라색/파란색 계열 (더 뜨거운 화재)
              const r = 100 + intensity * 1.55;  // 100 ~ 255
              const g = 0 + intensity * 0.5;     // 0 ~ 50
              const b = 150 + intensity * 1.05;  // 150 ~ 255
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
              
              // 수관화 중심부 강조
              ctx.fillRect(j * scale, i * scale, scale, scale);
              
              // 고강도 수관화일 때 흰색 코어 추가
              if (intensity > 70) {
                const coreAlpha = (intensity - 70) / 30 * 0.5;
                ctx.fillStyle = `rgba(255, 255, 255, ${coreAlpha})`;
                ctx.fillRect(
                  j * scale + scale * 0.2, 
                  i * scale + scale * 0.2, 
                  scale * 0.6, 
                  scale * 0.6
                );
              }
            } else {
              // 지표화: 주황색/빨간색 계열
              const r = 255;
              const g = 200 - intensity * 1.5;  // 200 ~ 50
              const b = 0;
              ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
              ctx.fillRect(j * scale, i * scale, scale, scale);
            }
            
            // IGNITING 상태일 때 깜빡임 효과
            if (cell.state === FIRE_STATES.IGNITING) {
              const flicker = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
              ctx.fillStyle = `rgba(255, 255, 0, ${flicker * 0.3})`;
              ctx.fillRect(j * scale, i * scale, scale, scale);
            }
          } else if (cell.state === FIRE_STATES.BURNED) {
            // 타버린 지역: 검은색/회색 (화재 유형에 따라 차별화)
            if (cell.fireType === 'CROWN') {
              // 수관화로 탄 지역: 더 진한 검은색
              ctx.fillStyle = 'rgba(20, 20, 20, 0.9)';
            } else {
              // 지표화로 탄 지역: 일반 회색
              ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
            }
            ctx.fillRect(j * scale, i * scale, scale, scale);
          }
        });
      });
    }

    // 3. 발화점 표시
    if (Array.isArray(ignitionPoints) && ignitionPoints.length > 0) {
      ignitionPoints.forEach(({ x, y }) => {
        const cx = x * scale + scale / 2;
        const cy = y * scale + scale / 2;
        
        // 발화점 원 그리기
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.8, 0, 2 * Math.PI);
        ctx.stroke();
        
        // 발화점 내부 채우기
        ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
        ctx.fill();
        
        // 불꽃 아이콘
        ctx.font = `bold ${scale * 1.2}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 165, 0, 1)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', cx, cy);
      });
    }

    // 4. 범례 그리기 (옵션)
    drawLegend(ctx, W, H);

  }, [terrainData, fireGrid, ignitionPoints, canopyCoverData, showCanopy, size]);

  // 범례 그리기 함수
  const drawLegend = (ctx, W, H) => {
    const legendX = W - 120;
    const legendY = H - 120;
    
    // 범례 배경
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(legendX, legendY, 110, 110);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, 110, 110);
    
    // 범례 텍스트
    ctx.fillStyle = 'black';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // 지표화
    ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
    ctx.fillRect(legendX + 5, legendY + 10, 15, 15);
    ctx.fillStyle = 'black';
    ctx.fillText('지표화', legendX + 25, legendY + 17);
    
    // 수관화
    ctx.fillStyle = 'rgba(200, 50, 255, 0.8)';
    ctx.fillRect(legendX + 5, legendY + 30, 15, 15);
    ctx.fillStyle = 'black';
    ctx.fillText('수관화', legendX + 25, legendY + 37);
    
    // 타버린 지역
    ctx.fillStyle = 'rgba(40, 40, 40, 0.8)';
    ctx.fillRect(legendX + 5, legendY + 50, 15, 15);
    ctx.fillStyle = 'black';
    ctx.fillText('소실지역', legendX + 25, legendY + 57);
    
    // 발화점
    ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(legendX + 12, legendY + 75, 7, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.fillText('발화점', legendX + 25, legendY + 75);
    
    // 캐노피 표시 상태
    if (showCanopy) {
      ctx.fillStyle = 'rgba(0, 150, 0, 0.5)';
      ctx.fillRect(legendX + 5, legendY + 90, 15, 15);
      ctx.fillStyle = 'black';
      ctx.fillText('수관밀도', legendX + 25, legendY + 97);
    }
  };

  return (
    <div className="relative">
      <div 
        className="bg-gray-100 p-2 rounded-xl shadow-inner cursor-crosshair overflow-auto"
        onClick={onCanvasClick}
        style={{ maxHeight: '600px', maxWidth: '100%' }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={{ 
            imageRendering: 'pixelated',
            minWidth: size * 5 + 'px',
            minHeight: size * 5 + 'px'
          }}
        />
      </div>
      
      {/* 컨트롤 힌트 */}
      <div className="mt-2 text-xs text-gray-600 text-center">
        클릭: 발화점 설정/해제 | 스크롤: 확대/축소
      </div>
    </div>
  );
}