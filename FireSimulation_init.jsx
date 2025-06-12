import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Upload, Play, Pause, RotateCcw, Save, Flame, Wind, Mountain, Droplets, TreePine, Settings, Thermometer, Navigation, Leaf, Cloud, Gauge, FileText, AlertCircle, Activity, MapPin, Clock, BarChart3, Zap, Eye } from 'lucide-react';
import { parseAscFile } from './simul/src/utils/AscParser';
import { parseWeatherCSV } from './simul/src/utils/WeatherParser';
import { FUEL_MODELS } from './simul/src/data/FuelModels';
import { computeSlope } from './simul/src/utils/terrain';
import { computeRothermelROS } from './simul/src/utils/rothermel';


const FIRE_STATES = {
  UNBURNED: 0,
  IGNITING: 1,
  ACTIVE: 2,
  DECLINING: 3,
  BURNED_OUT: 4
};

export default function FireSimulation() {

  // ---- 상태관리 ----
  const [terrainData, setTerrainData] = useState(null);
  const [fireGrid, setFireGrid] = useState(null);
  const [fuelModelData, setFuelModelData] = useState(null);
  const [fuelMoistureData, setFuelMoistureData] = useState(null);
  const [canopyCoverData, setCanopyCoverData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [ignitionPoints, setIgnitionPoints] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [message, setMessage] = useState('지형 데이터를 업로드하거나 생성하세요');

  const [params, setParams] = useState({
    windSpeed: 20,
    windDirection: 180,
    temperature: 30,
    humidity: 40,
    moistureContent: 8,
    fuelModel: 8,
    visualMode: 'elevation',
    timeStep: 0.5,
    simSpeed: 1.0,
    useWeatherData: true
  });

  // ---- 참조 ----
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const fileInputRef = useRef(null);
  const moistureInputRef = useRef(null);
  const canopyInputRef = useRef(null);
  const fuelModelInputRef = useRef(null);
  const weatherInputRef = useRef(null);

  // ---- 초기화 ----
  const initializeFireGrid = useCallback((size) => {
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({
        state: FIRE_STATES.UNBURNED,
        temperature: 20,
        intensity: 0,
        burnTime: 0,
        fuelLoad: 1,
        spreadRate: 0
      }))
    );
    setFireGrid(grid);
  }, []);

  // ---- 샘플 지형 생성 ----
  const generateTerrain = useCallback(() => {
    const size = 80;
    const elevation = [];
    const fuelModel = [];
    const canopy = [];
    const moisture = [];
    for (let i = 0; i < size; i++) {
      elevation[i] = [];
      fuelModel[i] = [];
      canopy[i] = [];
      moisture[i] = [];
      for (let j = 0; j < size; j++) {
        const distFromEdge = Math.min(i, j, size - 1 - i, size - 1 - j) / size;
        let elev = 100 + Math.sin(i * 0.1) * 50 + Math.cos(j * 0.1) * 50 + (Math.random() - 0.5) * 20;
        if (distFromEdge < 0.1) elev = -10 + Math.random() * 20;
        elevation[i][j] = elev;
        if (elev <= 0) fuelModel[i][j] = 0;
        else if (elev < 50) fuelModel[i][j] = Math.floor(1 + Math.random() * 3);
        else if (elev < 200) fuelModel[i][j] = Math.floor(5 + Math.random() * 3);
        else fuelModel[i][j] = Math.floor(8 + Math.random() * 3);
        canopy[i][j] = elev > 50 ? 30 + Math.random() * 50 : 0;
        moisture[i][j] = Math.max(5, Math.min(25, 15 - elev * 0.05 + Math.random() * 10));
      }
    }
    setTerrainData({ elevation, size });
    setFuelModelData(fuelModel);
    setCanopyCoverData(canopy);
    setFuelMoistureData(moisture);
    initializeFireGrid(size);
    setMessage('지형이 생성되었습니다. 캔버스를 클릭하여 발화점을 설정하세요.');
  }, [initializeFireGrid]);

  const cellSize = terrainData?.cellSize || 30;

  // ---- 파일 업로드 핸들러 ----
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const { data } = parseAscFile(text, 80);
    setTerrainData({ elevation: data, size: data.length });
    initializeFireGrid(data.length);
    setMessage('지형 데이터가 로드되었습니다.');
  }, [initializeFireGrid]);

  const handleMoistureUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const { data } = parseAscFile(text, terrainData?.size || 80);
    setFuelMoistureData(data);
  }, [terrainData]);

  const handleCanopyUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const { data } = parseAscFile(text, terrainData?.size || 80);
    setCanopyCoverData(data);
  }, [terrainData]);

  const handleFuelModelUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const { data } = parseAscFile(text, terrainData?.size || 80);
    setFuelModelData(data);
  }, [terrainData]);

  const handleWeatherUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const weather = parseWeatherCSV(text);
    setWeatherData(weather);
    setParams(p => ({ ...p, useWeatherData: true }));
    setMessage('기상 데이터가 로드되었습니다.');
  }, []);

  // ---- 발화점 클릭 ----
  const handleCanvasClick = useCallback((e) => {
    if (isRunning || !terrainData) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * terrainData.size / rect.width);
    const y = Math.floor((e.clientY - rect.top) * terrainData.size / rect.height);
    if (x >= 0 && x < terrainData.size && y >= 0 && y < terrainData.size) {
      const elev = terrainData.elevation[y]?.[x] || 0;
      if (elev > 0) {
        setIgnitionPoints([...ignitionPoints, { x, y }]);
        setMessage(`발화점 추가: (${x}, ${y})`);
      } else {
        setMessage('바다에는 발화점을 설정할 수 없습니다');
      }
    }
  }, [isRunning, terrainData, ignitionPoints]);

  // ---- 시뮬레이션 시작 ----
  const startSimulation = useCallback(() => {
    if (!terrainData || ignitionPoints.length === 0) {
      setMessage('발화점을 설정하세요');
      return;
    }
    const newGrid = JSON.parse(JSON.stringify(fireGrid));
    ignitionPoints.forEach(point => {
      if (newGrid[point.y] && newGrid[point.y][point.x]) {
        newGrid[point.y][point.x].temperature = 400;
        newGrid[point.y][point.x].state = FIRE_STATES.IGNITING;
      }
    });
    setFireGrid(newGrid);
    setIsRunning(true);
    lastUpdateRef.current = Date.now();
    setMessage('시뮬레이션 시작');
  }, [terrainData, ignitionPoints, fireGrid]);

  // ---- 현재 시간대의 기상 데이터 ----
  const getCurrentWeather = useCallback(() => {
    if (!weatherData || !params.useWeatherData) return params;
    const h = Math.floor(time / 60) % 24;
    return weatherData.find(w => w.hour === h) || weatherData[0];
  }, [weatherData, params, time]);

  // ---- 화재 확산 로직 ----
 // ===== src/components/FireSimulation.jsx (useCallback 수정) =====


