import Phaser from 'phaser';
import { GameScene } from './components/GameScene.js';
import JSZip from 'jszip';

// Global game state
let game;
let teams = new Map();
let readyCount = 0;

// Initialize game
function initGame() {
  const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#1a1a1a',
    physics: {
      default: 'matter',
      matter: {
        debug: true,
        gravity: { y: 0 }
      }
    },
    scene: [GameScene]
  };
  
  game = new Phaser.Game(config);
  
  // Get reference to game scene
  game.events.on('ready', () => {
    const scene = game.scene.getScene('GameScene');
    if (scene) {
      window.gameScene = scene;
    }
  });
}

// Team management
function addTeam(driverInfo) {
  const teamId = driverInfo.teamName + '_' + Date.now();
  
  teams.set(teamId, {
    id: teamId,
    teamName: driverInfo.teamName,
    tankName: driverInfo.tankName,
    color: driverInfo.color || getRandomColor(),
    status: 'ready',
    driverInfo: driverInfo
  });
  
  updateTeamList();
  updateReadyCount();
  
  return teamId;
}

function removeTeam(teamId) {
  teams.delete(teamId);
  updateTeamList();
  updateReadyCount();
}

function clearAllTeams() {
  teams.clear();
  updateTeamList();
  updateReadyCount();
}

function updateTeamList() {
  const teamList = document.getElementById('team-list');
  teamList.innerHTML = '';
  
  teams.forEach(team => {
    const teamItem = document.createElement('div');
    teamItem.className = 'team-item';
    
    teamItem.innerHTML = `
      <div class="team-color" style="background-color: ${team.color}"></div>
      <div class="team-info">
        <div class="team-name">${team.teamName}</div>
        <div class="tank-name">${team.tankName}</div>
      </div>
      <div class="team-status status-${team.status}">${getStatusText(team.status)}</div>
      <button class="btn btn-danger" onclick="removeTeam('${team.id}')">删除</button>
    `;
    
    teamList.appendChild(teamItem);
  });
}

function getStatusText(status) {
  switch (status) {
    case 'ready': return '准备就绪';
    case 'loading': return '加载中';
    case 'error': return '错误';
    default: return '未知';
  }
}

function updateReadyCount() {
  readyCount = teams.size;
  document.getElementById('ready-count').textContent = readyCount;
  
  const startButton = document.getElementById('start-button');
  startButton.disabled = readyCount < 2;
}

