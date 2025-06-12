export function parseAscFile(text, targetSize = 80) {
  const lines = text.split('\n').filter(line => line.trim());
  const header = {};
  let dataStart = 0;

  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const l = lines[i].toLowerCase();
    if (l.startsWith('ncols'))      header.ncols     = parseInt(l.split(/\s+/)[1], 10);
    else if (l.startsWith('nrows')) header.nrows     = parseInt(l.split(/\s+/)[1], 10);
    else if (l.startsWith('cellsize')) header.cellSize = parseFloat(l.split(/\s+/)[1]);
    else if (!isNaN(parseFloat(lines[i].split(/\s+/)[0]))) {
      dataStart = i;
      break;
    }
  }

  const data = [];
  for (let i = dataStart; i < lines.length && data.length < (header.nrows || targetSize); i++) {
    const vals = lines[i]
      .split(/\s+/)
      .map(v => parseFloat(v))
      .filter(v => !isNaN(v));
    if (vals.length) data.push(vals.slice(0, header.ncols || targetSize));
  }

  return {
    data,
    ncols: header.ncols,
    nrows: header.nrows,
    cellSize: header.cellSize ?? targetSize
  };
}