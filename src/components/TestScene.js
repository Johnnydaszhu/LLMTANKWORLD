import Phaser from 'phaser';
import { createTestTank } from '../utils/TestUtils.js';

export class TestScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TestScene' });
    this.tanks = [];
  }
  
  create() {
    console.log('TestScene created');
    
    // Create test tanks
    const tank1 = createTestTank(this, 200, 200, '#ff4444', 'Red Tank');
    const tank2 = createTestTank(this, 400, 200, '#4444ff', 'Blue Tank');
    
    this.tanks.push(tank1, tank2);
    
    // Simple movement
    this.time.addEvent({
      delay: 100,
      callback: this.updateTanks,
      loop: true
    });
    
    console.log('Test tanks created');
  }
  
  updateTanks() {
    // Move tanks randomly
    this.tanks.forEach((tank, index) => {
      const speed = 2;
      const direction = Math.sin(Date.now() * 0.001 + index) * speed;
      tank.x += direction;
      tank.y += Math.cos(Date.now() * 0.001 + index) * speed * 0.5;
      
      // Keep tanks on screen
      tank.x = Phaser.Math.Clamp(tank.x, 50, 750);
      tank.y = Phaser.Math.Clamp(tank.y, 50, 550);
    });
  }
}