# dsh-flow-canvas 🧭

Visual workflow builder for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).

Drag and drop nodes to orchestrate **agent tasks, tool calls, conditional branches, and parallel execution** into a DAG workflow. Powered by [React Flow](https://reactflow.dev/) and backed by a core execution engine with SQLite persistence.

## Features

### 🎨 Visual Canvas
- **20+ node types**: Agent, Tool, Code, HTTP, Condition, SubFlow, Loop, Iteration, Team, Trigger, etc.
- **Drag & drop** from categorized node panel
- **Real-time** node configuration with properties panel
- **Execution log** panel with status tracking

### 🏗️ Core Engine (参考 GM-HZ/dsh-dag-workflow)
- **10 core node definitions**: start, end, condition, tool, agent, script, human-approval, subworkflow, foreach, parallel
- **DAG compiler**: Topological sort, cycle detection, semantic hashing
- **Execution engine**: Ready-node scheduling, concurrency control, abort support

### 🔧 10 Standard Workflow Tools
Agent can create, validate, and execute workflows through conversation:

| Tool | Description |
|------|-------------|
| `workflow_nodes_list` | List available node types |
| `workflow_draft_create` | Create a new workflow draft |
| `workflow_draft_import` | Import workflow template |
| `workflow_draft_read` | Read a draft |
| `workflow_draft_update` | Update a draft |
| `workflow_draft_validate` | Validate a draft |
| `workflow_validate` | Validate a published workflow |
| `workflow_diff` | Compare two workflow versions |
| `workflow_publish` | Publish draft as immutable version |
| `workflow_run` | Execute a published workflow |

### 📋 WorkflowTemplate Spec (`dsh.flow-canvas/v1`)
```json
{
  "apiVersion": "dsh.flow-canvas/v1",
  "kind": "WorkflowTemplate",
  "metadata": { "id": "wf-xxx", "name": "My Workflow" },
  "spec": {
    "inputSchema": { "type": "object" },
    "outputSchema": { "type": "object" },
    "nodes": [...],
    "edges": [...],
    "outputs": {}
  }
}
```

### 💾 Persistence
- **SQLite** storage (fallback to JSON files)
- **Version management** with semantic hashing
- **Execution history** and checkpoints
- **Draft → Publish** workflow

## Install

```bash
dsh plugin --profile web add "path/to/dsh-flow-canvas"
```

Or from git:
```bash
dsh plugin --profile web add "git+https://github.com/YOUR_USER/dsh-flow-canvas.git"
```

## Development

```bash
# Install dependencies
npm install

# Build
node scripts/build.mjs

# Start DSH
dsh --profile web
```

## Architecture

```
src/
├── core/                    # Framework-independent core (plain JS)
│   ├── nodes.cjs           # 10 core node definitions
│   ├── compiler.cjs        # Workflow compiler (DAG validation, topological sort)
│   ├── engine.cjs          # DagWorkflowEngine (execution, concurrency, abort)
│   └── index.cjs           # Core module exports
├── server/                  # Server-side plugin
│   ├── index.ts            # Plugin entry (11 tools, settings, system prompt)
│   ├── sqlite.cjs          # SQLite persistence (drafts, versions, runs, checkpoints)
│   └── converter.cjs       # Canvas ↔ WorkflowTemplate converter
└── client/                  # Client-side (React Flow canvas)
    ├── entry.tsx           # Plugin entry (hash detection, overlay, settings)
    ├── FlowCanvas.tsx      # Main canvas component
    ├── nodes/              # Node components (20+ types)
    ├── panels/             # Side panels (Node, Props, Team, Task, Token)
    ├── store/              # Zustand stores
    ├── utils/              # DAG validation, execution, persistence, API
    └── styles/             # CSS
```

## Node Types

### Core (10 types)
| Type | Title | Description |
|------|-------|-------------|
| `core.start` | 开始 | Workflow entry point |
| `core.end` | 结束 | Workflow exit point |
| `core.agent` | Agent | Delegate to sub-agent |
| `core.tool` | 工具 | Call DSH tool |
| `core.condition` | 条件 | Conditional branching (truthy/eq/gt/contains/regex) |
| `core.script` | 脚本 | Deterministic JSON transform |
| `core.human-approval` | 人工审批 | Pause for human confirmation |
| `core.subworkflow` | 子工作流 | Reference sub-workflow |
| `core.foreach` | 遍历 | Iterate over array |
| `core.parallel` | 并行 | Parallel execution |

### Extended (10+ types)
Agent, Tool, Code, HTTP, Condition, Variable, SubFlow, Loop, Iteration, Team, Merge, Trigger (Cron/Webhook/FileWatch/GitEvent)

## Credits

Architecture inspired by:
- [GM-HZ/dsh-dag-workflow](https://github.com/GM-HZ/dsh-dag-workflow) — DAG engine, compiler, node definitions
- [PiedPiper911/dsh-workflow-canvas](https://github.com/PiedPiper911/dsh-workflow-canvas) — Transport-agnostic model
- [Lhy723/dsh-agent-canvas](https://github.com/Lhy723/dsh-agent-canvas) — Agent visualization

## License

MIT