function getRandomColor() {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// File handling
async function handleFileUpload(file) {
  try {
    const driverInfo = await parseDriverFile(file);
    
    if (driverInfo) {
      addTeam(driverInfo);
    }
  } catch (error) {
    console.error('文件解析失败:', error);
    alert('文件解析失败，请检查文件格式');
  }
}

async function parseDriverFile(file) {
  if (file.name.endsWith('.json')) {
    // Direct JSON file
    const text = await file.text();
    const json = JSON.parse(text);
    return validateDriverManifest(json);
  } else if (file.name.endsWith('.zip')) {
    // ZIP package
    const zip = new JSZip();
    const data = await zip.loadAsync(file);
    
    const manifestFile = data.file('manifest.json');
    if (!manifestFile) {
      throw new Error('ZIP包中缺少manifest.json');
    }
    
    const manifestText = await manifestFile.async('text');
    const manifest = JSON.parse(manifestText);
    return validateDriverManifest(manifest);
  } else {
    throw new Error('不支持的文件格式');
  }
}

function validateDriverManifest(manifest) {
  // Required fields
  const required = [
    'package.name',
    'package.version',
    'team.name',
    'tank.displayName',
    'engine.apiVersion',
    'policy.type',
    'policy.payload'
  ];
  
  for (let field of required) {
    const parts = field.split('.');
    let obj = manifest;
    
    for (let part of parts) {
      if (!obj[part]) {
        throw new Error(`缺少必需字段: ${field}`);
      }
      obj = obj[part];
    }
  }
  
  // Validate API version
  if (manifest.engine.apiVersion !== '1.0') {
    throw new Error('不支持的API版本');
  }
  
  // Validate policy type
  const validTypes = ['rule-set', 'fsm', 'llm-hint'];
  if (!validTypes.includes(manifest.policy.type)) {
    throw new Error('无效的策略类型');
  }
  
  return {
    teamName: manifest.team.name,
    tankName: manifest.tank.displayName,
    color: manifest.tank.color || getRandomColor(),
    apiVersion: manifest.engine.apiVersion,
    policyType: manifest.policy.type,
    policyPayload: manifest.policy.payload,
    packageName: manifest.package.name,
    packageVersion: manifest.package.version
  };
}

// Download examples
function downloadExample(type) {
  const manifest = {
    package: {
      name: 'example-driver',
      version: '1.0.0'
    },
    team: {
      name: '示例战队'
    },
    tank: {
      displayName: '示例坦克',
      color: '#4ecdc4'
    },
    engine: {
      apiVersion: '1.0'
    },
    policy: {
      type: 'rule-set',
      payload: {
        rules: [
          { condition: 'see_enemy', action: 'fire_at_enemy' },
          { condition: 'see_coin', action: 'move_to_coin' },
          { condition: 'low_hp', action: 'retreat' }
        ]
      }
    }
  };
  
  if (type === 'json') {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'driver-example.json');
  } else if (type === 'python') {
    const pythonCode = `# Example Python Driver
# This is just for reference, the actual driver runs in JavaScript

class TankDriver:
    def __init__(self):
        self.name = "Example Tank"
        self.version = "1.0.0"
    
    def decide(self, observation):
        # Simple strategy: move towards nearest coin
        if observation['coins']:
            target = observation['coins'][0]
            dx = target['x'] - observation['self']['x']
            dy = target['y'] - observation['self']['y']
            
            move = 'STOP'
            if abs(dx) > abs(dy):
                move = 'RIGHT' if dx > 0 else 'LEFT'
            else:
                move = 'DOWN' if dy > 0 else 'UP'
            
            return {
                'move': move,
                'fire': 'NONE',
                'upgrade': 'NONE'
            }
        
        return {
            'move': 'STOP',
            'fire': 'NONE',
            'upgrade': 'NONE'
        }
`;
    
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('driver.py', pythonCode);
    zip.file('README.md', '# Example Driver\\n\\nThis is an example driver package.');
    
    zip.generateAsync({ type: 'blob' }).then(blob => {
      downloadBlob(blob, 'driver-example.zip');
    });
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Generate random maze
function generateRandomMaze() {
  if (window.gameScene) {
    // Generate a more random seed using crypto API if available
    let randomSeed;
    if (window.crypto && window.crypto.getRandomValues) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      randomSeed = 'maze_' + array[0];
    } else {
      // Fallback to Math.random
      randomSeed = 'maze_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Update maze with new seed
    window.gameScene.gameManager.updateMazeSeed(randomSeed);
    
    // Clear existing entities if game is not running
    if (!window.gameScene.gameManager.isRunning) {
      console.log('Clearing existing entities...');
      
      // Clear tanks and their visuals
      for (let [tankId, tank] of window.gameScene.tanks) {
        if (tank.visual) tank.visual.destroy();
        if (tank.visionGraphics) tank.visionGraphics.destroy();
      }
      window.gameScene.tanks.clear();
      window.gameScene.drivers.clear();
      
      // Clear bullets and their visuals
      for (let bullet of window.gameScene.bullets) {
        if (bullet.visual) bullet.visual.destroy();
      }
      window.gameScene.bullets.clear();
      
      // Clear coins and their visuals
      for (let coin of window.gameScene.coins) {
        if (coin.visual) coin.visual.destroy();
        if (coin.text) coin.text.destroy();
      }
      window.gameScene.coins.clear();
    }
    
    console.log('Generated new maze with seed:', randomSeed);
  }
}

// Create example tanks and start battle immediately
function createExampleTanks() {
  clearAllTeams();
  
  // Optimized Red Tank - Elite Champion
  const redTankDriver = {
    teamName: "Red Champions",
    tankName: "Inferno",
    color: "#ff0000",
    policyType: "rule-set",
    policyPayload: {
      behavior: "elite",
      playStyle: "adaptive",
      targetPreference: "smart",
      tactics: {
        kiting: true,
        ambush: true,
        finishHim: true,
        zoneControl: true
      }
    }
  };
  
  // Example Target Tanks - Various behaviors to test against
  const target1Driver = {
    teamName: "Blue Targets",
    tankName: "Practice Bot",
    color: "#0066ff",
    policyType: "rule-set",
    policyPayload: {
      behavior: "passive",
      targetPreference: "coins"
    }
  };
  
  const target2Driver = {
    teamName: "Green Targets",
    tankName: "Moving Dummy",
    color: "#00ff00",
    policyType: "rule-set",
    policyPayload: {
      behavior: "random",
      targetPreference: "balanced"
    }
  };
  
  // Add teams - Red vs Targets
  addTeam(redTankDriver);
  addTeam(target1Driver);
  addTeam(target2Driver);
  
  // Start battle after a short delay
  setTimeout(() => {
    if (teams.size >= 2) {
      startGame();
    }
  }, 100);
}

// Game controls
async function startGame() {
  console.log('startGame called, readyCount:', readyCount);
  if (readyCount < 2) {
    alert('至少需要2支队伍才能开始游戏');
    return;
  }
  
  // Add all teams to game
  if (window.gameScene) {
    console.log('gameScene found, adding tanks...');
    const tankPromises = [];
    
    for (let team of teams.values()) {
      console.log('Adding tank for team:', team.teamName);
      tankPromises.push(window.gameScene.addTank(team.driverInfo));
    }
    
    // Wait for all tanks to be created
    console.log('Waiting for tanks to be created...');
    await Promise.all(tankPromises);
    console.log('All tanks created, starting game...');
    
    window.gameScene.startGame();
  } else {
    console.error('gameScene not found!');
  }
}

// Setup drag and drop
function setupDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  
  // Setup button event listeners
  document.getElementById('create-example-btn').addEventListener('click', createExampleTanks);
  document.getElementById('random-maze-btn').addEventListener('click', generateRandomMaze);
  document.getElementById('download-json-btn').addEventListener('click', () => downloadExample('json'));
  document.getElementById('download-python-btn').addEventListener('click', () => downloadExample('python'));
  document.getElementById('clear-all-btn').addEventListener('click', clearAllTeams);
  
  // Setup commentary checkbox
  const commentaryCheckbox = document.getElementById('enable-commentary');
  if (commentaryCheckbox) {
    commentaryCheckbox.addEventListener('change', (e) => {
      toggleCommentary(e.target.checked);
    });
  }
  
  // Setup Step-TTS checkbox
  const stepTtsCheckbox = document.getElementById('use-step-tts');
  const stepTtsOptions = document.getElementById('step-tts-options');
  if (stepTtsCheckbox && stepTtsOptions) {
    stepTtsCheckbox.addEventListener('change', (e) => {
      toggleStepTTS(e.target.checked);
      
      // Show/hide options
      if (e.target.checked) {
        stepTtsOptions.style.display = 'block';
      } else {
        stepTtsOptions.style.display = 'none';
      }
    });
    
    // Initially disable if service not available, but allow for configuration
    stepTtsCheckbox.disabled = false;
    // Check availability after a short delay and update UI accordingly
    setTimeout(() => {
      if (window.gameScene && window.gameScene.commentarySystem) {
        const isAvailable = window.gameScene.commentarySystem.tts.isAvailable;
        // Don't disable the checkbox, just update the label to show status
        const label = document.querySelector('#step-tts-label span');
        if (label) {
          if (isAvailable) {
            label.textContent = '🤖 使用 Step-Audio2 (服务可用)';
          } else {
            label.textContent = '🤖 使用 Step-Audio2 (服务不可用 - 将使用浏览器语音)';
          }
        }
      }
    }, 2000);
  }
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });
}

