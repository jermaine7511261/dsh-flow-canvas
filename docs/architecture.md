# dsh-flow-canvas 架构文档

> 版本: 0.1.0 | 更新日期: 2025-08-25

## 概述

dsh-flow-canvas 是一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 可视化工作流编排插件。用户通过拖拽节点构建 DAG 工作流，编译器校验语义正确性后由执行引擎运行。

## 三层架构

```
┌─────────────────────────────────────────┐
│  Client (React Flow 画布)               │
│  src/client/                            │
│  ─ FlowCanvas, 节点组件, 面板, 状态管理  │
├─────────────────────────────────────────┤
│  Server (DSH 插件层)                    │
│  src/server/                            │
│  ─ 工具注册, 设置, 持久化, SQLite       │
├─────────────────────────────────────────┤
│  Core (框架无关纯 JS)                   │
│  src/core/                              │
│  ─ 类型, 节点定义, 编译器, 引擎, 表达式  │
└─────────────────────────────────────────┘
```

### Core 层 (`src/core/`)

框架无关的纯 JS 模块，可独立于 DSH 和 React 使用。

| 模块 | 文件 | 职责 |
|------|------|------|
| **types** | `types.ts` | 全部类型定义：JSON 基础类型、WorkflowTemplate、节点定义、网关接口、运行状态、事件、诊断 |
| **nodes** | `nodes.ts` | 10 种核心节点的 `WorkflowNodeDefinition`，含 `execute()` 实现 |
| **compiler** | `compiler.ts` | 将 `WorkflowTemplate` 编译为 `CompiledWorkflow`（DAG 校验、拓扑排序、环检测、语义哈希） |
| **engine** | `engine.ts` | `DagWorkflowEngine` 类：就绪节点调度、并发控制、中止、检查点持久化、恢复 |
| **expression** | `expression.ts` | 确定性表达式 DSL（`evaluate()`），替代 `new Function()` / `eval` |
| **json** | `json.ts` | Lossless JSON 物化（`snapshotJsonValue`），防止原型污染 |
| **run-store** | `run-store.ts` | `InMemoryWorkflowRunStore` — 内存运行记录存储（含 CAS 检查点提交） |

### Server 层 (`src/server/`)

DSH 插件入口，注册工具和配置。

- **插件注册**: `apply(ctx)` 注册 `flow_canvas` 工具 + 34 个标准工具
- **配置系统**: `~/.dsh/flow-canvas.json` + 环境变量覆盖 + DSH Settings UI
- **持久化**: SQLite（`sqlite.cjs`）+ JSON 文件降级
- **工具集**: 10 个工作流工具、5 个任务账本工具、4 个团队工具、证据门控、深度研究、验证器 Ralph、图表生成

### Client 层 (`src/client/`)

基于 React Flow 的可视化画布。

- **FlowCanvas**: 主画布组件，集成节点拖拽、连线、缩放
- **节点组件**: 20+ 种节点渲染（Agent、Tool、Code、HTTP、Condition 等）
- **面板**: NodePanel（节点选择）、PropsPanel（属性编辑）、TeamPanel、TaskLedgerPanel、LogPanel
- **状态管理**: Zustand stores（executionStore, workflowStore）
- **工具**: DAG 校验、执行器、布局算法（dagre）、模板系统

## 10 种核心节点

| 类型 | 标题 | 角色 | 输出端口 | 能力 | 重试模式 |
|------|------|------|----------|------|----------|
| `core.start` | 开始 | start | `success` | — | safe |
| `core.end` | 结束 | end | `success` | — | safe |
| `core.condition` | 条件 | regular | `true`, `false` | — | safe |
| `core.tool` | 工具 | regular | `success`, `error` | `dsh.tools.execute` | safe |
| `core.agent` | Agent | regular | `success`, `error` | `dsh.subagents.start` | safe |
| `core.script` | 脚本 | regular | `success` | — | idempotent |
| `core.human-approval` | 人工审批 | regular | `approved`, `rejected` | `dsh.approval.request` | never |
| `core.subworkflow` | 子工作流 | regular | `success`, `error` | `dsh.workflows.execute` | safe |
| `core.foreach` | 遍历 | regular | `body`, `done` | — | safe |
| `core.parallel` | 并行 | regular | `branch` | — | safe |

### 节点定义结构

每个 `WorkflowNodeDefinition` 包含：

- **type/version**: 唯一类型标识和版本号
- **role**: `start` | `end` | `regular`
- **configSchema**: JSON Schema 校验节点配置
- **inputSchema / outputSchema**: 输入输出类型约束
- **outputPorts / requiredOutputPorts**: 端口声明与强制要求
- **capabilities**: 声明所需能力（如 `dsh.tools.execute`）
- **retry**: 重试策略（`never` | `safe` | `idempotent`）
- **execute(context)**: 执行函数

## 编译流水线

