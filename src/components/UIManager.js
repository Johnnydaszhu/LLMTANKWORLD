export class UIManager {
  constructor(scene) {
    this.scene = scene;
  }
  
  setupUI() {
    // Timer
    this.scene.timerText = this.scene.add.text(
      this.scene.cameras.main.width - 150,
      20,
      'Time: 0:00',
      { fontSize: '20px', fill: '#fff' }
    );
    
    // Tank stats container
    this.scene.tankStatsContainer = this.scene.add.container(20, 60);
    
    // Scoreboard
    this.scene.scoreboard = this.scene.add.text(
      20,
      20,
      '',
      { fontSize: '16px', fill: '#fff' }
    );
  }
  
  updateTankStats() {
    // Clear previous stats
    this.scene.tankStatsContainer.removeAll(true);
    
    let y = 0;
    for (let [tankId, tank] of this.scene.tanks) {
      if (tank.isDead) continue;
      
      // Create stat text for each tank
      const statText = this.scene.add.text(0, y, 
        `${tank.teamName} - HP: ${Math.ceil(tank.hp)}/${tank.maxHp} | K: ${tank.kills} | D: ${Math.floor(tank.damage)} | C: ${tank.coins}`,
        { 
          fontSize: '12px', 
          fill: '#' + tank.color.toString(16).padStart(6, '0')
        }
      );
      
      this.scene.tankStatsContainer.add(statText);
      y += 20;
    }
  }
  
  showResults(scores) {
    let resultText = '=== 游戏结束 ===\n\n';
    scores.forEach((score, i) => {
      resultText += `${i + 1}. ${score.teamName} - ${score.displayName}\n`;
      resultText += `   分数: ${Math.floor(score.score)}\n`;
      resultText += `   击杀: ${score.kills} | 伤害: ${Math.floor(score.damage)} | 金币: ${score.coins}\n\n`;
    });
    
    console.log(resultText);
  }
}