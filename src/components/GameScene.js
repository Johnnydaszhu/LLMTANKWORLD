import Phaser from 'phaser';
import { GameManager, CONFIG } from './GameManager.js';
import { TankManager } from './TankManager.js';
import { BulletManager } from './BulletManager.js';
import { CoinManager } from './CoinManager.js';
import { UIManager } from './UIManager.js';
import { ReplayManager } from './ReplayManager.js';
import { CommentarySystem } from './CommentarySystem.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    
    // Game state
    this.tanks = new Map();
    this.bullets = new Set();
    this.coins = new Set();
    this.drivers = new Map();
    
    // Physics engine (removed Matter.js)
    this.engine = null;
    this.world = null;
    
    // Managers
    this.gameManager = null;
    this.tankManager = null;
    this.bulletManager = null;
    this.coinManager = null;
    this.uiManager = null;
    this.replayManager = null;
    this.commentarySystem = null;
  }
  
  preload() {
    // Load assets
    this.load.image('tank', '/assets/tank.svg');
    this.load.image('bullet', '/assets/bullet.svg');
    this.load.image('coin', '/assets/coin.svg');
    this.load.image('wall', '/assets/wall.svg');
  }
  
  create() {
    // Initialize managers
    this.gameManager = new GameManager(this);
    this.tankManager = new TankManager(this);
    this.bulletManager = new BulletManager(this);
    this.coinManager = new CoinManager(this);
    this.uiManager = new UIManager(this);
    this.replayManager = new ReplayManager(this);
    this.commentarySystem = new CommentarySystem(this);
    
    // Generate maze
    this.gameManager.generateMaze();
    
    // Debug: log maze info
    console.log('Maze generated:', this.maze ? 'Yes' : 'No');
    console.log('Maze dimensions:', this.maze ? `${this.maze.length} x ${this.maze[0]?.length}` : 'None');
    console.log('Maze data sample:', this.maze ? this.maze[0]?.slice(0, 10) : 'None');
    
    // Center camera on maze
    const mazeWidth = CONFIG.maze.width * CONFIG.maze.cellSize;
    const mazeHeight = CONFIG.maze.height * CONFIG.maze.cellSize;
    
    // Camera control variables
    this.cameraTarget = null; // Tank to follow
    this.baseZoom = 1;
    this.currentZoom = 1;
    this.minZoom = 0.3;
    this.maxZoom = 2;
    
    // Drag variables
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.cameraStartX = 0;
    this.cameraStartY = 0;
    
    // Minimap
    this.minimapCanvas = null;
    this.minimapCtx = null;
    
    // Set camera bounds to allow dragging beyond the maze
    const boundsPadding = Math.max(mazeWidth, mazeHeight);
    this.cameras.main.setBounds(-boundsPadding, -boundsPadding, 
                               mazeWidth + boundsPadding * 2, 
                               mazeHeight + boundsPadding * 2);
    
    // Center camera on maze initially
    this.cameras.main.centerOn(
      mazeWidth / 2,
      mazeHeight / 2
    );
    
    // Set initial zoom
    const padding = 100;
    const zoomX = (this.cameras.main.width - padding * 2) / mazeWidth;
    const zoomY = (this.cameras.main.height - padding * 2) / mazeHeight;
    this.baseZoom = Math.min(zoomX, zoomY, 1);
    // Ensure minimum zoom is not too small
    this.baseZoom = Math.max(this.baseZoom, 0.5);
    this.currentZoom = this.baseZoom;
    this.cameras.main.setZoom(this.currentZoom);
    console.log('Initial zoom set to:', this.currentZoom);
    
    // Make sure background is visible
    this.cameras.main.setBackgroundColor('#2a2a2a');
    
    // Debug: log camera info
    console.log('Camera info:', {
      width: this.cameras.main.width,
      height: this.cameras.main.height,
      mazeWidth,
      mazeHeight,
      zoom: this.currentZoom,
      bounds: this.cameras.main.bounds
    });
    
    // Create maze walls
    this.createMazeWalls();
    
    // Force a camera update
    this.cameras.main.update();
    
    // Ensure camera is centered on maze
    this.resetCamera();
    
    // Setup collision detection
    this.setupCollisions();
    
    // Initialize UI
    this.uiManager.setupUI();
    
    // Setup camera controls
    this.setupCameraControls();
    
    // Initialize minimap
    this.initMinimap();
    
    // Start game loop
    this.setupGameLoop();
  }
  
  createMazeWalls() {
    console.log('Creating maze walls...');
    
    // Clear existing maze graphics
    if (this.mazeGroup) {
      this.mazeGroup.clear(true);
      this.mazeGroup.destroy();
    }
    
    this.mazeGroup = this.add.group();
    
    // Create a single graphics object for all walls
    const wallGraphics = this.add.graphics();
    wallGraphics.fillStyle(0x444444);
    
    // Batch all wall rectangles for better performance
    const walls = [];
    let wallCount = 0;
    
    for (let y = 0; y < CONFIG.maze.height; y++) {
      for (let x = 0; x < CONFIG.maze.width; x++) {
        if (this.maze && this.maze[y] && this.maze[y][x] === 1) {
          const wallX = x * CONFIG.maze.cellSize;
          const wallY = y * CONFIG.maze.cellSize;
          
          // Add to graphics batch
          wallGraphics.fillRect(wallX, wallY, CONFIG.maze.cellSize, CONFIG.maze.cellSize);
          wallCount++;
        }
      }
    }
    
    console.log(`Drew ${wallCount} walls`);
    console.log('Wall graphics position:', wallGraphics.x, wallGraphics.y);
    
    // Add graphics to maze group
    this.mazeGroup.add(wallGraphics);
    
    // Ensure walls are visible
    wallGraphics.setDepth(1);
  }
  
  setupCollisions() {
    // Collisions are now handled in the update loop
  }
  
  setupCameraControls() {
    // Keyboard controls
    this.cursors = this.input.keyboard.createCursorKeys();
    
    // Zoom controls
    this.input.keyboard.on('keydown-PLUS', () => {
      this.adjustZoom(0.1);
    });
    
    this.input.keyboard.on('keydown-MINUS', () => {
      this.adjustZoom(-0.1);
    });
    
    // Reset camera
    this.input.keyboard.on('keydown-SPACE', () => {
      this.resetCamera();
    });
    
    // Number keys to follow specific tanks
    this.input.keyboard.on('keydown-ONE', () => {
      this.followTankByIndex(0);
    });
    
    this.input.keyboard.on('keydown-TWO', () => {
      this.followTankByIndex(1);
    });
    
    this.input.keyboard.on('keydown-THREE', () => {
      this.followTankByIndex(2);
    });
    
    this.input.keyboard.on('keydown-FOUR', () => {
      this.followTankByIndex(3);
    });
    
    // Mouse wheel zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const zoomDelta = deltaY > 0 ? -0.05 : 0.05;
      this.adjustZoom(zoomDelta);
    });
    
    // Mouse drag controls
    this.input.on('pointerdown', (pointer) => {
      if (!this.cameraTarget) {
        // Start dragging
        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.cameraStartX = this.cameras.main.scrollX;
        this.cameraStartY = this.cameras.main.scrollY;
        
        // Change cursor to indicate dragging
        this.input.manager.canvas.style.cursor = 'grabbing';
      }
    });
    
    this.input.on('pointermove', (pointer) => {
      if (this.isDragging && !this.cameraTarget) {
        // Calculate drag delta
        const deltaX = pointer.x - this.dragStartX;
        const deltaY = pointer.y - this.dragStartY;
        
        // Update camera position
        this.cameras.main.setScroll(
          this.cameraStartX - deltaX,
          this.cameraStartY - deltaY
        );
      }
    });
    
    this.input.on('pointerup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        // Reset cursor
        this.input.manager.canvas.style.cursor = 'default';
      }
    });
    
    // Prevent context menu on right click
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonReleased()) {
        return false;
      }
    });
    
    console.log('Camera controls setup complete');
    console.log('Controls: +/- (zoom), Space (reset), 1-4 (follow tanks), Drag to move, Click to center');
  }
  
  setupGameLoop() {
    // Game tick
    this.time.addEvent({
      delay: 1000 / CONFIG.game.tickRate,
      callback: this.gameManager.gameTick.bind(this.gameManager),
      loop: true
    });
    
    // Driver decision tick - start disabled
    this.driverTickEvent = this.time.addEvent({
      delay: 1000 / CONFIG.game.aiTickRate,
      callback: this.driverTick.bind(this),
      loop: true,
      paused: true // Start paused
    });
  }
  
  driverTick() {
    // This should only run when game is running, but double-check
    if (!this.gameManager.isRunning) return;
    
    // Debug: log tank processing occasionally
    if (this.gameManager.tick % 25 === 0) { // Every 5 seconds at 5Hz
      console.log('driverTick: processing', this.tanks.size, 'tanks');
    }
    
    // Send observations to drivers and get actions
    for (let [tankId, tank] of this.tanks) {
      if (tank.isDead) continue;
      
      const observation = this.tankManager.getObservation(tankId);
      
      // Get action from driver
      let action;
      try {
        action = tank.sandbox.decide(observation);
      } catch (error) {
        console.error(`Driver error for ${tank.teamName}:`, error);
        tank.timeouts++;
        action = { move: 'STOP', fire: 'NONE', upgrade: 'NONE' };
      }
      
      // Apply action
      this.tankManager.applyTankAction(tankId, action);
    }
  }
  
  // Helper methods
  isBullet(body) {
    return body.label === 'bullet';
  }
  
  isTank(body) {
    return body.label === 'tank';
  }
  
  isCoin(body) {
    return body.label === 'coin';
  }
  
  // Public methods delegated to managers
  async addTank(driverInfo) {
    return this.tankManager.addTank(driverInfo);
  }
  
  fireBullet(tankId, direction) {
    this.bulletManager.fireBullet(tankId, direction);
  }
  
  spawnCoin() {
    this.coinManager.spawnCoin();
  }
  
  removeBullet(bulletBody) {
    this.bulletManager.removeBullet(bulletBody);
  }
  
  removeCoin(coinBody) {
    this.coinManager.removeCoin(coinBody);
  }
  
  updateBullets() {
    this.bulletManager.updateBullets();
  }
  
  updateTankStats() {
    this.uiManager.updateTankStats();
  }
  
  showResults(scores) {
    this.uiManager.showResults(scores);
  }
  
  exportReplay() {
    this.replayManager.exportReplay();
  }
  
  startGame() {
    this.gameManager.start();
  }
  
  update() {
    if (this.gameManager.isRunning) {
      // Update bullet positions
      this.bulletManager.updateBullets();
      
      // Update tank positions based on velocity
      for (let [tankId, tank] of this.tanks) {
        if (tank.isDead) continue;
        
        // Update position
        tank.x += tank.vx;
        tank.y += tank.vy;
        
        // Better collision detection - check tank corners
        const tankSize = CONFIG.maze.cellSize * 0.8;
        const corners = [
          { x: tank.x - tankSize/2, y: tank.y - tankSize/2 },
          { x: tank.x + tankSize/2, y: tank.y - tankSize/2 },
          { x: tank.x - tankSize/2, y: tank.y + tankSize/2 },
          { x: tank.x + tankSize/2, y: tank.y + tankSize/2 }
        ];
        
        let collision = false;
        for (let corner of corners) {
          const gridX = Math.floor(corner.x / CONFIG.maze.cellSize);
          const gridY = Math.floor(corner.y / CONFIG.maze.cellSize);
          
          if (gridX < 0 || gridX >= CONFIG.maze.width || 
              gridY < 0 || gridY >= CONFIG.maze.height ||
              this.maze[gridY][gridX] === 1) {
            collision = true;
            break;
          }
        }
        
        if (collision) {
          // Hit a wall, bounce back
          tank.x -= tank.vx;
          tank.y -= tank.vy;
          tank.vx = 0;
          tank.vy = 0;
        }
        
        // Keep tanks in bounds
        tank.x = Phaser.Math.Clamp(tank.x, CONFIG.maze.cellSize, 
                                   CONFIG.maze.width * CONFIG.maze.cellSize - CONFIG.maze.cellSize);
        tank.y = Phaser.Math.Clamp(tank.y, CONFIG.maze.cellSize, 
                                   CONFIG.maze.height * CONFIG.maze.cellSize - CONFIG.maze.cellSize);
        
        // Update birth protection
        if (tank.hasBirthProtection) {
          tank.birthProtectionTime -= 1 / CONFIG.game.tickRate;
          if (tank.birthProtectionTime <= 0) {
            tank.hasBirthProtection = false;
          }
        }
        
        // Update survival time
        tank.survivalTime += 1 / CONFIG.game.tickRate;
      }
      
      // Check tank-coin collisions
      for (let [tankId, tank] of this.tanks) {
        if (tank.isDead) continue;
        
        for (let coin of this.coins) {
          const dx = tank.x - coin.x;
          const dy = tank.y - coin.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < CONFIG.maze.cellSize) {
            this.tankManager.handleCoinPickup(tank, coin);
          }
        }
      }
      
      // Check bullet-tank collisions
      for (let bullet of this.bullets) {
        for (let [tankId, tank] of this.tanks) {
          if (tank.isDead || bullet.ownerId === tankId) continue;
          
          const dx = bullet.x - tank.x;
          const dy = bullet.y - tank.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Use bullet size for collision detection
          const hitDistance = CONFIG.maze.cellSize * 0.4 + (bullet.size || 4);
          
          if (distance < hitDistance) {
            this.tankManager.handleBulletHit(bullet, tank);
            this.removeBullet(bullet);
          }
        }
      }
    }
    
    // Update all visuals
    this.tankManager.updateTankVisuals();
    this.bulletManager.updateBulletVisuals();
    this.coinManager.updateCoinVisuals();
    
    // Update commentary system
    if (this.commentarySystem) {
      this.commentarySystem.update();
    }
    
    // Update camera
    this.updateCamera();
    
    // Update minimap
    this.updateMinimap();
    
    // Debug: count tanks
    if (this.gameManager.isRunning && this.tanks.size > 0) {
      if (this.gameManager.tick % 60 === 0) { // Log every 3 seconds
        console.log('Update: tanks in scene:', this.tanks.size);
      }
    }
  }
  
  // Helper method to follow tank by index
  followTankByIndex(index) {
    const tankIds = Array.from(this.tanks.keys());
    if (index < tankIds.length) {
      const tankId = tankIds[index];
      const tank = this.tanks.get(tankId);
      this.setCameraTarget(tankId);
      console.log(`Following ${tank.name || 'Tank ' + (index + 1)}`);
    } else {
      console.log(`No tank at index ${index}`);
    }
  }
  
  // Camera control methods
  setCameraTarget(tankId) {
    if (tankId && this.tanks.has(tankId)) {
      this.cameraTarget = tankId;
      console.log(`Camera now following tank: ${tankId}`);
    } else {
      this.cameraTarget = null;
      console.log('Camera freed');
    }
  }
  
  adjustZoom(delta) {
    this.currentZoom = Phaser.Math.Clamp(this.currentZoom + delta, this.minZoom, this.maxZoom);
    this.cameras.main.setZoom(this.currentZoom);
    console.log(`Zoom set to: ${this.currentZoom.toFixed(2)}x`);
  }
  
  resetCamera() {
    const mazeWidth = CONFIG.maze.width * CONFIG.maze.cellSize;
    const mazeHeight = CONFIG.maze.height * CONFIG.maze.cellSize;
    
    this.cameraTarget = null;
    this.currentZoom = this.baseZoom;
    this.cameras.main.setZoom(this.currentZoom);
    
    // Center the maze perfectly in the viewport
    this.cameras.main.centerOn(mazeWidth / 2, mazeHeight / 2);
    
    console.log('Camera reset to default view');
    console.log('Maze center:', mazeWidth / 2, mazeHeight / 2);
  }
  
  updateCamera() {
    if (this.cameraTarget && this.tanks.has(this.cameraTarget)) {
      const tank = this.tanks.get(this.cameraTarget);
      if (tank && tank.sprite) {
        // Smooth camera following
        const targetX = tank.sprite.x;
        const targetY = tank.sprite.y;
        
        // Use lerp for smooth following
        const currentX = this.cameras.main.scrollX + this.cameras.main.width / 2;
        const currentY = this.cameras.main.scrollY + this.cameras.main.height / 2;
        
        const lerp = 0.1; // Adjust for smoother/faster following
        const newX = currentX + (targetX - currentX) * lerp;
        const newY = currentY + (targetY - currentY) * lerp;
        
        this.cameras.main.centerOn(newX, newY);
      }
    }
  }
  
  // Minimap methods
  initMinimap() {
    this.minimapCanvas = document.getElementById('minimap');
    if (this.minimapCanvas) {
      this.minimapCtx = this.minimapCanvas.getContext('2d');
      console.log('Minimap initialized');
    }
  }
  
  updateMinimap() {
    if (!this.minimapCtx || !this.maze) return;
    
    const ctx = this.minimapCtx;
    const canvas = this.minimapCanvas;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scale
    const scaleX = canvas.width / (CONFIG.maze.width * CONFIG.maze.cellSize);
    const scaleY = canvas.height / (CONFIG.maze.height * CONFIG.maze.cellSize);
    
    // Draw maze walls
    ctx.fillStyle = '#444';
    for (let y = 0; y < CONFIG.maze.height; y++) {
      for (let x = 0; x < CONFIG.maze.width; x++) {
        if (this.maze[y][x] === 1) {
          ctx.fillRect(
            x * CONFIG.maze.cellSize * scaleX,
            y * CONFIG.maze.cellSize * scaleY,
            CONFIG.maze.cellSize * scaleX,
            CONFIG.maze.cellSize * scaleY
          );
        }
      }
    }
    
    // Draw tanks
    this.tanks.forEach((tank, tankId) => {
      if (!tank.isDead) {
        // Team colors
        const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44'];
        ctx.fillStyle = colors[tank.teamId % colors.length] || '#ffffff';
        
        ctx.beginPath();
        ctx.arc(
          tank.x * scaleX,
          tank.y * scaleY,
          3,
          0,
          Math.PI * 2
        );
        ctx.fill();
        
        // Draw tank direction
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tank.x * scaleX, tank.y * scaleY);
        ctx.lineTo(
          tank.x * scaleX + Math.cos(tank.angle) * 5,
          tank.y * scaleY + Math.sin(tank.angle) * 5
        );
        ctx.stroke();
      }
    });
    
    // Draw camera viewport indicator
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      -this.cameras.main.scrollX * scaleX,
      -this.cameras.main.scrollY * scaleY,
      (this.cameras.main.width / this.currentZoom) * scaleX,
      (this.cameras.main.height / this.currentZoom) * scaleY
    );
  }
}