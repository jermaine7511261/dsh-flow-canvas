# dsh-flow-canvas 迭代需求 v3 — 对标 GM-HZ/dsh-dag-workflow

> 基于 GM-HZ/dsh-dag-workflow v0.2.0 源码级深度对比，逐项列出功能差距和迭代需求。

---

## 一、功能对标总览

| # | 功能模块 | GM-HZ 状态 | dsh-flow-canvas 状态 | 差距 | 优先级 |
|---|---------|-----------|---------------------|------|--------|
| 1 | Monorepo 包拆分 | ✅ 6 包 | ❌ 单体 | 架构差距 | P1 |
| 2 | TypeScript 完整编译 | ✅ tsconfig + typecheck | ⚠️ 部分文件无类型 | 缺失 | P1 |
| 3 | apiVersion 字面量约束 | ✅ `'dsh.workflow/v1alpha1'` | ⚠️ `string` 无约束 | 弱 | P0 |
| 4 | spec.requires 依赖声明 | ✅ 完整 | ❌ 无 | 缺失 | P0 |
| 5 | 节点版本化 type@version | ✅ `core.start@1` | ❌ `core.start` 无版本 | 缺失 | P1 |
| 6 | NodeDefinition.validateConfig() | ✅ 有 | ❌ 无 | 缺失 | P1 |
| 7 | NodeDefinition.dependencies() | ✅ 从 config 解析资源 | ❌ 无 | 缺失 | P1 |
| 8 | NodeDefinition.dependencyKinds | ✅ 有 | ❌ 无 | 缺失 | P1 |
| 9 | NodeDefinition.execution | ✅ `'activity' \| 'human-wait'` | ❌ 无 | 缺失 | P1 |
| 10 | 编译器-重复 Edge ID 检测 | ✅ 有 | ❌ 无 | 缺失 | P0 |
| 11 | 编译器-Output port 校验 | ✅ 有 | ❌ 无 | 缺失 | P0 |
| 12 | 编译器-requiredOutputPorts 校验 | ✅ 有 | ❌ 无 | 缺失 | P0 |
| 13 | 编译器-可达性分析 | ✅ start 可达 + 可达 end | ❌ 无 | 缺失 | P0 |
| 14 | 编译器-Binding 上游校验 | ✅ 祖先集检查 | ❌ 无 | 缺失 | P1 |
| 15 | 编译器-Binding 类型兼容 | ✅ schemasMayOverlap() | ❌ 无 | 缺失 | P1 |
| 16 | 编译器-Config 语义校验 | ✅ 调用 validateConfig() | ❌ 无 | 缺失 | P1 |
| 17 | 编译器-需求声明校验 | ✅ WORKFLOW_REQUIREMENT_UNDECLARED | ❌ 无 | 缺失 | P1 |
| 18 | 编译器-Expectation schema 校验 | ✅ 有 | ❌ 无 | 缺失 | P1 |
| 19 | 编译器-诊断码体系 | ✅ 标准化 code | ❌ 无 | 缺失 | P1 |
| 20 | 编译器-Lossless JSON materialize | ✅ snapshotJsonValue() | ❌ 无 | 缺失 | P1 |
| 21 | 引擎-Checkpoint 持久化 | ✅ 事件+checkpoint 事务提交 | ❌ 无 | 缺失 | P0 |
| 22 | 引擎-Run 恢复 resume | ✅ 从 checkpoint 恢复 | ❌ 无 | 缺失 | P0 |
| 23 | 引擎-事件系统 WorkflowEvent | ✅ 完整事件类型 | ❌ 无 | 缺失 | P0 |
| 24 | 引擎-节点状态扩展 | ✅ 9 种状态 | ⚠️ 5 种 | 弱 | P0 |
| 25 | 引擎-Owner 权限透传 | ✅ 所有 gateway 携带 owner | ❌ 无 | 缺失 | P1 |
| 26 | 引擎-Secret 泄漏检测 | ✅ SECRET_OUTPUT_LEAK | ❌ 无 | 缺失 | P0 |
| 27 | 引擎-Output 大小限制 | ✅ maxOutputBytes | ❌ 无 | 缺失 | P1 |
| 28 | 引擎-子工作流 invoke | ✅ 幂等 invocationId | ❌ 无 | 缺失 | P1 |
| 29 | 引擎-深度限制 | ✅ subworkflowMaxDepth | ❌ 无 | 缺失 | P1 |
| 30 | 引擎-能力作用域裁剪 | ✅ scopeNodeServices() | ❌ 无 | 缺失 | P1 |
| 31 | 引擎-节点进度上报 | ✅ checkpointProgress() | ❌ 无 | 缺失 | P2 |
| 32 | 引擎-Human-wait 节点 | ✅ execution: 'human-wait' | ❌ 无 | 缺失 | P1 |
| 33 | 引擎-Deadline 精确计算 | ✅ 基于 createdAt 剩余时间 | ⚠️ 固定 timeout | 弱 | P2 |
| 34 | 节点-dsh.tool@1 版本化 | ✅ | ⚠️ core.tool 无版本 | 弱 | P1 |
| 35 | 节点-dsh.agent@1 增强 | ✅ label/outputSchema/maxDepth | ⚠️ 基础版 | 弱 | P1 |
| 36 | 节点-dsh.human-approval 完整 | ✅ token/4 种结果/action/reason | ⚠️ 简单暂停 | 弱 | P1 |
| 37 | 节点-core.script 可插拔运行时 | ✅ createScriptNodeDefinition(runtimes) | ❌ new Function() | 安全风险 | P0 |
| 38 | 节点-core.subworkflow 不可变 revision | ✅ templateId+revision | ⚠️ 简单引用 | 弱 | P1 |
| 39 | 节点-core.foreach 持久化帧 | ✅ 每 item 独立状态+checkpoint | ⚠️ 简单 mock | 弱 | P1 |
| 40 | Gateway-SecretGateway | ✅ Host scoped resolver | ❌ 无 | 缺失 | P0 |
| 41 | Gateway-ApprovalGateway | ✅ 4 种结果+token | ❌ 无 | 缺失 | P1 |
| 42 | Gateway-SubworkflowGateway | ✅ 幂等 invocationId | ❌ 无 | 缺失 | P1 |
| 43 | Gateway-CapabilitySource | ✅ 通用能力注册 | ❌ 无 | 缺失 | P1 |
| 44 | 能力注册系统 | ✅ WorkflowCapabilityRegistry | ❌ 无 | 缺失 | P1 |
| 45 | 脚本运行时注册 | ✅ WorkflowScriptRuntimeRegistry | ❌ 无 | 缺失 | P0 |
| 46 | 表达式语言 dsh.expr@1 | ✅ 800+ 行 DSL | ❌ 无 | 缺失 | P0 |
| 47 | Catalog-Draft CAS | ✅ revision 乐观锁 | ❌ 文件存储 | 弱 | P1 |
| 48 | Catalog-不可变发布 | ✅ workflow_revisions 表 | ❌ 无 | 缺失 | P1 |
| 49 | Catalog-语义/布局分离 | ✅ layout 不进 hash | ⚠️ 混在一起 | 弱 | P1 |
| 50 | 持久化-SQLite | ✅ WAL 模式+严格表 | ❌ localStorage | 弱 | P1 |
| 51 | 持久化-事件日志 | ✅ workflow_run_events 表 | ❌ 无 | 缺失 | P1 |
| 52 | 持久化-恢复 | ✅ listRecoverableRuns+resume | ❌ localStorage 崩溃恢复 | 弱 | P1 |
| 53 | 画布-统一数据模型 | ✅ 直接操作 WorkflowTemplate | ⚠️ 独立 Workflow 类型 | 弱 | P1 |
| 54 | 画布-RPC 架构 | ✅ WorkflowCanvasGateway | ❌ 前端直接操作 | 缺失 | P1 |
| 55 | 画布-授权系统 | ✅ Session-based+多用户 | ❌ 无 | 缺失 | P2 |
| 56 | 安全-new Function 移除 | ✅ 无 eval | ❌ new Function() | 安全风险 | P0 |
| 57 | 安全-Output 大小限制 | ✅ maxOutputBytes | ❌ 无 | 缺失 | P1 |
| 58 | 安全-依赖声明约束 | ✅ spec.requires fail-closed | ❌ 无 | 缺失 | P1 |
| 59 | 安全-未知副作用处理 | ✅ needs_attention | ❌ 无 | 缺失 | P2 |
| 60 | 测试-编译器测试 | ✅ compiler.spec.ts | ❌ 无 | 缺失 | P1 |
| 61 | 测试-引擎测试 | ✅ engine.spec.ts | ❌ 无 | 缺失 | P1 |
| 62 | 测试-表达式测试 | ✅ expression.spec.ts | ❌ 无 | 缺失 | P1 |
| 63 | 测试-CI | ✅ GitHub Actions | ❌ 无 | 缺失 | P2 |
| 64 | 文档-架构文档 | ✅ docs/architecture.md | ❌ 无 | 缺失 | P2 |
| 65 | 文档-安全文档 | ✅ docs/security.md | ❌ 无 | 缺失 | P2 |
| 66 | 文档-Template 规范 | ✅ spec/workflow-template-v1.md | ❌ 无 | 缺失 | P2 |
| 67 | 文档-Showcase 工作流 | ✅ 10 个示例 | ⚠️ 1 个 demo | 弱 | P2 |

