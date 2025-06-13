// src/utils/WeatherParser.js
export function parseWeatherCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(/\s+/);
  
  console.log('날씨 데이터 헤더:', headers);
  
  const weatherData = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].trim().split(/\s+/);
    if (values.length < 9) continue;
    
    const data = {
      year: parseInt(values[0]),
      month: parseInt(values[1]),
      day: parseInt(values[2]),
      time: parseInt(values[3]), // HHMM 형식
      temperature: parseFloat(values[4]),
      humidity: parseFloat(values[5]),
      precipitation: parseFloat(values[6]),
      windSpeed: parseFloat(values[7]), // m/s로 가정
      windDirection: parseFloat(values[8]), // 도
      cloudCover: parseFloat(values[9] || 0),
      // 시간 정보 추가
      hour: Math.floor(parseInt(values[3]) / 100),
      minute: parseInt(values[3]) % 100,
      // 전체 인덱스 (시작 시간부터 몇 시간째인지)
      hourIndex: i - 1
    };
    
    weatherData.push(data);
  }
  
  console.log(`날씨 데이터 파싱 완료: ${weatherData.length}시간 데이터`);
  console.log('첫 번째 데이터:', weatherData[0]);
  console.log('마지막 데이터:', weatherData[weatherData.length - 1]);
  
  return weatherData;
}