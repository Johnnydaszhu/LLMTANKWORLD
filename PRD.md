# 《迷宫坦克：LLM 大 PK》— 精简 PRD（给 LLM / 参赛者看的）

## 0. 目标

在**随机迷宫**中，若干坦克由各自的 **Driver（AI 脚本/LLM 策略）** 控制，进行混战。捡金币可**即时三选一强化**（速度/攻击/防御）。以**最后存活**或**积分最高**判胜。要求**可复现、可回放**，便于公平对比不同 LLM 的智能水准。

---

## 1. 最小可玩范围（MVP）

* **单位**：2–8 台坦克 + 炮弹 + 金币
* **动作**：前/后/左/右/停、四向开火、拾取后选择升级项
* **循环**：固定 Tick（推荐 20Hz 逻辑），到时判分或剩 1 台即结束
* **复现**：固定随机种子、固定地图、固定 Driver → 结果一致
* **回放**：事件日志可逐帧重放

---

## 2. 地图与迷宫

* **生成**：`labyrinth (mazejs)` 生成网格迷宫（MIT）
* **尺寸**：默认 `50×30`（可配），只在**可通行格**生成出生点/金币
* **随机**：使用 `seedrandom`（MIT）统一播种，支持外部指定 `seed`

---

## 3. 单位与属性（默认基线，可在 config 中改）

* **坦克**：`HP=100`，`Speed=1.0`（格/秒），`Atk=10`，`Def=0%`，`RoF=1 发/秒`，`Sight=8 格`
* **炮弹**：直线飞行，`Speed=4.0`（格/秒），撞墙或命中即消失
* **金币**：开局在 5% 可通行格生成；此后**限流刷新**（每 5s，≤50 枚上限）

---

## 4. 强化系统（拾取后**即时选择**）

* 三选一：

  1. **速度 +10%**（上限 2.0× 基线）
  2. **攻击 +15%**（线性叠加）
  3. **防御 +10%**（伤害减免，封顶 70%）
* 稀有金币/临时 Buff（可选，非 MVP）

---

## 5. 行为与规则

* **动作集合**（离散）

  * `MOVE_{UP,DOWN,LEFT,RIGHT,STOP}`
  * `FIRE_{UP,DOWN,LEFT,RIGHT}`（与移动可并行；冷却中忽略）
  * `UPGRADE_{SPEED,ATK,DEF}`（仅在拾取金币后一次性有效）
* **碰撞**：坦克/墙/炮弹采用**网格+AABB**（MVP 简化）
* **出生保护**：出生后 2 秒内伤害减半
* **胜负**：

  * **优先**：剩 1 台存活
  * **否则**（到时）：按**积分**判定

    * 计分 = `击杀×100 + 造成伤害×1 + 拾金×10 + 存活时长(秒)×0.1`

---

## 6. 技术栈与开源库映射（“至少 MIT”）

> 可按下表直接选用；括号内为**可替换项**。

| 模块        | 主要库（许可证）                                          | 用途 / 说明                                  |
| --------- | ------------------------------------------------- | ---------------------------------------- |
| 迷宫生成      | **labyrinth (mazejs)** / MIT                      | 生成可通行/阻挡网格，支持宽高与风格参数                     |
| 随机播种      | **seedrandom** / MIT                              | 统一 RNG，保证可复现/回放                          |
| 渲染引擎      | **Phaser 3** / MIT（或 **PixiJS** / MIT）            | 2D Canvas/WebGL 渲染，示例多、上手快（Pixi 适合自定制管线） |
| 物理/碰撞     | **Matter.js** / MIT（或 **Planck.js** / MIT）        | 简化刚体/碰撞/传感器（Planck 更贴近 Box2D）            |
| 寻路（可选）    | **EasyStar.js** / MIT（或 **PathFinding.js** / MIT） | 为 Driver 提供网格路径点（若策略需 A\*）               |
| ECS（可选）   | **bitECS** / MIT（或 **becsy** / MIT）               | 结构化管理实体/组件/系统，提高可维护性                     |
| 并发/隔离     | **WebWorker** + **Comlink** / Apache-2.0          | Driver 在 Worker 中运行，主线程渲染；RPC 简化通信       |
| 联机（非 MVP） | **Colyseus** / MIT（或 **Socket.IO** / MIT）         | 房间/状态同步/匹配（若做在线赛事）                       |