---

## 二、差距分类统计

| 类别 | 总数 | 已有 | 缺失 | 弱 | 缺失率 |
|------|------|------|------|-----|--------|
| 类型系统 | 9 | 1 | 6 | 2 | 67% |
| 编译器 | 11 | 0 | 11 | 0 | 100% |
| 引擎 | 14 | 0 | 12 | 2 | 86% |
| 节点 | 7 | 0 | 2 | 5 | 29% |
| Gateway | 4 | 0 | 4 | 0 | 100% |
| 扩展系统 | 3 | 0 | 3 | 0 | 100% |
| 持久化 | 5 | 0 | 3 | 2 | 60% |
| 画布 | 4 | 0 | 2 | 2 | 50% |
| 安全 | 4 | 0 | 3 | 1 | 75% |
| 测试 | 4 | 0 | 4 | 0 | 100% |
| 文档 | 4 | 0 | 3 | 1 | 75% |
| **合计** | **67** | **1** | **53** | **13** | **79%** |

**已有优势（GM-HZ 没有的）**：
- 21+ 前端节点类型（GM-HZ 依赖动态加载）
- 9 个侧面板（Node/Props/Log/Debug/Variable/Template/Team/TaskLedger/TokenSummary）
- 12 个内置模板
- 中英文双语 i18n
- 前端 WorkflowExecutor 完整执行器
- TeamPanel 团队管理
- TaskLedgerPanel 任务账本
- TokenSummaryPanel Token 追踪