`compileWorkflow(template, registry)` 执行以下步骤：

```
1. 结构校验 ──→ apiVersion, kind, metadata.id, metadata.name, nodes 非空
2. 需求声明校验 ──→ spec.requires 去重检查
3. 节点解析 ──→ 解析 uses@version，查注册表，收集能力需求
4. 边校验 ──→ 重复 ID 检测、端口存在性、requiredOutputPorts 检查
5. 环检测 ──→ Kahn 拓扑排序，order.length < nodes.length → 环
6. 可达性分析 ──→ start BFS 检测不可达节点 + end 反向 BFS 检测无法到达终节点
7. Binding 校验 ──→ output binding 必须严格上游，必填 binding 缺失检测
8. Config 语义校验 ──→ 调用 validateConfig()
9. 需求声明校验 ──→ 节点能力需求是否在 spec.requires 中声明
10. 语义哈希 ──→ SHA-256(spec) 前 16 位
11. 构建 CompiledWorkflow ──→ nodesMap, edgesMap, order, validators
```

### 诊断系统

编译器返回 `WorkflowDiagnostic[]`，每条包含：

```typescript
{
  code: string       // 如 'CYCLE_DETECTED', 'UNREACHABLE_NODE'
  severity: 'error' | 'warning'
  message: string    // 人类可读描述
  nodeId?: string    // 关联节点
  path?: (string|number)[]  // JSON Path
}
```

任何 `severity === 'error'` 存在时，编译失败。

## 调度语义

`DagWorkflowEngine` 基于 DAG 拓扑顺序调度执行：

```
execute(inputs)
  ├─ createRunRecord()          // 持久化运行记录
  ├─ persistCheckpoint()        // 初始检查点
  └─ while (有就绪节点)
       ├─ updateReadyNodes()    // 前驱全部终态 → 就绪
       ├─ 批量执行 (maxConcurrentNodes)
       │    ├─ shouldSkipNode() // 条件分支跳过
       │    ├─ executeNode()    // 收集输入 → 解析 binding → scopeNodeServices → 执行
       │    ├─ snapshotJsonValue() // 防原型污染
       │    ├─ checkOutputSize()   // 超限检查
       │    └─ 事件提交
       └─ persistCheckpoint()   // 批次后检查点
```

### 就绪条件

节点进入 `ready` 状态的前提：所有前驱节点处于终态（`succeeded` / `skipped` / `failed` / `cancelled`）。

### 条件分支跳过

当条件节点的 `false` 端口被选中时，下游 `false` 边上的节点自动标记为 `skipped`。

## 节点状态（9 种）

| 状态 | 说明 |
|------|------|
| `pending` | 等待前驱完成 |
| `ready` | 前驱已全部终态，等待调度 |
| `running` | 正在执行 |
| `waiting` | 暂停等待外部信号（如人工审批） |
| `succeeded` | 执行成功 |
| `failed` | 执行失败 |
| `cancelled` | 被中止 |
| `skipped` | 条件分支未选中，跳过 |
| `needs_attention` | 需要人工介入 |

## 运行状态

| 状态 | 说明 |
|------|------|
| `pending` | 初始状态 |
| `running` | 正在执行 |
| `completed` | 全部完成 |
| `failed` | 有节点失败 |
| `cancelled` | 被中止 |
| `paused` | 暂停（如等待审批） |

## Gateway 接口

引擎通过网关（Gateway）与外部系统交互，每个网关定义一个接口：

### Tool Gateway (`WorkflowToolGateway`)

```typescript
interface WorkflowToolGateway {
  execute(request: WorkflowToolRequest): Promise<JsonValue>
}
```

调用 DSH 注册的工具，传入 `toolName`、`input`、`signal`。

### Agent Gateway (`WorkflowAgentGateway`)

```typescript
interface WorkflowAgentGateway {
  execute(request: WorkflowAgentRequest): Promise<JsonValue>
}
```

启动子代理执行任务，支持 `provider`、`prompt`、`model`、`outputSchema`、`maxDepth`。

### Secret Gateway (`WorkflowSecretGateway`)

```typescript
interface WorkflowSecretGateway {
  resolve(ref: string, context: { runId: string; nodeId: string; signal: AbortSignal }): Promise<JsonValue>
}
```

解析 Secret 引用为实际值。仅通过 `secret` binding 引用，不内联存储。

### Approval Gateway (`WorkflowApprovalGateway`)

```typescript
interface WorkflowApprovalGateway {
  request(request: WorkflowApprovalRequest): Promise<WorkflowApprovalOutcome>
}
```

暂停执行等待人工确认。返回 `allowed-once` | `rejected` | `cancelled` | `unavailable`。

### Subworkflow Gateway (`WorkflowSubworkflowGateway`)

```typescript
interface WorkflowSubworkflowGateway {
  execute(request: WorkflowSubworkflowRequest): Promise<WorkflowSubworkflowResult>
}
```

