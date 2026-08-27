# Workflow Template v1 规范

> API Version: `dsh.flow-canvas/v1` | 版本: 0.1.0 | 更新日期: 2025-08-25

## 概述

Workflow Template v1 是 dsh-flow-canvas 的工作流定义格式。它描述了一个 DAG（有向无环图）工作流，包含节点、边、输入输出和执行策略。

## Envelope 格式

所有工作流模板遵循统一的信封格式：

```yaml
apiVersion: dsh.flow-canvas/v1
kind: WorkflowTemplate
metadata:
  id: my-workflow              # 必需，唯一标识符
  name: My Workflow            # 必需，可读名称
  description: "..."           # 可选，描述
spec:
  inputSchema: { ... }         # 必需，输入 JSON Schema
  outputSchema: { ... }        # 必需，输出 JSON Schema
  requires: [ ... ]            # 可选，依赖声明
  nodes: [ ... ]               # 必需，节点列表
  edges: [ ... ]               # 必需，边列表
  outputs: { ... }             # 必需，输出 binding
  policies: { ... }            # 可选，执行策略
layout: { ... }                # 可选，视觉布局数据（语义分离）
```

### 字段约束

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `apiVersion` | string | ✅ | 必须为 `dsh.flow-canvas/v1` |
| `kind` | string | ✅ | 必须为 `WorkflowTemplate` |
| `metadata.id` | string | ✅ | 唯一标识符，编译时检查重复 |
| `metadata.name` | string | ✅ | 可读名称 |
| `metadata.description` | string | — | 可选描述 |
| `spec.inputSchema` | JsonSchema | ✅ | 工作流输入类型约束 |
| `spec.outputSchema` | JsonSchema | ✅ | 工作流输出类型约束 |
| `spec.requires` | Requirement[] | — | 能力依赖声明 |
| `spec.nodes` | NodeTemplate[] | ✅ | 至少一个节点 |
| `spec.edges` | EdgeTemplate[] | ✅ | 边列表 |
| `spec.outputs` | Record<string, Binding> | ✅ | 输出 binding |
| `spec.policies` | Policies | — | 执行策略覆盖 |
| `layout` | JsonObject | — | 视觉布局（不影响语义） |

## spec.requires 依赖声明

`requires` 声明工作流所需的能力或资源。编译器校验节点需求是否在 `requires` 中声明。

```yaml
spec:
  requires:
    - kind: capability
      uses: dsh.tools.execute
    - kind: capability
      uses: dsh.subagents.start
    - kind: workflow
      uses: my-shared-workflow
```

### Requirement 结构

```typescript
interface WorkflowRequirement {
  kind: string    // 'capability' | 'workflow' | 自定义
  uses: string    // 能力标识符或工作流 ID
}
```

### 校验规则

1. **重复检测**: 相同 `kind:uses` 组合不可重复
2. **节点匹配**: 节点声明的 `capabilities` + `dependencies()` 必须在 `requires` 中
3. **缺失报错**: 缺失声明产生 `WORKFLOW_REQUIREMENT_UNDECLARED` 诊断

## Node 格式

```yaml
- id: my-node               # 必需，唯一标识符
  uses: core.agent@1        # 必需，节点类型（可带版本号）
  title: "My Agent"         # 可选，覆盖默认标题
  with:                     # 必需，节点配置
    provider: opencode-go
    prompt: "Analyze the data"
  inputs:                   # 必需，输入 binding
    data:
      output:
        node: data-source
        path: [result]
  expects:                  # 可选，输出期望
    schema: { type: object }
    maxBytes: 1048576
  policy:                   # 可选，节点策略
    timeoutMs: 60000
    retry:
      maxAttempts: 3
```

### NodeTemplate 结构

```typescript
interface WorkflowNodeTemplate {
  id: string                              // 唯一标识符
  uses: string                            // 节点类型（如 core.agent@1）
  title?: string                          // 覆盖默认标题
  with: JsonObject                        // 节点配置
  inputs: Record<string, WorkflowBinding> // 输入 binding
  expects?: WorkflowNodeExpectation       // 输出期望
  policy?: {
    timeoutMs?: number                    // 超时（毫秒）
    retry?: { maxAttempts: number }       // 重试策略
  }
}
```

### uses 格式

`uses` 字段格式为 `type[@version]`：

- `core.agent` — 使用默认版本
- `core.agent@1` — 指定版本 1
- `my-plugin/my-node` — 自定义节点类型

### 编译时校验

