// import Matter from 'matter-js';
import { CONFIG } from './GameManager.js';

export class BulletManager {
  constructor(scene) {
    this.scene = scene;
  }
  
  fireBullet(tankId, direction) {
    const tank = this.scene.tanks.get(tankId);
    
    const bulletSpeed = CONFIG.bullet.speed * CONFIG.maze.cellSize / CONFIG.game.tickRate;
    let velocity = { x: 0, y: 0 };
    
    switch (direction) {
      case 'UP': velocity = { x: 0, y: -bulletSpeed }; break;
      case 'DOWN': velocity = { x: 0, y: bulletSpeed }; break;
      case 'LEFT': velocity = { x: -bulletSpeed, y: 0 }; break;
      case 'RIGHT': velocity = { x: bulletSpeed, y: 0 }; break;
    }
    
    const bulletId = `bullet_${Date.now()}_${Math.random()}`;
    
    // Calculate bullet size based on tank's attack power
    const baseSize = 4;
    const sizeMultiplier = Math.min(tank.atk / CONFIG.tank.atk, 3); // Cap at 3x size
    const bulletSize = baseSize * sizeMultiplier;
    
    // Create bullet data
    const bullet = {
      id: bulletId,
      x: tank.x,
      y: tank.y,
      vx: velocity.x,
      vy: velocity.y,
      ownerId: tankId,
      direction: direction,
      damage: CONFIG.bullet.damage * tank.atk,
      size: bulletSize
    };
    
    this.scene.bullets.add(bullet);
    
    // Create visual with size based on attack power
    const visual = this.scene.add.circle(tank.x, tank.y, bulletSize, 0xffff00);
    bullet.visual = visual;
    
    this.scene.gameManager.recordEvent({
      actorId: tankId,
      eventType: 'fire',
      bulletId: bulletId,
      direction: direction
    });
  }
  
  updateBullets() {
    // Update bullet positions
    for (let bullet of this.scene.bullets) {
      // Store old position
      const oldX = bullet.x;
      const oldY = bullet.y;
      
      // Update position
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      
      // Check wall collision
      const gridX = Math.floor(bullet.x / CONFIG.maze.cellSize);
      const gridY = Math.floor(bullet.y / CONFIG.maze.cellSize);
      
      // Check if bullet hit a wall
      if (gridX >= 0 && gridX < CONFIG.maze.width && 
          gridY >= 0 && gridY < CONFIG.maze.height &&
          this.scene.maze[gridY][gridX] === 1) {
        // Bullet hit wall, remove it
        this.scene.removeBullet(bullet);
        continue;
      }
      
      // Update visual
      if (bullet.visual) {
        bullet.visual.x = bullet.x;
        bullet.visual.y = bullet.y;
      }
      
      // Remove bullets that are out of bounds
      if (bullet.x < 0 || bullet.x > CONFIG.maze.width * CONFIG.maze.cellSize ||
          bullet.y < 0 || bullet.y > CONFIG.maze.height * CONFIG.maze.cellSize) {
        this.scene.removeBullet(bullet);
      }
    }
  }
  
  updateBulletVisuals() {
    // Visuals are updated in updateBullets
  }
  
  removeBullet(bullet) {
    const bulletId = bullet.id;
    this.scene.bullets.delete(bullet);
    
    // Remove visual
    if (bullet.visual) bullet.visual.destroy();
  }
}