// ---- 화재 확산 로직 (Rothermel 기반) ----

// 경사 계산 함수 생성 (useMemo)
const computeSlopeFn = useMemo(
  () => computeSlope(terrainData.elevation, cellSize),
  [terrainData, cellSize]
);


// ---- 화재 확산 로직 (Rothermel 기반) ----
const spreadFire = useCallback((grid, deltaTime) => {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
  const size = terrainData.size;
  const weather = getCurrentWeather();

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const cell = grid[i][j];
      const elev = terrainData.elevation[i][j];
      if (elev <= 0 || cell.state !== FIRE_STATES.ACTIVE) continue;

      // 연료모델 인덱스 결정
      let idx = params.fuelModel;
      if (fuelModelData?.[i]?.[j] != null) idx = fuelModelData[i][j];
      if (idx === 0) continue;

      // moisture, slope 가져오기
      const moisture = fuelMoistureData?.[i]?.[j] ?? params.moistureContent;
      const slope    = computeSlopeFn(i, j); // terrainData 기반

      // ROS 계산
      const ros = computeRothermelROS({ fuelModel: idx, moisture, slope }, weather, cellSize);
      const spreadDist  = ros * deltaTime;
      const spreadCells = Math.ceil(spreadDist / cellSize);

      // 인접 셀로 확산
      for (let di = -spreadCells; di <= spreadCells; di++) {
        for (let dj = -spreadCells; dj <= spreadCells; dj++) {
          const ni = i + di, nj = j + dj;
          if (!isValid(ni, nj)) continue;
          if (newGrid[ni][nj].state === FIRE_STATES.UNBURNED) {
            newGrid[ni][nj].state = FIRE_STATES.IGNITING;
          }
        }
      }

      // 연소 진행
      newGrid[i][j].burnTime += deltaTime;
      if (newGrid[i][j].burnTime > burnDuration) {
        newGrid[i][j].state = FIRE_STATES.BURNT;
      }
    }
  }

  return newGrid;
}, [terrainData, params, fuelModelData, fuelMoistureData, computeSlope, getCurrentWeather, cellSize]);

  // ---- 렌더링 ----
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !terrainData) return;
    const ctx = canvas.getContext('2d');
    const size = terrainData.size;
    const cellSize = canvas.width / size;
    
    // 그라데이션 배경
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f0f0f0');
    gradient.addColorStop(1, '#e0e0e0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
      const elev = terrainData.elevation[i][j];
      let color = '#90EE90';
      if (elev <= 0) {
        // 물 효과 개선
        const waterGradient = ctx.createRadialGradient(
          j * cellSize + cellSize/2, i * cellSize + cellSize/2, 0,
          j * cellSize + cellSize/2, i * cellSize + cellSize/2, cellSize
        );
        waterGradient.addColorStop(0, '#5BA3E0');
        waterGradient.addColorStop(1, '#4682B4');
        ctx.fillStyle = waterGradient;
      } else if (params.visualMode === 'elevation') {
        const n = Math.max(0, Math.min(1, elev / 500));
        const r = Math.floor(139 - 39 * n);
        const g = Math.floor(90 + 100 * n);
        const b = Math.floor(63 + 37 * n);
        color = `rgb(${r},${g},${b})`;
        ctx.fillStyle = color;
      } else if (params.visualMode === 'moisture' && fuelMoistureData) {
        const m = fuelMoistureData[i][j] / 30;
        color = `rgb(${255 * (1 - m)},${100 + 155 * m},${255 * m})`;
        ctx.fillStyle = color;
      } else if (params.visualMode === 'canopy' && canopyCoverData) {
        const c = canopyCoverData[i][j] / 100;
        color = `rgb(${50 - 30 * c},${100 + 100 * c},${50 - 30 * c})`;
        ctx.fillStyle = color;
      } else if (params.visualMode === 'fuelModel' && fuelModelData) {
        const f = fuelModelData[i][j];
        color = `hsl(${f * 25},70%,50%)`;
        ctx.fillStyle = color;
      }
      ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      
      // 셀 경계선 추가 (subtle)
      ctx.strokeStyle = 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(j * cellSize, i * cellSize, cellSize, cellSize);
    }
    
    // 화재 렌더링 개선
    if (fireGrid) for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
      const cell = fireGrid[i][j];
      if (cell.state === FIRE_STATES.BURNED_OUT) {
        ctx.fillStyle = 'rgba(40,40,40,0.8)';
        ctx.fillRect(j * cellSize, i * cellSize, cellSize, cellSize);
      } else if (cell.state !== FIRE_STATES.UNBURNED) {
        const intensity = cell.intensity || 0;
        const x = j * cellSize + cellSize / 2;
        const y = i * cellSize + cellSize / 2;
        
        // 화재 광원 효과
        const fireGradient = ctx.createRadialGradient(x, y, 0, x, y, cellSize * intensity);
        
        if (cell.state === FIRE_STATES.IGNITING) {
          fireGradient.addColorStop(0, `rgba(255,${200 * intensity},0,1)`);
          fireGradient.addColorStop(0.5, `rgba(255,${150 * intensity},0,0.8)`);
          fireGradient.addColorStop(1, `rgba(255,${100 * intensity},0,0)`);
        } else if (cell.state === FIRE_STATES.ACTIVE) {
          fireGradient.addColorStop(0, `rgba(255,255,255,${intensity})`);
          fireGradient.addColorStop(0.3, `rgba(255,${200 * intensity},0,1)`);
          fireGradient.addColorStop(0.6, `rgba(255,${100 * intensity},0,0.8)`);
          fireGradient.addColorStop(1, `rgba(255,0,0,0)`);
        } else if (cell.state === FIRE_STATES.DECLINING) {
          fireGradient.addColorStop(0, `rgba(${255 * intensity},${100 * intensity},0,${intensity})`);
          fireGradient.addColorStop(1, `rgba(${200 * intensity},0,0,0)`);
        }
        
        ctx.fillStyle = fireGradient;
        ctx.fillRect(j * cellSize, i * cellSize, cellSize * 2, cellSize * 2);
      }
    }
    
    // 발화점 표시 개선
    ignitionPoints.forEach((p, idx) => {
      const x = p.x * cellSize + cellSize / 2;
      const y = p.y * cellSize + cellSize / 2;
      
      // 외곽 발광 효과
      ctx.shadowColor = '#FF0000';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // 중심 원
      ctx.fillStyle = '#FF4444';
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      // 번호
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${idx + 1}`, x, y);
    });
    
    // 풍향 표시 개선
    if (params.windSpeed > 0) {
      const w = getCurrentWeather();
      const cx = canvas.width - 50, cy = 50;
      const r = w.windDirection * Math.PI / 180;
      
      // 배경 원
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
      ctx.fill();
      
      // 풍향 화살표
      ctx.strokeStyle = '#0066CC';
      ctx.fillStyle = '#0066CC';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(r) * 20, cy - Math.sin(r) * 20);
      ctx.lineTo(cx + Math.cos(r) * 20, cy + Math.sin(r) * 20);
      ctx.stroke();
      
      // 화살표 머리
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(r) * 20, cy + Math.sin(r) * 20);
      ctx.lineTo(cx + Math.cos(r - 0.5) * 12, cy + Math.sin(r - 0.5) * 12);
      ctx.lineTo(cx + Math.cos(r + 0.5) * 12, cy + Math.sin(r + 0.5) * 12);
      ctx.closePath();
      ctx.fill();
      
      // 방위 표시
      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('N', cx, cy - 25);
    }
  }, [terrainData, fireGrid, ignitionPoints, params, fuelMoistureData, canopyCoverData, fuelModelData, getCurrentWeather]);

  // ---- 애니메이션 루프 ----
  useEffect(() => {
    if (isRunning && fireGrid) {
      const animate = () => {
        const now = Date.now();
        const deltaTime = Math.min((now - lastUpdateRef.current) / 1000 * params.simSpeed, 0.1);
        lastUpdateRef.current = now;
        setFireGrid(prevGrid => spreadFire(prevGrid, deltaTime));
        setTime(prevTime => prevTime + deltaTime * 60);
        render();
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      render();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, fireGrid, spreadFire, render, params.simSpeed]);

  // ---- 통계 계산 ----
  const fireStats = React.useMemo(() => {
    if (!fireGrid) return { active: 0, burned: 0, total: 0, area: 0 };
    let active = 0, burned = 0, total = 0;
    fireGrid.forEach(row => {
      row.forEach(cell => {
        if (cell.state === FIRE_STATES.ACTIVE || cell.state === FIRE_STATES.IGNITING) active++;
        if (cell.state === FIRE_STATES.BURNED_OUT) burned++;
        if (cell.state !== FIRE_STATES.UNBURNED) total++;
      });
    });
    const area = total * 0.09; // 각 셀을 30m x 30m로 가정(헥타르)
    return { active, burned, total, area };
  }, [fireGrid]);

  const weather = getCurrentWeather();

  // ---- UI ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 섹션 */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-8 mb-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl text-white">
                  <Flame className="w-8 h-8" />
                </div>
                고급 화재 시뮬레이션 시스템
              </h1>
              <p className="text-gray-600 text-lg">{message}</p>
            </div>
            <div className={`px-4 py-2 rounded-full font-medium ${isRunning ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
              {isRunning ? '시뮬레이션 실행 중' : '대기 중'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 왼쪽 사이드바 */}
          <div className="lg:col-span-1 space-y-4">
            {/* 지형 데이터 카드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
              <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-gray-800">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mountain className="w-5 h-5 text-blue-600" />
                </div>
                지형 데이터
              </h3>
              <input ref={fileInputRef} type="file" accept=".asc,.txt,.csv" onChange={handleFileUpload} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full mb-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-[1.02] font-medium shadow-md"
              >
                <Upload className="w-4 h-4 inline mr-2" />
                파일 업로드
              </button>
              <button
                onClick={generateTerrain}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-[1.02] font-medium shadow-md"
              >
                <Zap className="w-4 h-4 inline mr-2" />
                샘플 지형 생성
              </button>
            </div>

            {/* 연료 특성 데이터 카드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
              <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-gray-800">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Leaf className="w-5 h-5 text-green-600" />
                </div>
                연료 특성 데이터
              </h3>
              
              <input ref={moistureInputRef} type="file" accept=".csv,.txt" onChange={handleMoistureUpload} className="hidden" />
              <input ref={canopyInputRef} type="file" accept=".asc,.txt" onChange={handleCanopyUpload} className="hidden" />
              <input ref={fuelModelInputRef} type="file" accept=".asc,.txt" onChange={handleFuelModelUpload} className="hidden" />
              
              <div className="space-y-2">
                <button
                  onClick={() => moistureInputRef.current?.click()}
                  className="w-full px-4 py-2.5 bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-xl hover:bg-cyan-100 transition-colors font-medium"
                >
                  <Droplets className="w-4 h-4 inline mr-2" />
                  연료 수분
                </button>
                
                <button
                  onClick={() => canopyInputRef.current?.click()}
                  className="w-full px-4 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-xl hover:bg-green-100 transition-colors font-medium"
                >
                  <TreePine className="w-4 h-4 inline mr-2" />
                  수관 피복율
                </button>
                
                <button
                  onClick={() => fuelModelInputRef.current?.click()}
                  className="w-full px-4 py-2.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-xl hover:bg-orange-100 transition-colors font-medium"
                >
                  <Flame className="w-4 h-4 inline mr-2" />
                  연료 모델
                </button>
              </div>
              
              <div className="mt-4 space-y-1">
                {fuelMoistureData && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    연료 수분 로드됨
                  </div>
                )}
                {canopyCoverData && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    수관 피복율 로드됨
                  </div>
                )}
                {fuelModelData && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    연료 모델 로드됨
                  </div>
                )}
              </div>
            </div>

            {/* 기상 데이터 카드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
              <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-gray-800">
                <div className="p-2 bg-sky-100 rounded-lg">
                  <Cloud className="w-5 h-5 text-sky-600" />
                </div>
                기상 데이터
              </h3>
              
              <input ref={weatherInputRef} type="file" accept=".csv" onChange={handleWeatherUpload} className="hidden" />
              
              <button
                onClick={() => weatherInputRef.current?.click()}
                className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-xl hover:from-sky-600 hover:to-sky-700 transition-all transform hover:scale-[1.02] font-medium shadow-md"
              >
                <FileText className="w-4 h-4 inline mr-2" />
                기상 데이터 업로드
              </button>
              
              <div className="space-y-3">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={params.useWeatherData}
                    onChange={(e) => setParams({...params, useWeatherData: e.target.checked})}
                    disabled={!weatherData}
                    className="mr-3 w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-gray-700">기상 데이터 사용</span>
                </label>
                
                {weatherData && (
                  <div className="bg-sky-50 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-sky-700">
                      <Activity className="w-4 h-4" />
                      {weatherData.length}개 레코드 활성
                    </div>
                    {weatherData[0] && (
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>📅 {weatherData[0].year}/{weatherData[0].month}/{weatherData[0].day}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-gray-500">온도</p>
                            <p className="font-bold">{weather.temperature.toFixed(1)}°C</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-gray-500">습도</p>
                            <p className="font-bold">{weather.humidity.toFixed(0)}%</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-gray-500">풍속</p>
                            <p className="font-bold">{weather.windSpeed.toFixed(1)} km/h</p>
                          </div>
                          <div className="bg-white rounded-lg p-2">
                            <p className="text-gray-500">풍향</p>
                            <p className="font-bold">{weather.windDirection.toFixed(0)}°</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 연료 모델 선택 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
              <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-gray-800">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Flame className="w-5 h-5 text-orange-600" />
                </div>
                연료 모델
              </h3>
              <select
                value={params.fuelModel}
                onChange={(e) => setParams({...params, fuelModel: parseInt(e.target.value)})}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
                disabled={fuelModelData !== null}
              >
                {Object.entries(FUEL_MODELS).map(([key, model]) => (
                  <option key={key} value={key}>
                    {model.icon} {key}: {model.name}
                  </option>
                ))}
              </select>
              {fuelModelData && (
                <div className="mt-3 flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  파일 데이터 사용 중
                </div>
              )}
            </div>

            {/* 시뮬레이션 설정 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
              <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-gray-800">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                시뮬레이션 설정
              </h3>
              
              <div className="space-y-5">
                {/* 각 슬라이더 개선 */}
                <div>
                  <label className="text-sm font-medium flex items-center justify-between text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-gray-500" /> 풍속
                    </span>
                    <span className="text-purple-600 font-bold">{params.windSpeed} km/h</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={params.windSpeed}
                    onChange={(e) => setParams({...params, windSpeed: parseInt(e.target.value)})}
                    disabled={params.useWeatherData}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center justify-between text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-gray-500" /> 풍향
                    </span>
                    <span className="text-purple-600 font-bold">{params.windDirection}°</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={params.windDirection}
                    onChange={(e) => setParams({...params, windDirection: parseInt(e.target.value)})}
                    disabled={params.useWeatherData}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center justify-between text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-gray-500" /> 온도
                    </span>
                    <span className="text-purple-600 font-bold">{params.temperature}°C</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="45"
                    value={params.temperature}
                    onChange={(e) => setParams({...params, temperature: parseInt(e.target.value)})}
                    disabled={params.useWeatherData}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center justify-between text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-gray-500" /> 습도
                    </span>
                    <span className="text-purple-600 font-bold">{params.humidity}%</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={params.humidity}
                    onChange={(e) => setParams({...params, humidity: parseInt(e.target.value)})}
                    disabled={params.useWeatherData}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center justify-between text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-gray-500" /> 연료 수분
                    </span>
                    <span className="text-purple-600 font-bold">{params.moistureContent}%</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="25"
                    value={params.moistureContent}
                    onChange={(e) => setParams({...params, moistureContent: parseInt(e.target.value)})}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium flex items-center justify-between text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-gray-500" /> 시뮬레이션 속도
                    </span>
                    <span className="text-purple-600 font-bold">{params.simSpeed}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={params.simSpeed}
                    onChange={(e) => setParams({...params, simSpeed: parseFloat(e.target.value)})}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
            </div>

            {/* 시각화 모드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-shadow">
              <h3 className="font-bold text-xl mb-4 flex items-center gap-2 text-gray-800">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Eye className="w-5 h-5 text-indigo-600" />
                </div>
                시각화 모드
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setParams({...params, visualMode: 'elevation'})}
                  className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    params.visualMode === 'elevation' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  고도
                </button>
                <button
                  onClick={() => setParams({...params, visualMode: 'moisture'})}
                  disabled={!fuelMoistureData}
                  className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    params.visualMode === 'moisture' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${!fuelMoistureData ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  연료 수분
                </button>
                <button
                  onClick={() => setParams({...params, visualMode: 'canopy'})}
                  disabled={!canopyCoverData}
                  className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    params.visualMode === 'canopy' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${!canopyCoverData ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  수관 피복율
                </button>
                <button
                  onClick={() => setParams({...params, visualMode: 'fuelModel'})}
                  disabled={!fuelModelData}
                  className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    params.visualMode === 'fuelModel' 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${!fuelModelData ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  연료 모델
                </button>
              </div>
            </div>
          </div>

          {/* 메인 콘텐츠 영역 */}
          <div className="lg:col-span-3 space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-gray-400" />
                  <p className="text-sm text-gray-500">진행 시간</p>
                </div>
                <p className="text-3xl font-bold text-gray-800">{Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, '0')}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Flame className="w-5 h-5 text-red-500" />
                  <p className="text-sm text-gray-500">활성 화재</p>
                </div>
                <p className="text-3xl font-bold text-red-600">{fireStats.active}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <BarChart3 className="w-5 h-5 text-gray-500" />
                  <p className="text-sm text-gray-500">연소 완료</p>
                </div>
                <p className="text-3xl font-bold text-gray-600">{fireStats.burned}</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="w-5 h-5 text-orange-500" />
                  <p className="text-sm text-gray-500">연소 면적</p>
                </div>
                <p className="text-3xl font-bold text-orange-600">{fireStats.area.toFixed(1)}ha</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-5 border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <MapPin className="w-5 h-5 text-purple-500" />
                  <p className="text-sm text-gray-500">발화점</p>
                </div>
                <p className="text-3xl font-bold text-purple-600">{ignitionPoints.length}</p>
              </div>
            </div>

            {/* 기상 조건 표시 */}
            {params.useWeatherData && weatherData && (
              <div className="bg-gradient-to-r from-blue-50 to-sky-50 rounded-2xl p-6 border border-blue-100">
                <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-gray-800">
                  <Cloud className="w-6 h-6 text-blue-600" /> 
                  현재 기상 조건 ({Math.floor(time / 60) % 24}:00)
                </h4>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">온도</p>
                    <p className="text-lg font-bold text-gray-800">{weather.temperature.toFixed(1)}°C</p>
                  </div>
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">습도</p>
                    <p className="text-lg font-bold text-gray-800">{weather.humidity.toFixed(0)}%</p>
                  </div>
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">풍속</p>
                    <p className="text-lg font-bold text-gray-800">{weather.windSpeed.toFixed(1)} km/h</p>
                  </div>
                  <div className="bg-white rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">풍향</p>
                    <p className="text-lg font-bold text-gray-800">{weather.windDirection.toFixed(0)}°</p>
                  </div>
                  {weather.precipitation !== undefined && (
                    <div className="bg-white rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">강수</p>
                      <p className="text-lg font-bold text-gray-800">{weather.precipitation.toFixed(1)} mm</p>
                    </div>
                  )}
                  {weather.cloudCover !== undefined && (
                    <div className="bg-white rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">운량</p>
                      <p className="text-lg font-bold text-gray-800">{weather.cloudCover}%</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 시뮬레이션 뷰 */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h3 className="font-bold text-2xl mb-6 text-gray-800">시뮬레이션 뷰</h3>
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={800}
                  className="w-full border-2 border-gray-200 rounded-xl cursor-crosshair shadow-inner"
                  onClick={handleCanvasClick}
                />
                {!terrainData && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 rounded-xl">
                    <div className="text-center">
                      <Mountain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">지형 데이터를 로드하세요</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={startSimulation}
                  disabled={isRunning || !terrainData || ignitionPoints.length === 0}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-medium shadow-md transform hover:scale-[1.02]"
                >
                  <Play className="w-5 h-5 inline mr-2" />
                  시작
                </button>
                
                <button
                  onClick={() => setIsRunning(false)}
                  disabled={!isRunning}
                  className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl hover:from-yellow-600 hover:to-yellow-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-medium shadow-md transform hover:scale-[1.02]"
                >
                  <Pause className="w-5 h-5 inline mr-2" />
                  일시정지
                </button>
                
                <button
                  onClick={() => {
                    setIsRunning(false);
                    setTime(0);
                    setIgnitionPoints([]);
                    if (terrainData) initializeFireGrid(terrainData.size);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all font-medium shadow-md transform hover:scale-[1.02]"
                >
                  <RotateCcw className="w-5 h-5 inline mr-2" />
                  초기화
                </button>
                
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.download = `fire_simulation_${Date.now()}.png`;
                    link.href = canvasRef.current.toDataURL();
                    link.click();
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-md transform hover:scale-[1.02]"
                >
                  <Save className="w-5 h-5 inline mr-2" />
                  저장
                </button>
              </div>
            </div>

            {/* 주요 기능 설명 */}
            <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-2xl p-8 border border-purple-100">
              <h4 className="font-bold text-2xl mb-6 text-gray-800">주요 기능</h4>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-md">
                  <h5 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                    <Flame className="w-5 h-5 text-orange-500" />
                    FARSITE 연료 모델
                  </h5>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 mt-1">•</span>
                      <span>13개 표준 연료 모델 (0-13)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 mt-1">•</span>
                      <span>연료별 확산 특성 반영</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 mt-1">•</span>
                      <span>비연료 지역 확산 차단</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-400 mt-1">•</span>
                      <span>습도에 따른 수분 함량 동적 조정</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-md">
                  <h5 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    데이터 통합
                  </h5>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>셀별 연료 모델 지정</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>연료 수분 분포 반영</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>수관 피복율 바람 차폐</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
                      <span>시간대별 기상 데이터 적용</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-md">
                  <h5 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                    <Zap className="w-5 h-5 text-purple-500" />
                    고급 기능
                  </h5>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      <span>시뮬레이션 속도 조절 (0.1x ~ 5x)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      <span>경사도 효과 계산</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      <span>실시간 면적 계산</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400 mt-1">•</span>
                      <span>다중 시각화 모드</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-white/80 backdrop-blur-sm rounded-xl p-5 shadow-md">
                  <h5 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                    <Cloud className="w-5 h-5 text-sky-500" />
                    기상 통합
                  </h5>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-sky-400 mt-1">•</span>
                      <span>CSV 기상 데이터 업로드</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-400 mt-1">•</span>
                      <span>시간대별 자동 적용 (HHMM 형식)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-400 mt-1">•</span>
                      <span>온도/습도/풍속/풍향 연동</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-400 mt-1">•</span>
                      <span>강수량 화재 진압 효과</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-sky-400 mt-1">•</span>
                      <span>운량 데이터 지원</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div> 
          </div>
        </div>
      </div>
    </div> 
  );
}