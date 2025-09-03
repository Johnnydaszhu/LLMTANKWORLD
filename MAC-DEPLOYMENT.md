# Step-Audio2-Mini2 快速部署指南

## 🚀 macOS 快速启动

### 1. 下载模型（需要登录 Hugging Face）

1. 访问 [Step-Audio2-Mini2 模型页面](https://huggingface.co/stepfun-ai/Step-Audio2-Mini2)
2. 登录或注册 Hugging Face 账号
3. 点击 "Download repository" 或下载以下文件：
   - `step-audio2-mini2.pt` (主要模型文件，约 1.2GB)

4. 将下载的文件放在：
   ```
   LLMTANKWORLD/Step-Audio2/models/step-audio2-mini2.pt
   ```

### 2. 启动 TTS 服务

在终端中运行（确保在项目根目录）：

```bash
./start-step-audio2-mac.sh
```

脚本会自动：
- 克隆 Step-Audio2 仓库
- 创建 Python 虚拟环境
- 安装所需依赖
- 启动 TTS 服务在 http://localhost:8000

### 3. 验证服务

打开浏览器访问：http://localhost:8000

应该看到服务状态页面，显示模型是否已加载。

### 4. 在游戏中使用

1. 确保游戏和 TTS 服务都在运行
2. 勾选 "🎤 实时解说"
3. 如果模型已加载，勾选 "🤖 使用 Step-Audio2"

## 📋 完整手动部署步骤

如果自动脚本出现问题，可以手动执行：

```bash
# 1. 克隆仓库
git clone https://github.com/stepfun-ai/Step-Audio2.git
cd Step-Audio2

# 2. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 3. 安装依赖
pip install torch torchvision torchaudio
pip install flask flask-cors transformers numpy scipy soundfile

# 4. 启动服务（确保模型文件在 models/ 目录下）
python tts_server.py
```

## 🔧 故障排除

### 1. 模型文件权限问题
```bash
chmod 644 Step-Audio2/models/step-audio2-mini2.pt
```

### 2. Python 版本问题
确保使用 Python 3.8+：
```bash
python3 --version
```

### 3. 端口被占用
如果 8000 端口被占用，修改 `tts_server.py` 中的端口号。

### 4. CUDA 内存不足
如果没有 GPU 或显存不足，脚本会自动使用 CPU 模式。

## 🎮 游戏内设置

- **🎤 实时解说**: 启用/禁用游戏解说
- **🤖 使用 Step-Audio2**: 使用高质量语音合成（需要模型）

当 Step-Audio2 服务可用时，选项会高亮显示；否则会变灰。

## 📊 性能对比

| 特性 | Web Speech API | Step-Audio2-Mini2 |
|------|---------------|-------------------|
| 质量 | 一般 | 高质量 |
| 延迟 | 低 | 中等 |
| 离线 | 支持 | 需要服务 |
| 资源 | 低 | 中等 |

## 📝 注意事项

1. 模型文件较大（约 1.2GB），请确保有足够磁盘空间
2. 首次合成可能需要几秒钟加载模型
3. 服务运行时会占用一定内存
4. 可以随时在 Web Speech API 和 Step-Audio2 之间切换