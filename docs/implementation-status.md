# dsh-flow-canvas 实现状态报告

> 基于 5 份设计文档的逐项实现对照

---

## 文档清单

| # | 文档 | 行数 | 核心内容 |
|---|------|------|----------|
| 1 | `2026-08-23-dsh-flow-canvas-design-v2.md` | 1049 | 竞品分析 + 功能矩阵 + 详细设计 |
| 2 | `dsh-plugin-comparison-requirements.md` | 527 | 7 个 DSH 插件调研 + REQ-001~007 |
| 3 | `iteration-requirements-v2.md` | ~400 | 竞品源码级分析 + 迭代需求 |
| 4 | `archify-integration.md` | ~200 | 架构图集成方案 |
| 5 | `archify-technical-details.md` | ~300 | 架构图技术细节 |

---

## 文档 1：设计 v2 — 功能矩阵

### P0 核心功能

| 功能 | 设计要求 | 实现状态 | 说明 |
|------|----------|----------|------|
| 可视化画布 | ReactFlow | ✅ 完成 | FlowCanvas.tsx + ReactFlow |
| 拖拽节点 | 20+ 类型 | ✅ 完成 | NodePanel 14 类 20+ 节点 |
| 连线定义依赖 | DAG | ✅ 完成 | ReactFlow edges + DAG 校验 |
| 条件分支 | then/else | ✅ 完成 | conditionNodeDefinition (10 种运算符) |
| MiniMap | 缩略图 | ✅ 完成 | ReactFlow MiniMap |
| 缩放控件 | zoom | ✅ 完成 | ReactFlow Controls |
| 网格背景 | grid | ✅ 完成 | Background variant="dots" |
| 撤销/重做 | undo/redo | ✅ 完成 | useReactFlow history |
| 快捷键 | keyboard | ✅ 完成 | useOnKeyDown |
| 导入/导出 | JSON/YAML | ✅ 完成 | handleImport/handleExport |
| 模板库 | 预置模板 | ✅ 完成 | 深度搜索研究工作流 |

### P1 增强功能

| 功能 | 设计要求 | 实现状态 | 说明 |
|------|----------|----------|------|
| 循环节点 | Loop/Iteration | ✅ 完成 | foreachNodeDefinition + LoopNode/IterationNode |
| 子工作流 | SubFlow | ✅ 完成 | subworkflowNodeDefinition |
| 实时执行可视化 | 节点状态 | ⚠️ 部分 | 有状态显示，无实时动画 |
| 执行历史 | 历史记录 | ✅ 完成 | executionHistoryStore + localStorage |
| 调试面板 | 日志 | ✅ 完成 | 日志面板 + onNodeLog |
| 版本管理 | 版本化 | ✅ 完成 | persistence.ts (50 版本) |
| 多 Agent 协作 | Team | ✅ 完成 | TeamPanel + 成员管理 |
| 右键菜单 | context menu | ❌ 未实现 | — |
| 复制/粘贴 | clipboard | ❌ 未实现 | — |
| 自动布局 | dagre | ❌ 未实现 | — |

### P2 高级功能

| 功能 | 设计要求 | 实现状态 | 说明 |
|------|----------|----------|------|
| API 发布 | REST API | ❌ 未实现 | — |
| Git Worktree | 独家 | ❌ 未实现 | — |
| DSH 原生集成 | 独家 | ✅ 完成 | ctx.workflows + 10 工具 API |

**文档 1 实现率：~70%** (P0: 100%, P1: 60%, P2: 25%)

---

## 文档 2：REQ-001~007

| REQ | 需求 | 实现状态 | 说明 |
|-----|------|----------|------|
| REQ-001 | 多模型团队系统 | ⚠️ UI 层 | TeamPanel UI 完成，核心逻辑需 DSH 支持 |
| REQ-002 | 持久任务账本 + 审查循环 | ⚠️ UI 层 | TaskLedgerPanel UI 完成，持久化用 localStorage |
| REQ-003 | 证据优先门控 | ❌ 未实现 | 需 DSH PreStepHook |
| REQ-004 | 自适应深度研究 | ❌ 未实现 | 需 DSH Workflow 系统 |
| REQ-005 | 验证器门控 Ralph | ❌ 未实现 | 需 DSH Ralph 系统 |
| REQ-006 | 推理强度扩展 | ❌ 未实现 | 需 DSH LLM 适配器 |
| REQ-007 | 架构图增强 | ❌ 未实现 | 需 DSH Mermaid 系统 |

**文档 2 实现率：~15%** (仅 UI 层壳，核心逻辑依赖 DSH)

---

## 文档 3：迭代需求 v2（竞品源码分析）

### P0 — 核心能力

