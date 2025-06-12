export function parseWeatherCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const weather = [];
  
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(v => v.trim());
      if (cols.length >= 9) {
        const timeVal = parseInt(cols[3], 10);
        weather.push({
          year: parseInt(cols[0], 10),
          month: parseInt(cols[1], 10),
          day: parseInt(cols[2], 10),
          hour: Math.floor(timeVal / 100),
          temperature: parseFloat(cols[4]),
          humidity: parseFloat(cols[5]),
          precipitation: parseFloat(cols[6]),
          windSpeed: parseFloat(cols[7]),
          windDirection: parseFloat(cols[8]),
          cloudCover: parseFloat(cols[9] || 0)
        });
      }
    }
  
    return weather.sort((a, b) => a.hour - b.hour);
  }
  