# dsh-flow-canvas 迭代需求 v2 — 源码级调研版

> 基于 PiedPiper911/dsh-workflow-canvas 和 GM-HZ/dsh-dag-workflow 源码深度分析

---

## 一、PiedPiper911/dsh-workflow-canvas 源码分析

### 架构
```
src/
├── index.ts          # 插件入口，注册 ctx.workflowCanvas 服务
├── model.ts          # 数据模型（5种节点类型）
├── store/canvas.ts   # Zustand 状态管理
├── nodes/WorkflowNodeView.tsx  # 节点渲染组件
├── components/       # UI 组件
├── css.d.ts          # CSS 类型声明
└── ui.ts             # UI 工具函数
```

### 核心设计决策

**1. 数据模型 (`model.ts`)**
- 5 种节点类型：`trigger` / `tool` / `agent` / `condition` / `output`
- `WorkflowDocument` 类型：`{ version: 1, name, description?, nodes[], edges[] }`
- 节点数据：`{ kind, label, tool?, args?, agent?, prompt?, condition?, template?, notes? }`
- 关键函数：`toStepList(doc)` — 将画布图编译为有序步骤列表

**2. 插件入口 (`index.ts`)**
```typescript
export const inject = [] as const  // 无依赖注入

export function apply(ctx: Context) {
  ctx.provide('workflowCanvas', {
    compile: (doc) => toStepList(doc),      // 编译工作流
    load: (doc) => { /* 加载到共享存储 */ },
    exportCurrent: () => null,              // 导出当前状态
  })
  
  ctx.on(EVT_CHANGE, (doc) => { /* 监听画布变化 */ })
}
```

**3. 关键设计模式**
- **transport-agnostic**：画布只是 DSH 工作流规范的视图
- **event-driven**：通过 `EVT_CHANGE` 事件通信
- **框架无关**：core 层不依赖 React
- **可组合**：不硬依赖特定工作流引擎

**4. 依赖**
```json
"peerDependencies": {
  "@deepseek-ai/cordis": "^4.0.1",
  "react": "^18.0.0",
  "react-dom": "^18.0.0"
},
"dependencies": {
  "@xyflow/react": "^12.3.0",
  "zustand": "^4.5.5"
}
```

**5. 构建**
- `tsc` 编译 TypeScript
- `vite build` 构建客户端
- `scripts/build-client.mjs` 自定义构建脚本

### 我们可以借鉴的

| 特性 | 实现方式 | 我们的状态 |
|------|----------|-----------|
| `toStepList` 编译 | 将图转为有序步骤 | ❌ 缺失 |
| `ctx.workflowCanvas` 服务 | Cordis 服务注册 | ❌ 缺失 |
| event-driven 通信 | `EVT_CHANGE` 事件 | ❌ 缺失 |
| 节点验证 | `validateNodeData` 函数 | ⚠️ 有但不完整 |
| 框架无关 core | core 不依赖 React | ❌ 我们混在一起 |

---

## 二、GM-HZ/dsh-dag-workflow 源码分析

### 架构（6 个包）
```
packages/
├── core/             # 协议、编译器、调度器、核心节点
│   ├── src/
│   │   ├── compiler.ts      # 工作流编译器
│   │   ├── engine.ts        # DAG 执行引擎
│   │   ├── nodes.ts         # 核心节点定义（10种）
│   │   ├── registry.ts      # 节点注册表
│   │   ├── schema.ts        # JSON Schema 校验
│   │   ├── types.ts         # 完整类型定义
│   │   ├── capabilities.ts  # 能力系统
│   │   ├── expression.ts    # 表达式语言
│   │   ├── script-runtime.ts # 脚本运行时
│   │   ├── run-store.ts     # 运行存储接口
│   │   ├── json.ts          # JSON 工具
│   │   ├── hash.ts          # 语义哈希
│   │   ├── errors.ts        # 错误类型
│   │   └── dsh-schema.ts    # DSH Schema 校验
│   └── package.json
├── catalog/          # Draft CAS、diff、不可变发布
├── dsh/              # Cordis 服务、DSH 适配器、Agent 工具
│   └── src/
│       ├── index.ts         # 插件入口（6个服务）
│       ├── authoring.ts     # 10个工具定义
│       ├── services.ts      # 服务实现
│       └── types.ts         # DSH 类型适配
├── sqlite/           # SQLite 持久化
├── canvas/           # XYFlow Studio
└── ai-news-provider/ # 示例 Provider
```

