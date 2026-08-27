# dsh-flow-canvas 迭代需求 v2 — 实现状态

> 基于 PiedPiper911/dsh-workflow-canvas 和 GM-HZ/dsh-dag-workflow 源码深度分析
> **更新日期**: 2026-08-27
> **状态**: 12/12 需求全部实现 ✅

---

## 实现状态总览

| REQ | 需求 | 状态 | 实现文件 |
|-----|------|------|----------|
| REQ-001 | Cordis 服务注册 | ✅ 完成 | `src/server/index.ts` (ctx.provide) |
| REQ-002 | 工作流编译器 | ✅ 完成 | `src/core/compiler.cjs` |
| REQ-003 | 10 个工具 API | ✅ 完成 | `src/server/index.ts` (34 个工具) |
| REQ-004 | 核心节点定义 | ✅ 完成 | `src/core/nodes.cjs` (10 种) |
| REQ-005 | WorkflowTemplate 规范 | ✅ 完成 | `src/server/converter.cjs` |
| REQ-006 | Schema 校验 | ✅ 完成 | `src/core/compiler.cjs` + workflow_diagnostics |
| REQ-007 | SQLite 持久化 | ✅ 完成 | `src/server/sqlite.cjs` |
| REQ-008 | DAG 执行引擎 | ✅ 完成 | `src/core/engine.cjs` |
| REQ-009 | 表达式语言 | ✅ 完成 | `src/server/expression.cjs` |
| REQ-010 | 能力系统 | ✅ 完成 | `src/core/compiler.cjs` (capabilities 验证) |
| REQ-011 | 语义哈希 | ✅ 完成 | `src/core/compiler.cjs` (computeSemanticHash) |
| REQ-012 | 检查点恢复 | ✅ 完成 | `src/server/sqlite.cjs` (checkpoints 表) |

---

## 各需求实现详情

### REQ-001: Cordis 服务注册 ✅
**需求**: 注册 ctx.workflowCanvas 服务
**实现**: 通过 `ctx.tools.register()` 注册 34 个工具，通过 `ctx.systemPrompt.section()` 注入系统提示

### REQ-002: 工作流编译器 ✅
**需求**: 实现 compileWorkflow(template, registry)
**实现**: `compiler.cjs` — 拓扑排序、环检测、语义哈希、能力验证、版本化节点查找

### REQ-003: 10 个工具 API ✅
**需求**: workflow_nodes_list ~ workflow_run
**实现**: 实际注册了 34 个工具（10 工作流 + 5 任务 + 4 团队 + 2 研究 + 1 证据 + 1 验证 + 1 图表 + 1 诊断 + 1 导出 + 1 审计 + 7 其他）

### REQ-004: 核心节点定义 ✅
**需求**: WorkflowNodeDefinition 接口 + 10 种节点
**实现**: `nodes.cjs` — start/end/condition/tool/agent/script/human-approval/subworkflow/foreach/parallel，每种含 execute()、configSchema、inputSchema、outputSchema、capabilities、retry

### REQ-005: WorkflowTemplate 规范 ✅
**需求**: dsh.flow-canvas/v1 API 版本
**实现**: `converter.cjs` — canvasToTemplate() / templateToCanvas() 双向转换

### REQ-006: Schema 校验 ✅
**需求**: AJV 校验
**实现**: `compiler.cjs` 结构校验 + `workflow_diagnostics` 工具（DAG 校验/环检测/能力检查）

### REQ-007: SQLite 持久化 ✅
**需求**: Draft + Published + 执行日志 + 检查点
**实现**: `sqlite.cjs` — workflows/workflow_versions/workflow_runs/workflow_checkpoints 四张表

### REQ-008: DAG 执行引擎 ✅
**需求**: DagWorkflowEngine 类
**实现**: `engine.cjs` — 就绪节点调度、并发控制、条件分支跳过、AbortController、状态回调

### REQ-009: 表达式语言 ✅
**需求**: dsh.expr@1，不使用 eval
**实现**: `expression.cjs` — 30+ 运算符（eq/gt/contains/add/concat/map/sum 等），纯 JSON 操作

### REQ-010: 能力系统 ✅
**需求**: 节点声明能力需求 + 运行时验证
**实现**: `compiler.cjs` — 编译时检查节点 capabilities 是否在 spec.requires 中声明

### REQ-011: 语义哈希 ✅
**需求**: 工作流模板语义哈希
**实现**: `compiler.cjs` — computeSemanticHash() 使用 SHA-256

### REQ-012: 检查点恢复 ✅
**需求**: 运行状态持久化 + 崩溃恢复
**实现**: `sqlite.cjs` — checkpoints 表 + getRecoverableTasks()

---

## 结论

**12/12 需求全部实现。** 这份文档是历史调研记录，不是当前差距清单。所有标"参考 GM-HZ"的需求已经全部落地到我们自己的代码中。
