#!/bin/bash

# Step-Audio2-Mini2 启动脚本（简化版）
# 用于为LLMTANKWORLD提供实时解说语音合成服务

echo "🎤 Step-Audio2-Mini2 语音合成服务"
echo "================================"

# 检查Python版本
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到Python3，请先安装Python3"
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
echo "📦 安装依赖..."
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install flask flask-cors transformers numpy scipy soundfile requests tqdm

# 创建模型目录
mkdir -p models

# 检查模型文件
MODEL_FILE="$MODELS_DIR/step-audio2-mini2.pt"
if [ ! -f "$MODEL_FILE" ]; then
    echo ""
    echo "⚠️  未找到 Mini2 模型文件"
    echo "请按照 MAC-DEPLOYMENT.md 中的说明下载模型"
    echo "服务将使用 Web Speech API 作为备选"
    echo ""
fi

# 创建TTS服务脚本
cat > tts_server_simple.py << 'EOF'
from flask import Flask, request, jsonify
from flask_cors import CORS
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
MODEL_PATH = "models/step-audio2-mini2.pt"

def load_model():
    """加载Step-Audio2模型"""
    global tts, model_loaded, MODEL_PATH
    
    if not os.path.exists(MODEL_PATH):
        logger.warning(f"模型文件 {MODEL_PATH} 不存在")
        return False
    
    try:
        # 动态导入，避免在没有模型时报错
        import torch
        sys.path.append('.')  # 添加当前目录到路径
        from step_audio import StepAudioTTS
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"使用设备: {device}")
        
        tts = StepAudioTTS(model_path=MODEL_PATH, device=device)
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
        'model_loaded': model_loaded,
        'service': 'Step-Audio2 TTS Service'
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
        import base64
        import io
        
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

@app.route('/model/switch', methods=['POST'])
def switch_model_endpoint():
    """切换模型"""
    try:
        data = request.json
        model_path = data.get('model_path', 'models/step-audio2-mini2.pt')
        
        # 检查模型文件是否存在
        if not os.path.exists(model_path):
            return jsonify({
                'success': False,
                'error': f'Model file not found: {model_path}'
            })
        
        # 卸载当前模型
        global tts, model_loaded
        tts = None
        model_loaded = False
        
        # 更新模型路径
        global MODEL_PATH
        MODEL_PATH = model_path
        
        # 加载新模型
        success = load_model()
        
        return jsonify({
            'success': success,
            'model_loaded': model_loaded,
            'model_path': model_path
        })
        
    except Exception as e:
        logger.error(f"模型切换失败: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        })

@app.route('/model/list', methods=['GET'])
def list_models_endpoint():
    """列出可用模型"""
    models_dir = 'models'
    models = []
    
    if os.path.exists(models_dir):
        for file in os.listdir(models_dir):
            if file.endswith('.pt'):
                model_path = os.path.join(models_dir, file)
                file_size = os.path.getsize(model_path) / (1024 * 1024 * 1024)  # GB
                models.append({
                    'name': file,
                    'path': model_path,
                    'size': f"{file_size:.1f}GB"
                })
    
    return jsonify({
        'models': models,
        'current_model': MODEL_PATH if model_loaded else None
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
            body { 
                font-family: Arial, sans-serif; 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 20px;
                background: #f5f5f5;
            }
            .container {
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .status { 
                padding: 15px; 
                margin: 15px 0; 
                border-radius: 5px;
                font-weight: bold;
            }
            .success { 
                background: #d4edda; 
                color: #155724; 
                border: 1px solid #c3e6cb;
            }
            .warning { 
                background: #fff3cd; 
                color: #856404;
                border: 1px solid #ffeaa7;
            }
            .endpoint { 
                margin: 25px 0; 
                padding: 15px;
                background: #f8f9fa;
                border-radius: 5px;
            }
            code { 
                background: #f4f4f4; 
                padding: 2px 5px; 
                border-radius: 3px;
                font-family: 'Courier New', monospace;
            }
            pre {
                background: #2d3748;
                color: #e2e8f0;
                padding: 15px;
                border-radius: 5px;
                overflow-x: auto;
            }
            h1 { color: #2d3748; }
            h2 { color: #4a5568; margin-top: 30px; }
            .model-info {
                background: #edf2f7;
                padding: 15px;
                border-radius: 5px;
                margin: 15px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎤 Step-Audio2-Mini2 TTS Service</h1>
            <p>为 <strong>LLMTANKWORLD</strong> 提供高质量的中文语音合成服务</p>
            
            <div id="status" class="status warning">检查模型状态...</div>
            
            <div class="model-info">
                <h3>📋 模型信息</h3>
                <p><strong>模型名称:</strong> Step-Audio2-Mini2</p>
                <p><strong>模型大小:</strong> 约 1.2GB</p>
                <p><strong>支持语言:</strong> 中文（普通话）</p>
                <p><strong>质量:</strong> 自然度高，情感丰富</p>
            </div>
            
            <h2>📡 API 端点：</h2>
            
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
            
            <h2>🎮 游戏集成</h2>
            <ol>
                <li>确保此服务正在运行</li>
                <li>启动 LLMTANKWORLD 游戏</li>
                <li>勾选 "🎤 实时解说"</li>
                <li>如果模型已加载，勾选 "🤖 使用 Step-Audio2"</li>
            </ol>
            
            <script>
                // 检查服务状态
                fetch('/health')
                    .then(response => response.json())
                    .then(data => {
                        const statusDiv = document.getElementById('status');
                        if (data.model_loaded) {
                            statusDiv.className = 'status success';
                            statusDiv.innerHTML = `✅ 模型已加载: ${data.model}<br>
                                <small>服务运行正常，可以使用高质量语音合成</small>`;
                        } else {
                            statusDiv.className = 'status warning';
                            statusDiv.innerHTML = `⚠️ 模型未加载<br>
                                <small>将使用 Web Speech API 作为备选方案</small><br>
                                <small>请将模型文件放在 models/step-audio2-mini2.pt</small>`;
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        document.getElementById('status').innerHTML = 
                            '❌ 无法连接到服务';
                    });
            </script>
        </div>
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
        print("   可以使用高质量语音合成")
    else:
        print("⚠️  模型未加载")
        print("   将使用 Web Speech API 作为备选")
        print("   请参考 MAC-DEPLOYMENT.md 下载模型")
    
    print("")
    print("💡 提示: 即使没有模型，服务也可以运行")
    print("   游戏会自动使用浏览器内置的语音合成")
    
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
python tts_server_simple.py