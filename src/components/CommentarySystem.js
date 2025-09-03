// Game Commentary System
import { StepAudioTTS } from './StepAudioTTS.js';

export class CommentarySystem {
  constructor(scene) {
    this.scene = scene;
    this.enabled = false;
    this.commentaryQueue = [];
    this.lastCommentaryTime = 0;
    this.minCommentaryInterval = 3000; // 3 seconds between commentaries
    this.tts = new StepAudioTTS(); // Initialize TTS system
    this.gameState = {
      tanks: new Map(),
      events: [],
      battleStartTime: null,
      dominantTeam: null,
      intenseMoment: false
    };
    
    // Commentary templates
    this.commentaryTemplates = {
      battleStart: [
        "比赛开始！各队坦克进入战场！",
        "激烈的坦克大战即将展开！",
        "各路英雄齐聚一堂，谁能笑到最后？"
      ],
      kill: [
        "{killer} 击败了 {victim}！精彩的战斗！",
        "{victim} 被 {killer} 消灭，场上少了一员猛将！",
        "精准打击！{killer} 成功击毁 {victim}！"
      ],
      coinPickup: [
        "{team} 获得了金币，实力得到提升！",
        "{team} 捡到了金币，这可能会改变战局！",
        "金币被 {team} 收入囊中！"
      ],
      intenseBattle: [
        "战斗进入白热化阶段！",
        "场上的局势异常激烈！",
        "这是一场惊心动魄的对决！"
      ],
      lowHp: [
        "{team} 血量危急！需要小心应对！",
        "{team} 已经伤痕累累，能否绝地反击？",
        "{team} 处境危险，随时可能被淘汰！"
      ],
      victory: [
        "比赛结束！{winner} 获得了最终胜利！",
        "恭喜 {winner} 赢得了这场精彩的比赛！",
        "经过激烈战斗，{winner} 登顶冠军！"
      ]
    };
    
    // Initialize event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // Listen to game events from GameManager
    if (this.scene.gameManager) {
      this.scene.gameManager.on('gameStart', () => this.onGameStart());
      this.scene.gameManager.on('recordEvent', (event) => this.onGameEvent(event));
      this.scene.gameManager.on('gameEnd', () => this.onGameEnd());
    }
  }
  
  onGameStart() {
    this.gameState.battleStartTime = Date.now();
    this.gameState.tanks = new Map(this.scene.tanks);
    this.addCommentary('battleStart');
  }
  
  onGameEvent(event) {
    this.gameState.events.push({
      ...event,
      timestamp: Date.now()
    });
    
    // Process different event types
    switch (event.eventType) {
      case 'death':
        this.handleKillEvent(event);
        break;
      case 'coin':
        this.handleCoinEvent(event);
        break;
      case 'hit':
        this.handleHitEvent(event);
        break;
    }
    
    // Check for intense moments
    this.checkIntenseMoments();
  }
  
  handleKillEvent(event) {
    const victim = this.scene.tanks.get(event.actorId);
    const killer = this.findKiller(event.actorId);
    
    if (victim && killer) {
      this.addCommentary('kill', {
        killer: killer.teamName,
        victim: victim.teamName
      });
    }
  }
  
  handleCoinEvent(event) {
    const tank = this.scene.tanks.get(event.actorId);
    if (tank) {
      this.addCommentary('coinPickup', {
        team: tank.teamName
      });
    }
  }
  
  handleHitEvent(event) {
    const tank = this.scene.tanks.get(event.targetId);
    if (tank && tank.hp / tank.maxHp < 0.3) {
      this.addCommentary('lowHp', {
        team: tank.teamName
      });
    }
  }
  
  findKiller(victimId) {
    // Find the tank that killed the victim
    for (let [tankId, tank] of this.scene.tanks) {
      if (tank.kills > 0) {
        // This is simplified - in reality you'd track who killed whom
        return tank;
      }
    }
    return null;
  }
  
  checkIntenseMoments() {
    const aliveTanks = Array.from(this.scene.tanks.values()).filter(t => !t.isDead);
    
    // Check if battle is intense (few tanks left, high action)
    if (aliveTanks.length <= 3 && this.gameState.events.length > 10) {
      if (!this.gameState.intenseMoment) {
        this.gameState.intenseMoment = true;
        this.addCommentary('intenseBattle');
      }
    }
  }
  
  onGameEnd() {
    // Find winner
    const aliveTanks = Array.from(this.scene.tanks.values()).filter(t => !t.isDead);
    if (aliveTanks.length === 1) {
      this.addCommentary('victory', {
        winner: aliveTanks[0].teamName
      });
    }
  }
  
  addCommentary(type, data = {}) {
    if (!this.enabled) return;
    
    const now = Date.now();
    if (now - this.lastCommentaryTime < this.minCommentaryInterval) {
      return;
    }
    
    const templates = this.commentaryTemplates[type];
    if (templates) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      let commentary = template;
      
      // Replace placeholders
      for (let [key, value] of Object.entries(data)) {
        commentary = commentary.replace(new RegExp(`{${key}}`, 'g'), value);
      }
      
      this.commentaryQueue.push({
        text: commentary,
        timestamp: now,
        priority: this.getCommentaryPriority(type)
      });
      
      this.lastCommentaryTime = now;
    }
  }
  
  getCommentaryPriority(type) {
    const priorities = {
      battleStart: 10,
      victory: 10,
      intenseBattle: 8,
      kill: 7,
      lowHp: 6,
      coinPickup: 3
    };
    return priorities[type] || 5;
  }
  
  update() {
    if (!this.enabled || this.commentaryQueue.length === 0) return;
    
    // Get highest priority commentary
    this.commentaryQueue.sort((a, b) => b.priority - a.priority);
    const commentary = this.commentaryQueue.shift();
    
    // Display and speak commentary
    this.displayCommentary(commentary.text);
    this.speakCommentary(commentary.text);
  }
  
  displayCommentary(text) {
    // Create commentary overlay
    const overlay = document.createElement('div');
    overlay.className = 'commentary-overlay';
    overlay.textContent = text;
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px 20px;
      border-radius: 5px;
      font-size: 18px;
      z-index: 1000;
      animation: fadeInOut 3s ease-in-out;
    `;
    
    // Add fade animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(overlay);
    
    // Remove after animation
    setTimeout(() => {
      overlay.remove();
      style.remove();
    }, 3000);
  }
  
  async speakCommentary(text) {
    // Use Step-Audio2 TTS with fallback to Web Speech API
    try {
      await this.tts.synthesize(text, {
        lang: 'zh-CN',
        speed: 1.0,
        pitch: 1.0,
        volume: 0.8
      });
    } catch (error) {
      console.error('TTS synthesis failed:', error);
      // Fallback to Web Speech API
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        // Try to find Chinese voice
        const voices = speechSynthesis.getVoices();
        const chineseVoice = voices.find(voice => 
          voice.lang.includes('zh') || voice.name.includes('Chinese')
        );
        
        if (chineseVoice) {
          utterance.voice = chineseVoice;
        }
        
        speechSynthesis.speak(utterance);
      }
    }
  }
  
  enable() {
    this.enabled = true;
    console.log('Game commentary enabled');
  }
  
  disable() {
    this.enabled = false;
    console.log('Game commentary disabled');
  }
  
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}