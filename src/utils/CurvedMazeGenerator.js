import seedrandom from 'seedrandom';

export class CurvedMazeGenerator {
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
    // Use recursive backtracking to create a winding maze
    const stack = [];
    
    // Start from a random odd position
    let currentX = 1;
    let currentY = 1;
    this.grid[currentY][currentX] = 0;
    
    // Get all unvisited neighbors (2 steps away)
    const getUnvisitedNeighbors = (x, y) => {
      const neighbors = [];
      const directions = [
        { dx: 0, dy: -2 }, // Up
        { dx: 2, dy: 0 },  // Right
        { dx: 0, dy: 2 },  // Down
        { dx: -2, dy: 0 }  // Left
      ];
      
      for (let dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        
        if (nx > 0 && nx < this.width - 1 && 
            ny > 0 && ny < this.height - 1 && 
            this.grid[ny][nx] === 1) {
          neighbors.push({ x: nx, y: ny, dir });
        }
      }
      
      return neighbors;
    };
    
    // Add some randomness to the neighbor selection
    const shuffle = (array) => {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    
    // Start carving
    stack.push({ x: currentX, y: currentY });
    
    while (stack.length > 0) {
      const neighbors = shuffle(getUnvisitedNeighbors(currentX, currentY));
      
      if (neighbors.length > 0) {
        // Choose a random neighbor
        const next = neighbors[0];
        
        // Carve path to neighbor (including the wall between)
        const wallX = currentX + next.dir.dx / 2;
        const wallY = currentY + next.dir.dy / 2;
        this.grid[wallY][wallX] = 0;
        this.grid[next.y][next.x] = 0;
        
        // Move to the neighbor
        currentX = next.x;
        currentY = next.y;
        stack.push({ x: currentX, y: currentY });
      } else {
        // Backtrack
        const prev = stack.pop();
        if (prev) {
          currentX = prev.x;
          currentY = prev.y;
        }
      }
    }
    
    // Add some additional random paths for complexity
    const extraPaths = Math.floor(this.width * this.height * 0.05);
    for (let i = 0; i < extraPaths; i++) {
      const x = Math.floor(this.rng() * (this.width - 2)) + 1;
      const y = Math.floor(this.rng() * (this.height - 2)) + 1;
      
      // Check if this position can be opened without breaking the maze structure
      const wallCount = this.countAdjacentWalls(x, y);
      if (wallCount >= 3 && this.rng() < 0.3) {
        this.grid[y][x] = 0;
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
  
  countAdjacentWalls(x, y) {
    let count = 0;
    const directions = [
      { dx: 0, dy: -1 }, // Up
      { dx: 1, dy: 0 },  // Right
      { dx: 0, dy: 1 },  // Down
      { dx: -1, dy: 0 }  // Left
    ];
    
    for (let dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      
      if (nx >= 0 && nx < this.width && 
          ny >= 0 && ny < this.height && 
          this.grid[ny][nx] === 1) {
        count++;
      }
    }
    
    return count;
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