| 需求 | 实现状态 | 说明 |
|------|----------|------|
| REQ-001: 对接 ctx.workflows | ✅ 完成 | 核心引擎 + 10 工具 API |
| REQ-002: 10 个工具 API | ✅ 完成 | workflow_nodes_list ~ workflow_run |
| REQ-003: SQLite 持久化 | ✅ 完成 | sqlite.cjs + JSON fallback |
| REQ-004: 工作流编译器 | ✅ 完成 | compiler.cjs (拓扑排序/环检测/语义哈希) |
| REQ-005: 10 种核心节点 | ✅ 完成 | nodes.cjs (start/end/condition/tool/agent/script/...) |

### P1 — 增强能力

| 需求 | 实现状态 | 说明 |
|------|----------|------|
| REQ-006: 工作流校验工具 | ✅ 完成 | workflow_validate + workflow_draft_validate |
| REQ-007: 脚本节点 | ✅ 完成 | scriptNodeDefinition (确定性执行) |
| REQ-008: 人工审批节点 | ✅ 完成 | humanApprovalNodeDefinition |
| REQ-009: 实时 Agent 可视化 | ⚠️ 部分 | 有状态显示，无力导向布局 |
| REQ-010: DAG 执行引擎 | ✅ 完成 | engine.cjs (并发控制/abort/检查点) |

### P2 — 高级能力

| 需求 | 实现状态 | 说明 |
|------|----------|------|
| REQ-011: WorkflowTemplate 规范 | ✅ 完成 | dsh.flow-canvas/v1 + converter.cjs |
| REQ-012: AJV Schema 校验 | ⚠️ 简化版 | 基础校验，未用 AJV |
| REQ-013: 版本管理 (CAS) | ✅ 完成 | publishVersion + 语义哈希 |
| REQ-014: 表达式语言 | ❌ 未实现 | 需 dsh.expr@1 |
| REQ-015: 能力系统 | ❌ 未实现 | 需 DSH capabilities |

**文档 3 实现率：~65%** (P0: 100%, P1: 75%, P2: 40%)

---

## 文档 4：Archify 集成方案

| 需求 | 实现状态 | 说明 |
|------|----------|------|
| 5 种图类型 | ❌ 未实现 | 需 Mermaid 扩展 |
| Before/Delta/After 对比 | ❌ 未实现 | — |
| 节点搜索 + 源码追溯 | ❌ 未实现 | — |
| 多格式导出 | ❌ 未实现 | — |
| 暗/亮主题 | ⚠️ 部分 | CSS 变量已支持 |

**文档 4 实现率：~10%**

---

## 文档 5：Archify 技术细节

| 需求 | 实现状态 | 说明 |
|------|----------|------|
| 类型化 JSON IR | ❌ 未实现 | — |
| 确定性检查 | ❌ 未实现 | — |
| 引导式故事播放 | ❌ 未实现 | — |
| WebM 导出 | ❌ 未实现 | — |
| 分享卡片 | ❌ 未实现 | — |

**文档 5 实现率：~0%**

---

## 总体统计

| 文档 | 实现率 | 核心差距 |
|------|--------|----------|
| 设计 v2 | **~70%** | 右键菜单、复制粘贴、自动布局、API 发布 |
| REQ-001~007 | **~15%** | 核心逻辑依赖 DSH 核心系统 |
| 迭代需求 v2 | **~65%** | 表达式语言、能力系统、实时可视化 |
| Archify 集成 | **~10%** | 5 种图类型、对比、导出 |
| Archify 技术 | **~0%** | 全部未实现 |

### 加权总实现率：~35%

### 已完成的核心能力（可立即使用）
1. ✅ React Flow 可视化画布（20+ 节点类型）
2. ✅ 10 种核心节点定义（符合 GM-HZ 规范）
3. ✅ DAG 工作流编译器（拓扑排序/环检测/语义哈希）
4. ✅ DAG 执行引擎（并发控制/abort/状态机）
5. ✅ 10 个标准工作流工具 API
6. ✅ SQLite 持久化（JSON fallback）
7. ✅ WorkflowTemplate 规范（dsh.flow-canvas/v1）
8. ✅ 画布 ↔ 模板双向转换
9. ✅ 团队管理 UI（TeamPanel）
10. ✅ 任务账本 UI（TaskLedgerPanel）
11. ✅ Token 追踪 UI（TokenSummaryPanel）
12. ✅ 版本管理 + 崩溃恢复
13. ✅ 深度搜索研究工作流（示例）

### 未实现但属于 DSH 核心能力（插件层无法独立实现）
- REQ-003 证据优先门控（需 DSH PreStepHook）
- REQ-004 自适应深度研究（需 DSH Workflow 系统）
- REQ-005 验证器门控 Ralph（需 DSH Ralph 系统）
- REQ-006 推理强度扩展（需 DSH LLM 适配器）
- REQ-007 架构图增强（需 DSH Mermaid 系统）