// Setup Step-Audio2 TTS advanced controls
function setupStepTTSAdvancedControls() {
  // Debug: Check if elements exist
  console.log('Setting up TTS advanced controls...');
  console.log('step-tts-options:', document.getElementById('step-tts-options'));
  
  // TTS source selection
  const ttsSourceRadios = document.querySelectorAll('input[name="tts-source"]');
  const apiKeyContainer = document.getElementById('api-key-container');
  const localModelOptions = document.getElementById('local-model-options');
  const realtimeOptions = document.getElementById('realtime-options');
  
  ttsSourceRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      // Hide all option panels first
      apiKeyContainer.style.display = 'none';
      localModelOptions.style.display = 'none';
      realtimeOptions.style.display = 'none';
      
      // Show relevant panel
      switch (e.target.value) {
        case 'local':
          localModelOptions.style.display = 'block';
          break;
        case 'realtime':
          realtimeOptions.style.display = 'block';
          // Initialize realtime connection check
          checkRealtimeConnection();
          break;
        case 'cloud':
          apiKeyContainer.style.display = 'block';
          break;
      }
      
      // Update TTS configuration
      if (window.gameScene && window.gameScene.commentarySystem) {
        const tts = window.gameScene.commentarySystem.tts;
        tts.setUseCloudAPI(e.target.value === 'cloud');
        tts.setUseRealtimeAPI(e.target.value === 'realtime');
      }
    });
  });
  
  // API endpoint configuration
  const ttsEndpointInput = document.getElementById('tts-endpoint');
  const saveEndpointBtn = document.getElementById('save-endpoint');
  
  // Load saved endpoint
  const savedEndpoint = localStorage.getItem('step_tts_endpoint');
  if (savedEndpoint) {
    ttsEndpointInput.value = savedEndpoint;
  }
  
  saveEndpointBtn.addEventListener('click', () => {
    const endpoint = ttsEndpointInput.value.trim();
    if (endpoint && window.gameScene && window.gameScene.commentarySystem) {
      window.gameScene.commentarySystem.tts.setEndpoint(endpoint);
      // Show success message
      saveEndpointBtn.textContent = '已保存';
      saveEndpointBtn.style.background = '#4CAF50';
      setTimeout(() => {
        saveEndpointBtn.textContent = '保存端点';
        saveEndpointBtn.style.background = '#2196F3';
      }, 2000);
    }
  });
  
    
  // Update status display
  updateTTSStatus();
  
  // Update status every 5 seconds
  setInterval(updateTTSStatus, 5000);
}

