// generateMoisture.js
const fs = require('fs');

function generateTestMoisture() {
  const ncols = 329;
  const nrows = 266;
  
  let content = `ncols        ${ncols}
nrows        ${nrows}
xllcorner    345370.000000000000
yllcorner    4005605.000000000000
cellsize     30.000000000000
NODATA_value -9999
`;

  // 각 행에 대해 수분 값 생성 (0.05 ~ 0.20 범위)
  for (let i = 0; i < nrows; i++) {
    let row = [];
    for (let j = 0; j < ncols; j++) {
      // 랜덤하게 5% ~ 20% 수분 생성
      const moisture = (Math.random() * 0.15 + 0.05).toFixed(2);
      row.push(moisture);
    }
    content += row.join(' ') + '\n';
  }
  
  return content;
}

// 파일로 저장
const moistureData = generateTestMoisture();
fs.writeFileSync('moisture.asc', moistureData);
console.log('moisture.asc 파일이 생성되었습니다.');