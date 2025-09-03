# Step-Audio2-Mini2 部署指南

本指南将帮助您部署 Step-Audio2-Mini2 模型为 LLMTANKWORLD 提供高质量的中文语音合成服务。

## 快速开始

### 1. 自动启动（推荐）

根据您的操作系统选择相应的脚本：

**macOS/Linux:**
```bash
chmod +x start-step-audio2-mini2.sh
./start-step-audio2-mini2.sh
```

**Windows:**
```cmd
start-step-audio2-mini2.bat
```

脚本会自动：
- 克隆 Step-Audio2 仓库
- 创建 Python 虚拟环境
- 安装所需依赖
- 创建并启动 TTS 服务

### 2. 手动部署

如果您希望手动部署，请按照以下步骤操作：

#### 2.1 环境要求

- Python 3.8+
- PyTorch 2.0+
- CUDA（可选，用于GPU加速）
- Git

#### 2.2 下载模型

从 Hugging Face 下载 Mini2 模型：
```
https://huggingface.co/stepfun-ai/Step-Audio2-Mini2
```

将模型文件 `step-audio2-mini2.pt` 放在 `Step-Audio2/models/` 目录下。

#### 2.3 安装依赖

```bash
cd Step-Audio2
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate.bat
pip install -r requirements.txt
pip install flask flask-cors
```

#### 2.4 启动服务

```bash
python tts_server.py
```

服务将在 `http://localhost:8000` 启动。

## API 使用说明

### 健康检查
```
GET /health
```

返回：
```json
{
    "status": "ok",
    "model": "Step-Audio2-Mini2"
}
```

### 文本转语音
```
POST /tts
Content-Type: application/json

{
    "text": "比赛开始！各队坦克进入战场！",
    "temperature": 0.7,
    "max_new_tokens": 4096,
    "repetition_penalty": 1.05
}
```

返回：
```json
{
    "audio": "base64编码的wav音频",
    "format": "wav",
    "duration": 2.5
}
```

## 参数说明

- `text`: 要合成的文本（必需）
- `temperature**: 控制生成随机性，默认 0.7
- `max_new_tokens**: 最大生成长度，默认 4096
- `repetition_penalty**: 重复惩罚系数，默认 1.05

## 与 LLMTANKWORLD 集成

1. 确保 Step-Audio2 服务正在运行（端口 8000）
2. 在 LLMTANKWORLD 界面勾选 "🎤 实时解说"
3. 系统会自动使用 Step-Audio2 进行语音合成

## 故障排除

### 1. 模型文件不存在
- 确保已下载 Mini2 模型文件
- 检查文件路径是否正确：`Step-Audio2/models/step-audio2-mini2.pt`

### 2. CUDA 内存不足
如果遇到 CUDA 内存错误：
- 使用 CPU 模式（自动降级）
- 或者减少 batch size
- 或者使用更小的模型

### 3. 端口被占用
如果端口 8000 被占用：
- 修改 `tts_server.py` 中的端口号
- 或者停止占用端口的程序

### 4. 依赖安装失败
如果某些依赖安装失败：
- 确保使用最新版本的 pip
- 尝试使用国内镜像源
- 在虚拟环境中安装

## 性能优化

### GPU 加速
如果您的机器有 NVIDIA GPU：
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### 缓存优化
TTS 服务会自动缓存最近的合成结果，提高响应速度。

## 测试服务

使用 curl 测试服务是否正常工作：
```bash
curl -X POST http://localhost:8000/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "你好，世界！"}' \
  --output test.wav
```

如果成功，会在当前目录生成 `test.wav` 文件。

## 停止服务

按 `Ctrl+C` 停止 TTS 服务。

如果使用虚拟环境，记得退出虚拟环境：
```bash
deactivate
```