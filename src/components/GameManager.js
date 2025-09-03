import { WideMazeGenerator } from '../utils/WideMazeGenerator.js';

// Game configuration
export const CONFIG = {
  maze: {
    width: 50,
    height: 30,
    cellSize: 20,
    seed: 'llm-tank-world'
  },
  tank: {
    hp: 100,
    speed: 1.0, // grid cells per second
    atk: 10,
    def: 0,
    rof: 2, // shots per second (increased from 1)
    sight: 8
  },
  bullet: {
    speed: 4.0,
    damage: 10
  },
  game: {
    tickRate: 20, // Hz
    aiTickRate: 5, // Hz
    duration: 180 // seconds
  }
};

export class GameManager {
  constructor(scene) {
    this.scene = scene;
    this.events = [];
    this.tick = 0;
    this.gameTime = 0;
    this.isRunning = false;
    this.eventListeners = {};
  }
  
  generateMaze() {
    const generator = new WideMazeGenerator(
      CONFIG.maze.width,
      CONFIG.maze.height,
      CONFIG.maze.seed
    );
    this.scene.maze = generator.generate();
    this.scene.walkablePositions = generator.getWalkablePositions();
    
    // Update seed display
    document.getElementById('seed-info').textContent = `Seed: ${CONFIG.maze.seed}`;
  }
  
  updateMazeSeed(newSeed) {
    console.log('Updating maze seed to:', newSeed);
    CONFIG.maze.seed = newSeed;
    this.generateMaze();
    
    // Recreate maze walls
    this.scene.createMazeWalls();
    console.log('Maze updated with new seed:', newSeed);
  }
  
  getRandomWalkablePosition() {
    if (this.scene.walkablePositions.length === 0) return null;
    return this.scene.walkablePositions[Math.floor(Math.random() * this.scene.walkablePositions.length)];
  }
  
  start() {
    console.log('GameManager.start() called');
    this.isRunning = true;
    this.tick = 0;
    this.gameTime = 0;
    this.events = [];
    
    // Emit game start event
    this.emit('gameStart');
    
    // Spawn initial coins
    console.log('Spawning initial coins...');
    for (let i = 0; i < Math.floor(CONFIG.maze.width * CONFIG.maze.height * 0.05); i++) {
      this.scene.spawnCoin();
    }
    
    console.log('Game started! isRunning:', this.isRunning);
    
    // Enable driver tick now that game is running
    if (this.scene.driverTickEvent) {
      this.scene.driverTickEvent.paused = false;
      console.log('Driver tick enabled');
    }
    
    // Don't hide UI elements during development
    // document.getElementById('team-panel').classList.add('hidden');
    // document.getElementById('start-button').classList.add('hidden');
  }
  
  end() {
    this.isRunning = false;
    
    // Emit game end event
    this.emit('gameEnd');
    
    // Disable driver tick when game ends
    if (this.scene.driverTickEvent) {
      this.scene.driverTickEvent.paused = true;
      console.log('Driver tick disabled');
    }
    
    // Calculate scores
    const scores = Array.from(this.scene.tanks.values()).map(tank => ({
      teamName: tank.teamName,
      displayName: tank.displayName,
      score: tank.kills * 100 + tank.damage * 1 + tank.coins * 10 + tank.survivalTime * 0.1,
      kills: tank.kills,
      damage: tank.damage,
      coins: tank.coins,
      survivalTime: tank.survivalTime
    })).sort((a, b) => b.score - a.score);
    
    // Show results
    this.scene.showResults(scores);
    
    // Export replay
    this.scene.exportReplay();
  }
  
  gameTick() {
    if (!this.isRunning) return;
    
    this.tick++;
    this.gameTime += 1 / CONFIG.game.tickRate;
    
    // Update survival time and birth protection for all alive tanks
    for (let tank of this.scene.tanks.values()) {
      if (!tank.isDead) {
        tank.survivalTime = this.gameTime - tank.spawnTime;
        
        // Update birth protection
        if (tank.hasBirthProtection) {
          tank.birthProtectionTime -= 1 / CONFIG.game.tickRate;
          if (tank.birthProtectionTime <= 0) {
            tank.hasBirthProtection = false;
          }
        }
      }
    }
    
    // Update timer
    const minutes = Math.floor(this.gameTime / 60);
    const seconds = Math.floor(this.gameTime % 60);
    this.scene.timerText.setText(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    // Update tank stats
    this.scene.updateTankStats();
    
    // Check game end conditions
    if (this.gameTime >= CONFIG.game.duration) {
      this.end();
      return;
    }
    
    const aliveTanks = Array.from(this.scene.tanks.values()).filter(t => !t.isDead);
    if (aliveTanks.length <= 1) {
      this.end();
      return;
    }
    
    // Update bullets
    this.scene.updateBullets();
    
    // Spawn coins
    if (this.tick % (5 * CONFIG.game.tickRate) === 0) {
      this.scene.spawnCoin();
    }
  }
  
  recordEvent(event) {
    this.events.push({
      tick: this.tick,
      ...event
    });
    
    // Emit event to listeners
    this.emit('recordEvent', event);
  }
  
  // Event system methods
  on(eventName, callback) {
    if (!this.eventListeners[eventName]) {
      this.eventListeners[eventName] = [];
    }
    this.eventListeners[eventName].push(callback);
  }
  
  emit(eventName, data) {
    if (this.eventListeners[eventName]) {
      this.eventListeners[eventName].forEach(callback => {
        callback(data);
      });
    }
  }
}