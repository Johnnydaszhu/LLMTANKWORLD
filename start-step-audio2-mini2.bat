@echo off
REM Step-Audio2-Mini2 启动脚本 (Windows版本)
REM 用于为LLMTANKWORLD提供实时解说语音合成服务

echo 🎤 正在启动 Step-Audio2-Mini2 语音合成服务...

REM 检查Python是否已安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Python，请先安装Python
    pause
    exit /b 1
)

REM 检查git是否已安装
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到git，请先安装git
    pause
    exit /b 1
)

REM 检查是否存在Step-Audio2目录
if not exist "Step-Audio2" (
    echo 📥 正在克隆 Step-Audio2 仓库...
    git clone https://github.com/stepfun-ai/Step-Audio2.git
)

cd Step-Audio2

REM 创建虚拟环境（如果不存在）
if not exist "venv" (
    echo 🔧 创建Python虚拟环境...
    python -m venv venv
)

REM 激活虚拟环境
echo 🔄 激活虚拟环境...
call venv\Scripts\activate.bat

REM 安装依赖
echo 📦 安装依赖包...
pip install -r requirements.txt

REM 检查模型文件
if not exist "models\step-audio2-mini2.pt" (
    echo ⚠️  警告: 未找到Mini2模型文件
    echo 请从以下地址下载模型文件:
    echo https://huggingface.co/stepfun-ai/Step-Audio2-Mini2
    echo 将下载的模型文件放在 Step-Audio2\models\ 目录下
    echo.
    echo 或者运行自动下载脚本:
    echo python scripts\download_model.py mini2
)

REM 创建TTS服务脚本
echo 创建TTS服务脚本...
(
echo from flask import Flask, request, jsonify
echo from flask_cors import CORS
echo import base64
echo import io
echo import torch
echo from step_audio import StepAudioTTS
echo import os
echo import sys
echo.
echo app = Flask(__name__)
echo CORS(app)
echo.
echo # 初始化模型
echo print("正在加载 Step-Audio2-Mini2 模型...")
echo device = "cuda" if torch.cuda.is_available() else "cpu"
echo print(f"使用设备: {device}")
echo.
echo # 检查模型文件
echo model_path = "models/step-audio2-mini2.pt"
echo if not os.path.exists(model_path):
echo     print(f"错误: 模型文件 {model_path} 不存在")
echo     sys.exit(1)
echo.
echo try:
echo     tts = StepAudioTTS(model_path=model_path, device=device)
echo     print("✅ 模型加载成功")
echo except Exception as e:
echo     print(f"❌ 模型加载失败: {e}")
echo     sys.exit(1)
echo.
echo @app.route('/health', methods=['GET'])
echo def health_check():
echo     return jsonify({'status': 'ok', 'model': 'Step-Audio2-Mini2'})
echo.
echo @app.route('/tts', methods=['POST'])
echo def text_to_speech():
echo     try:
echo         data = request.json
echo         text = data.get('text', '')
echo.
echo         if not text:
echo             return jsonify({'error': 'No text provided'}), 400
echo.
echo         # 设置参数
echo         temperature = float(data.get('temperature', 0.7))
echo         max_new_tokens = int(data.get('max_new_tokens', 4096))
echo         repetition_penalty = float(data.get('repetition_penalty', 1.05))
echo.
echo         print(f"合成语音: {text[:50]}...")
echo.
echo         # 生成音频
echo         audio = tts.synthesize(
echo             text=text,
echo             temperature=temperature,
echo             max_new_tokens=max_new_tokens,
echo             repetition_penalty=repetition_penalty
echo         )
echo.
echo         # 转换为base64
echo         audio_buffer = io.BytesIO()
echo         audio.save(audio_buffer, format="wav")
echo         audio_b64 = base64.b64encode(audio_buffer.getvalue()).decode()
echo.
echo         return jsonify({
echo             'audio': audio_b64,
echo             'format': 'wav',
echo             'duration': len(audio) / tts.sr
echo         })
echo.
echo     except Exception as e:
echo         print(f"语音合成错误: {e}")
echo         return jsonify({'error': str(e)}), 500
echo.
echo @app.route('/', methods=['GET'])
echo def index():
echo     return """
echo     ^<h1^>Step-Audio2-Mini2 TTS Service^</h1^>
echo     ^<p^>为LLMTANKWORLD提供语音合成服务^</p^>
echo     ^<h2^>API端点:^</h2^>
echo     ^<ul^>
echo         ^<li^>POST /tts - 文本转语音^</li^>
echo         ^<li^>GET /health - 健康检查^</li^>
echo     ^</ul^>
echo     ^<h3^>使用示例:^</h3^>
echo     ^<pre^>
echo curl -X POST http://localhost:8000/tts \\
echo   -H "Content-Type: application/json" \\
echo   -d '{"text": "你好，世界！"}'
echo     ^</pre^>
echo     """
echo.
echo if __name__ == '__main__':
echo     app.run(host='0.0.0.0', port=8000, debug=False)
) > tts_server.py

echo ✅ TTS服务脚本已创建

REM 创建requirements.txt（如果不存在）
if not exist "requirements.txt" (
    echo torch>=2.0.0> requirements.txt
    echo torchaudio>=2.0.0>> requirements.txt
    echo flask>=2.0.0>> requirements.txt
    echo flask-cors>=3.0.0>> requirements.txt
    echo transformers>=4.30.0>> requirements.txt
    echo numpy>=1.21.0>> requirements.txt
    echo scipy>=1.7.0>> requirements.txt
    echo soundfile>=0.12.0>> requirements.txt
)

REM 安装Flask依赖
echo 🔍 检查Flask依赖...
pip install flask flask-cors

echo.
echo 🚀 启动TTS服务...
echo 服务将在 http://localhost:8000 运行
echo 按 Ctrl+C 停止服务
echo.

REM 启动服务
python tts_server.py

pause