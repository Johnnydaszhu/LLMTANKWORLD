// Smart driver with configurable personality and behavior
import { CONFIG } from '../components/GameManager.js';

export class SmartDriver {
  constructor(policy) {
    this.policy = policy;
    this.target = null;
    this.path = [];
    this.lastPathUpdate = 0;
    this.stuckCounter = 0;
    this.lastPosition = { x: 0, y: 0 };
    this.lastMoveDirection = 'UP';
    this.preferredDirection = null;
    
    // Extract behavior traits from policy
    this.behavior = policy.payload?.behavior || 'balanced';
    this.targetPreference = policy.payload?.targetPreference || 'balanced';
    this.aggressionLevel = this.getAggressionLevel();
    this.riskTolerance = this.getRiskTolerance();
    this.explorationStyle = this.getExplorationStyle();
    
    // Personality-specific parameters
    this.combatDistance = this.getPreferredCombatDistance();
    this.coinPriority = this.getCoinPriority();
    this.retreatThreshold = this.getRetreatThreshold();
  }
  
  getAggressionLevel() {
    switch (this.behavior) {
      case 'elite': return 0.9;
      case 'aggressive': return 0.8;
      case 'defensive': return 0.3;
      case 'balanced': return 0.5;
      case 'opportunistic': return 0.6;
      case 'passive': return 0.1;
      case 'random': return Math.random();
      default: return 0.5;
    }
  }
  
  getRiskTolerance() {
    switch (this.behavior) {
      case 'elite': return 0.7; // High but calculated risk
      case 'aggressive': return 0.8;
      case 'defensive': return 0.2;
      case 'balanced': return 0.5;
      case 'cautious': return 0.3;
      case 'passive': return 0.1;
      case 'random': return Math.random();
      default: return 0.5;
    }
  }
  
  getExplorationStyle() {
    switch (this.behavior) {
      case 'elite': return 'tactical';
      case 'aggressive': return 'hunt';
      case 'defensive': return 'safe';
      case 'balanced': return 'systematic';
      case 'opportunistic': return 'greedy';
      case 'passive': return 'avoid';
      case 'random': return 'random';
      default: return 'systematic';
    }
  }
  
  getPreferredCombatDistance() {
    switch (this.behavior) {
      case 'elite': return 4; // Optimal for kiting
      case 'aggressive': return 3; // Likes to get close
      case 'defensive': return 6; // Prefers distance
      case 'balanced': return 4;
      default: return 4;
    }
  }
  
  getCoinPriority() {
    switch (this.targetPreference) {
      case 'coins': return 1.5;
      case 'tanks': return 0.5;
      case 'smart': return this.getCoinSmartPriority();
      case 'balanced': return 1.0;
      default: return 1.0;
    }
  }
  
  getCoinSmartPriority() {
    // Dynamic coin priority based on situation
    // Elite behavior: only collect coins when safe or advantageous
    return 0.8; // Lower priority, focus on combat
  }
  
  getRetreatThreshold() {
    // HP percentage at which to retreat
    switch (this.behavior) {
      case 'elite': return 0.25; // 25% HP - fights until low
      case 'aggressive': return 0.2; // 20% HP
      case 'defensive': return 0.5; // 50% HP
      case 'balanced': return 0.3; // 30% HP
      case 'cautious': return 0.4; // 40% HP
      case 'passive': return 0.7; // 70% HP
      default: return 0.3;
    }
  }
  
  decide(observation) {
    const self = observation.self;
    const enemies = observation.enemies;
    const coins = observation.coins;
    const maze = observation.maze;
    
    // Elite tank debug info
    if (this.behavior === 'elite' && observation.tick % 100 === 0) {
      console.log(`Inferno Elite Tank Status:`, {
        hp: `${self.hp}/${self.maxHp}`,
        coins: self.coins,
        kills: self.kills,
        behavior: this.behavior,
        tactics: this.policy.payload?.tactics
      });
    }
    
    // Enhanced stuck detection - check if tank is making meaningful progress
    const currentPos = { x: Math.floor(self.x), y: Math.floor(self.y) };
    const posKey = `${currentPos.x},${currentPos.y}`;
    
    // Track recent positions to detect loops
    if (!this.recentPositions) {
      this.recentPositions = [];
    }
    
    this.recentPositions.push(posKey);
    if (this.recentPositions.length > 10) {
      this.recentPositions.shift();
    }
    
    // Check if stuck (not moving or looping)
    let isStuck = false;
    
    // Check exact position match
    if (this.lastPosition && 
        Math.abs(self.x - this.lastPosition.x) < 0.1 && 
        Math.abs(self.y - this.lastPosition.y) < 0.1) {
      this.stuckCounter++;
      isStuck = this.stuckCounter > 2;
    } 
    // Check for position looping
    else if (this.recentPositions.length >= 6) {
      const recentSet = new Set(this.recentPositions.slice(-6));
      if (recentSet.size <= 3) { // Been in 3 or fewer positions recently
        isStuck = true;
        this.stuckCounter++;
      } else {
        this.stuckCounter = 0;
      }
    } else {
      this.stuckCounter = 0;
    }
    
    this.lastPosition = { x: self.x, y: self.y };
    
    // If stuck, try to escape
    if (isStuck) {
      console.log(`Tank ${self.teamName} is stuck, attempting escape...`);
      return this.escapeFromDeadEnd(self, maze);
    }
    
    // Enhanced enemy detection with threat assessment
    let nearestEnemy = null;
    let minEnemyDist = Infinity;
    let highestThreat = null;
    let maxThreatLevel = 0;
    
    for (let enemy of enemies) {
      const dist = Math.abs(enemy.x - self.x) + Math.abs(enemy.y - self.y);
      
      // Basic threat assessment based on distance and alignment
      let threatLevel = 0;
      if (dist <= self.sight) {
        threatLevel = 100 / (dist + 1); // Closer = more threatening
        
        // Bonus if enemy is aligned with us
        if (this.isAligned(self, enemy)) {
          threatLevel *= 1.5;
        }
        
        // Update highest threat
        if (threatLevel > maxThreatLevel) {
          maxThreatLevel = threatLevel;
          highestThreat = enemy;
        }
        
        // Update nearest
        if (dist < minEnemyDist) {
          minEnemyDist = dist;
          nearestEnemy = enemy;
        }
      }
    }
    
    // Use highest threat enemy instead of just nearest
    const targetEnemy = highestThreat || nearestEnemy;
    
    // Find nearest coin with value assessment
    let nearestCoin = null;
    let minCoinDist = Infinity;
    let bestCoinValue = 0;
    
    for (let coin of coins) {
      const dist = Math.abs(coin.x - self.x) + Math.abs(coin.y - self.y);
      // Consider coin value vs distance risk
      const coinValue = coin.value / (dist + 1);
      
      if (coinValue > bestCoinValue || (coinValue === bestCoinValue && dist < minCoinDist)) {
        bestCoinValue = coinValue;
        minCoinDist = dist;
        nearestCoin = coin;
      }
    }
    
    // Enhanced decision making with state awareness
    let moveDirection = 'STOP';
    let fireDirection = 'NONE';
    
    // Combat priority based on personality and HP
    const hpRatio = self.hp / self.maxHp;
    const shouldRetreat = hpRatio < this.retreatThreshold;
    const engagementRange = this.combatDistance + (this.aggressionLevel * 2);
    
    if (targetEnemy && minEnemyDist <= 8 && !shouldRetreat) {
      // Combat mode - personality-based decisions
      const combatDecision = this.makePersonalityBasedCombatDecision(self, targetEnemy, maze, minEnemyDist);
      moveDirection = combatDecision.move;
      fireDirection = combatDecision.fire;
      
      // Defensive personalities might still retreat even when not critical
      if (this.behavior === 'defensive' && hpRatio < 0.6 && minEnemyDist <= 3) {
        moveDirection = this.getDirectionAway(
          targetEnemy.x - self.x,
          targetEnemy.y - self.y
        );
      }
    } else if (shouldRetreat) {
      // Retreat mode - find safety
      moveDirection = this.findSafeRetreatPath(self, enemies, maze);
      
      // Still shoot if being chased
      if (self.cooldown === 0 && targetEnemy && minEnemyDist <= 5) {
        fireDirection = this.getDirectionTowards(
          targetEnemy.x - self.x,
          targetEnemy.y - self.y
        );
      }
    } else {
      // Exploration/resource gathering mode - personality-based
      moveDirection = this.makePersonalityBasedExploration(self, enemies, coins, nearestCoin, minCoinDist, maze);
      
      // Opportunistic shooting based on personality
      if (self.cooldown === 0) {
        if (this.behavior === 'aggressive') {
          // Aggressive tanks shoot more often
          fireDirection = this.strategicShooting(self, enemies, maze);
        } else if (this.behavior === 'opportunistic' && Math.random() < 0.5) {
          // Opportunistic tanks sometimes take shots
          fireDirection = this.strategicShooting(self, enemies, maze);
        }
      }
    }
    
    // Upgrade decision logic
    let upgradeDirection = 'NONE';
    if (self.coins >= 10) {
      upgradeDirection = this.chooseUpgrade(self, targetEnemy, minEnemyDist);
    }
    
    // Remember the last successful move direction
    if (moveDirection !== 'STOP') {
      this.lastMoveDirection = moveDirection;
    }
    
    return {
      move: moveDirection,
      fire: fireDirection,
      upgrade: upgradeDirection
    };
  }
  
