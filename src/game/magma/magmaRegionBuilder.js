const keyOf = (row, col) => `${row}:${col}`;

const DIRECTIONS = Object.freeze([
  Object.freeze({ direction: "north", dr: -1, dc: 0 }),
  Object.freeze({ direction: "east", dr: 0, dc: 1 }),
  Object.freeze({ direction: "south", dr: 1, dc: 0 }),
  Object.freeze({ direction: "west", dr: 0, dc: -1 }),
]);

export function buildMagmaRegions(cells = [], { cellWidth = 100, cellHeight = 100, seed = 1 } = {}) {
  const remaining = new Set(cells.map(([row, col]) => keyOf(row, col)));
  const regions = [];

  while (remaining.size) {
    const first = remaining.values().next().value;
    const queue = [first];
    const regionCells = [];
    remaining.delete(first);

    while (queue.length) {
      const current = queue.pop();
      const [row, col] = current.split(":").map(Number);
      regionCells.push([row, col]);
      for (const { dr, dc } of DIRECTIONS) {
        const neighbor = keyOf(row + dr, col + dc);
        if (remaining.delete(neighbor)) queue.push(neighbor);
      }
    }

    regionCells.sort(([rowA, colA], [rowB, colB]) => rowA - rowB || colA - colB);
    const cellSet = new Set(regionCells.map(([row, col]) => keyOf(row, col)));
    const rows = regionCells.map(([row]) => row);
    const cols = regionCells.map(([, col]) => col);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const edges = [];

    for (const [row, col] of regionCells) {
      for (const { direction, dr, dc } of DIRECTIONS) {
        if (cellSet.has(keyOf(row + dr, col + dc))) continue;
        edges.push({ row, col, direction, r: row, c: col, d: direction });
      }
    }

    regions.push({
      id: `magma-region-${regions.length}`,
      cells: regionCells,
      cellSet,
      minRow,
      maxRow,
      minCol,
      maxCol,
      cellWidth,
      cellHeight,
      bounds: {
        x: minCol * cellWidth,
        y: minRow * cellHeight,
        width: (maxCol - minCol + 1) * cellWidth,
        height: (maxRow - minRow + 1) * cellHeight,
      },
      // Art can extend beyond this soft mask while cellSet remains the authoritative
      // placement and damage geometry.
      visualMask: {
        clipInset: 0.75,
        transitionWidth: 30,
        lowFrequencyAmplitude: 12,
        wavelength: 92,
      },
      edges,
      seed: (seed + regions.length * 97) >>> 0,
    });
  }

  return regions;
}

export function pointIsInsideMagmaRegion(region, x, y, cellWidth = 100, cellHeight = 100) {
  const row = Math.floor(y / cellHeight);
  const col = Math.floor(x / cellWidth);
  return region?.cellSet?.has(keyOf(row, col)) || false;
}
