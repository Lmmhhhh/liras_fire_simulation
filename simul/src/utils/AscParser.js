// src/utils/AscParser.js
export function parseAscFile(text, targetSize = 80) {
  const lines = text.split('\n').filter(line => line.trim());
  const header = {};
  let dataStart = 0;

  // 모든 헤더 키워드
  const headerKeywords = ['ncols', 'nrows', 'xllcorner', 'yllcorner', 'cellsize', 'nodata_value'];

  // 헤더 파싱 - 더 유연하게
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();
    
    // 헤더 라인인지 확인
    let isHeader = false;
    for (const keyword of headerKeywords) {
      if (lowerLine.startsWith(keyword)) {
        isHeader = true;
        const parts = line.split(/\s+/);
        const key = parts[0].toLowerCase();
        const value = parseFloat(parts[1]);
        
        switch(key) {
          case 'ncols':
            header.ncols = parseInt(parts[1], 10);
            break;
          case 'nrows':
            header.nrows = parseInt(parts[1], 10);
            break;
          case 'cellsize':
            header.cellSize = value;
            break;
          case 'nodata_value':
            header.nodata = value;
            break;
          case 'xllcorner':
            header.xllcorner = value;
            break;
          case 'yllcorner':
            header.yllcorner = value;
            break;
        }
        break;
      }
    }
    
    // 헤더가 아니고 숫자로 시작하면 데이터 시작
    if (!isHeader && !isNaN(parseFloat(line.split(/\s+/)[0]))) {
      dataStart = i;
      break;
    }
  }

  console.log('파싱된 헤더:', header);
  console.log('데이터 시작 라인:', dataStart);

  // 데이터 파싱
  const data = [];
  const maxRows = header.nrows || targetSize;
  const maxCols = header.ncols || targetSize;
  
  for (let i = dataStart; i < lines.length && data.length < maxRows; i++) {
    const vals = lines[i]
      .trim()
      .split(/\s+/)
      .map(v => {
        const num = parseFloat(v);
        // NODATA 처리
        if (header.nodata !== undefined && num === header.nodata) {
          return 0; // 연료 없음으로 처리
        }
        return num;
      })
      .filter(v => !isNaN(v));
    
    if (vals.length) {
      data.push(vals.slice(0, maxCols));
    }
  }

  // 데이터 검증
  console.log(`파싱 결과: ${data.length}행 x ${data[0]?.length || 0}열`);
  if (header.nrows && data.length !== header.nrows) {
    console.warn(`행 수 불일치: 예상 ${header.nrows}, 실제 ${data.length}`);
  }

  return {
    data,
    ncols: header.ncols,
    nrows: header.nrows,
    cellSize: header.cellSize || 30, // 기본값 30m
    nodata: header.nodata
  };
}