---

## 三、迭代需求

### 🔴 P0 — 安全与正确性（必须先做）

#### REQ-001: 移除 new Function()
**现状**: `src/core/nodes.ts` line 250 `new Function('inputs', code)`，`src/client/utils/executor.ts` line 546 同样使用
**风险**: 任意代码注入，可执行任意 JS
**方案**: 实现确定性表达式 DSL，参考 GM-HZ `expression.ts`（800+ 行，自定义 tokenizer + 递归下降解析器，无 eval，操作数上限 10000）
**验收**: 脚本节点不再包含任何 `new Function` / `eval` 调用

#### REQ-002: Secret Gateway + 输出泄漏检测
**现状**: 无 Secret 处理
**方案**:
- 实现 `WorkflowSecretGateway` 接口
- Binding 中 `secret: { ref }` 只存引用
- 节点输出检测是否包含已解析 secret 值，包含则拒绝（`SECRET_OUTPUT_LEAK`）
**验收**: secret binding 不存明文，输出泄漏检测生效

#### REQ-003: 编译器-重复 Edge ID 检测
**现状**: `compiler.ts` 未检测重复 edge id
**方案**: 遍历 edges 时用 Set 检测重复，产生 `DUPLICATE_EDGE_ID` 诊断
**验收**: 重复 edge id 产生编译错误

