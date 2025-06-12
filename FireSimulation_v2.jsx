// src/components/FireSimulation.jsx
import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo
} from 'react';
import DataUploader   from './simul/src/components/ui/DataUploader';
import ControlPanel   from './simul/src/components/ui/ControlPanel';
import CanvasView     from './simul/src/components/ui/CanvasView';
import InfoPanel      from './simul/src/components/ui/InfoPanel';
import { parseAscFile }     from './simul/src/utils/AscParser';
import { parseWeatherCSV }  from './simul/src/utils/WeatherParser';
import { computeRothermelROS } from './simul/src/utils/rothermel';
import { computeSlope }     from './simul/src/utils/terrain';
// import { FIRE_STATES, FUEL_MODELS } from '../data/FuelModels';
import {
    fuelModelParams,
    universalParams,
    FUEL_MODELS,
    FIRE_STATES
} from './simul/src/utils/fuelModelParams';
  
  export default function FireSimulation() {
    // 1) 데이터 상태
    const [terrainData, setTerrainData]         = useState(null);
    const [fuelModelData, setFuelModelData]     = useState(null);
    const [fuelMoistureData, setFuelMoistureData] = useState(null);
    const [canopyCoverData, setCanopyCoverData] = useState(null);
    const [weatherData, setWeatherData]         = useState(null);
  
    // 2) 시뮬레이션 상태
    const [isRunning, setIsRunning] = useState(false);
    const canvasRef  = useRef(null);
    const animRef    = useRef(null);
    const [fireGrid, setFireGrid]   = useState(null);
    const [time, setTime]           = useState(0);
  
    // 3) 셀 크기 및 그리드 크기
    const cellSize = terrainData?.cellSize || 30; // 기본 30m
    const size     = terrainData?.size     || 0;
  
    // 4) 경사 계산 함수(useMemo로 재생성 최소화)
    const computeSlopeFn = useMemo(() => {
      if (!terrainData?.elevation) return () => 0;
      return computeSlope(terrainData.elevation, cellSize);
    }, [terrainData, cellSize]);
  
    // 5) 파일 업로드 핸들러
    const handleDemUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const {data, nrows, ncos, cellsize } = parseAscFile(text);
      setTerrainData({elevation : data, size : nrows, cellSize})
    }, []);
  
    const handleFuelUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const data = parseAscFile(text, terrainData?.size);
      setFuelModelData(data);
    }, []);
  
    const handleMoistureUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const data = parseAscFile(text, terrainData?.size);
      setFuelMoistureData(data);
    }, []);
  
    const handleCanopyUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const data = parseAscFile(text, terrainData?.size);
      setCanopyCoverData(data);
    }, []);
  
    const handleWeatherUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const parsed = parseWeatherCSV(text);
      setWeatherData(parsed);
    }, []);
  
    // 6) 초기 그리드 생성
    const initializeGrid = useCallback(() => {
      if (!size) return;
      const grid = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ({
          state: FIRE_STATES.UNBURNED,
          temperature: 20,
          intensity: 0,
          burnTime: 0,
          fuelLoad: 1
        }))
      );
      setFireGrid(grid);
    }, [size]);
  
    // 7) 화재 확산 로직
    const spreadFire = useCallback((grid, deltaTime) => {
      if (!terrainData) return grid;
      const weather = weatherData?.[Math.floor(time)] || {};
      const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
  
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const cell = grid[i][j];
          if (cell.state !== FIRE_STATES.ACTIVE) continue;
  
          // Rothermel 기반 ROS 계산
          const slope  = computeSlopeFn(i, j);
          const ros    = computeRothermelROS(
            { fuelModel: fuelModelData[i][j], moisture: fuelMoistureData[i][j], slope },
            weather,
            cellSize
          );
          const distM  = ros * deltaTime;            // 퍼진 거리(m)
          const spreadCells = Math.ceil(distM / cellSize);
  
          // 인접 셀에 전파
          for (let di = -spreadCells; di <= spreadCells; di++) {
            for (let dj = -spreadCells; dj <= spreadCells; dj++) {
              const ni = i + di, nj = j + dj;
              if (
                ni >= 0 && ni < size && nj >= 0 && nj < size &&
                grid[ni][nj].state === FIRE_STATES.UNBURNED
              ) {
                newGrid[ni][nj].state = FIRE_STATES.IGNITING;
              }
            }
          }
        }
      }
  
      return newGrid;
    }, [
      terrainData, weatherData, fireGrid,
      computeSlopeFn, fuelModelData, fuelMoistureData,
      size, cellSize, time
    ]);
  
    // 8) 애니메이션 루프
    const step = useCallback(() => {
      setTime(t => t + 1);
      setFireGrid(g => spreadFire(g, 1)); // deltaTime = 1초
      animRef.current = requestAnimationFrame(step);
    }, [spreadFire]);
  
    const startSimulation = () => {
      if (!fireGrid) initializeGrid();
      setIsRunning(true);
    };
    const stopSimulation = () => {
      setIsRunning(false);
      cancelAnimationFrame(animRef.current);
    };
  
    useEffect(() => {
      if (isRunning) step();
      return () => cancelAnimationFrame(animRef.current);
    }, [isRunning, step]);
  
    // 9) 캔버스 렌더링
    useEffect(() => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !fireGrid) return;
      const w = size * 5, h = size * 5; // 화면용 스케일
      ctx.canvas.width = w; ctx.canvas.height = h;
  
      // 지형 배경
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const elev = terrainData.elevation[i][j];
          const shade = Math.min(255, Math.max(0, (elev / 1000) * 255));
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          ctx.fillRect(j*5, i*5, 5, 5);
        }
      }
  
      // 화재 그리기
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const cell = fireGrid[i][j];
          if (cell.state !== FIRE_STATES.UNBURNED) {
            const t = Math.min(1, cell.intensity);
            ctx.fillStyle = `rgba(255,0,0,${t})`;
            ctx.fillRect(j*5, i*5, 5, 5);
          }
        }
      }
    }, [fireGrid, terrainData, size]);
  
    // 10) 로딩/에디터 화면 분기
    if (
      !terrainData ||
      !fuelModelData ||
      !fuelMoistureData ||
      !canopyCoverData ||
      !weatherData
    ) {
      return (
        <div style={{ padding: 20 }}>
          <h2>데이터 업로드</h2>
          <div>
            <label>DEM (.asc): <input type="file" accept=".asc" onChange={handleDemUpload} /></label>
          </div>
          <div>
            <label>Fuel Model (.asc): <input type="file" accept=".asc" onChange={handleFuelUpload} /></label>
          </div>
          <div>
            <label>Fuel Moisture (.asc/.txt): <input type="file" accept=".asc,.txt" onChange={handleMoistureUpload} /></label>
          </div>
          <div>
            <label>Canopy Cover (.asc/.txt): <input type="file" accept=".asc,.txt" onChange={handleCanopyUpload} /></label>
          </div>
          <div>
            <label>Weather Data (.csv): <input type="file" accept=".csv" onChange={handleWeatherUpload} /></label>
          </div>
        </div>
      );
    }
  
    // 11) 메인 UI (시뮬레이션 뷰)
    return (
      <div style={{ display: 'flex' }}>
        <aside style={{ width: 200, padding: 10 }}>
          <button onClick={startSimulation} disabled={isRunning}>Start</button>
          <button onClick={stopSimulation}  disabled={!isRunning}>Stop</button>
          <div>Time: {time}s</div>
        </aside>
        <canvas ref={canvasRef} style={{ border: '1px solid #ccc' }} />
      </div>
    );
  }