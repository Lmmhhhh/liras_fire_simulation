// src/hooks/useDataManagement.js
import { useState, useCallback } from 'react';
import { parseAscFile } from '../utils/AscParser';
import { parseWeatherCSV } from '../utils/WeatherParser';
import { fuelModelParams } from '../utils/fuelModelParams';

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

  // 연료 모델 검증 및 매핑 함수
  const validateAndMapFuelData = (data) => {
    const validModels = Object.keys(fuelModelParams).map(Number);
    const modelStats = {};
    let mappedCount = 0;
    
    const mappedData = data.map((row, i) => 
      row.map((fuel, j) => {
        // 통계 수집
        modelStats[fuel] = (modelStats[fuel] || 0) + 1;
        
        // 0은 연료 없음 - 유지
        if (fuel === 0) return 0;
        
        // 유효한 모델인지 확인
        if (validModels.includes(fuel)) {
          return fuel;
        }
        
        // 매핑 규칙
        let mapped = fuel;
        
        // 확장 연료 모델 매핑 (Scott and Burgan 40 fuel models)
        if (fuel >= 91 && fuel <= 93) {
          mapped = 0; // NB (non-burnable) -> 연료 없음으로
        } else if (fuel >= 101 && fuel <= 109) {
          mapped = 1; // GR (grass) models -> short grass
        } else if (fuel >= 121 && fuel <= 124) {
          mapped = 2; // GS (grass-shrub) -> timber grass
        } else if (fuel >= 141 && fuel <= 149) {
          mapped = 5; // SH (shrub) -> brush
        } else if (fuel >= 161 && fuel <= 165) {
          mapped = 8; // TU (timber-understory) -> closed timber
        } else if (fuel >= 181 && fuel <= 189) {
          mapped = 10; // TL (timber litter) -> timber
        } else if (fuel >= 201 && fuel <= 204) {
          mapped = 11; // SB (slash-blowdown) -> light slash
        } else if (fuel > 13) {
          // 기타 알 수 없는 모델
          mapped = 2; // 기본값: timber grass
        }
        
        if (mapped !== fuel) {
          mappedCount++;
          if (mappedCount <= 10) { // 처음 10개만 로그
            console.log(`연료 모델 매핑: ${fuel} -> ${mapped} at [${i},${j}]`);
          }
        }
        
        return mapped;
      })
    );
    
    console.log('=== 연료 모델 통계 ===');
    console.log('원본 모델 분포:', modelStats);
    console.log('총 매핑된 셀:', mappedCount);
    
    // 매핑 후 통계
    const mappedStats = {};
    mappedData.forEach(row => {
      row.forEach(fuel => {
        mappedStats[fuel] = (mappedStats[fuel] || 0) + 1;
      });
    });
    console.log('매핑 후 분포:', mappedStats);
    
    return mappedData;
  };

  // DEM (Digital Elevation Model) 업로드 핸들러
  const handleDemUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFilenames(prev => ({ ...prev, dem: file.name }));
      const text = await file.text();
      const { data, nrows, ncols, cellSize } = parseAscFile(text);
      setTerrainData({ 
        elevation: data, 
        size: Math.min(nrows, ncols), // 정사각형 크기 (시뮬레이션용)
        rows: nrows, // 실제 행 수
        cols: ncols, // 실제 열 수
        cellSize: cellSize 
      });
      console.log(`DEM 로드 완료: ${nrows}×${ncols}, 셀 크기: ${cellSize}m`);
    } catch (error) {
      console.error('DEM 파일 업로드 오류:', error);
      // 에러 처리 로직 추가 가능
    }
  }, []);

  // 연료 모델 업로드 핸들러 (수정됨)
  const handleFuelUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !terrainData) return;

    try {
      setFilenames(prev => ({ ...prev, fuel: file.name }));
      const text = await file.text();
      const { data } = parseAscFile(text);  // 실제 크기 그대로 사용
      
      // 연료 모델 검증 및 매핑
      const validatedData = validateAndMapFuelData(data);
      
      setFuelModelData(validatedData);
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
      
      // 수분 데이터 검증
      console.log('=== 수분 데이터 검증 ===');
      let invalidCount = 0;
      const validatedData = data.map((row, i) => 
        row.map((moisture, j) => {
          // 수분은 0-1 범위여야 함
          if (moisture < 0 || moisture > 1) {
            invalidCount++;
            if (invalidCount <= 5) {
              console.warn(`비정상 수분값 [${i},${j}]: ${moisture} -> 0.15로 변경`);
            }
            return 0.15; // 15% 기본값
          }
          return moisture;
        })
      );
      
      if (invalidCount > 0) {
        console.log(`총 ${invalidCount}개의 비정상 수분값 수정됨`);
      }
      
      setFuelMoistureData(validatedData);
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
      
      // 캐노피 데이터 검증 (0-100 범위)
      const validatedData = data.map(row => 
        row.map(canopy => Math.max(0, Math.min(100, canopy)))
      );
      
      setCanopyCoverData(validatedData);
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
      console.log(`날씨 데이터 로드 완료: ${parsedData.length}개 시간대`);
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