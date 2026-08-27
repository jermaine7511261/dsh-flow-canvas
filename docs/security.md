# dsh-flow-canvas 安全文档

> 版本: 0.1.0 | 更新日期: 2025-08-25

## 概述

dsh-flow-canvas 在 DeepSeek Harness 沙箱环境中运行。本文档描述工作流引擎的安全模型、Secret 处理、能力作用域、资源限制和确定性脚本机制。

## 权限模型

### Agent Scope + spec.requires 声明

工作流中的每个节点通过 `capabilities` 字段声明其所需的能力。引擎在运行时根据声明裁剪可用服务。

```yaml
# 节点声明能力
- id: call-tool
  uses: core.tool
  with:
    toolName: read_file
  # core.tool 内置声明 capabilities: ['dsh.tools.execute']
```

**规则：**

1. 节点只能访问其声明了 `capabilities` 的服务
2. 未声明的能力在运行时被裁剪为 `undefined`
3. 节点运行时若未声明能力而尝试访问，会抛出错误
4. 能力声明在编译时收集，运行时通过 `scopeNodeServices()` 裁剪

### 编译时校验

编译器检查每个节点的能力需求是否在 `spec.requires` 中声明：

```yaml
spec:
  requires:
    - kind: capability
      uses: dsh.tools.execute
    - kind: capability
      uses: dsh.subagents.start
```

若节点声明了 `capabilities: ['dsh.tools.execute']` 但 `spec.requires` 中未声明，编译器会产生 `WORKFLOW_REQUIREMENT_UNDECLARED` 诊断。

### 服务裁剪实现

```typescript
function scopeNodeServices(services, capabilities): WorkflowNodeServices {
  const allowed = new Set(capabilities)
  return {
    tools:        allowed.has('dsh.tools.execute')    ? services.tools        : undefined,
    agents:       allowed.has('dsh.subagents.start')   ? services.agents       : undefined,
    approvals:    allowed.has('dsh.approval.request')  ? services.approvals    : undefined,
    secrets:      allowed.has('dsh.tools.execute')      ? services.secrets      : undefined,
    subworkflows: allowed.has('dsh.workflows.execute') ? services.subworkflows : undefined,
  }
}
```

### 能力解析器

每个节点获得独立的 `WorkflowCapabilityResolver`：

```typescript
{
  declared: [...allowed],              // 声明的能力列表
  has(cap): boolean,                   // 是否声明且可用
  optional<T>(cap): T | undefined,     // 可选获取
  require<T>(cap): T,                  // 必须获取，否则抛错
}
```

`require()` 会校验两点：
1. 节点是否声明了该能力（编译时已校验，运行时再次确认）
2. 该能力是否已安装（`capabilitySource.resolve()` 是否返回非 undefined）

## Secret 处理

### Binding 引用（不存储明文）

Secret 仅通过 `secret` binding 引用，不内联存储在工作流模板中：

```yaml
nodes:
  - id: call-api
    uses: core.tool
    with:
      toolName: api_call
    inputs:
      apiKey:
        secret:
          ref: "vault:api-key-production"   # 仅存储引用
```

### 运行时解析

Secret 在节点执行时通过 `WorkflowSecretGateway.resolve()` 解析：

```typescript
const secretValue = await secretGateway.resolve(binding.secret.ref, {
  runId,
  nodeId,
  signal,
})
inputs[key] = secretValue
```

### 输出泄漏检测

引擎在每个节点执行后检测 Secret 值是否泄露到输出中：

```typescript
if (resolvedSecrets.length > 0) {
  const outputString = JSON.stringify(result.outputs)
  for (const secretValue of resolvedSecrets) {
    const secretString = JSON.stringify(secretValue)
    if (secretString && outputString.includes(secretString)) {
      throw new Error('SECRET_OUTPUT_LEAK: Node output contains resolved secret value')
    }
  }
}
```

**检测逻辑：**
1. 序列化节点输出为 JSON 字符串
2. 序列化每个已解析的 Secret 值为 JSON 字符串
3. 若输出中包含 Secret 值的字符串子串，抛出 `SECRET_OUTPUT_LEAK` 错误
4. 该节点标记为 `failed`，运行中止

## 能力作用域

### scopeNodeServices 裁剪

如上所述，`scopeNodeServices()` 根据节点声明的 `capabilities` 裁剪可用服务。这是运行时的硬裁剪，不是软限制。

### 能力声明对照表

| 能力 | 允许的服务 | 声明节点 |
|------|-----------|----------|
| `dsh.tools.execute` | tools, secrets | `core.tool` |
| `dsh.subagents.start` | agents | `core.agent` |
| `dsh.approval.request` | approvals | `core.human-approval` |
| `dsh.workflows.execute` | subworkflows | `core.subworkflow` |

