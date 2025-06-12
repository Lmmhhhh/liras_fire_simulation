// src/hooks/useDataManagement.js
import { useState, useCallback } from 'react';
import { parseAscFile } from '../utils/AscParser';
import { parseWeatherCSV } from '../utils/WeatherParser';

/**
 * 데이터 파일 업로드와 관리를 담당하는 커스텀 훅
 * @returns {Object} 데이터 상태와 업로드 핸들러들
 */
export function useDataManagement() {
  // 데이터 상태
  const [terrainData, setTerrainData] = useState(null);
  const [fuelModelData, setFuelModelData] = useState(null);
  const [fuelMoistureData, setFuelMoistureData] = useState(null);
  const [canopyCoverData, setCanopyCoverData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  
  // 파일명 상태
  const [filenames, setFilenames] = useState({
    dem: '',
    fuel: '',
    moisture: '',
    canopy: '',
    weather: ''
  });

  // DEM (Digital Elevation Model) 업로드 핸들러
  const handleDemUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFilenames(prev => ({ ...prev, dem: file.name }));
      const text = await file.text();
      const { data, nrows, cellSize } = parseAscFile(text);
      setTerrainData({ 
        elevation: data, 
        size: nrows, 
        cellSize: cellSize 
      });
    } catch (error) {
      console.error('DEM 파일 업로드 오류:', error);
      // 에러 처리 로직 추가 가능
    }
  }, []);

  // 연료 모델 업로드 핸들러
  const handleFuelUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !terrainData) return;

    try {
      setFilenames(prev => ({ ...prev, fuel: file.name }));
      const text = await file.text();
      const { data } = parseAscFile(text, terrainData.size);
      
      // 데이터 검증
      console.log('=== 연료 데이터 검증 ===');
      console.log('첫 번째 행:', data[0]?.slice(0, 10));
      console.log('마지막 행:', data[data.length-1]?.slice(0, 10));
      
      // 이상한 값 체크
      let invalidValues = new Set();
      data.forEach(row => {
        row.forEach(val => {
          if (val > 13 || val < 0) {
            invalidValues.add(val);
          }
        });
      });
      
      if (invalidValues.size > 0) {
        console.warn('비정상적인 연료 값 발견:', Array.from(invalidValues));
      }
      
      setFuelModelData(data);
    } catch (error) {
      console.error('연료 모델 파일 업로드 오류:', error);
    }
  }, [terrainData]);

  // 연료 수분 업로드 핸들러
  const handleMoistureUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !terrainData) return;

    try {
      setFilenames(prev => ({ ...prev, moisture: file.name }));
      const text = await file.text();
      const { data } = parseAscFile(text, terrainData.size);
      setFuelMoistureData(data);
    } catch (error) {
      console.error('연료 수분 파일 업로드 오류:', error);
    }
  }, [terrainData]);

  // 캐노피 커버 업로드 핸들러
  const handleCanopyUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !terrainData) return;

    try {
      setFilenames(prev => ({ ...prev, canopy: file.name }));
      const text = await file.text();
      const { data } = parseAscFile(text, terrainData.size);
      setCanopyCoverData(data);
    } catch (error) {
      console.error('캐노피 커버 파일 업로드 오류:', error);
    }
  }, [terrainData]);

  // 날씨 데이터 업로드 핸들러
  const handleWeatherUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFilenames(prev => ({ ...prev, weather: file.name }));
      const text = await file.text();
      const parsedData = parseWeatherCSV(text);
      setWeatherData(parsedData);
    } catch (error) {
      console.error('날씨 데이터 파일 업로드 오류:', error);
    }
  }, []);

  // 모든 데이터 초기화
  const resetAllData = useCallback(() => {
    setTerrainData(null);
    setFuelModelData(null);
    setFuelMoistureData(null);
    setCanopyCoverData(null);
    setWeatherData(null);
    setFilenames({
      dem: '',
      fuel: '',
      moisture: '',
      canopy: '',
      weather: ''
    });
  }, []);

  // 필수 데이터가 모두 로드되었는지 확인
  const isDataReady = terrainData && fuelModelData && fuelMoistureData;

  return {
    // 데이터 상태
    terrainData,
    fuelModelData,
    fuelMoistureData,
    canopyCoverData,
    weatherData,
    filenames,
    
    // 유틸리티
    isDataReady,
    
    // 핸들러 함수들
    handlers: {
      handleDemUpload,
      handleFuelUpload,
      handleMoistureUpload,
      handleCanopyUpload,
      handleWeatherUpload,
      resetAllData
    }
  };
}