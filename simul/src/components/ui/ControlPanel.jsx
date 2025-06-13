// src/components/ui/ControlPanel.jsx
import React from 'react';
import { Play, StopCircle, RotateCcw, Zap, Thermometer, Droplets, Wind, Cloud, Navigation } from 'lucide-react';

export default function ControlPanel({
  isRunning,
  onStart,
  onStop,
  onReset,
  time,
  speed,
  onSpeedChange,
  weather,
  manualMode,
  onManualWeatherChange
}) {
  // 속도 옵션 (시뮬레이션 속도)
  const speedOptions = [
    { value: 1, label: '1x (실시간)' },
    { value: 60, label: '60x (1분 = 1초)' },
    { value: 300, label: '300x (5분 = 1초)' },
    { value: 600, label: '600x (10분 = 1초)' },
    { value: 1800, label: '1800x (30분 = 1초)' },
    { value: 3600, label: '3600x (1시간 = 1초)' },
    { value: 7200, label: '7200x (2시간 = 1초)' }
  ];

  // 시간 포맷팅
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}시간 ${minutes}분 ${secs}초`;
  };

  // 풍향을 방위로 변환
  const getWindDirectionName = (degrees) => {
    const directions = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  return (
    <div className="space-y-4">
      {/* 제어 버튼 */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex gap-2">
          <button
            onClick={onStart}
            disabled={isRunning}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isRunning
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600 shadow-sm'
            }`}
          >
            <Play className="w-4 h-4" />
            시작
          </button>
          
          <button
            onClick={onStop}
            disabled={!isRunning}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              !isRunning
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm'
            }`}
          >
            <StopCircle className="w-4 h-4" />
            정지
          </button>
          
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>
        </div>
      </div>

      {/* 시간 정보 */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">시뮬레이션 시간</h3>
        <div className="text-lg font-medium text-gray-900">
          {formatTime(time)}
        </div>
        {isRunning && (
          <div className="mt-1 text-xs text-gray-500">
            실행 중...
          </div>
        )}
      </div>

      {/* 속도 조절 */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          시뮬레이션 속도
        </h3>
        
        <select
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {speedOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="mt-2">
          <input
            type="range"
            min="1"
            max="7200"
            step="1"
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {/* 현재 날씨 */}
      <div className="bg-blue-50 p-4 rounded-lg shadow-sm">
        <h3 className="text-sm font-semibold text-blue-900 mb-3">
          현재 기상 조건
        </h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-600">
              <Thermometer className="w-4 h-4 text-red-500" />
              온도
            </span>
            <span className="font-medium">{weather.temperature || 0}°C</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-600">
              <Droplets className="w-4 h-4 text-blue-500" />
              습도
            </span>
            <span className="font-medium">{weather.humidity || 0}%</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-600">
              <Wind className="w-4 h-4 text-gray-500" />
              풍속
            </span>
            <span className="font-medium">{weather.windSpeed || 0} m/s</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-gray-600">
              <Navigation className="w-4 h-4 text-gray-500" />
              풍향
            </span>
            <span className="font-medium">
              {weather.windDirection || 0}° ({getWindDirectionName(weather.windDirection || 0)})
            </span>
          </div>
          
          {weather.precipitation > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-gray-600">
                <Cloud className="w-4 h-4 text-gray-500" />
                강수량
              </span>
              <span className="font-medium text-blue-600">{weather.precipitation} mm/hr</span>
            </div>
          )}
        </div>
      </div>

      {/* 수동 날씨 조절 (날씨 데이터가 없을 때) */}
      {manualMode && (
        <div className="bg-yellow-50 p-4 rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold text-yellow-900 mb-3">
            수동 기상 설정
          </h3>
          
          <div className="space-y-3">
            <div>
              <label className="flex items-center justify-between text-sm text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  온도
                </span>
                <span className="font-medium">{weather.temperature}°C</span>
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={weather.temperature}
                onChange={(e) => onManualWeatherChange('temperature', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center justify-between text-sm text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  습도
                </span>
                <span className="font-medium">{weather.humidity}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={weather.humidity}
                onChange={(e) => onManualWeatherChange('humidity', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center justify-between text-sm text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-gray-500" />
                  풍속
                </span>
                <span className="font-medium">{weather.windSpeed} m/s</span>
              </label>
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={weather.windSpeed}
                onChange={(e) => onManualWeatherChange('windSpeed', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center justify-between text-sm text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-gray-500" />
                  풍향
                </span>
                <span className="font-medium">{weather.windDirection}° ({getWindDirectionName(weather.windDirection)})</span>
              </label>
              <input
                type="range"
                min="0"
                max="360"
                step="10"
                value={weather.windDirection}
                onChange={(e) => onManualWeatherChange('windDirection', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="flex items-center justify-between text-sm text-gray-700 mb-1">
                <span className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-gray-500" />
                  강수량
                </span>
                <span className="font-medium">{weather.precipitation} mm/hr</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={weather.precipitation}
                onChange={(e) => onManualWeatherChange('precipitation', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}