// Simple rule-based driver for testing
export class SimpleDriver {
  constructor(policy) {
    this.policy = policy;
    this.direction = 'UP';
  }
  
  decide(observation) {
    // Simple movement: change direction randomly
    if (Math.random() < 0.1) {
      const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      this.direction = directions[Math.floor(Math.random() * directions.length)];
    }
    
    return {
      move: this.direction,
      fire: Math.random() < 0.05 ? this.direction : 'NONE',
      upgrade: 'NONE'
    };
  }
}