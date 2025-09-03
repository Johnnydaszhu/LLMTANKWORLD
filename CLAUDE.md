# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production (outputs to `dist/`)
- `npm run preview` - Preview production build
- `npm start` - Alternative command to start dev server

### Development Server
- Runs on port 3000 with `--host` flag enabled
- Hot reload enabled for development
- No linting or type checking commands configured

## Architecture Overview

LLMTANKWORLD is a competitive tank battle game where AI-controlled tanks battle in procedurally generated mazes. The architecture follows a modular design with clear separation between game logic, AI execution, and user interface.

### Core Components

1. **Game Engine** (`src/components/GameScene.js`)
   - Built on Phaser.js 3.70.0 with Matter.js physics
   - 20Hz game loop with 5Hz AI decision ticks
   - Manages maze generation, tank physics, collision detection
   - Handles coin spawning, bullet physics, and upgrade system

2. **AI Driver System** (`src/drivers/DriverSandbox.js`)
   - WebWorker-based sandbox for secure AI isolation
   - Supports three policy types: rule-set, FSM, and LLM-hint
   - 50ms decision timeout to ensure fair gameplay
   - Prevents cheating through sandbox isolation

3. **Application Controller** (`src/index.js`)
   - Entry point using ES modules
   - Handles team management and driver package validation
   - Manages file uploads and UI state
   - Integrates with Phaser game engine

4. **Maze Generation** (`src/utils/MazeGenerator.js`)
   - Recursive backtracking algorithm
   - Uses seedrandom for reproducible mazes
   - Provides walkable position detection for entity spawning

### Key Configuration (CONFIG object)
```javascript
{
  maze: { width: 50, height: 30, cellSize: 20, seed: 'llm-tank-world' },
  tank: { hp: 100, speed: 1.0, atk: 10, def: 0, rof: 1, sight: 8 },
  bullet: { speed: 4.0, damage: 10 },
  game: { tickRate: 20, aiTickRate: 5, duration: 180 }
}
```

## Game Mechanics

### Driver Package Format
AI drivers are distributed as ZIP files containing:
- `manifest.json` - Metadata and policy configuration
- Driver code (JavaScript, Python reference, or policy definitions)
- Supported policy types: rule-set, fsm, llm-hint

### Game Flow
1. Maze generated with fixed seed for reproducibility
2. Tanks spawn at random walkable positions
3. AI drivers make decisions every 200ms (5Hz)
4. Tanks collect coins for upgrades (speed/attack/defense)
5. Game ends after 180 seconds or when one tank remains

### Physics System
- Top-down 2D view with zero gravity
- Matter.js handles collision detection
- Grid-based movement (1.0 cells/second base speed)
- Bullets travel at 4.0 cells/second

## Important Implementation Details

### State Management
- Game state managed within GameScene class
- Team state tracked in index.js with Map data structures
- Driver state isolated in individual WebWorkers

### Security Considerations
- All AI code runs in WebWorker sandbox
- No direct DOM or network access for drivers
- 50ms timeout prevents infinite loops
- Strict validation of driver packages

### Reproducibility
- Fixed random seed ensures identical maze generation
- Deterministic physics simulation
- Complete game state logging for replay system

## File Structure Notes
- `public/assets/` - Contains minimal game assets (tank.svg)
- No CSS framework used - inline styles in HTML
- ES modules used throughout (no CommonJS)
- No build pipeline beyond Vite's default behavior
- 每个文件尽量不要超过 500 行代码

## Testing and Debugging
- No testing framework currently configured
- Debug mode can be enabled in Matter.js config
- Game state can be inspected through browser dev tools
- Driver errors logged to console with team information