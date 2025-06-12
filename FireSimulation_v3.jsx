import React, {
    useState, useEffect, useCallback, useMemo
  } from 'react';
  import DataUploader   from './simul/src/components/ui/DataUploader';
  import ControlPanel   from './simul/src/components/ui/ControlPanel';
  import CanvasView     from './simul/src/components/ui/CanvasView';
  import InfoPanel      from './simul/src/components/ui/InfoPanel';
  import { parseAscFile }      from './simul/src/utils/AscParser';
  import { parseWeatherCSV }   from './simul/src/utils/WeatherParser';
  import { computeRothermelROS } from './simul/src/utils/rothermel';
  import { computeSlope }      from './simul/src/utils/terrain';
  import {
    fuelModelParams,
    universalParams,
    FUEL_MODELS,
    FIRE_STATES
  } from './simul/src/utils/fuelModelParams';
  
  export default function FireSimulation() {
    // 1) 데이터 로드 상태
    const [terrainData,      setTerrainData]      = useState(null);
    const [fuelModelData,    setFuelModelData]    = useState(null);
    const [fuelMoistureData, setFuelMoistureData] = useState(null);
    const [canopyCoverData,  setCanopyCoverData]  = useState(null);
    const [weatherData,      setWeatherData]      = useState(null);
  
    // 2) 시뮬레이션 상태
    const [fireGrid, setFireGrid]   = useState(null);
    const [time,     setTime]       = useState(0);
    const [isRunning,setIsRunning]  = useState(false);
    const [speed,    setSpeed]      = useState(1);
    const [ignitionPoints, setIgnitionPoints] = useState([]);
    
    // 3) 지형 그리드 정보
    const cellSize = terrainData?.cellSize || 30;
    const size     = terrainData?.size     || 0;
  
    // 4) 경사 함수
    const computeSlopeFn = useMemo(() => {
      if (!terrainData?.elevation) return () => 0;
      return computeSlope(terrainData.elevation, cellSize);
    }, [terrainData, cellSize]);
  
    // 5) 파일 업로드 핸들러들
    const handleDemUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const { data, nrows, ncols, cellSize } = parseAscFile(text);
      setTerrainData({ elevation: data, size: nrows, cellSize });
    }, []);
  
    const handleFuelUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const { data } = parseAscFile(text, terrainData?.size);
      setFuelModelData(data);
    }, [terrainData]);
  
    const handleMoistureUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const { data } = parseAscFile(text, terrainData?.size);
      setFuelMoistureData(data);
    }, [terrainData]);
  
    const handleCanopyUpload = useCallback(async e => {
      const file = e.target.files?.[0]; if (!file) return;
      const text = await file.text();
      const { data } = parseAscFile(text, terrainData?.size);
      setCanopyCoverData(data);
    }, [terrainData]);
  
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
          intensity: 0
        }))
      );
      setFireGrid(grid);
    }, [size]);

    //발화점 선택 
    const handleCanvasClick = useCallback((e) => {
        if (isRunning || !terrainData) return;
        const rect = e.target.getBoundingClientRect();
        const scale = 5; // CanvasView에서 사용한 확대 배율
        const x = Math.floor((e.clientX - rect.left) / scale);
        const y = Math.floor((e.clientY - rect.top)  / scale);
        if (x < 0 || x >= size || y < 0 || y >= size) return;
        setIgnitionPoints(pts => {
            // 중복 방지
            if (pts.find(p => p.x===x && p.y===y)) return pts;
            return [...pts, { x, y }];
        });
    }, [isRunning, terrainData, size]);
  
    // 7) 확산 로직
    const spreadFire = useCallback((grid, dt) => {
      if (!terrainData) return grid;
      const weather = weatherData?.[Math.floor(time)] || {};
      const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
  
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (grid[i][j].state !== FIRE_STATES.ACTIVE) continue;
          const slope = computeSlopeFn(i,j);
          const ros = computeRothermelROS(
            { fuelModel: fuelModelData[i][j], moisture: fuelMoistureData[i][j], slope },
            weather,
            cellSize
          );
          const distM = ros * dt * speed;
          const spreadCells = Math.ceil(distM / cellSize);
  
          for (let di=-spreadCells; di<=spreadCells; di++) {
            for (let dj=-spreadCells; dj<=spreadCells; dj++) {
              const ni=i+di, nj=j+dj;
              if (
                ni>=0 && ni<size && nj>=0 && nj<size &&
                grid[ni][nj].state===FIRE_STATES.UNBURNED
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
      size, cellSize, time, speed
    ]);
  
    // 8) 애니메이션 루프
    useEffect(() => {
      if (!isRunning) return;
      const id = setInterval(() => {
        setTime(t=>t+1);
        setFireGrid(g => spreadFire(g,1));
      }, 1000);
      return () => clearInterval(id);
    }, [isRunning, spreadFire]);
  
    // 9) Load → Simulation 화면 전환
    if (
      !terrainData ||
      !fuelModelData ||
      !fuelMoistureData ||
      !canopyCoverData ||
      !weatherData
    ) {
      return (
        <div className="p-6">
          <DataUploader
            onDemUpload={handleDemUpload}
            onFuelUpload={handleFuelUpload}
            onMoistureUpload={handleMoistureUpload}
            onCanopyUpload={handleCanopyUpload}
            onWeatherUpload={handleWeatherUpload}
          />
        </div>
      );
    }
  
    return (
      <div className="h-screen flex">
        <aside className="w-80 p-6 space-y-6 bg-blue-50 border-r border-blue-100 overflow-auto">
          <DataUploader
            onDemUpload={handleDemUpload}
            onFuelUpload={handleFuelUpload}
            onMoistureUpload={handleMoistureUpload}
            onCanopyUpload={handleCanopyUpload}
            onWeatherUpload={handleWeatherUpload}
          />
          <ControlPanel
            isRunning={isRunning}
            onStart={()=>{
              if (!fireGrid) initializeGrid();
              setIsRunning(true);
            }}
            onStop={()=>setIsRunning(false)}
            time={time}
            speed={speed}
            onSpeedChange={setSpeed}
          />
        </aside>
        <main className="flex-1 p-6 bg-gray-100 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-white shadow overflow-hidden">
              <CanvasView
                terrainData={terrainData}
                fireGrid={fireGrid}
                cellSize={cellSize}
                ignitionPoints={ignitionPoints}
                onCanvasClick={handleCanvasClick}
              />
            </div>
            <InfoPanel
              fireGrid={fireGrid}
              terrainData={terrainData}
              cellSize={cellSize}
            />
          </div>
        </main>
      </div>
    );
  }
  