## 资源限制

引擎提供多层资源限制，防止工作流消耗过多资源：

### 默认策略

```typescript
const DEFAULT_POLICIES = {
  maxConcurrentNodes: 4,          // 最大并发节点数
  maxNodeRuns: 100,               // 最大节点执行次数
  maxDurationMs: 10 * 60_000,    // 最大运行时长 (10 分钟)
  maxOutputBytes: 1_048_576,     // 最大单节点输出 (1 MB)
}
```

### 配置覆盖

工作流模板的 `spec.policies` 可覆盖默认值：

```yaml
spec:
  policies:
    maxConcurrentNodes: 8
    maxNodeRuns: 50
    maxDurationMs: 300000        # 5 分钟
    maxOutputBytes: 2097152      # 2 MB
    subworkflowMaxDepth: 5       # 子工作流最大递归深度
```

### 检查机制

| 限制 | 检查时机 | 行为 |
|------|---------|------|
| `maxConcurrentNodes` | 每批调度时 | 仅执行前 N 个就绪节点 |
| `maxNodeRuns` | 每次节点执行前 | 超限抛出 `Max node runs exceeded` |
| `maxDurationMs` | 每次循环迭代 | 通过 AbortController 信号中断 |
| `maxOutputBytes` | 节点执行后 | 超限抛出 `output is N bytes, limit is M` |
| `subworkflowMaxDepth` | 子工作流网关调用时 | depth >= depthLimit 拒绝执行 |

### Output 大小限制

```typescript
private checkOutputSize(nodeId: string, outputs: JsonObject): void {
  const outputBytes = Buffer.byteLength(JSON.stringify(outputs), 'utf8')
  if (outputBytes > this.maxOutputBytes) {
    throw new Error(`Node ${nodeId} output is ${outputBytes} bytes, limit is ${this.maxOutputBytes}`)
  }
}
```

## 确定性脚本

### dsh.expr@1 DSL

`src/core/expression.ts` 实现了确定性表达式语言，完全替代 `new Function()` / `eval`。

**安全特性：**

1. **无 eval / new Function**: 使用自定义 Tokenizer + 递归下降 Parser
2. **操作数上限**: 10,000 个操作数，防止资源滥用
3. **有限运算**: 仅支持算术、比较、逻辑、成员访问、函数调用
4. **无副作用**: 无文件访问、无网络请求、无进程操作
5. **内置函数白名单**: 仅允许预定义的 30+ 函数

### 不可用的构造

表达式 DSL **不支持**：

- JavaScript 语句（`if/else/for/while/switch`）
- 变量声明（`var/let/const`）
- 函数声明（`function`）
- 导入（`import/require`）
- 原型操作（`__proto__`、`constructor`）
- `eval()`、`new Function()`
- `this` 访问

### JSON 变换模式

`core.script` 节点支持两种模式：

1. **JSON 变换** (`language: 'json'`): 声明式 filter/map/sort/merge
2. **DSL 表达式** (`language: 'expr'`): 确定性求值

```yaml
# JSON 变换模式
- id: transform
  uses: core.script
  with:
    language: json
    code: |
      {
        "filter": "item.age >= 18",
        "map": "item.name",
        "sort": "a.localeCompare(b)"
      }

# DSL 表达式模式
- id: compute
  uses: core.script
  with:
    language: expr
    code: 'inputs.items | map(item => item.price) | sum()'
```

## 持久化安全

### SQLite 存储

- 工作流模板存储在 SQLite 数据库（`~/.dsh/workflows/`）
- JSON 文件作为降级方案
- 运行记录使用 CAS（Compare-And-Swap）提交，防止并发覆盖

### 配置文件

- 插件配置文件：`~/.dsh/flow-canvas.json`
- 环境变量可覆盖配置（`FLOW_CANVAS_*`）
- 配置验证：枚举值、数值范围、字符串路径、字符串数组

### 原型污染防护

所有节点输出在存储前通过 `snapshotJsonValue()` 深拷贝：

```typescript
function snapshotJsonValue(value: any): any {
  return JSON.parse(JSON.stringify(value))
}
```

这确保了：
- 无原型链污染
- 无循环引用
- 输出为纯 JSON 值

## 人工审批安全

`core.human-approval` 节点暂停执行等待人工确认：

1. 生成审批 token: `${nodeId}:approval`
2. 调用 `WorkflowApprovalGateway.request()`
3. 返回 `allowed-once` | `rejected` | `cancelled`
4. 无审批网关时默认批准（兼容模式）
5. 重试策略为 `never`，不会自动重试

## 检查点安全

- 检查点包含完整的运行状态和节点输出
- 使用 CAS 序列号防止并发覆盖
- 恢复时验证 `semanticHash` 确保工作流模板未变
- 终态检查点不可再修改