#### REQ-004: 编译器-Output port 校验
**现状**: 未校验边的 sourcePort 是否在节点声明的 outputPorts 中
**方案**: 编译时检查每条边的 sourcePort 是否在源节点的 outputPorts 中
**验收**: 未知 port 产生 `UNKNOWN_OUTPUT_PORT` 诊断

#### REQ-005: 编译器-requiredOutputPorts 校验
**现状**: 条件节点的 true/false 端口未强制有边
**方案**: 检查 requiredOutputPorts 中的端口是否都有出边
**验收**: 缺少必要端口的边产生 `REQUIRED_OUTPUT_PORT_MISSING` 诊断

#### REQ-006: 编译器-可达性分析
**现状**: 未检测孤立节点
**方案**: 从 start 节点 BFS 检测可达性；反向 BFS 检测可达 end
**验收**: 不可达节点产生 `UNREACHABLE_NODE` / `NODE_CANNOT_REACH_END` 诊断

#### REQ-007: 节点状态扩展
**现状**: `pending / running / completed / failed / skipped`（5 种）
**方案**: 扩展为 `pending / ready / running / waiting / succeeded / failed / cancelled / skipped / needs_attention`（9 种）
**验收**: 节点状态枚举与 GM-HZ 一致

#### REQ-008: 引擎-事件系统
**现状**: 无事件系统
**方案**: 定义 `WorkflowEvent` 类型（run.started / node.ready / node.started / node.completed / node.failed / edge.taken / checkpoint.committed 等），每次状态推进追加事件
**验收**: 每个状态变化产生对应事件，事件有递增 seq

#### REQ-009: 引擎-Checkpoint 持久化
**现状**: 执行完毕后状态丢失
**方案**: 每次状态推进提交 checkpoint（nodeStates + edgeStates + nodeOutputs + nodeProgress），实现 `WorkflowRunStore` 接口
**验收**: 执行中途崩溃后可从 checkpoint 恢复

#### REQ-010: 引擎-Run 恢复
**现状**: 无恢复能力
**方案**: 实现 `resume(runId)` 从 checkpoint 恢复，支持未知节点 resolution（retry/fail）
**验收**: 崩溃后调用 resume 可继续执行

---

### 🟡 P1 — 核心能力补齐

#### REQ-011: spec.requires 依赖声明
**现状**: WorkflowTemplate 无 requires 字段
**方案**: 在 spec 中增加 `requires: WorkflowRequirement[]`，编译时校验节点声明的能力是否在 requires 中
**验收**: 节点声明的能力未在 requires 中时报 `WORKFLOW_REQUIREMENT_UNDECLARED`

#### REQ-012: 节点版本化 type@version
**现状**: `uses: 'core.start'` 无版本
**方案**: 支持 `uses: 'core.start@1'` 格式，编译时解析精确版本
**验收**: 无版本节点产生 warning，版本化节点从注册表精确解析

#### REQ-013: NodeDefinition 增强
**现状**: 无 validateConfig / dependencies / dependencyKinds / execution
**方案**: 在 WorkflowNodeDefinition 中增加：
- `validateConfig?(config): string[]`
- `dependencies?(config): WorkflowRequirement[]`
- `dependencyKinds?: string[]`
- `execution?: 'activity' | 'human-wait'`
**验收**: 节点定义支持完整接口

#### REQ-014: 编译器-Binding 校验增强
**现状**: Binding 校验只检查类型，不检查上游性和类型兼容
**方案**:
- Binding source 必须是严格上游（祖先集检查）
- source/target JSON Schema 类型兼容性检查（schemasMayOverlap）
- 必填 binding 缺失检测
**验收**: 非上游 binding、类型不兼容 binding 产生诊断

#### REQ-015: 编译器-Config 语义校验
**现状**: 未调用 validateConfig()
**方案**: 编译时调用 definition.validateConfig(node.with)，结果加入诊断
**验收**: config 语义错误产生 `NODE_CONFIG_SEMANTIC_INVALID` 诊断

