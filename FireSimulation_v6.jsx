import React, {
    useState,
    useEffect,
    useCallback,
    useMemo
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
  
  /** 간단 토스트 메시지 */
  function Toast({ message, type = 'info', onClose }) {
    useEffect(() => {
      const id = setTimeout(onClose, 3000);
      return () => clearTimeout(id);
    }, [onClose]);
    const bg = {
      info:    'bg-blue-500',
      success: 'bg-green-500',
      error:   'bg-red-500'
    }[type] || 'bg-gray-500';
    return (
      <div className={`${bg} fixed top-4 right-4 text-white px-4 py-2 rounded-lg shadow-lg`}>
        {message}
      </div>
    );
  }
  
  export default function FireSimulation() {
    // --- 데이터 상태 ---
    const [terrainData,      setTerrainData]      = useState(null);
    const [fuelModelData,    setFuelModelData]    = useState(null);
    const [fuelMoistureData, setFuelMoistureData] = useState(null);
    const [canopyCoverData,  setCanopyCoverData]  = useState(null);
    const [weatherData,      setWeatherData]      = useState(null);
  
    // 업로드된 파일명
    const [filenames, setFilenames] = useState({
      dem:'', fuel:'', moisture:'', canopy:'', weather:''
    });
  
    // --- 시뮬 상태 ---
    const [fireGrid,       setFireGrid]       = useState(null);
    const [ignitionPoints, setIgnitionPoints] = useState([]);
    const [time,           setTime]           = useState(0);     // seconds
    const [isRunning,      setIsRunning]      = useState(false);
    const [speed,          setSpeed]          = useState(1);     // multiplier
  
    // --- 수동 기상 & 토스트 ---
    const [manualWeather, setManualWeather] = useState({
      temperature: 20,
      humidity:    50,
      windSpeed:   5,
      precipitation: 0
    });
    const [toast, setToast] = useState(null);
  
    // --- 그리드 메타 ---
    const cellSize = terrainData?.cellSize || 30;
    const size     = terrainData?.size     || 0;
  
    // --- 클릭 핸들러 (발화점) ---
    const handleCanvasClick = useCallback(e => {
      if (isRunning || !terrainData) return;
      const rect  = e.currentTarget.getBoundingClientRect();
      const scale = 5;
      const x = Math.floor((e.clientX - rect.left) / scale);
      const y = Math.floor((e.clientY - rect.top)  / scale);
      if (x<0||x>=size||y<0||y>=size) return;
      setIgnitionPoints(prev => {
        if (prev.some(p=>p.x===x && p.y===y)) return prev;
        return [...prev, { x, y }];
      });
    }, [isRunning, terrainData, size]);
  
    // --- 파일 업로드 핸들러들 ---
    const handleDemUpload = useCallback(async e => {
      const f = e.target.files?.[0]; if (!f) return;
      setFilenames(fn=>({...fn,dem:f.name}));
      const text = await f.text();
      const { data, nrows, cellSize: cs } = parseAscFile(text);
      setTerrainData({ elevation: data, size: nrows, cellSize: cs });
    }, []);
    const handleFuelUpload = useCallback(async e => {
      const f = e.target.files?.[0]; if (!f) return;
      setFilenames(fn=>({...fn,fuel:f.name}));
      const text = await f.text();
      const { data } = parseAscFile(text, terrainData.size);
      setFuelModelData(data);
    }, [terrainData]);
    const handleMoistureUpload = useCallback(async e => {
      const f = e.target.files?.[0]; if (!f) return;
      setFilenames(fn=>({...fn,moisture:f.name}));
      const text = await f.text();
      const { data } = parseAscFile(text, terrainData.size);
      setFuelMoistureData(data);
    }, [terrainData]);
    const handleCanopyUpload = useCallback(async e => {
      const f = e.target.files?.[0]; if (!f) return;
      setFilenames(fn=>({...fn,canopy:f.name}));
      const text = await f.text();
      const { data } = parseAscFile(text, terrainData.size);
      setCanopyCoverData(data);
    }, [terrainData]);
    const handleWeatherUpload = useCallback(async e => {
      const f = e.target.files?.[0]; if (!f) return;
      setFilenames(fn=>({...fn,weather:f.name}));
      const text = await f.text();
      setWeatherData(parseWeatherCSV(text));
    }, []);
  
    // --- 초기화 리셋 ---
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
      if (!terrainData || (!weatherData && !manualWeather)) return grid;
      const w = weatherData
        ? weatherData[Math.floor(time/3600) % weatherData.length]
        : manualWeather;
      const newGrid = grid.map(r => r.map(c => ({ ...c })));
      for (let i=0; i<size; i++) {
        for (let j=0; j<size; j++) {
          const st = grid[i][j].state;
          if (st === FIRE_STATES.IGNITING) newGrid[i][j].state = FIRE_STATES.ACTIVE;
          if (newGrid[i][j].state !== FIRE_STATES.ACTIVE) continue;
          const slope = computeSlopeFn(i,j);
          const ros   = computeRothermelROS(
            { fuelModel: fuelModelData[i][j], moisture: fuelMoistureData[i][j], slope },
            w,
            cellSize
          );
          const dist  = ros * dt;
          const steps = Math.ceil(dist/cellSize);
          for (let di=-steps; di<=steps; di++) {
            for (let dj=-steps; dj<=steps; dj++) {
              const ni=i+di, nj=j+dj;
              if (ni>=0&&ni<size&&nj>=0&&nj<size&&grid[ni][nj].state===FIRE_STATES.UNBURNED) {
                newGrid[ni][nj].state = FIRE_STATES.IGNITING;
              }
            }
          }
        }
      }
      return newGrid;
    }, [
      terrainData, weatherData, manualWeather,
      fuelModelData, fuelMoistureData,
      size, cellSize, time, speed, computeSlopeFn
    ]);
  
    // --- 애니메이션 루프 ---
    useEffect(() => {
      if (!isRunning) return;
      const id = setInterval(() => {
        setTime(t => t + speed);
        setFireGrid(g => g ? spreadFire(g, speed) : g);
      }, 1000);
      return () => clearInterval(id);
    }, [isRunning, spreadFire, speed]);
  
    // --- 진화 완료 감지 & 토스트 ---
    useEffect(() => {
      if (!isRunning || !fireGrid) return;
      const anyBurning = fireGrid.some(row =>
        row.some(c => c.state===FIRE_STATES.ACTIVE || c.state===FIRE_STATES.IGNITING)
      );
      if (!anyBurning) {
        setIsRunning(false);
        setToast({ message: '🔥 모든 화재가 진화되었습니다!', type: 'success' });
      }
    }, [fireGrid, isRunning]);
  
    // --- 로딩/업로드 화면 ---
    if (
      !terrainData||
      !fuelModelData||
      !fuelMoistureData||
      !canopyCoverData||
      !(weatherData||manualWeather)
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
  
    // --- 현재 기상 ---
    const currentWeather = weatherData
      ? weatherData[Math.floor(time/3600)%weatherData.length] 
      : manualWeather;
  
    return (
      <>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        <div className="h-screen flex">
          <aside className="w-80 p-6 space-y-6 bg-blue-50 border-r border-blue-100 overflow-auto">
            <DataUploader
              onDemUpload={handleDemUpload}
              onFuelUpload={handleFuelUpload}
              onMoistureUpload={handleMoistureUpload}
              onCanopyUpload={handleCanopyUpload}
              onWeatherUpload={handleWeatherUpload}
              filenames={filenames}
            />
            <ControlPanel
              isRunning       ={isRunning}
              onStart         ={() => { if(!fireGrid) initializeGrid(); setIsRunning(true); }}
              onStop          ={() => setIsRunning(false)}
              onReset         ={handleReset}
              time            ={time}
              speed           ={speed}
              onSpeedChange   ={setSpeed}
              weather         ={currentWeather}
              manualMode      ={!weatherData}
              onManualWeatherChange={(f,v)=>setManualWeather(mw=>({...mw,[f]:v}))}
            />
          </aside>
          <main className="flex-1 p-6 bg-gray-100 overflow-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-white shadow overflow-hidden">
                <CanvasView
                  terrainData   ={terrainData}
                  fireGrid      ={fireGrid}
                  ignitionPoints={ignitionPoints}
                  onCanvasClick ={handleCanvasClick}
                />
              </div>
              <InfoPanel
                fireGrid    ={fireGrid}
                terrainData ={terrainData}
                cellSize    ={cellSize}
              />
            </div>
          </main>
        </div>
      </>
    );
  }
  