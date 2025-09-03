// import Matter from 'matter-js';
import { CONFIG } from './GameManager.js';
import { SmartDriver } from '../drivers/SmartDriver.js';
// import { DriverSandbox } from '../drivers/DriverSandbox.js';

export class TankManager {
  constructor(scene) {
    this.scene = scene;
    this.showVision = true;
    
    // Listen for vision toggle
    const visionCheckbox = document.getElementById('show-vision');
    if (visionCheckbox) {
      visionCheckbox.addEventListener('change', (e) => {
        this.showVision = e.target.checked;
        this.updateVisionVisibility();
      });
    }
  }
  
  // Helper function to convert hex color string to number
  hexColorToNumber(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    // Convert to number
    return parseInt(hex, 16);
  }
  
  addTank(driverInfo) {
    const pos = this.scene.gameManager.getRandomWalkablePosition();
    console.log('Random walkable position:', pos);
    if (!pos) {
      console.error('No walkable position found for tank!');
      return null;
    }
    
    const tankId = `tank_${Date.now()}_${Math.random()}`;
    
    // Calculate pixel position
    const x = pos.x * CONFIG.maze.cellSize + CONFIG.maze.cellSize / 2;
    const y = pos.y * CONFIG.maze.cellSize + CONFIG.maze.cellSize / 2;
    
    // Create smart driver
    const sandbox = new SmartDriver({
      type: driverInfo.policyType,
      payload: driverInfo.policyPayload
    });
    
    console.log('Created smart driver for', driverInfo.teamName);
    
    // Create tank data
    const tank = {
      id: tankId,
      teamName: driverInfo.teamName,
      displayName: driverInfo.tankName,
      color: driverInfo.color,
      hp: CONFIG.tank.hp,
      maxHp: CONFIG.tank.hp,
      speed: CONFIG.tank.speed,
      atk: CONFIG.tank.atk,
      def: CONFIG.tank.def,
      fireCooldown: 0,
      direction: 'UP',
      isDead: false,
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      kills: 0,
      damage: 0,
      coins: 0,
      survivalTime: 0,
      timeouts: 0,
      spawnTime: this.scene.gameManager.gameTime,
      hasBirthProtection: true,
      birthProtectionTime: 2,
      sandbox: sandbox
    };
    
    this.scene.tanks.set(tankId, tank);
    this.scene.drivers.set(tankId, sandbox);
    
    console.log('Created tank:', {
      id: tankId,
      teamName: tank.teamName,
      position: { x, y },
      color: driverInfo.color
    });
    
    // Create visual container
    const container = this.scene.add.container(x, y);
    
    // Convert color string to number
    const colorNum = this.hexColorToNumber(driverInfo.color);
    
    // Tank body
    const body = this.scene.add.rectangle(
      0,
      0,
      CONFIG.maze.cellSize * 0.8,
      CONFIG.maze.cellSize * 0.8,
      colorNum
    );
    container.add(body);
    
    // Tank turret
    const turret = this.scene.add.rectangle(
      0,
      -CONFIG.maze.cellSize * 0.3,
      CONFIG.maze.cellSize * 0.3,
      CONFIG.maze.cellSize * 0.6,
      colorNum
    );
    container.add(turret);
    
    // Tank name
    const nameText = this.scene.add.text(
      0,
      -CONFIG.maze.cellSize * 0.8,
      driverInfo.tankName,
      {
        fontSize: '10px',
        fill: '#ffffff'
      }
    );
    nameText.setOrigin(0.5);
    container.add(nameText);
    
    // Store reference to visual
    tank.visual = container;
    
    // Create vision range indicator (semi-transparent circle)
    const visionRadius = CONFIG.tank.sight * CONFIG.maze.cellSize;
    const visionGraphics = this.scene.add.graphics();
    
    // Use tank color for vision indicator
    visionGraphics.fillStyle(colorNum, 0.15); // Use tank color with 15% opacity
    visionGraphics.fillCircle(0, 0, visionRadius);
    visionGraphics.lineStyle(1, colorNum, 0.4);
    visionGraphics.strokeCircle(0, 0, visionRadius);
    container.add(visionGraphics);
    container.sendToBack(visionGraphics); // Put vision behind tank
    visionGraphics.visible = this.showVision; // Respect initial setting
    
    tank.visionGraphics = visionGraphics;
    
    console.log('Created visual for tank at position:', x, y);
    
    return tankId;
  }
  
  updateTankVisuals() {
    for (let [tankId, tank] of this.scene.tanks) {
      if (tank.isDead) continue;
      
      if (tank.visual) {
        tank.visual.x = tank.x;
        tank.visual.y = tank.y;
        
        // Update rotation based on direction
        let rotation = 0;
        switch (tank.direction) {
          case 'UP': rotation = 0; break;
          case 'RIGHT': rotation = Math.PI / 2; break;
          case 'DOWN': rotation = Math.PI; break;
          case 'LEFT': rotation = -Math.PI / 2; break;
        }
        tank.visual.rotation = rotation;
        
        // Visual indication for birth protection
        if (tank.hasBirthProtection) {
          tank.visual.alpha = 0.6;
        } else {
          tank.visual.alpha = 1;
        }
      }
    }
  }
  
  updateVisionVisibility() {
    for (let [tankId, tank] of this.scene.tanks) {
      if (tank.visionGraphics) {
        tank.visionGraphics.visible = this.showVision;
      }
    }
  }
  