| 校验 | 诊断码 | 说明 |
|------|--------|------|
| ID 重复 | `DUPLICATE_NODE_ID` | 节点 ID 不可重复 |
| 类型未知 | `UNKNOWN_NODE_TYPE` | 节点类型不在注册表中 |
| 版本不匹配 | `NODE_VERSION_MISMATCH` | 指定版本与定义版本不同（warning） |
| 必填输入缺失 | `REQUIRED_BINDING_MISSING` | inputSchema.required 中的字段未提供 binding |
| Binding 非上游 | `BINDING_NOT_UPSTREAM` | output binding 的源节点不是严格上游 |
| Config 语义无效 | `NODE_CONFIG_SEMANTIC_INVALID` | validateConfig() 返回错误 |
| 必需端口缺失 | `REQUIRED_OUTPUT_PORT_MISSING` | requiredOutputPorts 中的端口无出边 |

## Binding 类型

Binding 定义节点输入的值来源。有四种类型：

### 1. Literal Binding

直接内联值：

```yaml
inputs:
  threshold:
    literal: 0.5
  message:
    literal: "Hello, World!"
  config:
    literal:
      key: value
```

### 2. Input Binding

引用工作流输入：

```yaml
inputs:
  userInput:
    input: userPrompt         # 引用 spec.inputSchema 中的 userPrompt 字段
  count:
    input: items              # 引用 spec.inputSchema 中的 items 字段
```

### 3. Output Binding

引用上游节点的输出：

```yaml
inputs:
  data:
    output:
      node: fetch-data       # 上游节点 ID
      path: [result, items]  # JSON Path（可选）
  name:
    output:
      node: process
      path: []               # 空 path = 整个输出
```

**约束：**
- `node` 必须是严格上游（在拓扑顺序中位于当前节点之前）
- 编译器通过 BFS 祖先集校验

### 4. Secret Binding

引用 Secret（不存储明文）：

```yaml
inputs:
  apiKey:
    secret:
      ref: "vault:api-key-production"    # Secret 引用
  dbPassword:
    secret:
      ref: "env:DATABASE_PASSWORD"       # 环境变量引用
```

**安全特性：**
- 运行时通过 `WorkflowSecretGateway.resolve()` 解析
- 输出泄漏检测：若输出包含 Secret 值，抛出 `SECRET_OUTPUT_LEAK`

### Binding 校验

| 校验 | 诊断码 | 说明 |
|------|--------|------|
| 格式无效 | `INVALID_BINDING` | binding 无法识别 |
| output 节点不存在 | — | 在边校验中检测 |
| output 节点非上游 | `BINDING_NOT_UPSTREAM` | 编译器 BFS 校验 |
| 必填缺失 | `REQUIRED_BINDING_MISSING` | inputSchema.required 中的字段未提供 |

## Edge 格式

```yaml
edges:
  - id: e1                    # 必需，唯一标识符
    source: start             # 必需，源节点 ID
    target: process           # 必需，目标节点 ID
    sourcePort: success       # 可选，默认 'success'
```

### EdgeTemplate 结构

```typescript
interface WorkflowEdgeTemplate {
  id: string          // 唯一标识符
  source: string      // 源节点 ID
  target: string      // 目标节点 ID
  sourcePort?: string // 源端口，默认 'success'
}
```

### 端口匹配

- `sourcePort` 默认为 `success`
- 若源节点声明了 `outputPorts: ['true', 'false']`，边必须指定 `sourcePort`
- 若源节点声明了 `requiredOutputPorts: ['true', 'false']`，每个必需端口必须有至少一条出边

### 编译时校验

| 校验 | 诊断码 | 说明 |
|------|--------|------|
| ID 重复 | `DUPLICATE_EDGE_ID` | 边 ID 不可重复 |
| 源节点不存在 | `EDGE_SOURCE_MISSING` | source 不在 nodes 中 |
| 目标节点不存在 | `EDGE_TARGET_MISSING` | target 不在 nodes 中 |
| 端口未知 | `UNKNOWN_OUTPUT_PORT` | sourcePort 不在源节点的 outputPorts 中 |
| 环检测 | `CYCLE_DETECTED` | 拓扑排序失败 |
| 不可达节点 | `UNREACHABLE_NODE` | 从 start 无法到达 |
| 无法到达终节点 | `NODE_CANNOT_REACH_END` | 从该节点无法到达任何 end 节点 |

## Outputs 格式

`spec.outputs` 定义工作流的输出，使用 binding 从节点输出映射到工作流输出：

