// StepFun Realtime API TTS Implementation
// Uses WebSocket for real-time text-to-speech synthesis

export class StepFunRealtimeTTS {
  constructor(options = {}) {
    this.apiKey = options.apiKey || localStorage.getItem('stepfun_api_key') || '';
    this.useProxy = options.useProxy !== false; // Default to using proxy
    this.wsUrl = this.useProxy ? 'ws://localhost:8765/realtime' : 'wss://api.stepfun.com/v1/realtime';
    this.socket = null;
    this.isConnected = false;
    this.currentSession = null;
    this.audioContext = null;
    this.pendingRequests = new Map();
    
    // Available voices
    this.voices = [
      { id: 'linjiajiejie', name: '林姐姐', description: '温柔女声' },
      { id: 'zhongqiu', name: '中秋', description: '温暖女声' },
      { id: 'xiaoqi', name: '小七', description: '活泼女声' },
      { id: 'yunhao', name: '云浩', description: '沉稳男声' },
      { id: 'zhiqiang', name: '志强', description: '有力男声' }
    ];
    
    // Default configuration
    this.config = {
      model: 'step-1o-audio',
      voice: this.voices[0].id,
      temperature: 0.7,
      instructions: '你是一个专业的游戏解说员，请用生动有趣的声音进行解说。'
    };
  }
  
  async connect() {
    if (this.isConnected) {
      return;
    }
    
    try {
      console.log('Connecting to StepFun realtime API...');
      console.log('Using URL:', this.wsUrl);
      
      // Create WebSocket connection
      if (this.useProxy) {
        // Add API key to query string when using proxy
        const urlWithKey = `${this.wsUrl}?api_key=${encodeURIComponent(this.apiKey)}`;
        this.socket = new WebSocket(urlWithKey);
      } else {
        // Direct connection (may not work due to CORS)
        this.socket = new WebSocket(this.wsUrl);
      }
      
      this.socket.onopen = () => this.onOpen();
      this.socket.onmessage = (event) => this.onMessage(event);
      this.socket.onerror = (error) => this.onError(error);
      this.socket.onclose = () => this.onClose();
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);
        
        this.socket.addEventListener('open', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
      
    } catch (error) {
      console.error('Failed to connect to StepFun realtime API:', error);
      throw error;
    }
  }
  
  onOpen() {
    console.log('Connected to StepFun realtime API');
    this.isConnected = true;
    
    // Initialize session
    this.initializeSession();
  }
  
  async initializeSession() {
    if (!this.isConnected) {
      throw new Error('Not connected to StepFun API');
    }
    
    // Configure session
    const sessionConfig = {
      event_id: `session_${Date.now()}`,
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.config.instructions,
        voice: this.config.voice,
        temperature: this.config.temperature,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        }
      }
    };
    
    this.send(sessionConfig);
  }
  
  onMessage(event) {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'session.created':
          this.handleSessionCreated(message);
          break;
        case 'response.audio.delta':
          this.handleAudioDelta(message);
          break;
        case 'response.audio_transcript.done':
          this.handleTranscriptDone(message);
          break;
        case 'response.done':
          this.handleResponseDone(message);
          break;
        case 'error':
          this.handleError(message);
          break;
        default:
          console.log('Received message:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }
  
  handleSessionCreated(message) {
    console.log('Session created:', message.session);
    this.currentSession = message.session;
  }
  
  handleAudioDelta(message) {
    // Handle streaming audio data
    const audioData = message.delta;
    // Process audio chunks
    this.processAudioChunk(audioData);
  }
  
  handleTranscriptDone(message) {
    console.log('Transcript:', message.transcript);
  }
  
  handleResponseDone(message) {
    console.log('Response completed');
    // Resolve any pending requests
    const requestId = message.response_id;
    if (this.pendingRequests.has(requestId)) {
      const { resolve } = this.pendingRequests.get(requestId);
      resolve();
      this.pendingRequests.delete(requestId);
    }
  }
  
  handleError(message) {
    console.error('StepFun API error:', message);
    // Reject any pending requests
    this.pendingRequests.forEach(({ reject }, requestId) => {
      reject(new Error(message.error || 'Unknown error'));
      this.pendingRequests.delete(requestId);
    });
  }
  
  onError(error) {
    console.error('WebSocket error:', error);
    this.isConnected = false;
  }
  
  onClose() {
    console.log('WebSocket connection closed');
    this.isConnected = false;
    this.currentSession = null;
  }
  
  send(message) {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to StepFun API');
    }
    
    this.socket.send(JSON.stringify(message));
  }
  
  async synthesize(text, options = {}) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    const config = { ...this.config, ...options };
    
    return new Promise((resolve, reject) => {
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store promise for later resolution
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Create response request
      const request = {
        event_id: requestId,
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          instructions: config.instructions,
          voice: config.voice,
          temperature: config.temperature,
          input: text
        }
      };
      
      try {
        this.send(request);
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(error);
      }
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('TTS request timeout'));
        }
      }, 30000);
    });
  }
  
  processAudioChunk(audioData) {
    // Base64 decode PCM16 audio data
    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Convert to Int16Array
    const int16Array = new Int16Array(bytes.buffer);
    
    // Play audio using Web Audio API
    this.playPCM16(int16Array);
  }
  
  playPCM16(pcmData) {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const sampleRate = 24000; // StepFun uses 24kHz
    const buffer = this.audioContext.createBuffer(1, pcmData.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    // Convert PCM16 to Float32 (-1 to 1)
    for (let i = 0; i < pcmData.length; i++) {
      channelData[i] = pcmData[i] / 32768;
    }
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
  }
  
  setVoice(voiceId) {
    const voice = this.voices.find(v => v.id === voiceId);
    if (voice) {
      this.config.voice = voiceId;
      if (this.isConnected) {
        // Update session configuration
        this.initializeSession();
      }
    }
  }
  
  setInstructions(instructions) {
    this.config.instructions = instructions;
    if (this.isConnected) {
      this.initializeSession();
    }
  }
  
  setTemperature(temperature) {
    this.config.temperature = Math.max(0, Math.min(1, temperature));
    if (this.isConnected) {
      this.initializeSession();
    }
  }
  
  getVoices() {
    return this.voices;
  }
  
  getCurrentVoice() {
    return this.voices.find(v => v.id === this.config.voice);
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
    this.currentSession = null;
    this.pendingRequests.clear();
  }
  
  isConnectedToService() {
    return this.isConnected;
  }
}