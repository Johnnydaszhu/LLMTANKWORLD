import seedrandom from 'seedrandom';

export class MazeGenerator {
  constructor(width, height, seed = null) {
    this.width = width;
    this.height = height;
    this.rng = seedrandom(seed);
    this.grid = [];
    this.visited = [];
    
    // Initialize grid
    for (let y = 0; y < height; y++) {
      this.grid[y] = [];
      this.visited[y] = [];
      for (let x = 0; x < width; x++) {
        this.grid[y][x] = 1; // 1 = wall, 0 = path
        this.visited[y][x] = false;
      }
    }
  }
  
  generate() {
    // Start from (1, 1)
    this.carve(1, 1);
    
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
  
  carve(x, y) {
    this.grid[y][x] = 0;
    this.visited[y][x] = true;
    
    // Random directions
    const directions = [
      [0, -2], [2, 0], [0, 2], [-2, 0]
    ].sort(() => this.rng() - 0.5);
    
    for (let [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (nx > 0 && nx < this.width - 1 && 
          ny > 0 && ny < this.height - 1 && 
          !this.visited[ny][nx]) {
        // Carve path between current and next
        this.grid[y + dy/2][x + dx/2] = 0;
        this.carve(nx, ny);
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