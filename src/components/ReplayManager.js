import { CONFIG } from './GameManager.js';

export class ReplayManager {
  constructor(scene) {
    this.scene = scene;
  }
  
  exportReplay() {
    const replay = {
      seed: CONFIG.maze.seed,
      config: CONFIG,
      events: this.scene.gameManager.events,
      drivers: Array.from(this.scene.drivers.values())
    };
    
    const blob = new Blob([JSON.stringify(replay, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay_${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
}