> 备注：Comlink 为 Apache-2.0（宽松许可，含专利授权），其余均 MIT。

---

## 7. LLM Driver（AI 脚本）接口（重点）

**运行方式**：每台坦克绑定一个 **Driver**，在 **WebWorker** 沙箱内执行。平台按固定频率广播观测，Driver 返回动作。

* **频率与时序**

  * 逻辑 Tick：**20Hz**（每 50ms）
  * 观测推送给 Driver：**5Hz**（每 200ms）
  * 决策预算：`≤50ms`；超时则沿用上一帧动作（或 `STOP`）

* **观测（Observation）** *只读、有限制字段，示例结构*

  ```
  tick, self(x,y,hp,speed,atk,def,cooldown),
  enemies[ {id,x,y,hp,dir} ],
  bullets[ {x,y,dir} ],
  coins[ {x,y} ],
  mazeMeta(宽高,墙体哈希或可通行位集),
  last_events[...]
  ```

  > 禁止访问 DOM/网络/时间以外的全局状态；随机由平台注入（播种）。

* **动作（Action）**

  ```
  { move: UP|DOWN|LEFT|RIGHT|STOP,
    fire: UP|DOWN|LEFT|RIGHT|NONE,
    upgrade: SPEED|ATK|DEF|NONE }
  ```

* **公平性约束**

  * **不可网络请求、不可动态 import**；仅 `postMessage` 通信
  * 运行时内存/CPU 卫兵（超限即淘汰该帧动作）
  * 平台对提交脚本做静态扫描（黑名单关键字）

---

## 8. 复盘与评测

* **事件日志**：`[tick, actorId, eventType(hit/kill/coin/upgrade/death/… ), payload]`
* **回放**：同一 `seed + 配置 + Driver` 可重演
* **指标面板**：K / 伤害 / 拾金 / 存活时长 / 决策超时率
* **赛制（线下/本地）**：固定**种子集**对每个 Driver 跑 N 局，取平均分；同分看剩余 HP、总位移

---

## 9. 配置（示例字段）

```
seed, maze{width,height,style}, maxPlayers,
tickMs=50, decisionHz=5, durationSec=180,
coin{initialCoverage=0.05, spawnEverySec=5, max=50},
tank{hp,speed,atk,defMax=0.7,rof,sight},
bullet{speed,life},
scoring{k,dmg,coins,survivalFactor}
```

---

## 10. UI/体验（MVP）

* 顶部：计时器 + 当前种子
* 右上：记分板（K/伤害/拾金/HP/超时%）
* 左下：当前观战对象（可切换）
* 结果页：排行榜 + 导出回放

---

## 11. 验收标准（MVP）

* 单机 8 台坦克、`50×30` 地图、60 FPS 渲染、20Hz 逻辑稳定运行
* 同一 `seed + Driver` **结果一致**（伤害/击杀/积分误差=0）
* 支持**导出/导入回放**并逐帧播放
* 至少提供 **2 个示例 Driver**（贪心拾金、保守风筝）

---

### 选型建议（落地优先）

* **基线组合**：Phaser 3（渲染） + Matter.js（碰撞/传感） + labyrinth（迷宫） + seedrandom（可复现） + WebWorker(+Comlink)（AI 隔离）
* **需要更强可定制**时：PixiJS + Planck.js + bitECS + PathFinding.js

> 如需，我可以基于此 PRD 输出一份“赛事包规范”（提交格式、评测脚本 I/O、回放文件结构）用于公开赛。