### 核心设计决策

**1. 工作流模板规范 (`types.ts`)**
```typescript
interface WorkflowTemplate {
  apiVersion: 'dsh.workflow/v1alpha1'
  kind: 'WorkflowTemplate'
  metadata: { id, name, description? }
  spec: {
    inputSchema: JsonSchema
    outputSchema: JsonSchema
    requires?: WorkflowRequirement[]
    nodes: WorkflowNodeTemplate[]
    edges: WorkflowEdgeTemplate[]
    outputs: Record<string, WorkflowBinding>
    policies?: WorkflowPolicies
  }
  layout?: JsonObject
}
```

**2. 节点定义 (`nodes.ts`)** — 10 种核心节点
```typescript
// 每个节点定义包含：
interface WorkflowNodeDefinition {
  type: string           // e.g. 'core.start'
  version: number        // 版本号
  title: string
  description: string
  role: 'start' | 'end' | 'regular'
  configSchema: JsonSchema
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  outputPorts: string[]
  requiredOutputPorts?: string[]
  capabilities: string[]
  retry: 'never' | 'safe' | 'idempotent'
  execute(context): Promise<WorkflowNodeExecutionResult>
}
```

核心节点：
- `core.start` — 验证并暴露工作流输入
- `core.end` — 物化终端输出
- `core.condition` — 条件分支（truthy/falsy/eq/neq/gt/gte/lt/lte）
- `core.tool` — DSH Tool 调用
- `core.agent` — 子 Agent 调用
- `core.script` — 确定性脚本
- `core.human-approval` — 人工审批
- `core.subworkflow` — 子工作流
- `core.foreach` — 循环
- `core.parallel` — 并行

**3. 编译器 (`compiler.ts`)**
```typescript
function compileWorkflow(template, registry): WorkflowCompileResult {
  // 1. 校验模板结构
  // 2. 解析节点定义
  // 3. 验证输入/输出 Schema
  // 4. 拓扑排序
  // 5. 生成语义哈希
  // 6. 返回 CompiledWorkflow
}
```

**4. 执行引擎 (`engine.ts`)**
```typescript
class DagWorkflowEngine {
  start(request: WorkflowStartRequest): WorkflowRun {
    // 1. 编译模板
    // 2. 校验输入
    // 3. 初始化运行状态
    // 4. 拓扑排序
    // 5. 逐阶段执行节点
    // 6. 检查点持久化
    // 7. 返回运行句柄
  }
}
```

**5. 10 个工具 (`authoring.ts`)**
```typescript
const workflowToolDefinitions = [
  'workflow_nodes_list',     // 列出可用节点
  'workflow_draft_create',   // 创建草稿
  'workflow_draft_import',   // 导入草稿
  'workflow_draft_read',     // 读取草稿
  'workflow_draft_update',   // 更新草稿
  'workflow_draft_validate', // 校验草稿
  'workflow_validate',       // 校验工作流
  'workflow_diff',           // 版本对比
  'workflow_publish',        // 发布
  'workflow_run',            // 执行
]
```

**6. 插件入口 (`index.ts`)**
```typescript
export const inject = ['tools', 'subagents', 'approval', 'skills']

export async function apply(ctx, config) {
  // 注册 6 个 Cordis 服务
  if (ctx.get('workflowCapabilities') === undefined) 
    await ctx.plugin(WorkflowCapabilityRegistryService)
  if (ctx.get('workflowScripts') === undefined) 
    await ctx.plugin(WorkflowScriptRuntimeRegistryService)
  if (ctx.get('workflowNodes') === undefined) 
    await ctx.plugin(WorkflowNodeRegistryService)
  // ... catalog, runs, engine, recovery, authoring
}
```

