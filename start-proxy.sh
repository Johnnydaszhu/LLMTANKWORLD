#!/bin/bash

# StepFun Realtime API Proxy 启动脚本

echo "🔌 StepFun Realtime API Proxy"
echo "================================"

# 检查 Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 需要 Python3"
    exit 1
fi

# 检查 websockets 模块
if ! python3 -c "import websockets" &> /dev/null; then
    echo "📦 安装依赖..."
    pip3 install websockets
fi

# 启动代理服务
echo ""
echo "🚀 启动 WebSocket 代理服务..."
echo "服务地址: ws://localhost:8765"
echo "按 Ctrl+C 停止服务"
echo ""

python3 websocket-proxy.py