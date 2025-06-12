// src/utils/fireSpreadExtensions.js
// 기존 rothermel.js를 보완하는 추가 기능들

/**
 * 타원형 화재 확산 모델 (Anderson 1983)
 * @param {number} headROS - 전방 확산 속도 (m/s)
 * @param {number} windSpeed - 풍속 (m/s)
 * @param {number} elapsed - 경과 시간 (초)
 * @returns {Object} 타원 매개변수
 */
export function ellipticalFireSpread(headROS, windSpeed, elapsed) {
    // Length-to-width ratio (Rothermel 1991)
    const LWR = windSpeed > 0 
      ? 0.936 * Math.exp(0.2566 * windSpeed) + 0.461 * Math.exp(-0.1548 * windSpeed) - 0.397
      : 1.0;
    
    // Backing and flanking ROS
    const backingROS = headROS / LWR;
    const flankingROS = headROS / Math.sqrt(LWR);
    
    // 타원 매개변수 (미터 단위)
    const a = headROS * elapsed;      // 전방 확산 거리
    const b = flankingROS * elapsed;  // 측면 확산 거리
    const c = Math.sqrt(Math.max(0, a * a - b * b)); // 초점 거리
    
    return {
      a,           // 장축 반경 (m)
      b,           // 단축 반경 (m)
      c,           // 초점 거리 (m)
      backingROS,  // 후방 확산 속도 (m/s)
      flankingROS, // 측면 확산 속도 (m/s)
      LWR          // 길이-폭 비율
    };
  }
  
  /**
   * 특정 각도에서의 확산 거리 계산
   * @param {Object} ellipse - 타원 매개변수
   * @param {number} angle - 바람 방향 기준 각도 (라디안)
   * @returns {number} 확산 거리 (m)
   */
  export function spreadDistanceAtAngle(ellipse, angle) {
    const { a, b } = ellipse;
    if (a === 0 || b === 0) return 0;
    
    const cosTheta = Math.cos(angle);
    const sinTheta = Math.sin(angle);
    
    // 타원 방정식: r = ab / sqrt(b²cos²θ + a²sin²θ)
    const denominator = Math.sqrt(b * b * cosTheta * cosTheta + a * a * sinTheta * sinTheta);
    return denominator > 0 ? (a * b) / denominator : 0;
  }
  
  /**
   * Van Wagner 수관화 전이 모델 (1977)
   * @param {number} surfaceIntensity - 지표화 강도 (kW/m)
   * @param {number} foliarMoisture - 엽 수분 함량 (fraction)
   * @param {number} canopyBaseHeight - 수관 기저 높이 (m)
   * @returns {Object} 수관화 전이 정보
   */
  export function crownFireInitiation(surfaceIntensity, foliarMoisture, canopyBaseHeight) {
    // Critical surface fire intensity for crown fire initiation
    // Van Wagner (1977) equation
    const C = 0.01;      // 상수
    const h = canopyBaseHeight * 100; // m to cm
    const FMC = foliarMoisture * 100; // fraction to percent
    
    // I_0 = (0.01 * CBH * (460 + 25.9 * FMC))^1.5
    const criticalIntensity = Math.pow(C * h * (460 + 25.9 * FMC), 1.5);
    
    return {
      willTransition: surfaceIntensity > criticalIntensity,
      criticalIntensity,
      surfaceIntensity,
      ratio: surfaceIntensity / criticalIntensity
    };
  }
  
  /**
   * 화재선 강도 계산 (Byram 1959)
   * @param {number} ROS - 확산 속도 (m/s)
   * @param {number} fuelLoad - 연료 하중 (kg/m²)
   * @param {number} heatYield - 열 함량 (kJ/kg)
   * @returns {number} 화재선 강도 (kW/m)
   */
  export function firelineIntensity(ROS, fuelLoad, heatYield = 18000) {
    // I = H * w * R
    // I: fireline intensity (kW/m)
    // H: heat yield (kJ/kg)
    // w: available fuel load (kg/m²)
    // R: rate of spread (m/s)
    return heatYield * fuelLoad * ROS;
  }
  
  /**
   * 화염 길이 계산 (Byram 1959)
   * @param {number} intensity - 화재선 강도 (kW/m)
   * @returns {number} 화염 길이 (m)
   */
  export function flameLength(intensity) {
    // Byram's flame length equation
    // L = 0.0775 * I^0.46 (for I in kW/m)
    return 0.0775 * Math.pow(intensity, 0.46);
  }
  
  /**
   * 점화원(Spotting) 거리 계산 (Albini 1979 간소화)
   * @param {number} firelineIntensity - 화재선 강도 (kW/m)
   * @param {number} windSpeed - 풍속 (m/s)
   * @param {number} canopyHeight - 수관 높이 (m)
   * @returns {number} 최대 점화원 거리 (m)
   */
  export function spottingDistance(firelineIntensity, windSpeed, canopyHeight) {
    if (firelineIntensity < 1000) return 0; // 낮은 강도는 점화원 없음
    
    // Morris (1987) 간소화 모델
    // 점화원 거리는 화재 강도, 풍속, 수관 높이에 비례
    const intensityFactor = Math.sqrt(firelineIntensity / 1000);
    const windFactor = windSpeed / 10;
    const heightFactor = Math.log10(canopyHeight + 1);
    
    const maxDistance = 100 * intensityFactor * windFactor * heightFactor;
    
    return Math.min(maxDistance, 2000); // 최대 2km로 제한
  }
  
  /**
   * 연료 하중 변환 (t/ac to kg/m²)
   * @param {number} tonsPerAcre - 톤/에이커
   * @returns {number} kg/m²
   */
  export function fuelLoadToKgM2(tonsPerAcre) {
    // 1 ton/acre = 2000 lb/acre = 2000 lb / 43560 ft²
    // = 0.0459 lb/ft² = 0.224 kg/m²
    return tonsPerAcre * 0.224;
  }