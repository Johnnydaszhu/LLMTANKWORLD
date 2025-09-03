#!/bin/bash

# Step-Audio2-Mini2 启动脚本
# 请确保已经按照 MAC-DEPLOYMENT.md 下载并配置好了模型

echo "🔊 Step-Audio2-Mini2 启动脚本"
echo "================================"

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装 Python3"
    exit 1
fi

# 检查虚拟环境
if [ ! -d "venv" ]; then
    echo "📦 创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔄 激活虚拟环境..."
source venv/bin/activate

# 安装依赖
echo "📚 安装依赖..."
pip install -r requirements.txt

# 检查模型文件
if [ ! -f "models/step-audio2-mini2.pt" ]; then
    echo "⚠️  模型文件不存在：models/step-audio2-mini2.pt"
    echo "请按照 MAC-DEPLOYMENT.md 下载模型文件"
    exit 1
fi

# 启动服务
echo "🚀 启动 Step-Audio2-Mini2 服务..."
python3 app.py