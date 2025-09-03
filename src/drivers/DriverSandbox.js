// WebWorker template for driver isolation
const workerCode = `
  // Restricted environment - no access to DOM, network, etc.
  const self = this;
  
  // Simple rule-based driver implementation
  class Driver {
    constructor(policy) {
      this.policy = policy;
      this.lastAction = {
        move: 'STOP',
        fire: 'NONE',
        upgrade: 'NONE'
      };
    }
    
    decide(observation) {
      try {
        // Timeout protection
        const startTime = Date.now();
        const timeout = 50; // ms
        
        // Simple rule-based AI based on policy type
        let action = { ...this.lastAction };
        
        switch (this.policy.type) {
          case 'rule-set':
            action = this.ruleSetDriver(observation, this.policy.payload);
            break;
          case 'fsm':
            action = this.fsmDriver(observation, this.policy.payload);
            break;
          case 'llm-hint':
            action = this.llmHintDriver(observation, this.policy.payload);
            break;
          default:
            // Default behavior
            action = this.defaultDriver(observation);
        }
        
        // Check timeout
        if (Date.now() - startTime > timeout) {
          throw new Error('Decision timeout');
        }
        
        this.lastAction = action;
        return action;
        
      } catch (error) {
        console.error('Driver error:', error);
        return this.lastAction;
      }
    }
    
    ruleSetDriver(obsation, rules) {
      // Simple rule-based driver
      const self = observation.self;
      
      // Check for nearby enemies
      const nearbyEnemy = observation.enemies.find(e => {
        const dist = Math.abs(e.x - self.x) + Math.abs(e.y - self.y);
        return dist <= self.sight;
      });
      
      // Check for nearby coins
      const nearbyCoin = observation.coins[0];
      
      let move = 'STOP';
      let fire = 'NONE';
      
      // Movement logic
      if (nearbyCoin) {
        const dx = nearbyCoin.x - self.x;
        const dy = nearbyCoin.y - self.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
          move = dx > 0 ? 'RIGHT' : 'LEFT';
        } else {
          move = dy > 0 ? 'DOWN' : 'UP';
        }
      } else if (nearbyEnemy) {
        // Move towards enemy
        const dx = nearbyEnemy.x - self.x;
        const dy = nearbyEnemy.y - self.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
          move = dx > 0 ? 'RIGHT' : 'LEFT';
        } else {
          move = dy > 0 ? 'DOWN' : 'UP';
        }
      } else {
        // Random exploration when no targets
        if (!this.lastDirection || Math.random() < 0.1) {
          const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
          this.lastDirection = directions[Math.floor(Math.random() * directions.length)];
        }
        move = this.lastDirection;
      }
      
      // Firing logic
      if (nearbyEnemy && self.cooldown <= 0) {
        const dx = nearbyEnemy.x - self.x;
        const dy = nearbyEnemy.y - self.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
          fire = dx > 0 ? 'RIGHT' : 'LEFT';
        } else {
          fire = dy > 0 ? 'DOWN' : 'UP';
        }
      }
      
      return { move, fire, upgrade: 'NONE' };
    }
    
    fsmDriver(observation, fsm) {
      // Finite State Machine driver
      // Simplified implementation
      return this.ruleSetDriver(observation, { rules: [] });
    }
    
    llmHintDriver(observation, hints) {
      // LLM hint-based driver
      // Simplified implementation
      return this.ruleSetDriver(observation, { rules: [] });
    }
    
    defaultDriver(observation) {
      // Default random movement with persistence
      if (!this.defaultLastDirection || Math.random() < 0.2) {
        const directions = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        this.defaultLastDirection = directions[Math.floor(Math.random() * directions.length)];
      }
      return {
        move: this.defaultLastDirection,
        fire: 'NONE',
        upgrade: 'NONE'
      };
    }
  }
  
  // Message handler
  self.onmessage = function(e) {
    const { type, data } = e.data;
    
    switch (type) {
      case 'init':
        try {
          const driver = new Driver(data.policy);
          self.driver = driver;
          self.postMessage({ type: 'init', success: true });
        } catch (error) {
          self.postMessage({ type: 'init', success: false, error: error.message });
        }
        break;
        
      case 'decide':
        try {
          if (!self.driver) {
            throw new Error('Driver not initialized');
          }
          
          const action = self.driver.decide(data.observation);
          self.postMessage({ type: 'decide', decisionId: e.data.decisionId, action, success: true });
        } catch (error) {
          self.postMessage({ type: 'decide', decisionId: e.data.decisionId, success: false, error: error.message });
        }
        break;
        
      case 'destroy':
        // Cleanup
        self.driver = null;
        self.close();
        break;
    }
  };
  
  // Error handling
  self.onerror = function(error) {
    console.error('Worker error:', error);
    self.postMessage({ type: 'error', error: error.message });
  };
`;

// Create blob URL for worker
const blob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);

export class DriverSandbox {
  constructor(policy) {
    this.worker = new Worker(workerUrl);
    this.policy = policy;
    this.initialized = false;
    this.pendingDecisions = new Map();
    
    this.setupMessageHandler();
  }
  
  setupMessageHandler() {
    this.worker.onmessage = (e) => {
      const { type, success, action, error } = e.data;
      
      switch (type) {
        case 'init':
          this.initialized = success;
          if (this.initCallback) {
            this.initCallback(success, error);
          }
          break;
          
        case 'decide':
          if (this.pendingDecisions.has(e.data.decisionId)) {
            const callback = this.pendingDecisions.get(e.data.decisionId);
            this.pendingDecisions.delete(e.data.decisionId);
            callback(success ? action : null, error);
          }
          break;
          
        case 'error':
          console.error('Driver sandbox error:', error);
          break;
      }
    };
    
    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
    };
  }
  
  async init() {
    return new Promise((resolve) => {
      this.initCallback = resolve;
      this.worker.postMessage({
        type: 'init',
        data: { policy: this.policy }
      });
    });
  }
  
  async decide(observation) {
    if (!this.initialized) {
      throw new Error('Driver not initialized');
    }
    
    return new Promise((resolve, reject) => {
      const decisionId = `decide_${Date.now()}_${Math.random()}`;
      const timeoutId = setTimeout(() => {
        this.pendingDecisions.delete(decisionId);
        resolve({ move: 'STOP', fire: 'NONE', upgrade: 'NONE' });
      }, 50);
      
      this.pendingDecisions.set(decisionId, (action, error) => {
        clearTimeout(timeoutId);
        if (error) {
          resolve({ move: 'STOP', fire: 'NONE', upgrade: 'NONE' });
        } else {
          resolve(action);
        }
      });
      
      this.worker.postMessage({
        type: 'decide',
        decisionId,
        data: { observation }
      });
    });
  }
  
  destroy() {
    this.worker.postMessage({ type: 'destroy' });
    this.worker.terminate();
  }
}