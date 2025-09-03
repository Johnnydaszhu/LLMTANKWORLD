// import Matter from 'matter-js';
import { CONFIG } from './GameManager.js';

export class CoinManager {
  constructor(scene) {
    this.scene = scene;
  }
  
  spawnCoin() {
    if (this.scene.coins.size >= 50) return;
    
    const pos = this.scene.gameManager.getRandomWalkablePosition();
    if (!pos) return;
    
    const coinId = `coin_${Date.now()}_${Math.random()}`;
    
    // Calculate pixel position
    const x = pos.x * CONFIG.maze.cellSize + CONFIG.maze.cellSize / 2;
    const y = pos.y * CONFIG.maze.cellSize + CONFIG.maze.cellSize / 2;
    
    // Random coin type: 70% normal, 20% speed, 10% bullet
    const rand = Math.random();
    let coinType, color, symbol, size;
    
    if (rand < 0.7) {
      // Normal coin
      coinType = 'normal';
      color = 0xffd700; // Gold
      symbol = '$';
      size = 8;
    } else if (rand < 0.9) {
      // Speed coin (yellow)
      coinType = 'speed';
      color = 0xffff00; // Bright yellow
      symbol = '⚡';
      size = 10;
    } else {
      // Bullet coin (red)
      coinType = 'bullet';
      color = 0xff4444; // Red
      symbol = '◉';
      size = 10;
    }
    
    // Create coin data
    const coin = {
      id: coinId,
      x: x,
      y: y,
      type: coinType
    };
    
    this.scene.coins.add(coin);
    
    // Create visual
    const visual = this.scene.add.circle(x, y, size, color);
    
    // Add coin symbol
    const coinText = this.scene.add.text(x, y, symbol, {
      fontSize: '12px',
      fill: '#ffffff'
    });
    coinText.setOrigin(0.5);
    
    // Store references
    coin.visual = visual;
    coin.text = coinText;
  }
  
  updateCoinVisuals() {
    // Coins don't move, so no update needed
    // But we could add animations here later
  }
  
  removeCoin(coin) {
    const coinId = coin.id;
    this.scene.coins.delete(coin);
    
    // Remove visual
    if (coin.visual) coin.visual.destroy();
    if (coin.text) coin.text.destroy();
  }
}