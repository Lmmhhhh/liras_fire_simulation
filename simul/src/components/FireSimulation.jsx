// src/components/FireSimulation.jsx
import React, { useState, useEffect, useCallback } from 'react';
import DataUploader from './ui/DataUploader';
import ControlPanel from './ui/ControlPanel';
import CanvasView from './ui/CanvasView';
import InfoPanel from './ui/InfoPanel';
import { useDataManagement } from '../hooks/useDataManagement';
import { useFireSimulation } from '../hooks/useFireSimulation';

// Toast 컴포넌트 분리
function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500'
  };
  
  const bgColor = bgColors[type] || 'bg-gray-700';

  return (
    <div className={`${bgColor} fixed top-4 right-4 text-white px-4 py-2 rounded shadow-lg z-50 animate-pulse`}>
      {message}
    </div>
  );
}

export default function FireSimulation() {
  // 데이터 관리 훅
  const {
    terrainData,
    fuelModelData,
    fuelMoistureData,
    canopyCoverData,
    weatherData,
    filenames,
    isDataReady,
    handlers
  } = useDataManagement();

  // 수동 기상 데이터
  const [manualWeather, setManualWeather] = useState({
    temperature: 20,
    humidity: 50,
    windSpeed: 5,
    windDirection: 270, // 서풍 (270도)
    precipitation: 0
  });

  // 토스트 메시지
  const [toast, setToast] = useState(null);
  
  // 표시 옵션
  const [showCanopy, setShowCanopy] = useState(false);
  const [showFuelMap, setShowFuelMap] = useState(false);

  // 시뮬레이션 훅
  const {
    fireGrid,
    ignitionPoints,
    time,
    isRunning,
    speed,
    cellSize,
    size,
    setSpeed,
    addIgnitionPoint,
    clearIgnitionPoints,
    startSimulation,
    stopSimulation,
    resetSimulation,
    getCurrentWeather,
    getSimulationStats
  } = useFireSimulation(
    terrainData,
    fuelModelData,
    fuelMoistureData,
    canopyCoverData,
    weatherData,
    manualWeather
  );

  // 캔버스 클릭 핸들러
  const handleCanvasClick = useCallback((e) => {
    if (isRunning || !terrainData || !fuelModelData) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const scale = 5; // 캔버스 스케일
    const x = Math.floor((e.clientX - rect.left) / scale);
    const y = Math.floor((e.clientY - rect.top) / scale);

    // 경계 체크
    if (x < 0 || x >= size || y < 0 || y >= size) return;

    // 연료가 있는지 확인
    const fuel = fuelModelData[y]?.[x];
    if (!fuel || fuel === 0) {
      setToast({
        message: '❌ 연료가 없는 지역입니다. 다른 곳을 선택하세요.',
        type: 'error'
      });
      return;
    }

    const success = addIgnitionPoint(x, y);
    if (success) {
      // 발화점 추가/제거 시 피드백
      const isRemoval = ignitionPoints.some(p => p.x === x && p.y === y);
      
      // 발화점 정보 표시
      if (!isRemoval) {
        const moisture = (fuelMoistureData?.[y]?.[x] || 0.1) * 100;
        const canopy = canopyCoverData?.[y]?.[x] || 0;
        setToast({
          message: `🔥 발화점 추가 - 연료: ${fuel}, 수분: ${moisture.toFixed(1)}%, 수관: ${canopy}%`,
          type: 'info'
        });
      } else {
        setToast({
          message: '발화점 제거됨',
          type: 'info'
        });
      }
    }
  }, [isRunning, terrainData, fuelModelData, fuelMoistureData, canopyCoverData, size, addIgnitionPoint, ignitionPoints]);

  // 시뮬레이션 시작 핸들러
  const handleStart = useCallback(() => {
    const result = startSimulation();
    if (!result.success) {
      setToast({
        message: result.message || '시뮬레이션 시작 실패',
        type: 'error'
      });
    } else {
      setToast({
        message: '🔥 시뮬레이션 시작!',
        type: 'success'
      });
    }
  }, [startSimulation]);

  // 수동 날씨 변경 핸들러
  const handleManualWeatherChange = useCallback((field, value) => {
    setManualWeather(prev => ({ ...prev, [field]: value }));
  }, []);

  // 진화 완료 체크 (개선된 로직)
  useEffect(() => {
    if (!isRunning || !fireGrid) return;

    const stats = getSimulationStats();
    
    // 종료 조건들
    const noActiveFire = stats && stats.active === 0;
    const longDuration = time > 86400; // 24시간 이상
    
    // 확산 가능성 체크
    let canSpread = false;
    if (stats && stats.active > 0) {
      const burnedPercentage = stats.burnedPercentage;
      const avgIntensity = stats.averageIntensity;
      
      // 조건을 더 관대하게 수정
      // 1) 평균 강도가 5 이상이거나
      // 2) 활성 화재가 10개 이상이거나
      // 3) 아직 20% 미만만 탔으면 계속 진행
      canSpread = avgIntensity > 5 || stats.active > 10 || burnedPercentage < 20;
    }
    
    if (noActiveFire || longDuration || !canSpread) {
      stopSimulation();
      
      let message = '🔥 시뮬레이션 종료! ';
      if (noActiveFire) {
        message += `총 소실 면적: ${stats.burnedArea.toFixed(2)} ha (${stats.burnedPercentage.toFixed(1)}%)`;
      } else if (longDuration) {
        message += '최대 시뮬레이션 시간 도달';
      } else if (!canSpread) {
        message += '화재 확산 중지 (자연 차단)';
      }
      
      setToast({
        message,
        type: 'success'
      });
    }
  }, [fireGrid, isRunning, stopSimulation, getSimulationStats, time]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyPress = (e) => {
      // 입력 필드에 포커스가 있으면 무시
      if (e.target.tagName === 'INPUT') return;

      if (e.code === 'Space' && !isRunning && ignitionPoints.length > 0) {
        e.preventDefault();
        handleStart();
      } else if (e.code === 'Escape' && isRunning) {
        stopSimulation();
      } else if (e.code === 'KeyR' && !isRunning) {
        resetSimulation();
        setToast({ message: '시뮬레이션 초기화됨', type: 'info' });
      } else if (e.code === 'KeyC' && !isRunning) {
        clearIgnitionPoints();
        setToast({ message: '발화점 모두 제거됨', type: 'info' });
      } else if (e.code === 'KeyT') {
        setShowCanopy(prev => !prev);
      } else if (e.code === 'KeyF') {
        setShowFuelMap(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isRunning, ignitionPoints, handleStart, stopSimulation, resetSimulation, clearIgnitionPoints]);

  // 통계 정보
  const stats = getSimulationStats();
  
  // 현재 날씨
  const currentWeather = getCurrentWeather();

  // 초기 데이터 로딩 화면
  if (!terrainData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-4xl w-full">
          <h1 className="text-2xl font-bold mb-6 text-gray-800">
            산불 시뮬레이션 - 데이터 업로드
          </h1>
          <DataUploader
            onDemUpload={handlers.handleDemUpload}
            onFuelUpload={handlers.handleFuelUpload}
            onMoistureUpload={handlers.handleMoistureUpload}
            onCanopyUpload={handlers.handleCanopyUpload}
            onWeatherUpload={handlers.handleWeatherUpload}
            filenames={filenames}
          />
          {!isDataReady && terrainData && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800">
                ⚠️ 연료 모델과 연료 수분 데이터를 업로드해주세요.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 메인 시뮬레이션 화면
  return (
    <>
      {/* 토스트 메시지 */}
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="h-screen flex bg-gray-100">
        {/* 사이드바 */}
        <aside className="w-80 bg-white shadow-lg overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 데이터 업로더 */}
            <section>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">
                데이터 관리
              </h2>
              <DataUploader
                onDemUpload={handlers.handleDemUpload}
                onFuelUpload={handlers.handleFuelUpload}
                onMoistureUpload={handlers.handleMoistureUpload}
                onCanopyUpload={handlers.handleCanopyUpload}
                onWeatherUpload={handlers.handleWeatherUpload}
                filenames={filenames}
              />
            </section>

            {/* 컨트롤 패널 */}
            <section>
              <h2 className="text-lg font-semibold mb-4 text-gray-800">
                시뮬레이션 제어
              </h2>
              <ControlPanel
                isRunning={isRunning}
                onStart={handleStart}
                onStop={stopSimulation}
                onReset={resetSimulation}
                time={time}
                speed={speed}
                onSpeedChange={setSpeed}
                weather={currentWeather}
                manualMode={!weatherData || weatherData.length === 0}
                onManualWeatherChange={handleManualWeatherChange}
              />
            </section>

            {/* 실시간 통계 */}
            {stats && (
              <section className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-sm font-semibold mb-2 text-gray-700">
                  실시간 통계
                </h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">활성 화재:</span>
                    <span className="font-medium text-red-600">
                      {stats.active} 셀
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">지표화:</span>
                    <span className="font-medium text-orange-500">
                      {stats.surfaceFire} 셀
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">수관화:</span>
                    <span className="font-medium text-red-700">
                      {stats.crownFire} 셀 ({stats.crownFirePercentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">소실 면적:</span>
                    <span className="font-medium">
                      {stats.burnedArea.toFixed(2)} ha
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">진행률:</span>
                    <span className="font-medium">
                      {stats.burnedPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">평균 강도:</span>
                    <span className="font-medium">
                      {stats.averageIntensity.toFixed(1)}
                    </span>
                  </div>
                </div>
                
                {/* 시뮬레이션 시간 */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">경과 시간:</span>
                    <span className="font-medium">
                      {Math.floor(time / 3600)}시간 {Math.floor((time % 3600) / 60)}분
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-600">발화점:</span>
                    <span className="font-medium">
                      {ignitionPoints.length}개
                    </span>
                  </div>
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* 캔버스 뷰 */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    시뮬레이션 뷰
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {isRunning ? '시뮬레이션 진행 중...' : 
                     ignitionPoints.length > 0 ? `발화점 ${ignitionPoints.length}개 설정됨` : 
                     '클릭하여 발화점 설정'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCanopy(!showCanopy)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      showCanopy 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {showCanopy ? '🌳 수관' : '🗺️ 지형'}
                  </button>
                  <button
                    onClick={() => setShowFuelMap(!showFuelMap)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      showFuelMap 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {showFuelMap ? '🔥 연료' : '🗺️ 지형'}
                  </button>
                </div>
              </div>
              <div className="p-4">
                <CanvasView
                  terrainData={terrainData}
                  fuelModelData={showFuelMap ? fuelModelData : null}
                  fireGrid={fireGrid}
                  ignitionPoints={ignitionPoints}
                  canopyCoverData={showCanopy ? canopyCoverData : null}
                  showCanopy={showCanopy}
                  showFuelMap={showFuelMap}
                  onCanvasClick={handleCanvasClick}
                />
              </div>
            </div>

            {/* 정보 패널 */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">
                  상세 정보
                </h2>
              </div>
              <div className="p-4">
                <InfoPanel
                  fireGrid={fireGrid}
                  terrainData={terrainData}
                  cellSize={cellSize}
                  stats={stats}
                  currentWeather={currentWeather}
                  canopyCoverData={canopyCoverData}
                />
              </div>
            </div>
          </div>

          {/* 하단 안내 메시지 */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 팁: 캔버스를 클릭하여 발화점을 설정하고, 시작 버튼을 눌러 시뮬레이션을 실행하세요.
              발화점을 다시 클릭하면 제거됩니다.
            </p>
            {!isRunning && (
              <div className="text-sm text-blue-800 mt-2">
                <p>⌨️ 단축키:</p>
                <ul className="ml-4 mt-1">
                  <li><strong>Space</strong> - 시작 | <strong>Esc</strong> - 정지 | <strong>R</strong> - 초기화</li>
                  <li><strong>C</strong> - 발화점 모두 제거 | <strong>T</strong> - 수관 표시 | <strong>F</strong> - 연료 표시</li>
                </ul>
              </div>
            )}
            {isRunning && (
              <p className="text-sm text-blue-800 mt-2">
                🔥 <strong>주황색</strong>: 지표화 | 
                🟣 <strong>보라색</strong>: 수관화 | 
                ⬛ <strong>검은색</strong>: 소실 지역
              </p>
            )}
          </div>
        </main>
      </div>
    </>
  );
}