# Step-Audio2 TTS 配置说明

## 🎯 功能概述

LLMTANKWORLD 现已支持完整的 Step-Audio2 TTS 配置，包括：

1. **API 端点配置** - 自定义 TTS 服务地址
2. **模型切换** - 支持多个 Step-Audio2 模型动态切换
3. **源选择** - 本地模型 / 云端 API 双模式支持
4. **实时状态** - 服务状态和模型信息显示

## 🔧 配置选项

### 1. API 端点配置

- **默认端点**: `http://localhost:8000/tts`
- **配置位置**: 游戏界面右上角 "🤖 使用 Step-Audio2" 选项下
- **保存方式**: 自动保存到浏览器 localStorage

### 2. 模型选择

当前支持的模型：
- **Step-Audio2-Mini2** (1.2GB) - 轻量级模型，响应快
- **Step-Audio2** (2.1GB) - 标准模型，质量更高

### 3. TTS 源选择

- **本地模型**: 使用本地部署的 Step-Audio2 服务
- **云端 API**: 使用 StepFun 官方 API (需要 API Key)

## 📋 API 端点

### 基础端点
- `GET /health` - 健康检查
- `POST /tts` - 文本转语音

### 模型管理
- `GET /model/list` - 列出可用模型
- `POST /model/load` - 加载模型
- `POST /model/switch` - 切换模型

### 请求示例

#### 切换模型
```bash
curl -X POST http://localhost:8000/model/switch \
  -H "Content-Type: application/json" \
  -d '{"model_path": "models/step-audio2.pt"}'
```

#### 获取模型列表
```bash
curl http://localhost:8000/model/list
```

## 🎮 游戏内使用

1. 启动游戏和 TTS 服务
2. 勾选 "🎤 实时解说"
3. 勾选 "🤖 使用 Step-Audio2"
4. 在展开的选项中配置：
   - 选择 TTS 源（本地/云端）
   - 配置 API 端点
   - 选择模型
   - 输入 API Key（如使用云端）

## 🔍 故障排除

### 1. 服务不可用
- 检查 TTS 服务是否运行：`curl http://localhost:8000/health`
- 确认端点配置正确
- 查看浏览器控制台错误信息

### 2. 模型切换失败
- 确认模型文件已下载并放在正确位置
- 检查模型文件权限
- 确保有足够的内存加载模型

### 3. 云端 API 失败
- 验证 API Key 是否正确
- 检查网络连接
- 确认 API Key 配额充足

## 💡 高级功能

### 实时状态监控
游戏界面会显示：
- 服务状态（可用/不可用）
- 当前使用的模型
- TTS 源（本地/云端）

### 配置持久化
所有配置都会自动保存：
- API 端点
- 选择的模型
- API Key
- TTS 源设置

## 📝 注意事项

1. 首次切换大型模型可能需要几秒钟加载时间
2. 模型文件较大，请确保有足够的磁盘空间
3. 云端 API 使用会产生费用，请关注配额使用情况
4. 本地模型需要 GPU 或足够的 CPU 内存支持