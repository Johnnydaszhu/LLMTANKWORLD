#!/usr/bin/env python3
"""
Test StepFun TTS API with the provided key
"""

import requests
import json

def test_tts():
    api_key = "6oxozA0zB7AzTjPwSvmV6SHsYUm0O0GDjx0TSKUupL8iaUousXOtqmfUzuMG9HgT2"
    
    # Test different voice options from the realtime API
    voices = ['linjiajiejie', 'zhongqiu', 'xiaoqi', 'yunhao', 'zhiqiang']
    
    for voice in voices:
        print(f"\nTesting voice: {voice}")
        
        # Try the TTS API
        data = {
            "model": "step-1o-audio",
            "input": f"大家好，我是{voice}，正在测试语音合成功能。",
            "voice": voice,
            "response_format": "mp3"
        }
        
        try:
            response = requests.post(
                "https://api.stepfun.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json=data,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"✅ Voice {voice} works!")
                # Save the audio file
                with open(f"test_{voice}.mp3", "wb") as f:
                    f.write(response.content)
                print(f"   Audio saved to test_{voice}.mp3")
            else:
                error_data = response.json()
                print(f"❌ Voice {voice} failed: {error_data}")
                
        except requests.exceptions.Timeout:
            print(f"⏰ Voice {voice} timed out")
        except Exception as e:
            print(f"❌ Voice {voice} error: {e}")

if __name__ == "__main__":
    print("🎤 Testing StepFun TTS API...")
    test_tts()