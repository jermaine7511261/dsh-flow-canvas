# dsh-flow-canvas 迭代计划 v3

> 基于 DSH Context API 深度调研，13/15 需求可在插件层实现

---

## 核心 API 能力（已验证可用）

| API | 用途 | 用于哪些 REQ |
|-----|------|-------------|
| `ctx.tools.register(defineTool(...))` | 注册 Agent 工具 | 全部 |
| `ctx.subagents.start(provider, config)` | 启动子代理 | REQ-001/002/004/005 |
| `ctx.workflowEngine.start({script})` | JS 编排脚本 | REQ-004/005 |
| `ctx.systemPrompt.section({...})` | 注入提示词 | 全部 |
| `ctx.on('workflow/agent-start/end')` | 工作流事件 | REQ-002/003 |
| `ctx.goals.create/get/edit/complete` | 目标管理 | REQ-002 |
| `ctx.sessions` | 会话管理 | REQ-002 |
| `ctx.provide(name, service)` | 服务注册 | REQ-001 |

---

## Phase 1：任务账本（REQ-002）— 一切的基础

**目标**: 持久化任务 + 审查循环 + 崩溃恢复
**工作量**: 2 天
**依赖**: 无

### 实现清单

1. **SQLite 任务存储** (`src/server/taskLedger.cjs`)
   - tasks 表：id, title, status, assignee, reviewer, priority, evidence, token_cost
   - reviews 表：task_id, reviewer_id, status, comments
   - 审查循环状态机：pending → assigned → in_progress → review → completed/failed

2. **4 个工具注册** (`src/server/index.ts`)
   - `task_create` — 创建任务
   - `task_assign` — 分配任务
   - `task_review` — 触发审查（启动子代理）
   - `task_complete` — 完成任务

3. **审查子代理** 
   - `task_review` 内部调用 `ctx.subagents.start()` 启动审查
   - 审查结果写回任务状态

4. **崩溃恢复**
   - 启动时检查未完成任务
   - 恢复中断的审查循环

---

## Phase 2：多模型团队（REQ-001）

**目标**: 持久化团队 + 成员独立模型 + Lead 动态规划
**工作量**: 2 天
**依赖**: Phase 1

### 实现清单

1. **团队存储** (`src/server/teamStore.cjs`)
   - teams 表：id, name, lead_id, mode, config
   - members 表：team_id, name, role, model, tools, fallback

2. **3 个工具注册**
   - `team_create` — 创建团队
   - `team_add_member` — 添加成员
   - `team_run` — 执行团队任务

3. **team_run 执行逻辑**
   - 调用 `ctx.subagents.start()` 为每个成员启动子代理
   - Lead 成员的提示词包含团队结构
   - 通过事件追踪成员输出

---

## Phase 3：证据优先门控（REQ-003）

**目标**: Agent 声称前必须提供证据
**工作量**: 1 天
**依赖**: Phase 1

### 实现清单

1. **证据检查工具** (`evidence_check`)
   - 检查最近 N 条消息
   - 匹配模式："我记得" → 需要 memory_search
   - "计划就绪" → 需要 todo_write
   - "测试通过" → 需要 tool_output

2. **系统提示注入**
   - 注入证据优先原则
   - 无证据时自动拒绝

---

## Phase 4：自适应深度研究（REQ-004）

**目标**: 控制论闭环 + 边际增益 + 三态证据
**工作量**: 2 天
**依赖**: Phase 1

### 实现清单

1. **deep_research 工具**
   - 接收主题 + 验收标准
   - 内部调用 `ctx.workflowEngine.start()` 执行多轮研究

2. **工作流脚本**
   - 规划阶段：定义 scope + acceptance
   - 研究阶段：并行子代理搜索
   - 评估阶段：边际增益检查
   - 综合阶段：生成报告

3. **三态证据追踪**
   - confirmed / uncertain / gaps
   - 零增益时自动停止

---

## Phase 5：验证器 Ralph（REQ-005）

**目标**: 独立验证器评分 + 可观察轨迹
**工作量**: 1 天
**依赖**: Phase 1

### 实现清单

1. **verified_ralph 工具**
   - 内部 workflowEngine 编排
   - 执行→验证→评分→决策循环

2. **验证子代理**
   - 独立于执行代理
   - 每轮输出进度分数

---

## Phase 6：UI 增强

**目标**: 右键菜单 + 复制粘贴 + 自动布局
**工作量**: 1 天
**依赖**: 无

### 实现清单

1. **右键菜单** — ReactFlow `onPaneContextMenu`
2. **复制/粘贴** — clipboard API + ReactFlow
3. **自动布局** — dagre 库
4. **节点搜索** — ReactFlow 过滤

---

## Phase 7：架构图（REQ-007）

**目标**: 5 种图类型 + 对比 + 导出
**工作量**: 2 天
**依赖**: 无

### 实现清单

1. **generate_diagram 工具** — 生成 JSON IR
2. **客户端渲染** — 5 种图组件
3. **对比功能** — Before/Delta/After
4. **导出** — HTML/PNG/SVG

---

## 总工作量

| Phase | 需求 | 工作量 |
|-------|------|--------|
| Phase 1 | REQ-002 任务账本 | 2 天 |
| Phase 2 | REQ-001 多模型团队 | 2 天 |
| Phase 3 | REQ-003 证据门控 | 1 天 |
| Phase 4 | REQ-004 深度研究 | 2 天 |
| Phase 5 | REQ-005 验证器 Ralph | 1 天 |
| Phase 6 | UI 增强 | 1 天 |
| Phase 7 | REQ-007 架构图 | 2 天 |
| **总计** | | **11 天** |
