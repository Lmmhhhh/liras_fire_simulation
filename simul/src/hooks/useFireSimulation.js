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

/**
 * 산불 시뮬레이션 로직을 관리하는 커스텀 훅
 * @param {Object} terrainData - 지형 데이터
 * @param {Array} fuelModelData - 연료 모델 데이터
 * @param {Array} fuelMoistureData - 연료 수분 데이터
 * @param {Array} canopyCoverData - 캐노피 데이터
 * @param {Array} weatherData - 날씨 데이터
 * @param {Object} manualWeather - 수동 날씨 설정
 * @returns {Object} 시뮬레이션 상태와 제어 함수들
 */
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
        fireType: 'SURFACE' // 화재 유형 추가
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
        // 이미 있으면 제거
        return prev.filter(p => !(p.x === x && p.y === y));
      } else {
        // 없으면 추가
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

  // 화재 확산 로직 - Rothermel 모델 기반
  const spreadFire = useCallback((currentGrid, deltaTime) => {
    if (!currentGrid || !terrainData) return currentGrid;

    const weather = getCurrentWeather();
    const newGrid = currentGrid.map(row => row.map(cell => ({ ...cell })));

    // 바람 방향 (도 -> 라디안)
    const windRad = ((weather.windDirection || 0) * Math.PI) / 180;

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
          // 디버깅: 현재 셀 정보 출력
          if (i % 10 === 0 && j % 10 === 0) { // 모든 셀 출력하면 너무 많아서
            console.log(`[${i},${j}] 활성 화재:`, {
              연료: fuelModelData?.[i]?.[j],
              수분: fuelMoistureData?.[i]?.[j],
              수분퍼센트: (fuelMoistureData?.[i]?.[j] || 0.1) * 100,
              캐노피: canopyCoverData?.[i]?.[j],
              강도: cell.intensity,
              유형: cell.fireType
            });
          }

          // 기존 rothermel.js 사용하여 ROS 계산
          const cellData = {
            fuelModel: fuelModelData?.[i]?.[j] || 1,
            moisture: (fuelMoistureData?.[i]?.[j] || 0.1) * 100, // fraction to percent (rothermel.js expects %)
            slope: computeSlopeFn(i, j) // degrees
          };
          
          // ROS 계산 (m/s)
          const headROS = computeRothermelROS(cellData, weather, cellSize);
          
          // ROS 디버깅
          if (headROS === 0) {
            console.warn(`[${i},${j}] ROS가 0입니다!`, cellData);
          }

          // 강제 확산 테스트 코드 추가
          if (!window.debugged) {
            window.debugged = true; // 한 번만 실행
            
            console.log('=== 강제 확산 테스트 ===');
            console.log('현재 위치:', i, j);
            console.log('ROS:', headROS);
            console.log('cellData:', cellData);
            console.log('weather:', weather);
            
            // 타원형 화재 확산 매개변수 계산 (미리 계산)
            const ellipse = ellipticalFireSpread(
              headROS,
              weather.windSpeed || 0,
              deltaTime
            );
            console.log('타원:', ellipse);
            
            const maxDistance = Math.max(ellipse.a, ellipse.b);
            const steps = Math.ceil(maxDistance / cellSize);
            console.log('Steps:', steps);
            
            // 주변 9개 셀 강제 점화
            for (let di = -1; di <= 1; di++) {
              for (let dj = -1; dj <= 1; dj++) {
                if (di === 0 && dj === 0) continue;
                const ni = i + di;
                const nj = j + dj;
                
                if (ni >= 0 && ni < size && nj >= 0 && nj < size) {
                  console.log(`[${ni},${nj}] 상태:`, {
                    현재상태: newGrid[ni][nj].state,
                    연료: fuelModelData?.[ni]?.[nj],
                    수분: (fuelMoistureData?.[ni]?.[nj] || 0.1) * 100
                  });
                  
                  // 강제 점화
                  if (newGrid[ni][nj].state === FIRE_STATES.UNBURNED) {
                    newGrid[ni][nj].state = FIRE_STATES.IGNITING;
                    newGrid[ni][nj].intensity = 50;
                    console.log(`[${ni},${nj}] 강제 점화!`);
                  }
                }
              }
            }
          }
          
          // 연료 하중 계산 (kg/m²) - fuelModelParams에서 가져오기
          const fuelModel = cellData.fuelModel;
          const fuelLoad = fuelLoadToKgM2(
            (fuelModelParams[fuelModel]?.w1 || 0) + 
            (fuelModelParams[fuelModel]?.w10 || 0) + 
            (fuelModelParams[fuelModel]?.w100 || 0) + 
            (fuelModelParams[fuelModel]?.wLive || 0)
          );
          
          // 화재 강도 계산 (kW/m)
          const intensity = firelineIntensity(headROS, fuelLoad);
          newGrid[i][j].intensity = Math.min(100, intensity / 10); // 정규화
          
          // 수관화 전이 체크
          if (canopyCoverData?.[i]?.[j] > 60) {
            const canopyBaseHeight = 2.0; // 기본값 2m
            const foliarMoisture = (fuelMoistureData?.[i]?.[j] || 0.1) * 1.2; // 엽 수분은 더 높음
            
            const crownFire = crownFireInitiation(
              intensity,
              foliarMoisture,
              canopyBaseHeight
            );
            
            if (crownFire.willTransition && cell.fireType !== 'CROWN') {
              newGrid[i][j].fireType = 'CROWN';
              newGrid[i][j].intensity = Math.min(100, intensity / 5); // 수관화는 더 강함
            }
          }
          
          // 타원형 화재 확산 매개변수 계산
          const ellipse = ellipticalFireSpread(
            headROS,
            weather.windSpeed || 0,
            deltaTime
          );
          
          // 최대 확산 거리 계산
          const maxDistance = Math.max(ellipse.a, ellipse.b);
          const steps = Math.ceil(maxDistance / cellSize);
          
          // 확산 시도 중 차단되는 경우 로그
          let blockedCount = 0;
          let attemptCount = 0;
          
          // 주변 셀로 확산
          for (let di = -steps; di <= steps; di++) {
            for (let dj = -steps; dj <= steps; dj++) {
              const ni = i + di;
              const nj = j + dj;

              attemptCount++;

              // 경계 체크
              if (ni < 0 || ni >= size || nj < 0 || nj >= size) continue;
              if (newGrid[ni][nj].state !== FIRE_STATES.UNBURNED) continue;

              // 거리 계산
              const dx = dj * cellSize;
              const dy = di * cellSize;
              const distance = Math.hypot(dx, dy);
              if (distance === 0) continue;

              // 화재 중심에서 대상 셀까지의 각도 (바람 방향 기준)
              const cellAngle = Math.atan2(dy, dx);
              const relativeAngle = cellAngle - windRad;
              
              // 타원형 모델에서 해당 각도의 최대 확산 거리
              const maxSpreadDist = spreadDistanceAtAngle(ellipse, relativeAngle);
              
              // 확산 범위 밖이면 스킵
              if (distance > maxSpreadDist) continue;
              
              // 대상 셀의 연료 확인
              const targetFuel = fuelModelData?.[ni]?.[nj];
              if (!targetFuel || targetFuel === 0) {
                blockedCount++;
                if (blockedCount < 5) { // 처음 몇 개만 로그
                  console.log(`[${ni},${nj}] 연료 없음`);
                }
                continue;
              }
              
              // 대상 셀의 수분 확인 (수분 소멸점 체크)
              const targetMoisture = (fuelMoistureData?.[ni]?.[nj] || 0.1) * 100; // fraction to percent
              const targetMx = fuelModelParams[targetFuel]?.mExt || 30; // 이미 퍼센트
              
              if (targetMoisture >= targetMx) {
                blockedCount++;
                if (blockedCount < 5) {
                  console.log(`[${ni},${nj}] 수분 초과: ${targetMoisture}% >= ${targetMx}%`);
                }
                continue;
              }
              
              // 경사 효과
              const targetElev = terrainData.elevation[ni][nj];
              const sourceElev = terrainData.elevation[i][j];
              const slopeFactor = targetElev > sourceElev ? 1.2 : 0.9;
              
              // 거리 기반 확산 확률
              const distanceRatio = distance / maxSpreadDist;
              const probability = (1 - distanceRatio) * slopeFactor;
              
              if (Math.random() < probability) {
                newGrid[ni][nj].state = FIRE_STATES.IGNITING;
                newGrid[ni][nj].intensity = intensity / 20; // 초기 강도
                
                // 수관화 전파
                if (cell.fireType === 'CROWN' && 
                    canopyCoverData?.[ni]?.[nj] > 60 &&
                    canopyCoverData?.[i]?.[j] > 60) {
                  newGrid[ni][nj].fireType = 'CROWN';
                } else {
                  newGrid[ni][nj].fireType = 'SURFACE';
                }
              }
            }
          }

          if (attemptCount > 0 && blockedCount === attemptCount) {
            console.warn(`[${i},${j}] 모든 확산 시도가 차단됨!`);
          }

          // 점화원(Spotting) - 수관화일 때만
          if (cell.fireType === 'CROWN' && weather.windSpeed > 5) {
            const canopyHeight = (canopyCoverData?.[i]?.[j] || 60) / 10; // 추정 높이
            const spotDist = spottingDistance(intensity, weather.windSpeed, canopyHeight);
            
            if (spotDist > 50 && Math.random() < 0.1) { // 50m 이상이고 10% 확률
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
          
          // 화재 소화 조건
          const burnDuration = cell.fireType === 'CROWN' ? 600 : 1200; // 초
          const burnTime = time - (cell.burnedTime || time);
          
          // 강도 감소
          if (burnTime > burnDuration * 0.7) {
            const decayRate = cell.fireType === 'CROWN' ? 2 : 1;
            newGrid[i][j].intensity = Math.max(0, cell.intensity - decayRate);
          }
          
          // 소화 조건
          const lowIntensity = newGrid[i][j].intensity < 5;
          const precipitation = weather.precipitation > 2.5; // mm/hr
          const fuelDepleted = burnTime > burnDuration;
          
          if (lowIntensity || precipitation || fuelDepleted) {
            newGrid[i][j].state = FIRE_STATES.BURNED;
            newGrid[i][j].intensity = 0;
          }
        }
      }
    }

    return newGrid;
  }, [terrainData, getCurrentWeather, fuelModelData, fuelMoistureData, canopyCoverData, size, cellSize, computeSlopeFn, time]);

  // 시뮬레이션 통계 계산
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
      setFireGrid(grid => spreadFire(grid, deltaTime * speed));

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