  applyTankAction(tankId, action) {
    const tank = this.scene.tanks.get(tankId);
    if (!tank || tank.isDead) return;
    
    const speed = tank.speed * CONFIG.maze.cellSize / CONFIG.game.tickRate;
    
    // Apply movement
    switch (action.move) {
      case 'UP':
        tank.vx = 0;
        tank.vy = -speed;
        tank.direction = 'UP';
        break;
      case 'DOWN':
        tank.vx = 0;
        tank.vy = speed;
        tank.direction = 'DOWN';
        break;
      case 'LEFT':
        tank.vx = -speed;
        tank.vy = 0;
        tank.direction = 'LEFT';
        break;
      case 'RIGHT':
        tank.vx = speed;
        tank.vy = 0;
        tank.direction = 'RIGHT';
        break;
      case 'STOP':
        tank.vx = 0;
        tank.vy = 0;
        break;
    }
    
    // Apply firing
    if (action.fire !== 'NONE' && tank.fireCooldown <= 0) {
      this.scene.fireBullet(tankId, action.fire);
      tank.fireCooldown = CONFIG.game.tickRate / CONFIG.tank.rof;
    }
    
    // Update cooldowns
    if (tank.fireCooldown > 0) tank.fireCooldown--;
  }
  
  handleBulletHit(bullet, tank) {
    const tankId = tank.id;
    const bulletId = bullet.id;
    
    if (tank && !tank.isDead) {
      // Use custom damage from bullet
      let damage = (bullet.damage || CONFIG.bullet.damage) * (1 - tank.def);
      
      // Birth protection: 50% damage reduction
      if (tank.hasBirthProtection) {
        damage *= 0.5;
      }
      
      damage = Math.max(1, damage);
      tank.hp -= damage;
      tank.damage += damage;
      
      // Record event
      this.scene.gameManager.recordEvent({
        actorId: bulletId,
        eventType: 'hit',
        targetId: tankId,
        damage: damage
      });
      
      // Check if tank is dead
      if (tank.hp <= 0) {
        tank.isDead = true;
        
        // Record kill
        const attacker = this.scene.tanks.get(bullet.ownerId);
        if (attacker) {
          attacker.kills++;
        }
        
        // Record death
        this.scene.gameManager.recordEvent({
          actorId: tankId,
          eventType: 'death'
        });
        
        // Remove visual
        if (tank.visual) {
          tank.visual.destroy();
          tank.visual = null;
        }
        if (tank.visionGraphics) {
          tank.visionGraphics.destroy();
          tank.visionGraphics = null;
        }
      }
    }
  }
  
  handleCoinPickup(tank, coin) {
    const tankId = tank.id;
    const coinId = coin.id;
    
    if (tank && !tank.isDead) {
      // Remove coin
      this.scene.removeCoin(coin);
      
      // Update coin count
      tank.coins++;
      
      // Record pickup
      this.scene.gameManager.recordEvent({
        actorId: tankId,
        eventType: 'coin',
        coinId: coinId,
        coinType: coin.type
      });
      
      // Apply effect based on coin type
      let upgrade = 'none';
      
      switch (coin.type) {
        case 'speed':
          // Yellow coin - speed boost
          tank.speed = Math.min(tank.speed * 1.3, CONFIG.tank.speed * 3);
          upgrade = 'speed_boost';
          console.log(`Tank ${tank.teamName} got speed boost!`);
          break;
          
        case 'bullet':
          // Red coin - increase bullet size (damage)
          tank.atk *= 1.5;
          upgrade = 'bullet_boost';
          console.log(`Tank ${tank.teamName} got bullet boost!`);
          break;
          
        default:
          // Normal coin - random upgrade
          const upgrades = ['speed', 'atk', 'def'];
          const randomUpgrade = upgrades[Math.floor(Math.random() * upgrades.length)];
          
          switch (randomUpgrade) {
            case 'speed':
              tank.speed = Math.min(tank.speed * 1.1, CONFIG.tank.speed * 2);
              break;
            case 'atk':
              tank.atk *= 1.15;
              break;
            case 'def':
              tank.def = Math.min(tank.def + 0.1, 0.7);
              break;
          }
          upgrade = randomUpgrade;
      }
      
      this.scene.gameManager.recordEvent({
        actorId: tankId,
        eventType: 'upgrade',
        upgrade: upgrade
      });
    }
  }
  
  getObservation(tankId) {
    const tank = this.scene.tanks.get(tankId);
    
    return {
      tick: this.scene.gameManager.tick,
      self: {
        id: tank.id,
        x: Math.floor(tank.x / CONFIG.maze.cellSize),
        y: Math.floor(tank.y / CONFIG.maze.cellSize),
        hp: tank.hp,
        maxHp: tank.maxHp,
        speed: tank.speed,
        atk: tank.atk,
        def: tank.def,
        direction: tank.direction,
        cooldown: tank.fireCooldown,
        coins: tank.coins,
        sight: CONFIG.tank.sight
      },
      enemies: Array.from(this.scene.tanks.values())
        .filter(t => t.id !== tankId && !t.isDead)
        .map(t => ({
          id: t.id,
          x: Math.floor(t.x / CONFIG.maze.cellSize),
          y: Math.floor(t.y / CONFIG.maze.cellSize),
          hp: t.hp,
          dir: t.direction
        })),
      bullets: Array.from(this.scene.bullets)
        .map(b => ({
          x: Math.floor(b.x / CONFIG.maze.cellSize),
          y: Math.floor(b.y / CONFIG.maze.cellSize),
          dir: b.direction
        })),
      coins: Array.from(this.scene.coins)
        .map(c => ({
          x: Math.floor(c.x / CONFIG.maze.cellSize),
          y: Math.floor(c.y / CONFIG.maze.cellSize)
        })),
      maze: this.scene.maze
    };
  }
}