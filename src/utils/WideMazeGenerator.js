import seedrandom from 'seedrandom';

export class WideMazeGenerator {
  constructor(width, height, seed = null) {
    this.width = width;
    this.height = height;
    this.rng = seedrandom(seed);
    this.grid = [];
    
    // Initialize grid with walls
    for (let y = 0; y < height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < width; x++) {
        this.grid[y][x] = 1; // 1 = wall, 0 = path
      }
    }
  }
  
  generate() {
    console.log('Generating random maze...');
    
    // Create a more random maze using recursive backtracking with variations
    
    // Start from random position
    const startX = Math.floor(this.rng() * (this.width - 10)) + 5;
    const startY = Math.floor(this.rng() * (this.height - 10)) + 5;
    
    // Use recursive backtracking with random path widths
    this.carvePassages(startX, startY);
    
    // Add some random rooms of varying sizes
    this.addRandomRooms();
    
    // Add extra random passages for more connectivity
    this.addRandomPassages();
    
    // Ensure the maze has enough open space
    this.ensureMinimumOpenSpace();
    
    // Ensure borders are walls
    for (let x = 0; x < this.width; x++) {
      this.grid[0][x] = 1;
      this.grid[this.height - 1][x] = 1;
    }
    for (let y = 0; y < this.height; y++) {
      this.grid[y][0] = 1;
      this.grid[y][this.width - 1] = 1;
    }
    
    // Count walkable cells
    let walkableCount = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === 0) walkableCount++;
      }
    }
    console.log(`Generated maze with ${walkableCount} walkable cells (${Math.round(walkableCount / (this.width * this.height) * 100)}% open)`);
    
    return this.grid;
  }
  
  carvePassages(startX, startY) {
    const stack = [{x: startX, y: startY}];
    this.clearArea(startX - 1, startY - 1, 3, 3);
    
    while (stack.length > 0) {
      const current = stack[stack.length - 1];
      const neighbors = this.getUnvisitedNeighbors(current.x, current.y);
      
      if (neighbors.length > 0) {
        const next = neighbors[Math.floor(this.rng() * neighbors.length)];
        
        // Create passage with random width (1-2 cells)
        const passageWidth = this.rng() < 0.7 ? 2 : 3;
        this.createPassage(current.x, current.y, next.x, next.y, passageWidth);
        
        stack.push(next);
      } else {
        stack.pop();
      }
    }
  }
  
  getUnvisitedNeighbors(x, y) {
    const neighbors = [];
    const directions = [
      {dx: 0, dy: -4}, // Up
      {dx: 4, dy: 0},  // Right
      {dx: 0, dy: 4},  // Down
      {dx: -4, dy: 0}  // Left
    ];
    
    // Shuffle directions
    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }
    
    for (let dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      
      if (nx > 3 && nx < this.width - 3 && 
          ny > 3 && ny < this.height - 3 && 
          this.isAreaWall(nx, ny, 2)) {
        neighbors.push({x: nx, y: ny});
      }
    }
    
    return neighbors;
  }
  
  isAreaWall(x, y, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          if (this.grid[ny][nx] === 0) return false;
        }
      }
    }
    return true;
  }
  
  createPassage(x1, y1, x2, y2, width) {
    // Create horizontal passage
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    
    if (x1 !== x2) {
      // Horizontal passage
      for (let x = minX; x <= maxX; x++) {
        this.clearArea(x - Math.floor(width/2), y1 - Math.floor(width/2), width, width);
      }
    }
    
    if (y1 !== y2) {
      // Vertical passage
      for (let y = minY; y <= maxY; y++) {
        this.clearArea(x2 - Math.floor(width/2), y - Math.floor(width/2), width, width);
      }
    }
  }
  
  addRandomRooms() {
    // Add random rooms of varying sizes
    const numRooms = Math.floor(this.rng() * 8) + 5;
    
    for (let i = 0; i < numRooms; i++) {
      const roomWidth = Math.floor(this.rng() * 4) + 3; // 3-6
      const roomHeight = Math.floor(this.rng() * 4) + 3; // 3-6
      const roomX = Math.floor(this.rng() * (this.width - roomWidth - 4)) + 2;
      const roomY = Math.floor(this.rng() * (this.height - roomHeight - 4)) + 2;
      
      this.clearArea(roomX, roomY, roomWidth, roomHeight);
    }
  }
  
  addRandomPassages() {
    // Add random passages to break up walls and create more paths
    const numPassages = Math.floor(this.width * this.height * 0.03);
    
    for (let i = 0; i < numPassages; i++) {
      const x = Math.floor(this.rng() * (this.width - 6)) + 3;
      const y = Math.floor(this.rng() * (this.height - 6)) + 3;
      const length = Math.floor(this.rng() * 5) + 3;
      const direction = Math.floor(this.rng() * 4); // 0: up, 1: right, 2: down, 3: left
      
      const width = this.rng() < 0.8 ? 2 : 3;
      
      switch (direction) {
        case 0: // Up
          this.clearArea(x - Math.floor(width/2), y - length, width, length);
          break;
        case 1: // Right
          this.clearArea(x, y - Math.floor(width/2), length, width);
          break;
        case 2: // Down
          this.clearArea(x - Math.floor(width/2), y, width, length);
          break;
        case 3: // Left
          this.clearArea(x - length, y - Math.floor(width/2), length, width);
          break;
      }
    }
  }
  
  ensureMinimumOpenSpace() {
    // Ensure we have at least 40% open space
    const targetOpenCells = Math.floor(this.width * this.height * 0.4);
    let currentOpenCells = 0;
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === 0) currentOpenCells++;
      }
    }
    
    // Add more random openings if needed
    while (currentOpenCells < targetOpenCells) {
      const x = Math.floor(this.rng() * (this.width - 4)) + 2;
      const y = Math.floor(this.rng() * (this.height - 4)) + 2;
      
      if (this.grid[y][x] === 1) {
        // Clear a small area
        const size = Math.floor(this.rng() * 2) + 2;
        this.clearArea(x, y, size, size);
        currentOpenCells += size * size;
      }
    }
  }
  
  clearArea(x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx > 0 && nx < this.width - 1 && ny > 0 && ny < this.height - 1) {
          this.grid[ny][nx] = 0;
        }
      }
    }
  }
  
  getWalkablePositions() {
    const positions = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x] === 0) {
          positions.push({ x, y });
        }
      }
    }
    return positions;
  }
  
  getRandomWalkablePosition() {
    const positions = this.getWalkablePositions();
    if (positions.length === 0) return null;
    return positions[Math.floor(this.rng() * positions.length)];
  }
}