**7. 6 个 Cordis 服务**
```typescript
ctx.workflowCapabilities  // 节点生命周期服务
ctx.workflowScripts       // 确定性脚本运行时
ctx.workflowNodes         // 节点注册与解析
ctx.workflowTemplates     // draft/CAS/校验/发布
ctx.workflowRuns          // 事件日志与 checkpoint
ctx.dagWorkflowEngine     // 启动/恢复/取消运行
```

**8. Schema 校验 (`schema.ts`)**
```typescript
// 使用 AJV 校验
const WORKFLOW_TEMPLATE_SCHEMA = {
  type: 'object',
  required: ['apiVersion', 'kind', 'metadata', 'spec'],
  properties: {
    apiVersion: { const: 'dsh.workflow/v1alpha1' },
    kind: { const: 'WorkflowTemplate' },
    // ...
  }
}
```

**9. 表达式语言 (`expression.ts`)**
```typescript
// 内置 dsh.expr@1 表达式语言
// 不使用 eval，纯 JSON 操作
// 操作数上限，确定性执行
```

**10. 语义哈希 (`hash.ts`)**
```typescript
// 工作流模板的语义哈希
// 用于 CAS 更新和版本管理
```

### 我们可以借鉴的

| 特性 | 实现方式 | 优先级 |
|------|----------|--------|
| WorkflowTemplate 规范 | `dsh.workflow/v1alpha1` API 版本 | 🔴 P0 |
| 10 个核心节点定义 | `WorkflowNodeDefinition` 接口 | 🔴 P0 |
| 编译器 | `compileWorkflow` 函数 | 🔴 P0 |
| DAG 执行引擎 | `DagWorkflowEngine` 类 | 🔴 P0 |
| 10 个工具 API | `authoring.ts` 工具定义 | 🔴 P0 |
| 6 个 Cordis 服务 | `index.ts` 服务注册 | 🔴 P0 |
| AJV Schema 校验 | `WORKFLOW_TEMPLATE_SCHEMA` | 🟡 P1 |
| 表达式语言 | `dsh.expr@1` | 🟡 P1 |
| 语义哈希 | `hash.ts` | 🟡 P1 |
| SQLite 持久化 | `packages/sqlite` | 🟡 P1 |
| 能力系统 | `capabilities.ts` | 🟡 P1 |
| 检查点恢复 | `run-store.ts` | 🟡 P1 |

---

## 三、我们的差距分析

### 架构差距

| 维度 | GM-HZ | PiedPiper911 | 我们 |
|------|-------|--------------|------|
| **包结构** | 6 个独立包 | 1 个包 | 1 个包 |
| **核心/UI 分离** | ✅ core 不依赖 React | ✅ core 不依赖 React | ❌ 混在一起 |
| **Cordis 服务** | 6 个服务 | 1 个服务 | 0 个服务 |
| **工具 API** | 10 个工具 | 0 个工具 | 1 个工具 |
| **节点定义** | 10 种（版本化） | 5 种 | 20+ 种（无版本） |
| **Schema 校验** | AJV + 自定义 | 简单验证 | 基础验证 |
| **持久化** | SQLite | 无 | localStorage |
| **表达式语言** | dsh.expr@1 | 简单条件 | JS eval |
| **执行引擎** | DagWorkflowEngine | toStepList | 模拟执行 |
| **版本管理** | CAS + 语义哈希 | 无 | localStorage |

### 关键差距总结

**🔴 致命差距（必须修复）**

1. **未对接 ctx.workflows 引擎** — 我们的画布只是前端展示，不能真正执行
2. **无 Cordis 服务注册** — 没有 `ctx.workflowCanvas` 服务
3. **无工具 API** — Agent 无法通过对话操作工作流
4. **无编译器** — 不能将画布图编译为可执行步骤

**🟡 重要差距（应该修复）**