function updateTTSStatus() {
  if (window.gameScene && window.gameScene.commentarySystem) {
    const tts = window.gameScene.commentarySystem.tts;
    const statusSpan = document.getElementById('service-status');
    
    if (statusSpan) {
      if (tts.isAvailable) {
        statusSpan.textContent = '已连接';
        statusSpan.style.color = '#4CAF50';
      } else {
        statusSpan.textContent = '未连接';
        statusSpan.style.color = '#f44336';
      }
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initGame();
  setupDragAndDrop();
  setupStepTTSAdvancedControls();
  
  // Make functions global
  window.downloadExample = downloadExample;
  window.clearAllTeams = clearAllTeams;
  window.removeTeam = removeTeam;
  window.startGame = startGame;
  window.createExampleTanks = createExampleTanks;
  window.generateRandomMaze = generateRandomMaze;
  window.toggleCommentary = toggleCommentary;
  window.toggleStepTTS = toggleStepTTS;
  
  // Don't auto-create tanks on load
  // createExampleTanks();
});

// Handle window resize
window.addEventListener('resize', () => {
  if (game) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});

// Toggle commentary function
function toggleCommentary(enabled) {
  if (window.gameScene && window.gameScene.commentarySystem) {
    if (enabled) {
      window.gameScene.commentarySystem.enable();
    } else {
      window.gameScene.commentarySystem.disable();
    }
  }
}

// Toggle Step-TTS function
function toggleStepTTS(enabled) {
  if (window.gameScene && window.gameScene.commentarySystem) {
    window.gameScene.commentarySystem.tts.setUseStepTTS(enabled);
  }
}

// Camera control functions
function adjustZoom(delta) {
  if (window.gameScene) {
    window.gameScene.adjustZoom(delta);
    updateZoomDisplay();
  }
}

function resetCamera() {
  if (window.gameScene) {
    window.gameScene.resetCamera();
    updateZoomDisplay();
  }
}

function updateZoomDisplay() {
  if (window.gameScene) {
    const zoomLevel = document.getElementById('zoom-level');
    if (zoomLevel) {
      zoomLevel.textContent = window.gameScene.currentZoom.toFixed(1) + 'x';
    }
  }
}

// Keyboard shortcuts for camera control
document.addEventListener('keydown', (e) => {
  if (!window.gameScene) return;
  
  switch(e.key) {
    case '1':
      window.gameScene.followTankByIndex(0);
      break;
    case '2':
      window.gameScene.followTankByIndex(1);
      break;
    case '3':
      window.gameScene.followTankByIndex(2);
      break;
    case '4':
      window.gameScene.followTankByIndex(3);
      break;
    case ' ':
      e.preventDefault();
      resetCamera();
      break;
    case '+':
    case '=':
      adjustZoom(0.1);
      break;
    case '-':
    case '_':
      adjustZoom(-0.1);
      break;
  }
});