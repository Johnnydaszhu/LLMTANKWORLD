// Step-Audio2 TTS Integration (Simplified)
// This module handles integration with Step-Audio2-Mini2 for text-to-speech

export class StepAudioTTS {
  constructor(options = {}) {
    this.apiEndpoint = options.apiEndpoint || localStorage.getItem('step_tts_endpoint') || 'http://localhost:8000/tts';
    // Ensure we don't use WebSocket URLs for HTTP requests
    if (this.apiEndpoint.startsWith('ws://') || this.apiEndpoint.startsWith('wss://')) {
      this.apiEndpoint = 'http://localhost:8000/tts';
      localStorage.removeItem('step_tts_endpoint');
    }
    // Ensure the URL is valid
    try {
      new URL(this.apiEndpoint);
    } catch {
      this.apiEndpoint = 'http://localhost:8000/tts';
      localStorage.removeItem('step_tts_endpoint');
    }
    this.modelPath = 'models/step-audio2-mini2.pt'; // Fixed model path
    this.isAvailable = false;
    this.useStepTTS = false; // Default to Web Speech API
    this.audioQueue = [];
    this.isPlaying = false;
    this.healthCheckInterval = null;
    
    // Check if Step-Audio2 service is available
    this.startHealthCheck();
  }
  
  async checkAvailability() {
    try {
      // Ensure apiEndpoint is valid
      if (!this.apiEndpoint || this.apiEndpoint.trim() === '') {
        throw new Error('API endpoint is not configured');
      }
      
      // Try to ping the Step-Audio2 service
      const healthUrl = this.apiEndpoint.replace('/tts', '/health');
      console.log('Checking health at:', healthUrl);
      const response = await fetch(healthUrl, {
        method: 'GET',
        mode: 'cors'
      });
      
      if (response.ok) {
        const data = await response.json();
        this.isAvailable = true;
        console.log('Step-Audio2 TTS service is available:', data.model || 'Unknown');
        
        // Update UI
        const label = document.getElementById('step-tts-label');
        if (label) {
          label.style.opacity = '1';
          label.title = 'Step-Audio2-Mini2 模型已加载';
        }
        
        // Update status
        const statusEl = document.getElementById('service-status');
        if (statusEl) {
          statusEl.textContent = '已连接';
          statusEl.style.color = '#4CAF50';
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn('Step-Audio2 TTS service not available, using fallback:', error);
      this.isAvailable = false;
      
      // Update UI
      const label = document.getElementById('step-tts-label');
      if (label) {
        label.style.opacity = '0.5';
        label.title = 'Step-Audio2 服务不可用';
      }
      
      // Update status
      const statusEl = document.getElementById('service-status');
      if (statusEl) {
        statusEl.textContent = '未连接';
        statusEl.style.color = '#f44336';
      }
    }
  }
  
  startHealthCheck() {
    // Check immediately
    this.checkAvailability();
    
    // Check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkAvailability();
    }, 30000);
  }
  
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
  
  setUseStepTTS(use) {
    this.useStepTTS = use && this.isAvailable;
    console.log(`Step-Audio2 TTS ${this.useStepTTS ? 'enabled' : 'disabled'}`);
  }
  
  async synthesize(text, options = {}) {
    if (!this.useStepTTS) {
      // Fallback to Web Speech API
      return this.fallbackSynthesize(text, options);
    }
    
    // Try local service
    if (this.isAvailable) {
      try {
        return await this.localSynthesize(text, options);
      } catch (error) {
        console.warn('Local TTS failed, falling back to Web Speech API:', error);
      }
    }
    
    // Final fallback
    return this.fallbackSynthesize(text, options);
  }
  
  async localSynthesize(text, options = {}) {
    const defaultOptions = {
      voice: 'default',
      speed: 1.0,
      model: 'step-audio2-mini2'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          ...finalOptions
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Get response data
      const data = await response.json();
      
      // Check if fallback is requested
      if (data.fallback) {
        console.log('Step-Audio2 fallback, using Web Speech API');
        return this.fallbackSynthesize(text, options);
      }
      
      // Get audio blob
      const audioBlob = await fetch(`data:audio/wav;base64,${data.audio}`).then(res => res.blob());
      return this.playAudio(audioBlob);
      
    } catch (error) {
      console.error('Audio synthesis failed:', error);
      throw error;
    }
  }
  
  async fallbackSynthesize(text, options = {}) {
    // Use Web Speech API as fallback
    return new Promise((resolve, reject) => {
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set language to Chinese
        utterance.lang = 'zh-CN';
        
        // Set voice if specified
        if (options.voice) {
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find(v => v.name === options.voice || v.lang.includes('zh'));
          if (voice) {
            utterance.voice = voice;
          }
        }
        
        // Set speed
        utterance.rate = options.speed || 1.0;
        
        utterance.onend = () => {
          resolve();
        };
        
        utterance.onerror = (event) => {
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };
        
        window.speechSynthesis.speak(utterance);
      } else {
        reject(new Error('Web Speech API not supported'));
      }
    });
  }
  
  async playAudio(audioBlob) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.onended = resolve;
      audio.onerror = reject;
      
      // Create object URL from blob
      audio.src = URL.createObjectURL(audioBlob);
      
      // Play the audio
      audio.play().catch(reject);
    });
  }
  
  setEndpoint(endpoint) {
    this.apiEndpoint = endpoint;
    localStorage.setItem('step_tts_endpoint', endpoint);
    // Re-check availability
    this.checkAvailability();
  }
  
  destroy() {
    this.stopHealthCheck();
    this.audioQueue = [];
    this.isPlaying = false;
  }
}