#### REQ-016: 编译器-需求声明校验
**现状**: 未校验节点依赖是否在 requires 中
**方案**: 收集节点的 capabilities + dependencies(config) + secret binding，检查是否全部在 spec.requires 中声明
**验收**: 未声明依赖产生 `WORKFLOW_REQUIREMENT_UNDECLARED` 诊断

#### REQ-017: 编译器-诊断码体系
**现状**: 无标准化诊断码
**方案**: 建立统一诊断码：`GRAPH_CYCLE`, `UNREACHABLE_NODE`, `BINDING_TYPE_MISMATCH`, `UNKNOWN_OUTPUT_PORT` 等
**验收**: 每个诊断有唯一 code，可被 Agent 定点修复

#### REQ-018: 引擎-Owner 权限透传
**现状**: 所有 gateway 调用无 owner 参数
**方案**: 在 WorkflowToolRequest / WorkflowAgentRequest 等接口中增加 `owner`，引擎在调用时透传
**验收**: 所有 gateway 调用携带 owner

#### REQ-019: 引擎-Output 大小限制
**现状**: 无输出大小限制
**方案**: 在 WorkflowPolicies 中增加 `maxOutputBytes`，节点输出超过限制时拒绝
**验收**: 超大输出产生 `OUTPUT_TOO_LARGE` 错误

#### REQ-020: 引擎-能力作用域裁剪
**现状**: 节点可访问所有 gateway
**方案**: 实现 `scopeNodeServices(services, node.capabilities)`，节点只能访问自己声明的能力
**验收**: 未声明 `dsh.tools.execute` 的节点无法取得 Tool gateway

#### REQ-021: 引擎-子工作流 invoke
**现状**: subworkflow 节点只是简单引用
**方案**: 实现 `invoke(invocationId, templateId, revision, inputs, depth)`，幂等 invocationId
**验收**: 同一 invocationId 重复调用不产生副作用

#### REQ-022: 引擎-深度限制
**现状**: 无子工作流深度限制
**方案**: 实现 `subworkflowMaxDepth`（默认 8），超过时拒绝
**验收**: 深度超限产生 `SUBWORKFLOW_DEPTH_EXCEEDED` 错误

#### REQ-023: 引擎-Human-wait 节点
**现状**: approval 节点只是简单暂停
**方案**: 实现完整审批网关：action/reason 配置，4 种结果（allowed-once/rejected/cancelled/unavailable），token 一次性
**验收**: 审批节点走完整 DSH approval 流程

#### REQ-024: Tool 节点输出标准化
**现状**: Tool 节点输出 `{ toolName, args, result }`
**方案**: 统一为 `{ result: value }`，与 GM-HZ `dsh.tool@1` 一致
**验收**: Tool 节点输出格式标准化

#### REQ-025: Agent 节点增强
**现状**: Agent 节点只有 prompt/model/tools
**方案**: 增加 `label`、`outputSchema`（结构化输出校验）、`maxDepth`，输出标准化为 `{ runId, content, structured? }`
**验收**: Agent 节点支持完整配置和标准化输出

#### REQ-026: Subworkflow 节点增强
**现状**: subworkflow 只有 workflowId
**方案**: 增加 `revision`（不可变引用），运行时校验 revision 存在
**验收**: subworkflow 引用精确 published revision

#### REQ-027: Foreach 持久化帧
**现状**: foreach 是简单 mock 循环
**方案**: 每个 item 有独立状态（pending/running/completed），支持 checkpoint 恢复、maxConcurrency、maxItems
**验收**: foreach 支持崩溃恢复，每 item 独立状态

#### REQ-028: Lossless JSON materialize
**现状**: 节点输入输出直接引用活对象
**方案**: 实现 `snapshotJsonValue()` 深冻结，防止原型污染和循环引用
**验收**: 所有存储的输入/输出都是深冻结的 JSON

#### REQ-029: Draft CAS + 不可变发布
**现状**: 文件存储，无 CAS
**方案**: 实现 revision 乐观锁，Published revision 不可变，Draft 使用 CAS 更新
**验收**: 并发更新检测到冲突，Published revision 不可修改

