// src/utils/unitConversions.js
// Rothermel 모델을 위한 단위 변환 유틸리티

export const UnitConversions = {
    // 길이
    metersToFeet: (m) => m * 3.28084,
    feetToMeters: (ft) => ft * 0.3048,
    
    // 속도
    msToFtmin: (ms) => ms * 196.85,        // m/s to ft/min
    ftminToMs: (ftmin) => ftmin * 0.00508, // ft/min to m/s
    mphToFtmin: (mph) => mph * 88,         // miles/hr to ft/min
    kmhToFtmin: (kmh) => kmh * 54.68,      // km/hr to ft/min
    
    // 질량/면적
    kgm2ToLbft2: (kgm2) => kgm2 * 0.204816, // kg/m² to lb/ft²
    lbft2ToKgm2: (lbft2) => lbft2 * 4.88243, // lb/ft² to kg/m²
    
    // 에너지
    kjkgToBtulb: (kjkg) => kjkg * 0.42992,   // kJ/kg to BTU/lb
    btulbToKjkg: (btulb) => btulb * 2.326,   // BTU/lb to kJ/kg
    
    // 강도
    kwmToBtuftmin: (kwm) => kwm * 0.2893,    // kW/m to BTU/ft/min
    btuftsToKwm: (btufts) => btufts * 3.461, // BTU/ft/s to kW/m
    
    // 밀도
    kgm3ToLbft3: (kgm3) => kgm3 * 0.062428,  // kg/m³ to lb/ft³
    lbft3ToKgm3: (lbft3) => lbft3 * 16.0185, // lb/ft³ to kg/m³
    
    // 각도
    degreesToRadians: (deg) => deg * Math.PI / 180,
    radiansToDegrees: (rad) => rad * 180 / Math.PI,
    
    // 면적
    haToAcres: (ha) => ha * 2.47105,         // hectares to acres
    acresToHa: (acres) => acres * 0.404686,  // acres to hectares
    m2ToFt2: (m2) => m2 * 10.7639,          // m² to ft²
    ft2ToM2: (ft2) => ft2 * 0.092903        // ft² to m²
  };
  
  // 기상 데이터 변환
  export function convertWeatherToImperial(weather) {
    return {
      windSpeed: UnitConversions.msToFtmin(weather.windSpeed || 0),
      temperature: weather.temperature * 9/5 + 32, // C to F
      humidity: weather.humidity,
      precipitation: weather.precipitation * 0.0393701, // mm to inches
      windDirection: weather.windDirection
    };
  }
  
  // 연료 데이터 변환 (미터법 -> 영국 단위)
  export function convertFuelToImperial(fuelMetric) {
    return {
      load: UnitConversions.kgm2ToLbft2(fuelMetric.load || 0),
      depth: UnitConversions.metersToFeet(fuelMetric.depth || 0),
      savr: (fuelMetric.savr || 0) * 3.28084,  // 1/m to 1/ft
      packingRatio: fuelMetric.packingRatio || 0,  // 무차원
      heatContent: UnitConversions.kjkgToBtulb(fuelMetric.heatContent || 18000),
      density: (fuelMetric.density || 512) * 0.062428,  // kg/m³ to lb/ft³
      moistureExtinction: fuelMetric.moistureExtinction || 0.25,  // 무차원
      mineralContent: fuelMetric.mineralContent || 0.0555,  // 무차원
      effectiveMineralContent: fuelMetric.effectiveMineralContent || 0.01  // 무차원
    };
  }
  
  // ROS 결과 변환 (영국 단위 -> 미터법)
  export function convertROSToMetric(ros_ftmin) {
    return {
      ms: UnitConversions.ftminToMs(ros_ftmin),
      mhr: ros_ftmin * 0.3048 * 60, // m/hr
      kmhr: ros_ftmin * 0.018288    // km/hr
    };
  }
  
  // 화재 강도 변환
  export function convertIntensityToMetric(intensity_btuftmin) {
    return {
      kwm: intensity_btuftmin * 3.461,  // BTU/ft/min to kW/m
      mwm: intensity_btuftmin * 0.003461  // BTU/ft/min to MW/m
    };
  }
  
  // 연료 하중 변환
  export function convertFuelLoadToMetric(load_lbft2) {
    return {
      kgm2: UnitConversions.lbft2ToKgm2(load_lbft2),
      tonneHa: load_lbft2 * 48.8243  // lb/ft² to tonne/ha
    };
  }
  
  // 전체 산출물 변환 함수
  export function convertFireOutputsToMetric(outputs) {
    return {
      ros: convertROSToMetric(outputs.ros),
      intensity: convertIntensityToMetric(outputs.intensity),
      flameLength: UnitConversions.feetToMeters(outputs.flameLength),
      heatPerArea: UnitConversions.btulbToKjkg(outputs.heatPerArea),
      spreadDistance: UnitConversions.feetToMeters(outputs.spreadDistance)
    };
  }