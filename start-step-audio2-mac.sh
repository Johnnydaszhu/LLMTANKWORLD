#!/bin/bash

# Step-Audio2-Mini2 启动脚本（带模型下载）
# 用于为LLMTANKWORLD提供实时解说语音合成服务

echo "🎤 Step-Audio2-Mini2 语音合成服务"
echo "================================"

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

# 创建项目目录结构
PROJECT_DIR="$(pwd)"
STEP_AUDIO_DIR="$PROJECT_DIR/Step-Audio2"
MODELS_DIR="$STEP_AUDIO_DIR/models"

# 检查是否存在Step-Audio2目录
if [ ! -d "$STEP_AUDIO_DIR" ]; then
    echo "📥 正在克隆 Step-Audio2 仓库..."
    git clone https://github.com/stepfun-ai/Step-Audio2.git
fi

cd "$STEP_AUDIO_DIR"

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo "🔧 创建Python虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔄 激活虚拟环境..."
source venv/bin/activate

# 升级pip
pip install --upgrade pip

# 安装基础依赖
echo "📦 安装基础依赖..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install flask flask-cors transformers numpy scipy soundfile

# 创建requirements.txt
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

# 创建模型目录
mkdir -p models

# 检查模型文件
MODEL_FILE="$MODELS_DIR/step-audio2-mini2.pt"
if [ ! -f "$MODEL_FILE" ]; then
    echo ""
    echo "⚠️  未找到 Mini2 模型文件"
    echo "模型大小约 1.2GB"
    echo ""
    
    # 提供下载选项
    echo "请选择下载方式："
    echo "1) 自动下载（推荐）"
    echo "2) 手动下载"
    echo "3) 跳过（使用Web Speech API）"
    echo ""
    read -p "请输入选项 [1-3]: " choice
    
    case $choice in
        1)
            echo "📥 开始自动下载模型..."
            cd "$PROJECT_DIR"
            python3 download-model.py
            cd "$STEP_AUDIO_DIR"
            ;;
        2)
            echo "请从以下地址手动下载："
            echo "https://huggingface.co/stepfun-ai/Step-Audio2-Mini2"
            echo ""
            echo "下载后将文件放在：$MODEL_FILE"
            echo ""
            read -p "下载完成后按 Enter 继续..."
            ;;
        3)
            echo "跳过模型下载，将使用 Web Speech API"
            ;;
        *)
            echo "无效选项，退出"
            exit 1
            ;;
    esac
fi

# 创建增强版TTS服务脚本
cat > tts_server.py << 'EOF'
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import io
import os
import sys
import json
import logging
from datetime import datetime

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# 全局变量
tts = None
model_loaded = False

def load_model():
    """加载Step-Audio2模型"""
    global tts, model_loaded
    
    model_path = "models/step-audio2-mini2.pt"
    
    if not os.path.exists(model_path):
        logger.warning(f"模型文件 {model_path} 不存在")
        return False
    
    try:
        # 动态导入，避免在没有模型时报错
        import torch
        from step_audio import StepAudioTTS
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"使用设备: {device}")
        
        tts = StepAudioTTS(model_path=model_path, device=device)
        model_loaded = True
        logger.info("✅ Step-Audio2-Mini2 模型加载成功")
        return True
        
    except ImportError as e:
        logger.error(f"导入失败: {e}")
        logger.error("请确保已安装 step-audio 包")
        return False
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    status = {
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'model': 'Step-Audio2-Mini2' if model_loaded else 'Web Speech API',
        'model_loaded': model_loaded
    }
    return jsonify(status)

@app.route('/tts', methods=['POST'])
def text_to_speech():
    """文本转语音端点"""
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # 记录请求
        logger.info(f"TTS请求: {text[:50]}...")
        
        # 如果模型已加载，使用Step-Audio2
        if model_loaded and tts:
            return step_audio_tts(text, data)
        else:
            # 返回标记，让客户端使用Web Speech API
            return jsonify({
                'fallback': True,
                'message': 'Model not loaded, use Web Speech API',
                'text': text
            })
            
    except Exception as e:
        logger.error(f"TTS处理错误: {e}")
        return jsonify({'error': str(e)}), 500

def step_audio_tts(text, data):
    """使用Step-Audio2合成语音"""
    try:
        # 设置参数
        temperature = float(data.get('temperature', 0.7))
        max_new_tokens = int(data.get('max_new_tokens', 4096))
        repetition_penalty = float(data.get('repetition_penalty', 1.05))
        
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
            'duration': len(audio) / tts.sr,
            'model': 'Step-Audio2-Mini2'
        })
        
    except Exception as e:
        logger.error(f"Step-Audio2合成失败: {e}")
        # 降级到fallback
        return jsonify({
            'fallback': True,
            'message': f'Step-Audio2 failed: {str(e)}',
            'text': text
        })

@app.route('/model/load', methods=['POST'])
def load_model_endpoint():
    """手动加载模型"""
    success = load_model()
    return jsonify({
        'success': success,
        'model_loaded': model_loaded
    })

@app.route('/', methods=['GET'])
def index():
    """主页"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Step-Audio2-Mini2 TTS Service</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .success { background: #d4edda; color: #155724; }
            .warning { background: #fff3cd; color: #856404; }
            .endpoint { margin: 20px 0; }
            code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
        </style>
    </head>
    <body>
        <h1>🎤 Step-Audio2-Mini2 TTS Service</h1>
        <p>为 LLMTANKWORLD 提供高质量的中文语音合成服务</p>
        
        <div id="status" class="status warning">检查模型状态...</div>
        
        <h2>API 端点：</h2>
        <div class="endpoint">
            <h3>POST /tts</h3>
            <p>文本转语音</p>
            <pre>curl -X POST http://localhost:8000/tts \\
  -H "Content-Type: application/json" \\
  -d '{"text": "你好，世界！"}'</pre>
        </div>
        
        <div class="endpoint">
            <h3>GET /health</h3>
            <p>健康检查</p>
            <code>curl http://localhost:8000/health</code>
        </div>
        
        <div class="endpoint">
            <h3>POST /model/load</h3>
            <p>重新加载模型</p>
            <code>curl -X POST http://localhost:8000/model/load</code>
        </div>
        
        <script>
            // 检查服务状态
            fetch('/health')
                .then(response => response.json())
                .then(data => {
                    const statusDiv = document.getElementById('status');
                    if (data.model_loaded) {
                        statusDiv.className = 'status success';
                        statusDiv.textContent = `✅ 模型已加载: ${data.model}`;
                    } else {
                        statusDiv.className = 'status warning';
                        statusDiv.textContent = '⚠️ 模型未加载，将使用 Web Speech API';
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                });
        </script>
    </body>
    </html>
    """

if __name__ == '__main__':
    # 尝试加载模型
    load_model()
    
    print("")
    print("🚀 启动 TTS 服务...")
    print("服务地址: http://localhost:8000")
    print("按 Ctrl+C 停止服务")
    print("")
    
    if model_loaded:
        print("✅ Step-Audio2-Mini2 模型已加载")
    else:
        print("⚠️  模型未加载，将使用 Web Speech API 作为备选")
    
    # 启动服务
    app.run(host='0.0.0.0', port=8000, debug=False)
EOF

echo "✅ TTS服务脚本已创建"

echo ""
echo "🚀 启动 TTS 服务..."
echo "服务将在 http://localhost:8000 运行"
echo "按 Ctrl+C 停止服务"
echo ""

# 启动服务
python tts_server.py