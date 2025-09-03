#!/usr/bin/env python3
"""
Quick test for StepFun Realtime API
"""

import asyncio
import websockets
import json

async def test_realtime_api():
    api_key = "6oxozA0zB7AzTjPwSvmV6SHsYUm0O0GDjx0TSKUupL8iaUousXOtqmfUzuMG9HgT2"
    
    try:
        # Connect to StepFun directly through proxy
        uri = f"ws://localhost:8765/realtime?api_key={api_key}"
        
        print("🔌 Connecting to StepFun Realtime API...")
        async with websockets.connect(uri) as websocket:
            print("✅ Connected successfully!")
            
            # Configure session
            config = {
                "event_id": "test_event_001",
                "type": "session.update",
                "session": {
                    "modalities": ["text", "audio"],
                    "instructions": "你是一个专业的游戏解说员，请用生动有趣的声音进行解说。",
                    "voice": "linjiajiejie",
                    "temperature": 0.7,
                    "input_audio_format": "pcm16",
                    "output_audio_format": "pcm16"
                }
            }
            
            await websocket.send(json.dumps(config))
            print("📤 Session configured")
            
            # Wait for session created response
            response = await websocket.recv()
            print(f"📥 Session response: {json.loads(response)}")
            
            # Test TTS
            tts_request = {
                "event_id": "test_event_002",
                "type": "response.create",
                "response": {
                    "modalities": ["text", "audio"],
                    "instructions": "你是一个专业的游戏解说员，请用生动有趣的声音进行解说。",
                    "voice": "linjiajiejie",
                    "temperature": 0.7,
                    "input": "欢迎大家来到 LLMTANKWORLD！这是一场精彩的坦克对战！"
                }
            }
            
            print("🎤 Testing TTS...")
            await websocket.send(json.dumps(tts_request))
            
            # Listen for responses
            audio_received = False
            for _ in range(10):  # Listen for up to 10 messages
                response = await websocket.recv()
                data = json.loads(response)
                
                if data.get("type") == "response.audio.delta":
                    print("🎵 Received audio chunk!")
                    audio_received = True
                elif data.get("type") == "response.done":
                    print("✅ TTS request completed!")
                    break
                elif data.get("type") == "error":
                    print(f"❌ Error: {data}")
                    break
            
            if audio_received:
                print("🎉 Test successful! Realtime API is working.")
            else:
                print("⚠️  No audio received. Check API key or permissions.")
                
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_realtime_api())