5. **无 Schema 校验** — 不能校验工作流合法性
6. **无 SQLite 持久化** — localStorage 不可靠
7. **无版本管理** — 不能版本化发布
8. **无检查点恢复** — 崩溃后不能恢复

**🟢 次要差距（可以优化）**

9. **无表达式语言** — 条件判断用 JS eval（不安全）
10. **无能力系统** — 不能声明节点能力需求
11. **无语义哈希** — 不能检测模板变更

---

## 四、迭代需求（更新版）

### 🔴 P0 — 核心能力（必须）

#### REQ-001: 对接 DSH Cordis 服务架构
**参考**: GM-HZ `index.ts`, PiedPiper911 `index.ts`  
**当前**: 无 Cordis 服务注册  
**需求**:
```typescript
// 注册 ctx.workflowCanvas 服务
ctx.provide('workflowCanvas', {
  compile: (doc) => toStepList(doc),
  load: (doc) => { /* 加载到共享存储 */ },
  exportCurrent: () => null,
})

// 监听画布变化
ctx.on('workflow-canvas/change', (doc) => { ... })
```
**验收标准**: 画布状态通过 Cordis 服务暴露给 DSH

---

#### REQ-002: 工作流编译器
**参考**: GM-HZ `compiler.ts`  
**当前**: 无编译器  
**需求**:
- 实现 `compileWorkflow(template, registry)` 函数
- 将画布图编译为 `CompiledWorkflow`
- 包含拓扑排序、Schema 校验、语义哈希
- 输出有序步骤列表

**验收标准**: 画布图可以编译为可执行步骤

---

#### REQ-003: 10 个工具 API
**参考**: GM-HZ `authoring.ts`  
**当前**: 只有 `flow_canvas` 1 个工具  
**需求**: 注册以下工具：

| 工具名 | 功能 | 参考 GM-HZ |
|--------|------|-----------|
| `workflow_nodes_list` | 列出可用节点 | ✅ |
| `workflow_draft_create` | 创建草稿 | ✅ |
| `workflow_draft_import` | 导入草稿 | ✅ |
| `workflow_draft_read` | 读取草稿 | ✅ |
| `workflow_draft_update` | 更新草稿 | ✅ |
| `workflow_draft_validate` | 校验草稿 | ✅ |
| `workflow_validate` | 校验工作流 | ✅ |
| `workflow_diff` | 版本对比 | ✅ |
| `workflow_publish` | 发布工作流 | ✅ |
| `workflow_run` | 执行工作流 | ✅ |

**验收标准**: Agent 可以通过对话创建、校验、执行工作流

---

#### REQ-004: 核心节点定义（10种）
**参考**: GM-HZ `nodes.ts`  
**当前**: 20+ 种节点但无统一定义接口  
**需求**: 实现 `WorkflowNodeDefinition` 接口：
```typescript
interface WorkflowNodeDefinition {
  type: string           // 'core.start'
  version: number        // 1
  title: string
  description: string
  role: 'start' | 'end' | 'regular'
  configSchema: JsonSchema
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  outputPorts: string[]
  capabilities: string[]
  retry: 'never' | 'safe' | 'idempotent'
  execute(context): Promise<WorkflowNodeExecutionResult>
}
```
实现 10 种核心节点：
- `core.start` / `core.end`
- `core.condition`（支持 truthy/falsy/eq/neq/gt/gte/lt/lte）
- `core.tool` / `core.agent`
- `core.script`（确定性脚本）
- `core.human-approval`（人工审批）
- `core.subworkflow` / `core.foreach` / `core.parallel`

**验收标准**: 所有核心节点有完整定义和执行逻辑

---

### 🟡 P1 — 增强能力

#### REQ-005: 工作流模板规范
**参考**: GM-HZ `types.ts`  
**需求**: 定义 `WorkflowTemplate` 规范：
```typescript
interface WorkflowTemplate {
  apiVersion: 'dsh.flow-canvas/v1'
  kind: 'WorkflowTemplate'
  metadata: { id, name, description? }
  spec: {
    inputSchema: JsonSchema
    outputSchema: JsonSchema
    nodes: WorkflowNodeTemplate[]
    edges: WorkflowEdgeTemplate[]
    outputs: Record<string, WorkflowBinding>
    policies?: WorkflowPolicies
  }
}
```

