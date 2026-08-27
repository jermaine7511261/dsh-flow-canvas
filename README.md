# dsh-flow-canvas 🧭

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 可视化工作流编排插件。

拖拽节点编排 **Agent 任务、工具调用、条件分支、并行执行**，构建 DAG 工作流。基于 [React Flow](https://reactflow.dev/)，内置核心执行引擎和 SQLite 持久化。

## ✨ 功能特性

### 🎨 可视化画布
- **21+ 节点类型**：Agent、工具、代码、HTTP、条件、子工作流、循环、遍历、团队、触发器等
- **拖拽操作**：从分类面板拖拽节点到画布
- **实时配置**：点击节点编辑属性
- **执行日志**：底部面板实时显示执行状态

### 🏗️ 核心引擎
- **10 种核心节点**：start、end、condition、tool、agent、script、human-approval、subworkflow、foreach、parallel
- **DAG 编译器**：拓扑排序、环检测、语义哈希
- **执行引擎**：就绪节点调度、并发控制、中止支持

### 🔧 34 个标准工具
Agent 可通过对话创建、校验、执行工作流：

| 类别 | 工具 |
|------|------|
| **工作流 (10)** | workflow_nodes_list, workflow_draft_create/import/read/update/validate, workflow_validate, workflow_diff, workflow_publish, workflow_run |
| **任务 (5)** | task_create, task_assign, task_review, task_complete, task_list |
| **团队 (4)** | team_create, team_add_member, team_list, team_run |
| **研究 (2)** | deep_research, workflow_execute |
| **质量 (1)** | evidence_check |
| **验证 (1)** | verified_ralph |
| **图表 (1)** | generate_diagram |
| **其他** | flow_canvas, canvas 画布操作 |

### 📋 工作流规范 (`dsh.flow-canvas/v1`)
```json
{
  "apiVersion": "dsh.flow-canvas/v1",
  "kind": "WorkflowTemplate",
  "metadata": { "id": "wf-xxx", "name": "我的工作流" },
  "spec": {
    "inputSchema": { "type": "object" },
    "outputSchema": { "type": "object" },
    "nodes": [...],
    "edges": [...],
    "outputs": {}
  }
}
```

### 💾 持久化
- **SQLite** 存储（JSON 文件降级）
- **版本管理** + 语义哈希
- **执行历史** + 检查点
- **草稿 → 发布** 工作流

### 🎯 高级能力
- **多模型团队**：持久化团队 + 成员独立模型 + Lead 动态规划
- **持久任务账本**：任务 CRUD + 审查循环 + 崩溃恢复
- **证据优先门控**：Agent 声称前必须提供证据
- **自适应深度研究**：控制论闭环 + 边际增益 + 三态证据
- **验证器 Ralph**：独立验证器评分 + 可观察轨迹
- **架构图生成**：5 种图类型（架构/工作流/序列/数据流/生命周期）

### 🎨 界面
- **Dark/Light 主题**：一键切换，状态保存
- **右键菜单**：节点 + 画布上下文菜单
- **复制/粘贴**：Ctrl+C/V + 右键
- **自动布局**：Ctrl+G 一键排列

## 📦 安装

```bash
dsh plugin --profile web add "path/to/dsh-flow-canvas"
```

或从 git：
```bash
dsh plugin --profile web add "git+https://github.com/jermaine7511261/dsh-flow-canvas.git"
```

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 构建
node scripts/build.mjs

# 启动 DSH
dsh --profile web
```

## 📁 架构

```
src/
├── core/                    # 框架无关核心（纯 JS）
│   ├── nodes.cjs           # 10 种核心节点定义
│   ├── compiler.cjs        # 工作流编译器（DAG 校验、拓扑排序）
│   ├── engine.cjs          # DAG 执行引擎（并发控制、中止、状态机）
│   └── index.cjs           # 核心模块导出
├── server/                  # 服务端插件
│   ├── index.ts            # 插件入口（34 个工具、设置、系统提示）
│   ├── sqlite.cjs          # SQLite 持久化（草稿、版本、运行、检查点）
│   ├── converter.cjs       # 画布 ↔ WorkflowTemplate 转换
│   ├── taskLedger.cjs      # 持久任务账本（状态机、审查、崩溃恢复）
│   └── teamStore.cjs       # 团队管理（成员、模型、工具策略）
└── client/                  # 客户端（React Flow 画布）
    ├── entry.tsx           # 插件入口（hash 检测、overlay、设置）
    ├── FlowCanvas.tsx      # 主画布组件
    ├── nodes/              # 节点组件（20+ 类型）
    ├── panels/             # 侧面板（节点、属性、团队、任务、Token）
    ├── store/              # Zustand 状态管理
    ├── utils/              # DAG 校验、执行、持久化、API
    └── styles/             # CSS（Dark/Light 主题）
```

## 🧩 节点类型

### 核心（10 种）
| 类型 | 标题 | 说明 |
|------|------|------|
| `core.start` | 开始 | 工作流入口 |
| `core.end` | 结束 | 工作流出口 |
| `core.agent` | Agent | 委托子代理执行 |
| `core.tool` | 工具 | 调用 DSH 工具 |
| `core.condition` | 条件 | 条件分支（truthy/eq/gt/contains/regex） |
| `core.script` | 脚本 | 确定性 JSON 变换 |
| `core.human-approval` | 人工审批 | 暂停等待确认 |
| `core.subworkflow` | 子工作流 | 引用子工作流 |
| `core.foreach` | 遍历 | 遍历数组 |
| `core.parallel` | 并行 | 并行执行 |

### 扩展（11+ 种）
Agent、工具、代码、HTTP、条件、变量、子工作流、循环、遍历、团队、合并、触发器（Cron/Webhook/文件监听/Git 事件）

## 📄 许可证

MIT

## Credits

Architecture inspired by:
- [GM-HZ/dsh-dag-workflow](https://github.com/GM-HZ/dsh-dag-workflow) — DAG engine, compiler, node definitions
- [PiedPiper911/dsh-workflow-canvas](https://github.com/PiedPiper911/dsh-workflow-canvas) — Transport-agnostic model
- [Lhy723/dsh-agent-canvas](https://github.com/Lhy723/dsh-agent-canvas) — Agent visualization
