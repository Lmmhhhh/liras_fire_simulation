import React from 'react';
import { Play, StopCircle, Zap, Thermometer, Droplets, Wind, Cloud } from 'lucide-react';

export default function ControlPanel({
  isRunning, onStart, onStop, onReset,
  time, speed, onSpeedChange,
  weather, manualMode, onManualWeatherChange
}) {
  return (
    <div className="bg-green-50 p-4 rounded-xl shadow-md flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button onClick={onStart} disabled={isRunning} className="flex items-center gap-1 px-3 py-2 bg-green-200 text-green-800 rounded-md hover:bg-green-300 disabled:opacity-50">
          <Play className="w-5 h-5" /> Start
        </button>
        <button onClick={onStop} disabled={!isRunning} className="flex items-center gap-1 px-3 py-2 bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200 disabled:opacity-50">
          <StopCircle className="w-5 h-5" /> Stop
        </button>
        <button onClick={onReset} className="ml-auto px-3 py-2 bg-red-200 text-red-800 rounded-md hover:bg-red-300">
          Reset
        </button>
      </div>
      <div className="flex justify-between text-sm">
        <span>Time: {time}s</span>
        <span>Speed: {speed.toFixed(1)}×</span>
      </div>
      <input type="range" min="0.1" max="5" step="0.1" value={speed} onChange={e=>onSpeedChange(parseFloat(e.target.value))} className="w-full"/>
      <div className="flex flex-col gap-1 text-xs text-gray-700">
        <span>🌡️ Temp: {weather.temperature ?? '-'}℃</span>
        <span>💧 Humidity: {weather.humidity ?? '-'}%</span>
        <span>💨 Wind: {weather.windSpeed ?? '-'} m/s</span>
        <span>☂️ Precip: {weather.precipitation ?? '-'} mm</span>
      </div>
      {manualMode && (
        <div className="mt-4 space-y-3 text-xs">
          <label className="flex items-center gap-2">
            <Thermometer className="w-4 h-4 text-blue-500"/> Temp
            <input type="range" min="0" max="50" step="1" value={weather.temperature} onChange={e=>onManualWeatherChange('temperature', +e.target.value)} className="flex-1"/>
            <span className="w-8 text-right">{weather.temperature}℃</span>
          </label>
          <label className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500"/> Humidity
            <input type="range" min="0" max="100" step="1" value={weather.humidity} onChange={e=>onManualWeatherChange('humidity', +e.target.value)} className="flex-1"/>
            <span className="w-8 text-right">{weather.humidity}%</span>
          </label>
          <label className="flex items-center gap-2">
            <Wind className="w-4 h-4 text-blue-500"/> Wind
            <input type="range" min="0" max="20" step="0.5" value={weather.windSpeed} onChange={e=>onManualWeatherChange('windSpeed', +e.target.value)} className="flex-1"/>
            <span className="w-8 text-right">{weather.windSpeed}m/s</span>
          </label>
          <label className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-500"/> Precip
            <input type="range" min="0" max="10" step="0.1" value={weather.precipitation} onChange={e=>onManualWeatherChange('precipitation', +e.target.value)} className="flex-1"/>
            <span className="w-8 text-right">{weather.precipitation}mm</span>
          </label>
        </div>
      )}
    </div>
  );
}