  escapeFromDeadEnd(self, maze) {
    this.stuckCounter = 0;
    
    // Clear position history to avoid immediate re-detection
    this.recentPositions = [];
    
    // Find the best escape route
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const directionScores = [];
    
    for (let dir of directions) {
      const vec = this.directionToVector(dir);
      if (this.canMove(self.x, self.y, vec, maze)) {
        let score = 0;
        
        // Look ahead to see where this direction leads
        let lookAheadX = self.x + vec.x;
        let lookAheadY = self.y + vec.y;
        
        // Check multiple steps ahead
        for (let step = 1; step <= 5; step++) {
          const gridX = Math.floor(lookAheadX);
          const gridY = Math.floor(lookAheadY);
          
          // Bounds check
          if (gridX < 0 || gridX >= maze[0].length || 
              gridY < 0 || gridY >= maze.length ||
              maze[gridY][gridX] === 1) {
            break;
          }
          
          // Score based on openness
          score += (6 - step);
          
          // Bonus for leading to open areas
          const openNeighbors = this.countOpenNeighbors(gridX, gridY, maze);
          score += openNeighbors * 2;
          
          // Penalty if we've been here recently
          const posKey = `${gridX},${gridY}`;
          if (this.recentPositions && this.recentPositions.includes(posKey)) {
            score -= 10;
          }
          
          lookAheadX += vec.x;
          lookAheadY += vec.y;
        }
        
        directionScores.push({ dir, score });
      }
    }
    
    // Sort by score
    directionScores.sort((a, b) => b.score - a.score);
    
    // Choose the best direction
    if (directionScores.length > 0) {
      const bestDir = directionScores[0].dir;
      
      // If best direction is really bad, try to find unexplored area
      if (directionScores[0].score < 5) {
        const unexplored = this.findNearestUnexploredDirection(self, maze);
        if (unexplored !== 'STOP') {
          return {
            move: unexplored,
            fire: 'NONE',
            upgrade: 'NONE'
          };
        }
      }
      
      return {
        move: bestDir,
        fire: 'NONE',
        upgrade: 'NONE'
      };
    }
    
    return { move: 'STOP', fire: 'NONE', upgrade: 'NONE' };
  }
  
  countOpenNeighbors(x, y, maze) {
    let count = 0;
    const neighbors = [
      {dx: 0, dy: -1}, {dx: 1, dy: 0},
      {dx: 0, dy: 1}, {dx: -1, dy: 0}
    ];
    
    for (let n of neighbors) {
      const nx = x + n.dx;
      const ny = y + n.dy;
      
      if (nx >= 0 && nx < maze[0].length && 
          ny >= 0 && ny < maze.length &&
          maze[ny][nx] === 0) {
        count++;
      }
    }
    
    return count;
  }
  
  findNearestUnexploredDirection(self, maze) {
    if (!this.visitedPositions) return 'STOP';
    
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    let bestDir = 'STOP';
    let bestScore = -1;
    
    for (let dir of directions) {
      const vec = this.directionToVector(dir);
      if (this.canMove(self.x, self.y, vec, maze)) {
        let score = 0;
        
        // Check a few steps in this direction
        for (let step = 1; step <= 3; step++) {
          const checkX = Math.floor(self.x + vec.x * step);
          const checkY = Math.floor(self.y + vec.y * step);
          const key = `${checkX},${checkY}`;
          
          if (!this.visitedPositions.has(key)) {
            score += (4 - step) * 5;
          }
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestDir = dir;
        }
      }
    }
    
    return bestDir;
  }
  