引用并执行另一个工作流，支持 `depth` 和 `depthLimit`（默认 8 层）递归限制。

## 能力作用域裁剪

引擎通过 `scopeNodeServices()` 裁剪每个节点可用的服务：

```typescript
function scopeNodeServices(services, capabilities): WorkflowNodeServices {
  const allowed = new Set(capabilities)
  return {
    tools:      allowed.has('dsh.tools.execute')    ? services.tools      : undefined,
    agents:     allowed.has('dsh.subagents.start')   ? services.agents     : undefined,
    approvals:  allowed.has('dsh.approval.request')  ? services.approvals  : undefined,
    secrets:    allowed.has('dsh.tools.execute')      ? services.secrets    : undefined,
    subworkflows: allowed.has('dsh.workflows.execute') ? services.subworkflows : undefined,
  }
}
```

节点只能访问其声明了 `capabilities` 的服务。未声明的能力在运行时不可用。

同时，`createScopedWorkflowCapabilityResolver()` 为每个节点创建独立的能力解析器，确保 `require()` 时校验声明。

## 确定性表达式 DSL

`src/core/expression.ts` 实现了一个安全的表达式语言，完全替代 `new Function()` / `eval`：

### 架构

```
源码 → Tokenizer → Token[] → Parser (递归下降) → AST → Evaluator → 结果
```

### 特性

- **词法**: 数字、字符串、布尔、null、标识符、运算符、标点
- **语法**: 算术（`+ - * / %`）、比较（`== != > < >= <=`）、逻辑（`&& || !`）、成员访问、函数调用、三元、数组/对象字面量
- **内置函数**: 30+ 函数（`len`, `upper`, `lower`, `trim`, `join`, `split`, `keys`, `values`, `sum`, `min`, `max`, `unique`, `sort`, `filter`, `map`, `typeof`, `toString`, `toNumber` 等）
- **安全限制**: 操作数上限 10,000，防止资源滥用
- **无外部依赖**: 纯递归下降解析器，无 `eval`、无 `Function` 构造

### 公开 API

```typescript
// 单次求值
evaluate('inputs.name + " is " + inputs.age', { inputs: { name: 'Alice', age: 30 } })
// => "Alice is 30"

// 编译后复用
const fn = compile('inputs.x * 2')
fn({ inputs: { x: 5 } }) // => 10

// 排序比较器
const cmp = sortComparator('a.priority - b.priority')
items.sort(cmp)

// 过滤谓词
const pred = filterPredicate('item.age >= 18')
items.filter(pred)

// 映射变换
const transform = mapTransform('item.name')
items.map(transform)
```

## 检查点持久化

引擎在以下时机创建检查点：

1. **运行开始**: `createRunRecord()` 写入初始 `WorkflowRunRecord`
2. **每个批次后**: `persistCheckpoint()` 提交当前状态
3. **终态时**: 最终检查点

### WorkflowRunCheckpoint 结构

```typescript
interface WorkflowRunCheckpoint {
  version: 1
  runId: string
  semanticHash: string
  seq: number                      // CAS 序列号
  status: PersistedWorkflowRunStatus
  nodeStates: Record<string, WorkflowNodeStatus>
  edgeStates: Record<string, WorkflowEdgeStatus>
  nodeOutputs: Record<string, JsonObject>
  nodeProgress: Record<string, JsonValue>
  ready: string[]                  // 当前就绪节点
  nodeRuns: number                 // 已执行节点数
  updatedAt: number
  resultOutputs?: JsonObject
  error?: string
}
```

### CAS 提交

`commit(runId, expectedSeq, checkpoint, events)` 使用乐观并发控制：

- 若 `current.seq !== expectedSeq`，抛出 `Sequence conflict`
- 防止并发写入覆盖

### 恢复

`engine.resume({ runId })` 从 `WorkflowRunRecord` 恢复引擎状态：

- 终态 → 直接返回
- 非终态 → 恢复 `nodeOutputs`、`checkpointSeq`、`nodeRuns`，继续执行

## 事件系统

引擎发出 15 种事件，用于审计和观察：

| 事件 | 说明 |
|------|------|
| `run.started` | 运行开始 |
| `run.completed` | 运行完成 |
| `run.failed` | 运行失败 |
| `run.cancelled` | 运行中止 |
| `run.paused` | 运行暂停 |
| `node.ready` | 节点就绪 |
| `node.started` | 节点开始执行 |
| `node.completed` | 节点执行完成 |
| `node.failed` | 节点执行失败 |
| `node.skipped` | 节点跳过 |
| `node.waiting` | 节点等待外部信号 |
| `node.cancelled` | 节点中止 |
| `node.needs-attention` | 节点需要人工介入 |
| `edge.taken` | 边被选中 |
| `edge.skipped` | 边被跳过 |

每个事件携带 `seq`（序列号）和 `runId`。
