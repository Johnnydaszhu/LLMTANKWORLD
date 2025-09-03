import seedrandom from 'seedrandom';

export class SimpleMazeGenerator {
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
    // Create large open rooms connected by wide corridors
    
    // Create a grid of rooms
    const roomWidth = 5;
    const roomHeight = 5;
    const roomSpacing = 7;
    
    // Place rooms
    for (let ry = 1; ry < this.height - roomHeight; ry += roomSpacing) {
      for (let rx = 1; rx < this.width - roomWidth; rx += roomSpacing) {
        // Create room
        for (let y = ry; y < ry + roomHeight && y < this.height - 1; y++) {
          for (let x = rx; x < rx + roomWidth && x < this.width - 1; x++) {
            this.grid[y][x] = 0;
          }
        }
      }
    }
    
    // Connect rooms with horizontal corridors
    for (let y = 1; y < this.height - 1; y += roomSpacing) {
      for (let x = 1; x < this.width - 1; x++) {
        // Create 2-cell wide corridors
        this.grid[y][x] = 0;
        if (y + 1 < this.height - 1) {
          this.grid[y + 1][x] = 0;
        }
      }
    }
    
    // Connect rooms with vertical corridors
    for (let x = 1; x < this.width - 1; x += roomSpacing) {
      for (let y = 1; y < this.height - 1; y++) {
        // Create 2-cell wide corridors
        this.grid[y][x] = 0;
        if (x + 1 < this.width - 1) {
          this.grid[y][x + 1] = 0;
        }
      }
    }
    
    // Add some random openings for more interesting paths
    const numOpenings = Math.floor(this.width * this.height * 0.02);
    for (let i = 0; i < numOpenings; i++) {
      const x = Math.floor(this.rng() * (this.width - 2)) + 1;
      const y = Math.floor(this.rng() * (this.height - 2)) + 1;
      
      // Create small openings around this point
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx > 0 && nx < this.width - 1 && ny > 0 && ny < this.height - 1) {
            if (this.rng() < 0.3) {
              this.grid[ny][nx] = 0;
            }
          }
        }
      }
    }
    
    // Ensure borders are walls
    for (let x = 0; x < this.width; x++) {
      this.grid[0][x] = 1;
      this.grid[this.height - 1][x] = 1;
    }
    for (let y = 0; y < this.height; y++) {
      this.grid[y][0] = 1;
      this.grid[y][this.width - 1] = 1;
    }
    
    return this.grid;
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