  makeCombatDecision(self, enemy, maze) {
    const dx = enemy.x - self.x;
    const dy = enemy.y - self.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    
    let moveDirection = 'STOP';
    let fireDirection = 'NONE';
    
    // Advanced combat tactics with predictive positioning
    if (dist <= 2) {
      // Too close - create distance while maintaining alignment
      moveDirection = this.getDirectionAway(dx, dy);
      
      // But if we're aligned and can shoot, take the shot first
      if (this.isAligned(self, enemy) && self.cooldown === 0) {
        fireDirection = this.getDirectionTowards(dx, dy);
      }
    } else if (dist > 6) {
      // Use predictive interception - anticipate enemy movement
      const predictedPos = this.predictEnemyPosition(enemy, self, dist);
      const predDx = predictedPos.x - self.x;
      const predDy = predictedPos.y - self.y;
      
      // Move to intercept position
      const interceptX = predictedPos.x + (predDx > 0 ? -3 : 3);
      const interceptY = predictedPos.y;
      moveDirection = this.findPathToTarget(self, { x: interceptX, y: interceptY }, maze);
      
      // If path blocked, try alternative interception
      if (moveDirection === 'STOP') {
        const altX = predictedPos.x;
        const altY = predictedPos.y + (predDy > 0 ? -3 : 3);
        moveDirection = this.findPathToTarget(self, { x: altX, y: altY }, maze);
      }
    }
    
    // Enhanced shooting logic with leading
    if (dist <= 8 && dist > 1 && self.cooldown === 0) {
      // Check if we have a clear shot with leading
      const shotInfo = this.calculateLeadingShot(self, enemy, maze);
      
      if (shotInfo.canShoot) {
        fireDirection = shotInfo.direction;
        console.log(`Tank ${self.teamName} leading shot ${fireDirection} at distance ${dist}!`);
      } else if (this.isAligned(self, enemy)) {
        // Direct shot if aligned
        fireDirection = this.getDirectionTowards(dx, dy);
      } else {
        // Move to alignment
        moveDirection = this.getAlignmentMove(self, enemy, maze, moveDirection);
      }
    }
    
    // Tactical movement - use cover when possible
    if (moveDirection !== 'STOP' && enemy.cooldown === 0) {
      const coverMove = this.findCoveredApproach(self, enemy, maze, moveDirection);
      if (coverMove !== 'STOP') {
        moveDirection = coverMove;
      }
    }
    
    return { move: moveDirection, fire: fireDirection };
  }
  
  findPathToTarget(self, target, maze) {
    // Enhanced pathfinding with obstacle avoidance
    const dx = target.x - self.x;
    const dy = target.y - self.y;
    
    // If already at target, stop
    if (dx === 0 && dy === 0) {
      return 'STOP';
    }
    
    // Use A*-like pathfinding for short distances
    const path = this.findShortestPath(self, target, maze);
    if (path.length > 1) {
      const firstStep = path[1]; // [0] is current position
      const stepDx = firstStep.x - self.x;
      const stepDy = firstStep.y - self.y;
      
      return this.vectorToDirection(stepDx, stepDy);
    }
    
    // Fallback to simple direction-based movement
    return this.getDirectionTowards(dx, dy);
  }
  
