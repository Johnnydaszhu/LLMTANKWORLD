#!/bin/bash

# Step-Audio2-Mini2 启动脚本
# 用于为LLMTANKWORLD提供实时解说语音合成服务

echo "🎤 正在启动 Step-Audio2-Mini2 语音合成服务..."

# 检查Python版本
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到Python3，请先安装Python3"
    exit 1
fi

# 检查git是否已安装
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 未找到git，请先安装git"
    exit 1
fi

# 检查是否存在Step-Audio2目录
if [ ! -d "Step-Audio2" ]; then
    echo "📥 正在克隆 Step-Audio2 仓库..."
    git clone https://github.com/stepfun-ai/Step-Audio2.git
fi

cd Step-Audio2

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo "🔧 创建Python虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔄 激活虚拟环境..."
source venv/bin/activate

# 安装依赖
echo "📦 安装依赖包..."
pip install -r requirements.txt

# 检查模型文件
if [ ! -f "models/step-audio2-mini2.pt" ]; then
    echo "⚠️  警告: 未找到Mini2模型文件"
    echo "请从以下地址下载模型文件:"
    echo "https://huggingface.co/stepfun-ai/Step-Audio2-Mini2"
    echo "将下载的模型文件放在 Step-Audio2/models/ 目录下"
    echo ""
    echo "或者运行自动下载脚本:"
    echo "python scripts/download_model.py mini2"
fi

# 创建TTS服务脚本
cat > tts_server.py << 'EOF'
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import torch
from step_audio import StepAudioTTS
import os
import sys

app = Flask(__name__)
CORS(app)

# 初始化模型
print("正在加载 Step-Audio2-Mini2 模型...")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"使用设备: {device}")

# 检查模型文件
model_path = "models/step-audio2-mini2.pt"
if not os.path.exists(model_path):
    print(f"错误: 模型文件 {model_path} 不存在")
    sys.exit(1)

try:
    tts = StepAudioTTS(model_path=model_path, device=device)
    print("✅ 模型加载成功")
except Exception as e:
    print(f"❌ 模型加载失败: {e}")
    sys.exit(1)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'model': 'Step-Audio2-Mini2'})

@app.route('/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # 设置参数
        temperature = float(data.get('temperature', 0.7))
        max_new_tokens = int(data.get('max_new_tokens', 4096))
        repetition_penalty = float(data.get('repetition_penalty', 1.05))
        
        print(f"合成语音: {text[:50]}...")
        
        # 生成音频
        audio = tts.synthesize(
            text=text,
            temperature=temperature,
            max_new_tokens=max_new_tokens,
            repetition_penalty=repetition_penalty
        )
        
        # 转换为base64
        audio_buffer = io.BytesIO()
        audio.save(audio_buffer, format="wav")
        audio_b64 = base64.b64encode(audio_buffer.getvalue()).decode()
        
        return jsonify({
            'audio': audio_b64,
            'format': 'wav',
            'duration': len(audio) / tts.sr
        })
        
    except Exception as e:
        print(f"语音合成错误: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    return """
    <h1>Step-Audio2-Mini2 TTS Service</h1>
    <p>为LLMTANKWORLD提供语音合成服务</p>
    <h2>API端点:</h2>
    <ul>
        <li>POST /tts - 文本转语音</li>
        <li>GET /health - 健康检查</li>
    </ul>
    <h3>使用示例:</h3>
    <pre>
curl -X POST http://localhost:8000/tts \\
  -H "Content-Type: application/json" \\
  -d '{"text": "你好，世界！"}'
    </pre>
    """

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=False)
EOF

echo "✅ TTS服务脚本已创建"

# 创建requirements.txt（如果不存在）
if [ ! -f "requirements.txt" ]; then
    cat > requirements.txt << 'EOF'
torch>=2.0.0
torchaudio>=2.0.0
flask>=2.0.0
flask-cors>=3.0.0
transformers>=4.30.0
numpy>=1.21.0
scipy>=1.7.0
soundfile>=0.12.0
EOF
fi

# 安装Flask依赖（如果需要）
echo "🔍 检查Flask依赖..."
pip install flask flask-cors

echo ""
echo "🚀 启动TTS服务..."
echo "服务将在 http://localhost:8000 运行"
echo "按 Ctrl+C 停止服务"
echo ""

# 启动服务
python tts_server.py