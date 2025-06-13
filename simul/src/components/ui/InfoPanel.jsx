// src/components/ui/InfoPanel.jsx
import React from 'react';
import { BarChart, Layers, Flame, Trees, Droplets, Wind, Navigation, Thermometer, Clock } from 'lucide-react';
import { FIRE_STATES } from '../../utils/fuelModelParams';

export default function InfoPanel({ 
  fireGrid, 
  terrainData, 
  cellSize, 
  stats, 
  currentWeather,
  canopyCoverData,
  weatherData,
  time
}) {
  if (!terrainData) return null;

  // 캐노피 통계 계산
  const calculateCanopyStats = () => {
    if (!canopyCoverData) return null;

    let total = 0;
    let count = 0;
    let min = 100;
    let max = 0;
    const distribution = {
      none: 0,      // 0%
      low: 0,       // 1-30%
      medium: 0,    // 31-60%
      high: 0,      // 61-80%
      veryHigh: 0   // 81-100%
    };

    canopyCoverData.forEach(row => {
      row.forEach(value => {
        if (value !== undefined && value >= 0) {
          total += value;
          count++;
          min = Math.min(min, value);
          max = Math.max(max, value);

          if (value === 0) distribution.none++;
          else if (value <= 30) distribution.low++;
          else if (value <= 60) distribution.medium++;
          else if (value <= 80) distribution.high++;
          else distribution.veryHigh++;
        }
      });
    });

    return {
      average: (count > 0 ? total / count : 0).toFixed(1),
      min,
      max,
      distribution,
      totalCells: count,
      highRiskArea: ((distribution.high + distribution.veryHigh) / count * 100).toFixed(1)
    };
  };

  const canopyStats = calculateCanopyStats();

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

  // 현재 시뮬레이션 시간대 계산 (날씨 데이터가 있을 때)
  const getCurrentTimeInfo = () => {
    if (!weatherData || weatherData.length === 0) return null;
    
    const currentHour = Math.floor(time / 3600);
    const weatherIndex = Math.min(currentHour, weatherData.length - 1);
    const weather = weatherData[weatherIndex];
    
    if (!weather) return null;
    
    return {
      year: weather.year,
      month: weather.month,
      day: weather.day,
      hour: weather.hour,
      totalHours: weatherData.length
    };
  };

  const timeInfo = getCurrentTimeInfo();

  return (
    <div className="space-y-4">
      {/* 시뮬레이션 시간 정보 */}
      <div className="bg-gray-100 p-4 rounded-xl shadow-md space-y-2">
        <h2 className="flex items-center gap-2 text-gray-700 font-bold">
          <Clock className="w-5 h-5" /> 시뮬레이션 시간
        </h2>
        <div className="text-lg font-medium text-gray-800">
          {formatTime(time)}
        </div>
        {timeInfo && (
          <div className="text-sm text-gray-600">
            {timeInfo.year}년 {timeInfo.month}월 {timeInfo.day}일 {timeInfo.hour}시
            <span className="text-xs text-gray-500 ml-2">
              (총 {timeInfo.totalHours}시간 데이터)
            </span>
          </div>
        )}
      </div>

      {/* 화재 통계 */}
      {stats && (
        <div className="bg-orange-100 p-4 rounded-xl shadow-md space-y-3">
          <h2 className="flex items-center gap-2 text-orange-700 font-bold">
            <Flame className="w-6 h-6" /> 화재 상태
          </h2>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/50 p-2 rounded">
              <p className="text-orange-600 font-medium">활성 화재</p>
              <p className="text-xl font-bold text-orange-800">{stats.active}</p>
            </div>
            <div className="bg-white/50 p-2 rounded">
              <p className="text-orange-600 font-medium">소실 면적</p>
              <p className="text-xl font-bold text-orange-800">{stats.burnedArea.toFixed(1)} ha</p>
            </div>
          </div>

          {/* 화재 유형 분포 */}
          {stats.active > 0 && (
            <div className="bg-white/50 p-3 rounded space-y-2">
              <p className="text-sm font-medium text-orange-700">화재 유형</p>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  지표화
                </span>
                <span className="font-medium">{stats.surfaceFire} 셀</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-purple-600 rounded"></div>
                  수관화
                </span>
                <span className="font-medium">{stats.crownFire} 셀 ({stats.crownFirePercentage.toFixed(1)}%)</span>
              </div>
              
              {/* 진행률 바 */}
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>진행률</span>
                  <span>{stats.burnedPercentage.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-400 to-red-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(stats.burnedPercentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 현재 기상 */}
      {currentWeather && (
        <div className="bg-blue-100 p-4 rounded-xl shadow-md space-y-3">
          <h2 className="flex items-center gap-2 text-blue-700 font-bold">
            <Wind className="w-6 h-6" /> 현재 기상
          </h2>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-red-500" />
              <span>온도: {currentWeather.temperature || 0}°C</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-600" />
              <span>습도: {currentWeather.humidity || 0}%</span>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-gray-600" />
              <span>풍속: {currentWeather.windSpeed || 0} m/s</span>
            </div>
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-gray-600" />
              <span>풍향: {getWindDirectionName(currentWeather.windDirection || 0)}</span>
            </div>
          </div>

          {/* 기상 경고 */}
          {currentWeather.windSpeed > 15 && (
            <div className="bg-red-100 p-2 rounded text-xs text-red-700">
              ⚠️ 강풍 주의: 수관화 발생 가능성 높음
            </div>
          )}
          {currentWeather.humidity < 20 && (
            <div className="bg-yellow-100 p-2 rounded text-xs text-yellow-700">
              ⚠️ 낮은 습도: 화재 확산 속도 증가 위험
            </div>
          )}
          {currentWeather.precipitation > 0 && (
            <div className="bg-green-100 p-2 rounded text-xs text-green-700">
              💧 강수 중: 화재 확산 억제 효과
            </div>
          )}
        </div>
      )}

      {/* 캐노피 통계 */}
      {canopyStats && (
        <div className="bg-green-100 p-4 rounded-xl shadow-md space-y-3">
          <h2 className="flex items-center gap-2 text-green-700 font-bold">
            <Trees className="w-6 h-6" /> 수관 피복률
          </h2>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/50 p-2 rounded">
              <p className="text-green-600 font-medium">평균</p>
              <p className="text-xl font-bold text-green-800">{canopyStats.average}%</p>
            </div>
            <div className="bg-white/50 p-2 rounded">
              <p className="text-green-600 font-medium">고위험 지역</p>
              <p className="text-xl font-bold text-green-800">{canopyStats.highRiskArea}%</p>
              <p className="text-xs text-green-600">(60% 이상)</p>
            </div>
          </div>

          <div className="bg-white/50 p-2 rounded">
            <p className="text-xs text-green-700">
              수관 밀도 범위: {canopyStats.min}% - {canopyStats.max}%
            </p>
          </div>

          {/* 수관 밀도 분포 */}
          <div className="bg-white/50 p-2 rounded text-xs">
            <p className="font-medium text-green-700 mb-1">밀도 분포</p>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>없음 (0%)</span>
                <span>{((canopyStats.distribution.none / canopyStats.totalCells) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>낮음 (1-30%)</span>
                <span>{((canopyStats.distribution.low / canopyStats.totalCells) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>중간 (31-60%)</span>
                <span>{((canopyStats.distribution.medium / canopyStats.totalCells) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-orange-600 font-medium">
                <span>높음 (61-80%)</span>
                <span>{((canopyStats.distribution.high / canopyStats.totalCells) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-red-600 font-medium">
                <span>매우 높음 (81-100%)</span>
                <span>{((canopyStats.distribution.veryHigh / canopyStats.totalCells) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="bg-gray-100 p-3 rounded-xl shadow-md">
        <h3 className="text-sm font-bold text-gray-700 mb-2">범례</h3>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded"></div>
            <span>지표화 (Surface Fire)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-600 rounded"></div>
            <span>수관화 (Crown Fire)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-700 rounded"></div>
            <span>소실 지역 (Burned)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 border-2 border-red-500 rounded"></div>
            <span>발화점 (Ignition Point)</span>
          </div>
        </div>
      </div>
    </div>
  );
}