// src/hooks/useFireSimulation.js
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { computeRothermelROS } from '../utils/rothermel';
import { 
  ellipticalFireSpread, 
  spreadDistanceAtAngle,
  crownFireInitiation,
  firelineIntensity,
  spottingDistance,
  fuelLoadToKgM2
} from '../utils/fireSpreadExtensions';
import { computeSlope } from '../utils/terrain';
import { FIRE_STATES, fuelModelParams } from '../utils/fuelModelParams';

export function useFireSimulation(
  terrainData,
  fuelModelData,
  fuelMoistureData,
  canopyCoverData,
  weatherData,
  manualWeather
) {
  // 시뮬레이션 상태
  const [fireGrid, setFireGrid] = useState(null);
  const [ignitionPoints, setIgnitionPoints] = useState([]);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [speed, setSpeed] = useState(1);

  // 애니메이션 프레임 관리를 위한 ref
  const animationRef = useRef(null);

  // 메타 데이터
  const cellSize = terrainData?.cellSize || 30;
  const size = terrainData?.size || 0;

  // 경사 계산 함수 메모이제이션
  const computeSlopeFn = useMemo(() => {
    if (!terrainData?.elevation) return () => 0;
    return computeSlope(terrainData.elevation, cellSize);
  }, [terrainData, cellSize]);

  // 격자 초기화
  const initializeGrid = useCallback(() => {
    if (!size) return null;
    
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        state: FIRE_STATES.UNBURNED,
        intensity: 0,
        burnedTime: null,
        fireType: 'SURFACE'
      }))
    );
    
    return grid;
  }, [size]);

  // 발화점 추가/제거
  const addIgnitionPoint = useCallback((x, y) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return false;
    
    setIgnitionPoints(prev => {
      const exists = prev.some(p => p.x === x && p.y === y);
      if (exists) {
        return prev.filter(p => !(p.x === x && p.y === y));
      } else {
        return [...prev, { x, y }];
      }
    });
    
    return true;
  }, [size]);

  // 발화점 초기화
  const clearIgnitionPoints = useCallback(() => {
    setIgnitionPoints([]);
  }, []);

  // 시뮬레이션 시작
  const startSimulation = useCallback(() => {
    if (!ignitionPoints.length) {
      return { success: false, message: '발화점을 선택해주세요' };
    }

    if (!terrainData || !fuelModelData || !fuelMoistureData) {
      return { success: false, message: '필수 데이터가 로드되지 않았습니다' };
    }

    // 발화점이 연료가 있는 곳인지 확인
    const invalidPoints = ignitionPoints.filter(({x, y}) => {
      const fuel = fuelModelData?.[y]?.[x];
      return !fuel || fuel === 0;
    });

    if (invalidPoints.length > 0) {
      return { 
        success: false, 
        message: '발화점이 연료가 없는 지역에 설정되었습니다. 다른 곳을 선택하세요.' 
      };
    }

    // 데이터 분석 (디버깅용)
    console.log('=== 시뮬레이션 데이터 분석 ===');
    
    // 연료 분포
    let fuelStats = {};
    fuelModelData.forEach((row, i) => {
      row.forEach((fuel, j) => {
        fuelStats[fuel] = (fuelStats[fuel] || 0) + 1;
      });
    });
    console.log('연료 분포:', fuelStats);
    
    // 수분 분포
    let moistureRanges = {
      '0-10%': 0,
      '10-20%': 0,
      '20-30%': 0,
      '30%+': 0
    };
    fuelMoistureData.forEach(row => {
      row.forEach(m => {
        const percent = m * 100;
        if (percent < 10) moistureRanges['0-10%']++;
        else if (percent < 20) moistureRanges['10-20%']++;
        else if (percent < 30) moistureRanges['20-30%']++;
        else moistureRanges['30%+']++;
      });
    });
    console.log('수분 분포:', moistureRanges);
    
    // 발화점 정보
    console.log('발화점:', ignitionPoints.map(p => ({
      위치: `[${p.x},${p.y}]`,
      연료: fuelModelData[p.y]?.[p.x],
      수분: (fuelMoistureData[p.y]?.[p.x] * 100).toFixed(1) + '%',
      캐노피: canopyCoverData?.[p.y]?.[p.x] + '%'
    })));

    // 격자 초기화
    const newGrid = initializeGrid();
    if (!newGrid) {
      return { success: false, message: '격자 초기화 실패' };
    }

    // 발화점 설정
    ignitionPoints.forEach(({ x, y }) => {
      if (newGrid[y] && newGrid[y][x]) {
        newGrid[y][x].state = FIRE_STATES.IGNITING;
        newGrid[y][x].intensity = 50; // 초기 강도 설정
      }
    });

    setFireGrid(newGrid);
    setTime(0);
    setIsRunning(true);
    
    return { success: true };
  }, [ignitionPoints, terrainData, fuelModelData, fuelMoistureData, canopyCoverData, initializeGrid]);

  // 시뮬레이션 정지
  const stopSimulation = useCallback(() => {
    setIsRunning(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  // 시뮬레이션 리셋
  const resetSimulation = useCallback(() => {
    stopSimulation();
    setIgnitionPoints([]);
    setFireGrid(null);
    setTime(0);
  }, [stopSimulation]);

  // 현재 날씨 정보 가져오기
  const getCurrentWeather = useCallback(() => {
    if (weatherData && weatherData.length > 0) {
      const hourIndex = Math.min(Math.floor(time / 3600), weatherData.length - 1);
      return weatherData[hourIndex];
    }
    return manualWeather;
  }, [weatherData, manualWeather, time]);

  // 시뮬레이션 통계 계산 - spreadFire보다 먼저 정의
  const getSimulationStats = useCallback(() => {
    if (!fireGrid) return null;

    let unburned = 0;
    let active = 0;
    let burned = 0;
    let surfaceFire = 0;
    let crownFire = 0;
    let totalIntensity = 0;

    fireGrid.forEach(row => {
      row.forEach(cell => {
        switch (cell.state) {
          case FIRE_STATES.UNBURNED:
            unburned++;
            break;
          case FIRE_STATES.ACTIVE:
          case FIRE_STATES.IGNITING:
            active++;
            totalIntensity += cell.intensity || 0;
            // 화재 유형별 카운트
            if (cell.fireType === 'CROWN') {
              crownFire++;
            } else {
              surfaceFire++;
            }
            break;
          case FIRE_STATES.BURNED:
            burned++;
            break;
        }
      });
    });

    const totalCells = size * size;
    const burnedArea = (burned + active) * cellSize * cellSize / 10000; // hectares

    return {
      unburned,
      active,
      burned,
      totalCells,
      burnedArea,
      averageIntensity: active > 0 ? totalIntensity / active : 0,
      burnedPercentage: ((burned + active) / totalCells) * 100,
      surfaceFire,
      crownFire,
      crownFirePercentage: active > 0 ? (crownFire / active) * 100 : 0
    };
  }, [fireGrid, size, cellSize]);

  // 화재 확산 로직 - Rothermel 모델 기반
  const spreadFire = useCallback((currentGrid, deltaTime) => {
    if (!currentGrid || !terrainData) return currentGrid;

    const weather = getCurrentWeather();
    const newGrid = currentGrid.map(row => row.map(cell => ({ ...cell })));

    // 바람 방향 (도 -> 라디안)
    const windRad = ((weather.windDirection || 0) * Math.PI) / 180;

    // 디버깅 정보 초기화
    if (!window.fireDebugInfo) {
      window.fireDebugInfo = {
        totalSpreadAttempts: 0,
        successfulSpreads: 0,
        blockedByFuel: 0,
        blockedByMoisture: 0,
        blockedByDistance: 0,
        avgIntensityHistory: []
      };
    }

    // 모든 셀 순회
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const cell = currentGrid[i][j];
        
        // IGNITING 상태를 ACTIVE로 전환
        if (cell.state === FIRE_STATES.IGNITING) {
          newGrid[i][j].state = FIRE_STATES.ACTIVE;
          newGrid[i][j].burnedTime = time;
        }

        // ACTIVE 상태인 셀에서 확산
        if (cell.state === FIRE_STATES.ACTIVE) {
          // 기존 rothermel.js 사용하여 ROS 계산
          const cellData = {
            fuelModel: fuelModelData?.[i]?.[j] || 1,
            moisture: (fuelMoistureData?.[i]?.[j] || 0.1) * 100,
            slope: computeSlopeFn(i, j)
          };
          
          // ROS 계산 (m/s)
          const headROS = computeRothermelROS(cellData, weather, cellSize);
          
          // ROS가 너무 낮으면 기본값 사용
          let adjustedROS = headROS;
          if (headROS < 0.1 && cellData.fuelModel !== 0) {
            adjustedROS = 0.1; // 최소 0.1 m/s
          }

          // 연료 하중 계산 (화재 강도 계산용)
          const fuelModel = cellData.fuelModel;
          const fuelLoad = fuelLoadToKgM2(
            (fuelModelParams[fuelModel]?.w1 || 0) + 
            (fuelModelParams[fuelModel]?.w10 || 0) + 
            (fuelModelParams[fuelModel]?.w100 || 0) + 
            (fuelModelParams[fuelModel]?.wLive || 0)
          );
          
          // 화재 강도 계산 (더 높은 강도)
          const intensity = firelineIntensity(adjustedROS, fuelLoad);
          newGrid[i][j].intensity = Math.min(100, intensity / 5); // /10 -> /5로 변경
          
          // 수관화 전이 체크
          if (canopyCoverData?.[i]?.[j] > 60) {
            const canopyBaseHeight = 2.0;
            const foliarMoisture = (fuelMoistureData?.[i]?.[j] || 0.1) * 1.2;
            
            const crownFire = crownFireInitiation(
              intensity,
              foliarMoisture,
              canopyBaseHeight
            );
            
            if (crownFire.willTransition && cell.fireType !== 'CROWN') {
              newGrid[i][j].fireType = 'CROWN';
              newGrid[i][j].intensity = Math.min(100, intensity / 3);
            }
          }

          // 타원형 화재 확산 매개변수 계산
          const ellipse = ellipticalFireSpread(
            adjustedROS,
            weather.windSpeed || 0,
            deltaTime * speed
          );

          // 최소 확산 거리 보장 (최소 1셀은 확산)
          const minSpreadDistance = cellSize;
          if (ellipse.a < minSpreadDistance) {
            ellipse.a = minSpreadDistance;
            ellipse.b = minSpreadDistance * 0.8;
          }

          // 확산 범위 계산
          const maxDistance = Math.max(ellipse.a, ellipse.b);
          const steps = Math.max(1, Math.ceil(maxDistance / cellSize));

          // 주변 셀로 확산
          let spreadCount = 0;
          let attemptCount = 0;

          for (let di = -steps; di <= steps; di++) {
            for (let dj = -steps; dj <= steps; dj++) {
              if (di === 0 && dj === 0) continue;
              
              const ni = i + di;
              const nj = j + dj;

              // 경계 체크
              if (ni < 0 || ni >= size || nj < 0 || nj >= size) continue;
              if (newGrid[ni][nj].state !== FIRE_STATES.UNBURNED) continue;

              attemptCount++;
              window.fireDebugInfo.totalSpreadAttempts++;

              // 거리 계산
              const dx = dj * cellSize;
              const dy = di * cellSize;
              const distance = Math.hypot(dx, dy);

              // 화재 중심에서 대상 셀까지의 각도
              const cellAngle = Math.atan2(dy, dx);
              const relativeAngle = cellAngle - windRad;
              
              // 타원형 모델에서 해당 각도의 최대 확산 거리
              const maxSpreadDist = spreadDistanceAtAngle(ellipse, relativeAngle);
              
              // 확산 범위 체크 (여유 마진 추가)
              if (distance > maxSpreadDist * 1.5) {
                window.fireDebugInfo.blockedByDistance++;
                continue;
              }
              
              // 대상 셀의 연료 확인
              const targetFuel = fuelModelData?.[ni]?.[nj];
              if (!targetFuel || targetFuel === 0) {
                window.fireDebugInfo.blockedByFuel++;
                continue;
              }
              
              // 연료 파라미터 확인
              const targetFuelParams = fuelModelParams[targetFuel];
              if (!targetFuelParams) {
                // 지원되지 않는 연료 모델은 기본값 사용
                console.log(`연료 모델 ${targetFuel} 미지원, 기본값 사용`);
              }
              
              // 대상 셀의 수분 확인
              const targetMoisture = (fuelMoistureData?.[ni]?.[nj] || 0.1) * 100;
              const targetMx = targetFuelParams?.mExt || 30;
              
              // 수분이 소멸점의 90% 이상이면 확산 어려움
              if (targetMoisture >= targetMx * 0.9) {
                window.fireDebugInfo.blockedByMoisture++;
                continue;
              }
              
              // 경사 효과
              const targetElev = terrainData.elevation[ni][nj];
              const sourceElev = terrainData.elevation[i][j];
              const elevDiff = targetElev - sourceElev;
              
              let slopeFactor = 1.0;
              if (elevDiff > 0) {
                // 상향 경사는 확산 촉진
                slopeFactor = 1.0 + Math.min(0.5, elevDiff / 50);
              } else {
                // 하향 경사는 확산 억제
                slopeFactor = Math.max(0.7, 1.0 + elevDiff / 100);
              }
              
              // 거리 기반 확산 확률
              let probability = 0;
              
              // 인접 셀 (8방향)은 높은 확률
              if (Math.abs(di) <= 1 && Math.abs(dj) <= 1) {
                probability = 0.9 * slopeFactor; // 0.8 -> 0.9
                
                // 수분 효과 적용 (덜 엄격하게)
                const moistureFactor = 1 - (targetMoisture / targetMx) * 0.3; // 0.5 -> 0.3
                probability *= moistureFactor;
              } else {
                // 더 먼 셀은 거리에 따라 감소
                const distanceRatio = distance / maxSpreadDist;
                probability = (1 - distanceRatio) * slopeFactor * 0.5;
                
                // 수분 효과
                const moistureFactor = 1 - (targetMoisture / targetMx) * 0.7;
                probability *= moistureFactor;
              }
              
              // 바람 방향 보너스
              const windAlignment = Math.cos(relativeAngle);
              if (windAlignment > 0 && weather.windSpeed > 2) {
                probability *= (1 + windAlignment * 0.3);
              }
              
              // 확률 제한
              probability = Math.max(0, Math.min(1, probability));
              
              // 확산 시도
              if (Math.random() < probability) {
                newGrid[ni][nj].state = FIRE_STATES.IGNITING;
                
                // 초기 강도를 더 높게 설정
                const initialIntensity = Math.max(30, cell.intensity * 0.9); // 10 -> 30, 0.8 -> 0.9
                newGrid[ni][nj].intensity = initialIntensity;
                
                // 화재 유형 결정
                if (cell.fireType === 'CROWN' && 
                    canopyCoverData?.[ni]?.[nj] > 50 && 
                    canopyCoverData?.[i]?.[j] > 50 &&
                    distance <= cellSize * 2) {
                  newGrid[ni][nj].fireType = 'CROWN';
                } else {
                  newGrid[ni][nj].fireType = 'SURFACE';
                }
                
                spreadCount++;
                window.fireDebugInfo.successfulSpreads++;
              }
            }
          }

          // 점화원(Spotting) - 수관화일 때만
          if (cell.fireType === 'CROWN' && weather.windSpeed > 5) {
            const canopyHeight = (canopyCoverData?.[i]?.[j] || 60) / 10;
            const spotDist = spottingDistance(intensity, weather.windSpeed, canopyHeight);
            
            if (spotDist > 50 && Math.random() < 0.1) {
              const spotCells = Math.floor(spotDist / cellSize);
              const spotAngle = windRad + (Math.random() - 0.5) * Math.PI / 6;
              
              const spotI = i + Math.round(Math.sin(spotAngle) * spotCells);
              const spotJ = j + Math.round(Math.cos(spotAngle) * spotCells);
              
              if (spotI >= 0 && spotI < size && spotJ >= 0 && spotJ < size) {
                const spotFuel = fuelModelData?.[spotI]?.[spotJ];
                if (spotFuel && spotFuel > 0 && 
                    newGrid[spotI][spotJ].state === FIRE_STATES.UNBURNED) {
                  newGrid[spotI][spotJ].state = FIRE_STATES.IGNITING;
                  newGrid[spotI][spotJ].intensity = 20;
                  newGrid[spotI][spotJ].fireType = 'SURFACE';
                }
              }
            }
          }
          
          // 화재 소화 조건 (더 늦게 소화되도록)
          const burnDuration = cell.fireType === 'CROWN' ? 900 : 1800; // 600->900, 1200->1800
          const burnTime = time - (cell.burnedTime || time);
          
          // 강도 감소 (더 늦게 시작)
          if (burnTime > burnDuration * 0.85) { // 0.7 -> 0.85
            const decayRate = cell.fireType === 'CROWN' ? 1.5 : 0.5; // 2->1.5, 1->0.5
            newGrid[i][j].intensity = Math.max(0, cell.intensity - decayRate);
          }
          
          // 소화 조건 (더 엄격하게)
          const lowIntensity = newGrid[i][j].intensity < 2; // 5 -> 2
          const precipitation = weather.precipitation > 5; // 2.5 -> 5
          const fuelDepleted = burnTime > burnDuration * 1.2;
          
          if (lowIntensity || precipitation || fuelDepleted) {
            newGrid[i][j].state = FIRE_STATES.BURNED;
            newGrid[i][j].intensity = 0;
          }
        }
      }
    }

    // 디버깅 정보 출력 (매 10초)
    if (Math.floor(time) % 10 === 0 && window.fireDebugInfo.totalSpreadAttempts > 0) {
      const stats = getSimulationStats();
      window.fireDebugInfo.avgIntensityHistory.push(stats?.averageIntensity || 0);
      
      console.log('=== 화재 확산 분석 ===');
      console.log('확산 성공률:', 
        `${(window.fireDebugInfo.successfulSpreads / window.fireDebugInfo.totalSpreadAttempts * 100).toFixed(1)}%`);
      console.log('차단 원인:', {
        연료없음: window.fireDebugInfo.blockedByFuel,
        수분과다: window.fireDebugInfo.blockedByMoisture,
        거리초과: window.fireDebugInfo.blockedByDistance
      });
      
      // 리셋
      window.fireDebugInfo.totalSpreadAttempts = 0;
      window.fireDebugInfo.successfulSpreads = 0;
      window.fireDebugInfo.blockedByFuel = 0;
      window.fireDebugInfo.blockedByMoisture = 0;
      window.fireDebugInfo.blockedByDistance = 0;
    }

    return newGrid;
  }, [terrainData, getCurrentWeather, fuelModelData, fuelMoistureData, canopyCoverData, size, cellSize, computeSlopeFn, time, getSimulationStats, speed]);

  // 애니메이션 루프
  useEffect(() => {
    if (!isRunning || !fireGrid) return;

    let lastTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const deltaTime = (currentTime - lastTime) / 1000; // seconds
      lastTime = currentTime;

      // 시간 업데이트
      setTime(t => t + deltaTime * speed);

      // 화재 확산
      setFireGrid(grid => spreadFire(grid, deltaTime));

      // 다음 프레임 요청
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, fireGrid, speed, spreadFire]);

  return {
    // 상태
    fireGrid,
    ignitionPoints,
    time,
    isRunning,
    speed,
    
    // 메타 정보
    cellSize,
    size,
    
    // 제어 함수
    setSpeed,
    addIgnitionPoint,
    clearIgnitionPoints,
    startSimulation,
    stopSimulation,
    resetSimulation,
    
    // 유틸리티
    getCurrentWeather,
    getSimulationStats
  };
}