---

#### REQ-006: AJV Schema 校验
**参考**: GM-HZ `schema.ts`  
**需求**:
- 使用 AJV 校验工作流模板
- 实现 `WORKFLOW_TEMPLATE_SCHEMA`
- 支持 binding 校验（literal/input/output/secret）
- 支持 requirement 校验

---

#### REQ-007: SQLite 持久化
**参考**: GM-HZ `packages/sqlite`  
**需求**:
- SQLite 存储工作流模板
- Draft + Published 版本管理
- 执行事件日志
- 检查点（checkpoint）

---

#### REQ-008: DAG 执行引擎
**参考**: GM-HZ `engine.ts`  
**需求**:
- 实现 `DagWorkflowEngine` 类
- 支持 `start` / `stop` / `resume`
- 拓扑排序执行
- 并发控制（maxConcurrentNodes）
- 检查点持久化

---

#### REQ-009: 表达式语言
**参考**: GM-HZ `expression.ts`  
**需求**:
- 实现 `dsh.expr@1` 表达式语言
- 不使用 eval，纯 JSON 操作
- 支持比较、逻辑、数学运算
- 操作数上限，确定性执行

---

### 🟢 P2 — 高级能力

#### REQ-010: 能力系统
**参考**: GM-HZ `capabilities.ts`  
**需求**:
- 节点声明能力需求
- 运行时验证能力可用
- 支持 `capability:dsh.tools.execute`

---

#### REQ-011: 语义哈希
**参考**: GM-HZ `hash.ts`  
**需求**:
- 工作流模板的语义哈希
- 用于 CAS 更新和版本管理
- 检测模板变更

---

#### REQ-012: 检查点恢复
**参考**: GM-HZ `run-store.ts`  
**需求**:
- 运行状态持久化
- 崩溃后恢复
- 支持 `paused` 状态

---

## 五、实施路线图（更新版）

| Phase | 需求 | 工作量 | 依赖 | 参考 |
|-------|------|--------|------|------|
| **Phase 1** | REQ-001 Cordis 服务 + REQ-002 编译器 | 2周 | 无 | GM-HZ index.ts, compiler.ts |
| **Phase 2** | REQ-003 工具 API + REQ-004 节点定义 | 2周 | Phase 1 | GM-HZ authoring.ts, nodes.ts |
| **Phase 3** | REQ-005 模板规范 + REQ-006 Schema 校验 | 1周 | Phase 1 | GM-HZ types.ts, schema.ts |
| **Phase 4** | REQ-007 SQLite + REQ-008 执行引擎 | 2周 | Phase 1-3 | GM-HZ sqlite, engine.ts |
| **Phase 5** | REQ-009 表达式 + REQ-010 能力系统 | 1周 | Phase 1-3 | GM-HZ expression.ts, capabilities.ts |
| **Phase 6** | REQ-011 语义哈希 + REQ-012 检查点 | 1周 | Phase 4-5 | GM-HZ hash.ts, run-store.ts |

**总计**: ~9 周

---

## 六、技术决策

### 1. 包结构
**推荐**: 参考 GM-HZ，拆分为 2-3 个包
```
dsh-flow-canvas/
├── core/           # 编译器、引擎、节点定义（无 React）
├── client/         # React 画布 UI
└── host/           # Cordis 服务、工具注册
```

### 2. 工作流规范
**推荐**: 参考 GM-HZ，使用 `dsh.flow-canvas/v1` API 版本

### 3. 节点定义
**推荐**: 参考 GM-HZ，使用 `WorkflowNodeDefinition` 接口

### 4. 执行引擎
**推荐**: 参考 GM-HZ，实现 `DagWorkflowEngine` 类

### 5. 持久化
**推荐**: 参考 GM-HZ，使用 SQLite 替换 localStorage
