# 迷宫坦克：LLM 大 PK

一个在随机迷宫中进行的坦克对战游戏，支持由 AI 脚本/LLM 策略控制的坦克进行混战。

## 功能特性

- **随机迷宫生成**：使用固定种子确保可复现性
- **多坦克混战**：支持任意数量的坦克同时对战
- **AI 驱动系统**：每个坦克由独立的 Driver（AI 脚本）控制
- **实时战斗**：移动、射击、拾取金币并三选一强化
- **回放系统**：完整记录游戏过程，支持导出和回放
- **公平竞技**：Driver 在 WebWorker 沙箱中运行，确保隔离和公平

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

游戏将在 http://localhost:3000 打开

### 参与游戏

1. 下载范例 Driver 包（JSON 或 Python 格式）
2. 将 Driver 包拖拽到"参赛队伍"面板或点击"选择文件"导入
3. 导入成功后，坦克将显示为"准备就绪"状态
4. 至少需要 2 支队伍才能开始游戏
5. 点击"开始战斗"按钮开始对战

## Driver 包格式

Driver 包是一个 ZIP 文件，必须包含 `manifest.json` 文件：

```json
{
  "package": {
    "name": "my-tank-driver",
    "version": "1.0.0"
  },
  "team": {
    "name": "我的战队"
  },
  "tank": {
    "displayName": "我的坦克",
    "color": "#ff6b6b"
  },
  "engine": {
    "apiVersion": "1.0"
  },
  "policy": {
    "type": "rule-set",
    "payload": {
      "rules": [
        { "condition": "see_enemy", "action": "fire_at_enemy" },
        { "condition": "see_coin", "action": "move_to_coin" }
      ]
    }
  }
}
```

### 支持的策略类型

- `rule-set`：基于规则集的策略
- `fsm`：有限状态机
- `llm-hint`：基于 LLM 提示的策略

## 游戏规则

### 基础设置

- 地图大小：50×30 网格
- 游戏时长：180 秒
- 逻辑帧率：20Hz
- 决策频率：5Hz（每 200ms）

### 坦克属性

- 生命值：100
- 移动速度：1.0 格/秒
- 攻击力：10
- 防御力：0%
- 射击频率：1 发/秒
- 视野范围：8 格

### 强化系统

拾取金币后可以从以下三个选项中选择一个：

1. **速度 +10%**（最高提升至 200%）
2. **攻击 +15%**（线性叠加）
3. **防御 +10%**（最高 70% 伤害减免）

### 胜负判定

1. **优先**：场上只剩一辆坦克存活
2. **其次**：游戏时间结束时按积分排名

积分计算公式：
```
积分 = 击杀数 × 100 + 造成伤害 × 1 + 拾取金币 × 10 + 存活时间 × 0.1
```

### 出生保护

坦克出生后 2 秒内受到的伤害减半。

## 技术架构

### 核心技术栈

- **渲染引擎**：Phaser 3
- **物理引擎**：Matter.js
- **迷宫生成**：自定义算法（基于递归回溯）
- **随机种子**：seedrandom
- **沙箱隔离**：WebWorker

### 目录结构

```
src/
├── components/          # 游戏组件
│   └── GameScene.js    # 主游戏场景
├── drivers/            # Driver 相关
│   └── DriverSandbox.js # Driver 沙箱
├── utils/              # 工具类
│   └── MazeGenerator.js # 迷宫生成器
└── index.js            # 入口文件
```

## 开发指南

### 添加新的 Driver 类型

1. 在 `DriverSandbox.js` 中添加新的决策方法
2. 更新 `decide` 方法以支持新的策略类型
3. 在文档中说明新类型的用法

### 修改游戏配置

所有游戏配置都在 `GameScene.js` 文件的 `CONFIG` 对象中，包括：

- 迷宫尺寸
- 坦克属性
- 子弹属性
- 游戏时长
- 刷新频率等

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！