  findShortestPath(start, goal, maze) {
    // Enhanced BFS pathfinding with better handling of edge cases
    const startX = Math.floor(start.x);
    const startY = Math.floor(start.y);
    let goalX = Math.floor(goal.x);
    let goalY = Math.floor(goal.y);
    
    // If goal is not reachable (wall or out of bounds), find nearest reachable point
    if (goalX < 0 || goalX >= maze[0].length || 
        goalY < 0 || goalY >= maze.length ||
        maze[goalY][goalX] === 1) {
      const nearestPoint = this.findNearestReachablePoint(goalX, goalY, maze);
      if (!nearestPoint) {
        return [{x: startX, y: startY}];
      }
      goalX = nearestPoint.x;
      goalY = nearestPoint.y;
    }
    
    const queue = [{x: startX, y: startY, path: [{x: startX, y: startY}]}];
    const visited = new Set();
    const maxSteps = 15; // Reduced for better performance
    
    while (queue.length > 0) {
      const current = queue.shift();
      const key = `${current.x},${current.y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);
      
      // Check if reached goal (with some tolerance for floating point)
      if (Math.abs(current.x - goalX) <= 1 && Math.abs(current.y - goalY) <= 1) {
        return current.path;
      }
      
      // Don't search too far
      if (current.path.length > maxSteps) continue;
      
      // Check all directions
      const directions = [
        {dx: 0, dy: -1, dir: 'UP'},
        {dx: 1, dy: 0, dir: 'RIGHT'},
        {dx: 0, dy: 1, dir: 'DOWN'},
        {dx: -1, dy: 0, dir: 'LEFT'}
      ];
      
      for (let dir of directions) {
        const newX = current.x + dir.dx;
        const newY = current.y + dir.dy;
        
        // Check bounds and walls
        if (newX >= 0 && newX < maze[0].length && 
            newY >= 0 && newY < maze.length &&
            maze[newY][newX] === 0) {
          
          const newKey = `${newX},${newY}`;
          if (!visited.has(newKey)) {
            queue.push({
              x: newX,
              y: newY,
              path: [...current.path, {x: newX, y: newY}]
            });
          }
        }
      }
    }
    
    // No path found - try to find any valid move towards target
    return this.findAnyPathTowards(startX, startY, goalX, goalY, maze);
  }
  
  findNearestReachablePoint(x, y, maze) {
    // Find the nearest walkable cell to the given position
    const searchRadius = 5;
    
    for (let radius = 1; radius <= searchRadius; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          
          const checkX = x + dx;
          const checkY = y + dy;
          
          if (checkX >= 0 && checkX < maze[0].length && 
              checkY >= 0 && checkY < maze.length &&
              maze[checkY][checkX] === 0) {
            return { x: checkX, y: checkY };
          }
        }
      }
    }
    
    return null;
  }
  
  findAnyPathTowards(startX, startY, goalX, goalY, maze) {
    // If no complete path exists, at least move towards the target
    const dx = goalX - startX;
    const dy = goalY - startY;
    
    // Try to move in the general direction
    const primaryDir = Math.abs(dx) > Math.abs(dy) ? 
      (dx > 0 ? 'RIGHT' : 'LEFT') : 
      (dy > 0 ? 'DOWN' : 'UP');
    
    const vec = this.directionToVector(primaryDir);
    const newX = startX + vec.dx;
    const newY = startY + vec.dy;
    
    if (newX >= 0 && newX < maze[0].length && 
        newY >= 0 && newY < maze.length &&
        maze[newY][newX] === 0) {
      return [
        {x: startX, y: startY},
        {x: newX, y: newY}
      ];
    }
    
    // Can't move towards target, stay put
    return [{x: startX, y: startY}];
  }
  
  vectorToDirection(dx, dy) {
    if (dx > 0) return 'RIGHT';
    if (dx < 0) return 'LEFT';
    if (dy > 0) return 'DOWN';
    if (dy < 0) return 'UP';
    return 'STOP';
  }
  
  explore(self, maze) {
    // Intelligent exploration with memory and purpose
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const validDirections = [];
    
    // Check which directions are valid
    for (let dir of directions) {
      if (this.canMove(self.x, self.y, this.directionToVector(dir), maze)) {
        validDirections.push(dir);
      }
    }
    
    if (validDirections.length === 0) {
      return 'STOP';
    }
    
    // Initialize visited positions tracking if not exists
    if (!this.visitedPositions) {
      this.visitedPositions = new Set();
      this.explorationTarget = null;
    }
    
    // Mark current position as visited
    const currentKey = `${Math.floor(self.x)},${Math.floor(self.y)}`;
    this.visitedPositions.add(currentKey);
    
    // If we have an exploration target, try to reach it
    if (this.explorationTarget) {
      const targetKey = `${this.explorationTarget.x},${this.explorationTarget.y}`;
      
      // Check if we reached the target or it's no longer valid
      if (currentKey === targetKey || this.visitedPositions.has(targetKey)) {
        this.explorationTarget = null;
      } else {
        // Try to move towards target
        const moveDir = this.findPathToTarget(self, this.explorationTarget, maze);
        if (moveDir !== 'STOP') {
          return moveDir;
        } else {
          // Can't reach target, find a new one
          this.explorationTarget = null;
        }
      }
    }
    
    // Find a new exploration target
    if (!this.explorationTarget) {
      this.explorationTarget = this.findUnexploredArea(self, maze);
      
      // If found unexplored area, move towards it
      if (this.explorationTarget) {
        const moveDir = this.findPathToTarget(self, this.explorationTarget, maze);
        if (moveDir !== 'STOP') {
          return moveDir;
        }
      }
    }
    
    // Fallback: prefer unvisited directions
    const unvisitedDirections = [];
    for (let dir of validDirections) {
      const vec = this.directionToVector(dir);
      const newX = Math.floor(self.x + vec.x);
      const newY = Math.floor(self.y + vec.y);
      const newKey = `${newX},${newY}`;
      
      if (!this.visitedPositions.has(newKey)) {
        unvisitedDirections.push(dir);
      }
    }
    
    // Choose from unvisited directions first
    let chosenDirection;
    if (unvisitedDirections.length > 0) {
      chosenDirection = unvisitedDirections[Math.floor(Math.random() * unvisitedDirections.length)];
    } else {
      // All directions visited, choose the one leading to least visited area
      chosenDirection = this.findBestExplorationDirection(self, maze, validDirections);
    }
    
    // Continue in chosen direction for a while
    if (this.preferredDirection === chosenDirection && Math.random() < 0.7) {
      return chosenDirection;
    } else {
      this.preferredDirection = chosenDirection;
      return chosenDirection;
    }
  }
  
  findUnexploredArea(self, maze) {
    // Find the nearest unexplored area
    const searchRadius = 10;
    let bestTarget = null;
    let bestScore = -1;
    
    // Search in expanding circles
    for (let radius = 3; radius <= searchRadius; radius += 2) {
      for (let angle = 0; angle < 360; angle += 45) {
        const rad = angle * Math.PI / 180;
        const checkX = Math.floor(self.x + radius * Math.cos(rad));
        const checkY = Math.floor(self.y + radius * Math.sin(rad));
        
        // Check bounds
        if (checkX >= 0 && checkX < maze[0].length && 
            checkY >= 0 && checkY < maze.length) {
          
          const key = `${checkX},${checkY}`;
          
          // Skip if visited or wall
          if (this.visitedPositions.has(key) || maze[checkY][checkX] === 1) {
            continue;
          }
          
          // Calculate score based on distance and unexplored neighbors
          let score = 100 / radius; // Closer is better
          
          // Bonus for areas with many unexplored neighbors
          let unexploredCount = 0;
          const neighbors = [
            {dx: 0, dy: -1}, {dx: 1, dy: 0},
            {dx: 0, dy: 1}, {dx: -1, dy: 0}
          ];
          
          for (let n of neighbors) {
            const nx = checkX + n.dx;
            const ny = checkY + n.dy;
            const nKey = `${nx},${ny}`;
            
            if (nx >= 0 && nx < maze[0].length && 
                ny >= 0 && ny < maze.length &&
                !this.visitedPositions.has(nKey) &&
                maze[ny][nx] === 0) {
              unexploredCount++;
            }
          }
          
          score += unexploredCount * 10;
          
          if (score > bestScore) {
            bestScore = score;
            bestTarget = { x: checkX, y: checkY };
          }
        }
      }
      
      // Return if found a good target in this radius
      if (bestTarget) {
        return bestTarget;
      }
    }
    
    return null;
  }
  
  findBestExplorationDirection(self, maze, validDirections) {
    // Try to find direction with most open space and least visited
    let bestDirection = validDirections[0];
    let bestScore = -1;
    
    for (let dir of validDirections) {
      let score = 0;
      const vec = this.directionToVector(dir);
      
      // Look ahead a few cells
      let openSpace = 0;
      for (let i = 1; i <= 5; i++) {
        const checkX = Math.floor(self.x + vec.x * i);
        const checkY = Math.floor(self.y + vec.y * i);
        
        if (checkX >= 0 && checkX < maze[0].length && 
            checkY >= 0 && checkY < maze.length &&
            maze[checkY][checkX] === 0) {
          
          const key = `${checkX},${checkY}`;
          // Penalty for visited positions
          if (!this.visitedPositions.has(key)) {
            openSpace += (6 - i); // Closer cells worth more
          } else {
            openSpace += (6 - i) * 0.3; // Reduced score for visited
          }
        } else {
          break; // Hit a wall
        }
      }
      
      score = openSpace + Math.random() * 2;
      
      if (score > bestScore) {
        bestScore = score;
        bestDirection = dir;
      }
    }
    
    return bestDirection;
  }
  
  strategicShooting(self, enemies, maze) {
    // Shoot down corridors or towards enemy last known positions
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    
    // Prefer shooting down long corridors
    for (let dir of directions) {
      if (this.canShootInDirection(self, dir, maze, 8)) {
        // Check if this is a long corridor
        const vec = this.directionToVector(dir);
        let corridorLength = 0;
        
        for (let i = 1; i <= 8; i++) {
          const checkX = Math.floor(self.x + vec.x * i);
          const checkY = Math.floor(self.y + vec.y * i);
          
          if (checkX >= 0 && checkX < maze[0].length && 
              checkY >= 0 && checkY < maze.length &&
              maze[checkY][checkX] === 0) {
            corridorLength++;
          } else {
            break;
          }
        }
        
        // If it's a long corridor, likely enemy might be there
        if (corridorLength >= 5 && Math.random() < 0.4) {
          return dir;
        }
      }
    }
    
    return 'NONE';
  }
  
  huntEnemies(self, enemies, maze) {
    if (enemies.length === 0) {
      return this.explore(self, maze);
    }
    
    // Smart hunting - consider enemy last known positions and sight lines
    let bestTarget = null;
    let bestScore = -1;
    
    for (let enemy of enemies) {
      // Calculate a score based on various factors
      let score = 0;
      
      // Distance factor - closer is better
      const dist = Math.abs(enemy.x - self.x) + Math.abs(enemy.y - self.y);
      score += 100 / (dist + 1);
      
      // Sight line bonus - if we can see them, they're easier to hunt
      if (this.hasLineOfSight(self, enemy, maze)) {
        score += 50;
      }
      
      // Choke point bonus - enemies in corridors are easier to find
      if (this.isInChokePoint(enemy, maze)) {
        score += 30;
      }
      
      // Update best target
      if (score > bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }
    
    if (bestTarget) {
      // Use intelligent pathfinding to hunt the target
      const huntPath = this.findHuntingPath(self, bestTarget, maze);
      if (huntPath !== 'STOP') {
        return huntPath;
      }
    }
    
    // Fallback to exploring towards enemy area
    let avgX = 0, avgY = 0;
    for (let enemy of enemies) {
      avgX += enemy.x;
      avgY += enemy.y;
    }
    avgX /= enemies.length;
    avgY /= enemies.length;
    
    return this.findPathToTarget(self, { x: avgX, y: avgY }, maze);
  }
  
  hasLineOfSight(self, target, maze) {
    // Check if there's a relatively clear path (not perfect, but good enough)
    const dx = target.x - self.x;
    const dy = target.y - self.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    
    if (steps === 0) return true;
    
    const stepX = dx / steps;
    const stepY = dy / steps;
    
    let wallCount = 0;
    for (let i = 1; i < steps; i++) {
      const checkX = Math.floor(self.x + stepX * i);
      const checkY = Math.floor(self.y + stepY * i);
      
      if (checkX >= 0 && checkX < maze[0].length && 
          checkY >= 0 && checkY < maze.length &&
          maze[checkY][checkX] === 1) {
        wallCount++;
        if (wallCount > 2) return false; // Too many walls in the way
      }
    }
    
    return true;
  }
  
  isInChokePoint(pos, maze) {
    // Check if position is in a narrow area (corridor)
    const x = Math.floor(pos.x);
    const y = Math.floor(pos.y);
    
    // Count open neighbors
    let openCount = 0;
    const neighbors = [
      {dx: 0, dy: -1}, {dx: 1, dy: 0},
      {dx: 0, dy: 1}, {dx: -1, dy: 0}
    ];
    
    for (let n of neighbors) {
      const nx = x + n.dx;
      const ny = y + n.dy;
      
      if (nx >= 0 && nx < maze[0].length && 
          ny >= 0 && ny < maze.length &&
          maze[ny][nx] === 0) {
        openCount++;
      }
    }
    
    // Position is in choke point if 2 or fewer open neighbors
    return openCount <= 2;
  }
  
  findHuntingPath(self, target, maze) {
    // Try to find a path that cuts off the target or anticipates movement
    const dx = target.x - self.x;
    const dy = target.y - self.y;
    
    // Try to intercept
    const interceptPoints = [
      { x: target.x + 2, y: target.y },
      { x: target.x - 2, y: target.y },
      { x: target.x, y: target.y + 2 },
      { x: target.x, y: target.y - 2 }
    ];
    
    // Try each intercept point
    for (let point of interceptPoints) {
      if (point.x >= 0 && point.x < maze[0].length && 
          point.y >= 0 && point.y < maze.length &&
          maze[point.y][point.x] === 0) {
        
        const moveDir = this.findPathToTarget(self, point, maze);
        if (moveDir !== 'STOP') {
          return moveDir;
        }
      }
    }
    
    // Direct approach if interception fails
    return this.findPathToTarget(self, target, maze);
  }
  
  getReverseDirection(direction) {
    switch (direction) {
      case 'UP': return 'DOWN';
      case 'DOWN': return 'UP';
      case 'LEFT': return 'RIGHT';
      case 'RIGHT': return 'LEFT';
      default: return 'STOP';
    }
  }
  
  getDirectionTowards(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'RIGHT' : 'LEFT';
    } else {
      return dy > 0 ? 'DOWN' : 'UP';
    }
  }
  
  getDirectionAway(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'LEFT' : 'RIGHT';
    } else {
      return dy > 0 ? 'UP' : 'DOWN';
    }
  }
  
  directionToVector(direction) {
    switch (direction) {
      case 'UP': return { x: 0, y: -1 };
      case 'DOWN': return { x: 0, y: 1 };
      case 'LEFT': return { x: -1, y: 0 };
      case 'RIGHT': return { x: 1, y: 0 };
      default: return { x: 0, y: 0 };
    }
  }
  
  canMove(x, y, direction, maze) {
    const newX = x + direction.x;
    const newY = y + direction.y;
    
    // Check bounds
    if (newX < 0 || newX >= maze[0].length || newY < 0 || newY >= maze.length) {
      return false;
    }
    
    // Check wall
    return maze[newY][newX] === 0;
  }
  
  canShootInDirection(self, direction, maze, maxDist = 8) {
    const vec = this.directionToVector(direction);
    
    // Check each cell in the shooting direction
    for (let i = 1; i <= maxDist; i++) {
      const checkX = Math.floor(self.x + vec.x * i);
      const checkY = Math.floor(self.y + vec.y * i);
      
      // Check bounds
      if (checkX < 0 || checkX >= maze[0].length || checkY < 0 || checkY >= maze.length) {
        break;
      }
      
      // Check if hit a wall
      if (maze[checkY][checkX] === 1) {
        return false;
      }
    }
    
    return true;
  }
  
  tryToAlign(self, enemy, maze) {
    const dx = enemy.x - self.x;
    const dy = enemy.y - self.y;
    
    // Check if already aligned horizontally or vertically
    if (dx === 0 || dy === 0) {
      return true;
    }
    
    // Check if we can move to align
    // Try horizontal alignment first
    if (this.canMove(self.x, self.y + (dy > 0 ? 1 : -1), { x: 0, y: dy > 0 ? 1 : -1 }, maze)) {
      return true;
    }
    
    // Try vertical alignment
    if (this.canMove(self.x + (dx > 0 ? 1 : -1), self.y, { x: dx > 0 ? 1 : -1, y: 0 }, maze)) {
      return true;
    }
    
    return false;
  }
  
  getBestShootingDirection(self, enemy, maze) {
    const dx = enemy.x - self.x;
    const dy = enemy.y - self.y;
    
    // Check if aligned
    if (dx === 0) {
      // Vertical alignment
      const direction = dy > 0 ? 'DOWN' : 'UP';
      if (this.canShootInDirection(self, direction, maze, 8)) {
        return direction;
      }
    } else if (dy === 0) {
      // Horizontal alignment
      const direction = dx > 0 ? 'RIGHT' : 'LEFT';
      if (this.canShootInDirection(self, direction, maze, 8)) {
        return direction;
      }
    }
    
    // Not aligned, can't shoot accurately
    return 'NONE';
  }
  
  canShoot(self, target, maze) {
    // Check if there's a clear line of sight
    const dx = target.x - self.x;
    const dy = target.y - self.y;
    
    // Only shoot if aligned horizontally or vertically
    if (dx !== 0 && dy !== 0) return false;
    
    // Check each cell between self and target
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
    const stepY = dy === 0 ? 0 : dy / Math.abs(dy);
    
    for (let i = 1; i < steps; i++) {
      const checkX = self.x + stepX * i;
      const checkY = self.y + stepY * i;
      
      if (maze[Math.floor(checkY)][Math.floor(checkX)] === 1) {
        return false; // Wall in the way
      }
    }
    
    return true;
  }
  
  // New predictive aiming methods
  predictEnemyPosition(enemy, self, distance) {
    // Simple prediction - assume enemy continues current movement
    // In a real implementation, you'd track enemy velocity
    const predictionFactor = Math.min(distance * 0.1, 2); // Predict up to 2 cells ahead
    
    // Default to current position if no movement data
    return {
      x: enemy.x,
      y: enemy.y
    };
  }
  
  calculateLeadingShot(self, enemy, maze) {
    const dx = enemy.x - self.x;
    const dy = enemy.y - self.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    
    // For leading shots, we need to be aligned
    if (dx !== 0 && dy !== 0) {
      return { canShoot: false, direction: 'NONE' };
    }
    
    // Calculate where to shoot based on bullet speed
    const bulletSpeed = CONFIG.bullet.speed;
    const timeToTarget = dist / bulletSpeed;
    
    // Lead the target (simplified - in practice you'd track enemy velocity)
    const leadX = enemy.x;
    const leadY = enemy.y;
    
    // Check if we can shoot at the led position
    if (this.canShoot(self, { x: leadX, y: leadY }, maze)) {
      return {
        canShoot: true,
        direction: this.getDirectionTowards(dx, dy)
      };
    }
    
    return { canShoot: false, direction: 'NONE' };
  }
  
  isAligned(self, enemy) {
    const dx = enemy.x - self.x;
    const dy = enemy.y - self.y;
    return dx === 0 || dy === 0;
  }
  
  getAlignmentMove(self, enemy, maze, currentMove) {
    const dx = enemy.x - self.x;
    const dy = enemy.y - self.y;
    
    // If already moving and it's towards alignment, keep it
    if (currentMove !== 'STOP') {
      return currentMove;
    }
    
    // Move to align
    if (Math.abs(dx) > Math.abs(dy)) {
      // Need to align vertically
      if (dy !== 0) {
        return dy > 0 ? 'DOWN' : 'UP';
      }
    } else {
      // Need to align horizontally
      if (dx !== 0) {
        return dx > 0 ? 'RIGHT' : 'LEFT';
      }
    }
    
    return 'STOP';
  }
  
  findCoveredApproach(self, enemy, maze, preferredMove) {
    // Try to find a path that uses walls as cover
    const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const safeMoves = [];
    
    for (let dir of directions) {
      const vec = this.directionToVector(dir);
      const newX = self.x + vec.x;
      const newY = self.y + vec.y;
      
      // Check if move is valid
      if (this.canMove(self.x, self.y, vec, maze)) {
        // Check if this position provides cover from enemy
        const hasCover = this.checkPositionCover(newX, newY, enemy, maze);
        
        if (hasCover || dir === preferredMove) {
          safeMoves.push(dir);
        }
      }
    }
    
    // Prefer moves with cover, but fall back to preferred move
    if (safeMoves.length > 0) {
      return safeMoves[0];
    }
    
    return 'STOP';
  }
  
  checkPositionCover(x, y, enemy, maze) {
    // Check if there's a wall between this position and the enemy
    const dx = enemy.x - x;
    const dy = enemy.y - y;
    
    // Only check if not aligned
    if (dx !== 0 && dy !== 0) {
      // Diagonal positions naturally provide some cover
      return true;
    }
    
    // Check for intervening walls
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const stepX = dx === 0 ? 0 : dx / Math.abs(dx);
    const stepY = dy === 0 ? 0 : dy / Math.abs(dy);
    
    for (let i = 1; i < steps; i++) {
      const checkX = x + stepX * i;
      const checkY = y + stepY * i;
      
      if (maze[Math.floor(checkY)][Math.floor(checkX)] === 1) {
        return true; // Wall provides cover
      }
    }
    
    return false;
  }
  
  makePersonalityBasedCombatDecision(self, enemy, maze, distance) {
  // Base combat decision
  let decision = this.makeCombatDecision(self, enemy, maze);
  
  // Adjust based on personality
  switch (this.behavior) {
    case 'elite':
      decision = this.makeEliteCombatDecision(self, enemy, maze, distance);
      break;
      
    case 'aggressive':
      // Get closer for better shots
      if (distance > this.combatDistance) {
        decision.move = this.findPathToTarget(self, enemy, maze);
      }
      // Shoot more often
      if (self.cooldown === 0 && this.isAligned(self, enemy)) {
        decision.fire = this.getDirectionTowards(enemy.x - self.x, enemy.y - self.y);
      }
      break;
      
    case 'defensive':
      // Maintain optimal distance
      if (distance < this.combatDistance - 1) {
        decision.move = this.getDirectionAway(enemy.x - self.x, enemy.y - self.y);
      } else if (distance > this.combatDistance + 1) {
        decision.move = this.findPathToTarget(self, enemy, maze);
      }
      // Only shoot when safe
      if (decision.fire !== 'NONE' && Math.random() > this.aggressionLevel) {
        decision.fire = 'NONE';
      }
      break;
      
    case 'opportunistic':
      // Look for finishing blows
      if (enemy.hp <= 20) {
        decision.move = this.findPathToTarget(self, enemy, maze);
        if (self.cooldown === 0) {
          decision.fire = this.getDirectionTowards(enemy.x - self.x, enemy.y - self.y);
        }
      }
      break;
      
    case 'passive':
      // Avoid combat, focus on escape
      decision.move = this.getDirectionAway(enemy.x - self.x, enemy.y - self.y);
      decision.fire = 'NONE';
      break;
      
    case 'random':
      // Random behavior
      if (Math.random() < 0.3) {
        decision.move = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'STOP'][Math.floor(Math.random() * 5)];
      }
      if (Math.random() < 0.2 && self.cooldown === 0) {
        decision.fire = ['UP', 'DOWN', 'LEFT', 'RIGHT'][Math.floor(Math.random() * 4)];
      }
      break;
  }
  
  return decision;
}

makeEliteCombatDecision(self, enemy, maze, distance) {
  const decision = { move: 'STOP', fire: 'NONE' };
  
  // Elite tactics - adaptive combat
  const hpRatio = self.hp / self.maxHp;
  const enemyHpRatio = enemy.hp / 100; // Assuming max enemy HP is 100
  
  // Finish Him tactic - Execute low health targets
  if (this.policy.payload?.tactics?.finishHim && enemyHpRatio <= 0.25) {
    // Rush in for the kill
    decision.move = this.findPathToTarget(self, enemy, maze);
    if (self.cooldown === 0 && this.isAligned(self, enemy)) {
      decision.fire = this.getDirectionTowards(enemy.x - self.x, enemy.y - self.y);
      console.log(`Inferno executing Finish Him on ${enemy.teamName}!`);
    }
    return decision;
  }
  
  // Kiting tactic - Maintain optimal range while attacking
  if (this.policy.payload?.tactics?.kiting) {
    if (distance < 3) {
      // Too close, back away while shooting
      decision.move = this.getDirectionAway(enemy.x - self.x, enemy.y - self.y);
    } else if (distance > 5) {
      // Too far, close in
      decision.move = this.findPathToTarget(self, enemy, maze);
    } else {
      // Sweet spot - strafe to maintain angle
      decision.move = this.findStrafePosition(self, enemy, maze);
    }
    
    // Always shoot when aligned and ready
    if (self.cooldown === 0 && this.isAligned(self, enemy)) {
      decision.fire = this.getDirectionTowards(enemy.x - self.x, enemy.y - self.y);
    }
    return decision;
  }
  
  // Ambush tactic - Use cover and surprise
  if (this.policy.payload?.tactics?.ambush && !this.isAligned(self, enemy)) {
    // Move to alignment while using cover
    decision.move = this.findCoveredApproach(self, enemy, maze, 
      this.getDirectionTowards(enemy.x - self.x, enemy.y - self.y));
    
    // Don't shoot until in position
    decision.fire = 'NONE';
    return decision;
  }
  
  // Default elite behavior - calculated aggression
  if (distance > this.combatDistance) {
    decision.move = this.findPathToTarget(self, enemy, maze);
  } else if (distance < 2 && hpRatio < 0.5) {
    // Low health and too close - create space
    decision.move = this.getDirectionAway(enemy.x - self.x, enemy.y - self.y);
  }
  
  // Smart shooting - lead targets and predict movement
  if (self.cooldown === 0) {
    if (this.isAligned(self, enemy)) {
      decision.fire = this.getDirectionTowards(enemy.x - self.x, enemy.y - self.y);
    } else {
      // Try to align quickly
      decision.move = this.getAlignmentMove(self, enemy, maze, decision.move);
    }
  }
  
  return decision;
}

findStrafePosition(self, enemy, maze) {
  // Find a position to maintain distance while getting better angles
  const dx = self.x - enemy.x;
  const dy = self.y - enemy.y;
  
  // Calculate perpendicular directions for strafing
  const strafeTargets = [
    { x: self.x + dy * 0.5, y: self.y - dx * 0.5 },
    { x: self.x - dy * 0.5, y: self.y + dx * 0.5 }
  ];
  
  // Try each strafe direction
  for (let target of strafeTargets) {
    const moveDir = this.findPathToTarget(self, target, maze);
    if (moveDir !== 'STOP') {
      return moveDir;
    }
  }
  
  // Fallback to circling
  return this.getCircleDirection(self, enemy);
}

getCircleDirection(self, enemy) {
  // Circle around enemy clockwise or counter-clockwise
  const dx = enemy.x - self.x;
  const dy = enemy.y - self.y;
  
  // Choose circle direction based on current position
  if (Math.abs(dx) > Math.abs(dy)) {
    return dy > 0 ? 'RIGHT' : 'LEFT';
  } else {
    return dx > 0 ? 'DOWN' : 'UP';
  }
}

makePersonalityBasedExploration(self, enemies, coins, nearestCoin, minCoinDist, maze) {
  switch (this.explorationStyle) {
    case 'tactical':
      // Elite tactical exploration
      return this.exploreTactically(self, enemies, coins, nearestCoin, minCoinDist, maze);
      
    case 'hunt':
      // Aggressively hunt enemies
      return this.huntEnemies(self, enemies, maze);
      
    case 'safe':
      // Stick to safe areas, avoid unknown
      if (nearestCoin && minCoinDist <= 4) {
        return this.findPathToTarget(self, { x: nearestCoin.x, y: nearestCoin.y }, maze);
      }
      return this.exploreSafely(self, maze);
      
    case 'greedy':
      // Prioritize coins above all
      if (coins.length > 0) {
        // Find highest value coin
        let bestCoin = coins[0];
        let bestValue = 0;
        
        for (let coin of coins) {
          const dist = Math.abs(coin.x - self.x) + Math.abs(coin.y - self.y);
          const value = coin.value / (dist + 1) * this.coinPriority;
          if (value > bestValue) {
            bestValue = value;
            bestCoin = coin;
          }
        }
        
        return this.findPathToTarget(self, { x: bestCoin.x, y: bestCoin.y }, maze);
      }
      return this.explore(self, maze);
      
    case 'avoid':
      // Passive - avoid everything
      return this.exploreSafely(self, maze);
      
    case 'random':
      // Random exploration
      const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      const validDirs = directions.filter(dir => 
        this.canMove(self.x, self.y, this.directionToVector(dir), maze)
      );
      return validDirs.length > 0 ? 
        validDirs[Math.floor(Math.random() * validDirs.length)] : 'STOP';
      
    case 'systematic':
    default:
      // Balanced exploration
      if (nearestCoin && minCoinDist <= 6 * this.coinPriority) {
        return this.findPathToTarget(self, { x: nearestCoin.x, y: nearestCoin.y }, maze);
      } else {
        return this.huntEnemies(self, enemies, maze);
      }
  }
}

exploreTactically(self, enemies, coins, nearestCoin, minCoinDist, maze) {
  // Elite tactical exploration - zone control and map dominance
  const hpRatio = self.hp / self.maxHp;
  
  // Zone control tactic - Control key areas of the map
  if (this.policy.payload?.tactics?.zoneControl) {
    // Find and control choke points and intersections
    const strategicPoint = this.findStrategicPosition(self, maze);
    if (strategicPoint) {
      const distToPoint = Math.abs(strategicPoint.x - self.x) + Math.abs(strategicPoint.y - self.y);
      if (distToPoint > 2) {
        return this.findPathToTarget(self, strategicPoint, maze);
      }
    }
  }
  
  // Smart coin collection - only when safe or advantageous
  if (nearestCoin && minCoinDist <= 5) {
    // Check if coin collection is safe
    const enemiesNearby = enemies.some(e => {
      const dist = Math.abs(e.x - nearestCoin.x) + Math.abs(e.y - nearestCoin.y);
      return dist <= 6;
    });
    
    if (!enemiesNearby || hpRatio > 0.7) {
      return this.findPathToTarget(self, { x: nearestCoin.x, y: nearestCoin.y }, maze);
    }
  }
  
  // Hunt enemies intelligently - predict movement patterns
  if (enemies.length > 0) {
    // Look for enemies in predictable patterns
    const target = this.findVulnerableTarget(enemies, maze);
    if (target) {
      return this.huntEnemies(self, [target], maze);
    }
  }
  
  // Systematic exploration with purpose
  return this.exploreWithPurpose(self, maze);
}

findStrategicPosition(self, maze) {
  // Find choke points, intersections, or high-value positions
  const centerX = Math.floor(maze[0].length / 2);
  const centerY = Math.floor(maze.length / 2);
  
  // Check multiple strategic positions
  const positions = [
    { x: centerX, y: centerY }, // Center control
    { x: 5, y: 5 }, // Corner control
    { x: maze[0].length - 5, y: 5 },
    { x: 5, y: maze.length - 5 },
    { x: maze[0].length - 5, y: maze.length - 5 }
  ];
  
  // Find the best strategic position
  let bestPos = null;
  let bestScore = -1;
  
  for (let pos of positions) {
    if (maze[pos.y] && maze[pos.y][pos.x] === 0) {
      const dist = Math.abs(pos.x - self.x) + Math.abs(pos.y - self.y);
      const openNeighbors = this.countOpenNeighbors(pos.x, pos.y, maze);
      
      // Score based on centrality and openness
      const score = openNeighbors * 10 - dist;
      
      if (score > bestScore) {
        bestScore = score;
        bestPos = pos;
      }
    }
  }
  
  return bestPos;
}

findVulnerableTarget(enemies, maze) {
  // Find the most vulnerable enemy (low HP, in bad position, etc.)
  let bestTarget = null;
  let bestVulnerability = -1;
  
  for (let enemy of enemies) {
    let vulnerability = 0;
    
    // Low HP is very vulnerable
    if (enemy.hp <= 30) vulnerability += 50;
    else if (enemy.hp <= 60) vulnerability += 20;
    
    // Enemies in choke points are vulnerable
    if (this.isInChokePoint(enemy, maze)) vulnerability += 30;
    
    // Enemies far from help are vulnerable
    let helpDistance = Infinity;
    for (let other of enemies) {
      if (other !== enemy) {
        const dist = Math.abs(other.x - enemy.x) + Math.abs(other.y - enemy.y);
        helpDistance = Math.min(helpDistance, dist);
      }
    }
    if (helpDistance > 8) vulnerability += 20;
    
    if (vulnerability > bestVulnerability) {
      bestVulnerability = vulnerability;
      bestTarget = enemy;
    }
  }
  
  return bestTarget;
}

exploreWithPurpose(self, maze) {
  // Systematic exploration that avoids recently visited areas
  if (!this.explorationQuadrants) {
    // Divide map into quadrants and explore systematically
    this.explorationQuadrants = [
      { x: 0, y: 0, explored: false },
      { x: Math.floor(maze[0].length / 2), y: 0, explored: false },
      { x: 0, y: Math.floor(maze.length / 2), explored: false },
      { x: Math.floor(maze[0].length / 2), y: Math.floor(maze.length / 2), explored: false }
    ];
  }
  
  // Find next unexplored quadrant
  let targetQuadrant = null;
  let minDist = Infinity;
  
  for (let quad of this.explorationQuadrants) {
    if (!quad.explored) {
      const dist = Math.abs(quad.x - self.x) + Math.abs(quad.y - self.y);
      if (dist < minDist) {
        minDist = dist;
        targetQuadrant = quad;
      }
    }
  }
  
  if (targetQuadrant) {
    // Move to quadrant center
    const quadCenterX = targetQuadrant.x + Math.floor(maze[0].length / 4);
    const quadCenterY = targetQuadrant.y + Math.floor(maze.length / 4);
    
    // Check if we've explored this quadrant enough
    const distToCenter = Math.abs(quadCenterX - self.x) + Math.abs(quadCenterY - self.y);
    if (distToCenter < 3) {
      targetQuadrant.explored = true;
    }
    
    return this.findPathToTarget(self, { x: quadCenterX, y: quadCenterY }, maze);
  }
  
  // All quadrants explored, reset
  this.explorationQuadrants.forEach(q => q.explored = false);
  return this.explore(self, maze);
}

findSafeRetreatPath(self, enemies, maze) {
  // Find the safest direction to retreat
  const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
  let safestDir = 'STOP';
  let bestSafetyScore = -1;
  
  for (let dir of directions) {
    const vec = this.directionToVector(dir);
    if (this.canMove(self.x, self.y, vec, maze)) {
      let safetyScore = 0;
      
      // Check distance from enemies
      for (let enemy of enemies) {
        const futureX = self.x + vec.x * 3;
        const futureY = self.y + vec.y * 3;
        const dist = Math.abs(enemy.x - futureX) + Math.abs(enemy.y - futureY);
        safetyScore += dist;
      }
      
      // Prefer directions with walls for cover
      const coverScore = this.checkPositionCover(self.x + vec.x, self.y + vec.y, {x: 0, y: 0}, maze) ? 5 : 0;
      safetyScore += coverScore;
      
      if (safetyScore > bestSafetyScore) {
        bestSafetyScore = safetyScore;
        safestDir = dir;
      }
    }
  }
  
  return safestDir;
}

exploreSafely(self, maze) {
  // Conservative exploration - prefer known safe areas
  const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
  const validDirections = [];
  
  for (let dir of directions) {
    const vec = this.directionToVector(dir);
    if (this.canMove(self.x, self.y, vec, maze)) {
      const newX = Math.floor(self.x + vec.x);
      const newY = Math.floor(self.y + vec.y);
      const key = `${newX},${newY}`;
      
      // Prefer visited positions
      if (this.visitedPositions && this.visitedPositions.has(key)) {
        validDirections.unshift(dir); // Add to beginning
      } else {
        validDirections.push(dir); // Add to end
      }
    }
  }
  
  return validDirections.length > 0 ? validDirections[0] : 'STOP';
}

chooseUpgrade(self, nearestEnemy, enemyDist) {
  // Personality-based upgrade choices
  const hpRatio = self.hp / self.maxHp;
  const hasEnemyNearby = nearestEnemy && enemyDist <= 6;
  
  switch (this.behavior) {
    case 'aggressive':
      // Always prioritize attack
      if (self.atk < 25) return 'ATTACK';
      if (self.speed < 1.5) return 'SPEED';
      return 'HEALTH';
      
    case 'defensive':
      // Prioritize survival
      if (hpRatio < 0.7) return 'HEALTH';
      if (self.def < 15) return 'DEFENSE';
      return 'SPEED';
      
    case 'opportunistic':
      // Balanced but opportunistic
      if (hpRatio < 0.5) return 'HEALTH';
      if (self.coins >= 20 && self.atk < 20) return 'ATTACK';
      return 'SPEED';
      
    default:
      // Balanced upgrade strategy
      if (hpRatio <= 0.3) return 'HEALTH';
      if (hasEnemyNearby) {
        if (self.atk < 15) return 'ATTACK';
        if (self.def < 5) return 'DEFENSE';
      }
      if (self.speed < 1.2) return 'SPEED';
      return 'HEALTH';
  }
}
}