#### REQ-030: 画布-统一数据模型
**现状**: 画布维护独立 `Workflow` 类型，与 `WorkflowTemplate` 不一致
**方案**: 画布直接操作 `WorkflowTemplate`，`layout` 字段分离（不进 semantic hash）
**验收**: 画布编辑直接修改 WorkflowTemplate，layout diff 不影响语义

#### REQ-031: 画布-RPC 架构
**现状**: 前端直接操作，无 Host 通信
**方案**: 实现 `WorkflowCanvasGateway`，所有读写通过 RPC
**验收**: Canvas 通过 Host RPC 操作模板，支持 session 授权

---

### 🟢 P2 — 增强与生态

#### REQ-032: SQLite 持久化
**现状**: localStorage
**方案**: 实现 SQLite 存储层（WAL 模式），包含 workflow_drafts / workflow_revisions / workflow_runs / workflow_run_events 表
**验收**: 数据持久化到 SQLite，支持事务提交

#### REQ-033: 事件审计日志面板
**现状**: 简单日志面板
**方案**: 基于 WorkflowEvent 的时间线可视化，节点执行 trace
**验收**: 审计面板展示完整事件时间线

#### REQ-034: Canvas 授权系统
**现状**: 无授权
**方案**: Session-based 授权 + 可选多用户策略 `authorize({ sessionId, agent, action, resourceId })`
**验收**: 多用户部署可按用户/workspace 授权

#### REQ-035: 测试覆盖
**现状**: 无系统测试
**方案**: 编译器测试、引擎测试、表达式测试、集成测试
**验收**: 核心模块有单元测试，端到端有集成测试

#### REQ-036: 文档
**现状**: 无规范文档
**方案**: 架构文档、安全文档、Workflow Template v1 规范、Showcase 工作流
**验收**: 文档覆盖架构、安全、规范、示例

#### REQ-037: CI
**现状**: 无 CI
**方案**: GitHub Actions CI（build + typecheck + test）
**验收**: PR 自动运行完整校验

#### REQ-038: 自定义节点注册
**现状**: 节点硬编码
**方案**: 通过 `ctx.workflowNodes.register()` 动态注册，支持第三方节点
**验收**: 插件可注册自定义节点类型

#### REQ-039: 脚本运行时注册
**现状**: 脚本节点固定实现
**方案**: 通过 `ctx.workflowScripts.register()` 注册版本化运行时
**验收**: 插件可注册自定义脚本语言

#### REQ-040: Workflow Builder Skill
**现状**: 无 Agent 生成工作流的 Skill
**方案**: 实现 `workflow-builder` Skill，引导 Agent 按 查询→拓扑→创建→校验→发布→执行 流程工作
**验收**: Agent 可通过对话从自然语言生成可发布的工作流

---

## 四、实施路线图

### Phase 1 — 安全与正确性（2 周）
REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007

### Phase 2 — 引擎核心（3 周）
REQ-008, REQ-009, REQ-010, REQ-018, REQ-019, REQ-020

### Phase 3 — 类型与编译器（2 周）
REQ-011, REQ-012, REQ-013, REQ-014, REQ-015, REQ-016, REQ-017, REQ-028

### Phase 4 — 节点与 Gateway（2 周）
REQ-021, REQ-022, REQ-023, REQ-024, REQ-025, REQ-026, REQ-027

### Phase 5 — 持久化与画布（3 周）
REQ-029, REQ-030, REQ-031, REQ-032, REQ-033

### Phase 6 — 生态与质量（3 周）
REQ-034, REQ-035, REQ-036, REQ-037, REQ-038, REQ-039, REQ-040

**总计**: ~15 周

---

## 五、优先级说明

- **P0（REQ-001~010）**: 安全漏洞 + 正确性缺陷，不修复无法用于生产
- **P1（REQ-011~031）**: 核心能力补齐，缩小与 GM-HZ 的功能差距
- **P2（REQ-032~040）**: 增强与生态，提升用户体验和可扩展性