```yaml
spec:
  outputs:
    result:
      output:
        node: final-process
        path: [result]
    summary:
      literal: "Workflow completed"
    metadata:
      output:
        node: end
        path: []
```

### 输出 binding 校验

- 支持所有四种 binding 类型（literal、input、output、secret）
- `output` binding 的源节点必须是工作流中的节点

## Policies

`spec.policies` 覆盖引擎的默认资源限制：

```yaml
spec:
  policies:
    maxConcurrentNodes: 8         # 最大并发节点数（默认 4）
    maxNodeRuns: 200              # 最大节点执行次数（默认 100）
    maxDurationMs: 600000         # 最大运行时长（默认 600000 = 10 分钟）
    maxOutputBytes: 2097152       # 最大单节点输出（默认 1048576 = 1 MB）
    subworkflowMaxDepth: 5        # 子工作流最大递归深度（默认 8）
```

### Policies 结构

```typescript
interface WorkflowPolicies {
  maxConcurrentNodes?: number
  maxNodeRuns?: number
  maxDurationMs?: number
  maxOutputBytes?: number
  subworkflowMaxDepth?: number
}
```

### 默认值

| 策略 | 默认值 | 说明 |
|------|--------|------|
| `maxConcurrentNodes` | 4 | 每批最多并发执行的节点数 |
| `maxNodeRuns` | 100 | 整个工作流最多执行的节点次数 |
| `maxDurationMs` | 600,000 | 最大运行时长（10 分钟） |
| `maxOutputBytes` | 1,048,576 | 单节点最大输出（1 MB） |
| `subworkflowMaxDepth` | 8 | 子工作流最大递归深度 |

## Layout（语义分离）

`layout` 字段存储视觉布局数据（节点位置、缩放等），与语义完全分离：

```yaml
layout:
  nodes:
    start:
      x: 100
      y: 200
    process:
      x: 300
      y: 200
    end:
      x: 500
      y: 200
  viewport:
    x: 0
    y: 0
    zoom: 1
```

**原则：**
- `layout` 不参与编译或执行
- 编译器忽略 `layout` 字段
- 保存和加载时保留 `layout` 用于画布渲染
- 不同客户端可使用不同的布局算法

## 完整示例

```yaml
apiVersion: dsh.flow-canvas/v1
kind: WorkflowTemplate
metadata:
  id: data-pipeline
  name: Data Processing Pipeline
  description: "Fetch, transform, and summarize data"
spec:
  inputSchema:
    type: object
    required: [sourceUrl]
    properties:
      sourceUrl: { type: string }

  outputSchema:
    type: object
    properties:
      summary: { type: string }
      recordCount: { type: number }

  requires:
    - kind: capability
      uses: dsh.tools.execute

  nodes:
    - id: start
      uses: core.start
      with: {}
      inputs: {}

    - id: fetch
      uses: core.tool
      with:
        toolName: web_fetch
      inputs:
        url:
          input: sourceUrl

    - id: transform
      uses: core.script
      with:
        language: expr
        code: 'inputs.data | map(item => { "name": item.name, "score": item.value * 10 })'
      inputs:
        data:
          output:
            node: fetch
            path: [result]

    - id: check
      uses: core.condition
      with:
        operator: gt
      inputs:
        left:
          output:
            node: transform
            path: [length]
        right:
          literal: 0

    - id: summarize
      uses: core.agent
      with:
        provider: opencode-go
        prompt: "Summarize the following data: {{inputs.data}}"
      inputs:
        data:
          output:
            node: transform

    - id: end
      uses: core.end
      with: {}
      inputs:
        summary:
          output:
            node: summarize
            path: [result]

  edges:
    - id: e-start-fetch
      source: start
      target: fetch
    - id: e-fetch-transform
      source: fetch
      target: transform
    - id: e-transform-check
      source: transform
      target: check
    - id: e-check-summarize
      source: check
      target: summarize
      sourcePort: true
    - id: e-check-end
      source: check
      target: end
      sourcePort: false
    - id: e-summarize-end
      source: summarize
      target: end

  outputs:
    summary:
      output:
        node: summarize
        path: [result, summary]
    recordCount:
      output:
        node: transform
        path: [length]

layout:
  nodes:
    start: { x: 50, y: 200 }
    fetch: { x: 200, y: 200 }
    transform: { x: 350, y: 200 }
    check: { x: 500, y: 200 }
    summarize: { x: 650, y: 150 }
    end: { x: 800, y: 200 }
```
