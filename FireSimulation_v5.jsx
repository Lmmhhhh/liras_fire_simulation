// src/components/FireSimulation.jsx
import React, {
  useState, useEffect, useCallback, useMemo
} from 'react';
import DataUploader     from './simul/src/components/ui/DataUploader';
import ControlPanel     from './simul/src/components/ui/ControlPanel';
import CanvasView       from './simul/src/components/ui/CanvasView';
import InfoPanel        from './simul/src/components/ui/InfoPanel';
import { parseAscFile }      from './simul/src/utils/AscParser';
import { parseWeatherCSV }   from './simul/src/utils/WeatherParser';
import { computeRothermelROS } from './simul/src/utils/rothermel';
import { computeSlope }      from './simul/src/utils/terrain';
import {
  FUEL_MODELS,
  FIRE_STATES
} from './simul/src/utils/fuelModelParams';

export default function FireSimulation() {
  // --- 데이터 상태 ---
  const [terrainData,      setTerrainData]      = useState(null);
  const [fuelModelData,    setFuelModelData]    = useState(null);
  const [fuelMoistureData, setFuelMoistureData] = useState(null);
  const [canopyCoverData,  setCanopyCoverData]  = useState(null);
  const [weatherData,      setWeatherData]      = useState(null);

  // 업로드된 파일명 표시용
  const [filenames, setFilenames] = useState({
    dem:'', fuel:'', moisture:'', canopy:'', weather:''
  });

  // --- 시뮬 상태 ---
  const [fireGrid,         setFireGrid]         = useState(null);
  const [ignitionPoints,   setIgnitionPoints]   = useState([]);
  const [time,             setTime]             = useState(0);       // 초 단위
  const [isRunning,        setIsRunning]        = useState(false);
  const [speed,            setSpeed]            = useState(1);       // 속도 배율

  // --- 그리드 메타 ---
  const cellSize = terrainData?.cellSize || 30;
  const size     = terrainData?.size     || 0;

  // --- 클릭 핸들러 ---
  const handleCanvasClick = useCallback(e => {
    if (isRunning || !terrainData) return;
    const rect  = e.target.getBoundingClientRect(),
          scale = 5,
          x     = Math.floor((e.clientX - rect.left )/ scale),
          y     = Math.floor((e.clientY - rect.top  )/ scale);
    if (x<0 || x>=size || y<0 || y>=size) return;
    setIgnitionPoints(prev => {
      if (prev.some(p=>p.x===x && p.y===y)) return prev;
      return [...prev, { x, y }];
    });
  }, [isRunning, terrainData, size]);

  // --- 파일 업로드 핸들러들 ---
  const handleDemUpload = useCallback(async e => {
    const f = e.target.files?.[0]; if (!f) return;
    setFilenames(fn=>({ ...fn, dem: f.name }));
    const text = await f.text();
    const { data, nrows, cellSize: cs } = parseAscFile(text);
    setTerrainData({ elevation: data, size: nrows, cellSize: cs });
  }, []);

  const handleFuelUpload = useCallback(async e => {
    const f = e.target.files?.[0]; if (!f) return;
    setFilenames(fn=>({ ...fn, fuel: f.name }));
    const text = await f.text();
    const { data } = parseAscFile(text, terrainData.size);
    setFuelModelData(data);
  }, [terrainData]);

  const handleMoistureUpload = useCallback(async e => {
    const f = e.target.files?.[0]; if (!f) return;
    setFilenames(fn=>({ ...fn, moisture: f.name }));
    const text = await f.text();
    const { data } = parseAscFile(text, terrainData.size);
    setFuelMoistureData(data);
  }, [terrainData]);

  const handleCanopyUpload = useCallback(async e => {
    const f = e.target.files?.[0]; if (!f) return;
    setFilenames(fn=>({ ...fn, canopy: f.name }));
    const text = await f.text();
    const { data } = parseAscFile(text, terrainData.size);
    setCanopyCoverData(data);
  }, [terrainData]);

  const handleWeatherUpload = useCallback(async e => {
    const f = e.target.files?.[0]; if (!f) return;
    setFilenames(fn=>({ ...fn, weather: f.name }));
    const text = await f.text();
    const parsed = parseWeatherCSV(text);
    setWeatherData(parsed);
  }, []);

  // --- 리셋(초기화) ---
  const handleReset = useCallback(() => {
    setIgnitionPoints([]);
    setFireGrid(null);
    setTime(0);
    setIsRunning(false);
  }, []);

  // --- 격자 초기화 ---
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

  // --- 경사 함수 ---
  const computeSlopeFn = useMemo(() => {
    if (!terrainData?.elevation) return () => 0;
    return computeSlope(terrainData.elevation, cellSize);
  }, [terrainData, cellSize]);

  // --- 확산 로직 (Rothermel) ---
  const spreadFire = useCallback((grid, dt) => {
    if (!terrainData || !weatherData) return grid;
    // 기상은 1시간 단위로 바꾼 인덱스
    const hourIdx = Math.floor(time / 3600) % weatherData.length;
    const w       = weatherData[hourIdx] || {};
    const newGrid = grid.map(r => r.map(c => ({ ...c })));

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const st = grid[i][j].state;
        // IGNITING → 바로 ACTIVE
        if (st === FIRE_STATES.IGNITING) {
          newGrid[i][j].state = FIRE_STATES.ACTIVE;
        }
        if (newGrid[i][j].state !== FIRE_STATES.ACTIVE) continue;

        const slope = computeSlopeFn(i, j);
        const ros   = computeRothermelROS(
          {
            fuelModel: fuelModelData[i][j],
            moisture:  fuelMoistureData[i][j],
            slope
          },
          w,
          cellSize
        );
        const spreadDist = ros * dt;          // m
        const steps      = Math.ceil(spreadDist / cellSize);

        for (let di = -steps; di <= steps; di++) {
          for (let dj = -steps; dj <= steps; dj++) {
            const ni = i + di, nj = j + dj;
            if (
              ni >= 0 && ni < size &&
              nj >= 0 && nj < size &&
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
    terrainData, weatherData, fuelModelData, fuelMoistureData,
    size, cellSize, time, speed, computeSlopeFn
  ]);

  // --- 애니메이션 루프 (dt = speed 초마다) ---
  useEffect(() => {
    if (!isRunning) return;
    const iid = setInterval(() => {
      setTime(t => t + speed);
      setFireGrid(g => (g ? spreadFire(g, speed) : g));
    }, 1000);
    return () => clearInterval(iid);
  }, [isRunning, spreadFire, speed]);

  // --- 로딩/업로드 화면 ---
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
          filenames={filenames}
        />
      </div>
    );
  }

  // --- 현재 기상 정보 for ControlPanel ---
  const hourIndex     = Math.floor(time / 3600) % weatherData.length;
  const currentWeather = weatherData[hourIndex] || {};

  return (
    <div className="h-screen flex">
      <aside className="w-80 p-6 space-y-6 bg-blue-50 border-r border-blue-100 overflow-auto">
        {/* 업로드 + 컨트롤 패널 */}
        <DataUploader
          onDemUpload={handleDemUpload}
          onFuelUpload={handleFuelUpload}
          onMoistureUpload={handleMoistureUpload}
          onCanopyUpload={handleCanopyUpload}
          onWeatherUpload={handleWeatherUpload}
          filenames={filenames}
        />
        <ControlPanel
          isRunning   ={isRunning}
          onStart     ={() => { if(!fireGrid) initializeGrid(); setIsRunning(true); }}
          onStop      ={() => setIsRunning(false)}
          onReset     ={handleReset}
          time        ={time}
          speed       ={speed}
          onSpeedChange={setSpeed}
          weather     ={currentWeather}
        />
      </aside>
      <main className="flex-1 p-6 bg-gray-100 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 캔버스 뷰 */}
          <div className="rounded-xl bg-white shadow overflow-hidden">
            <CanvasView
              terrainData     ={terrainData}
              fireGrid        ={fireGrid}
              ignitionPoints  ={ignitionPoints}
              onCanvasClick   ={handleCanvasClick}
            />
          </div>

          {/* 실시간 통계 */}
          <InfoPanel
            fireGrid    ={fireGrid}
            terrainData ={terrainData}
            cellSize    ={cellSize}
          />
        </div>
      </main>
    </div>
  );
}
