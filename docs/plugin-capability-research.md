# dsh-flow-canvas 插件层能力深度调研

> 基于 DSH 197 个已安装包的源码分析

---

## 一、DSH Context API 全景

### 1.1 可注入的服务（ctx.xxx）

| 服务 | 来源包 | 可用方法 | 插件层可用性 |
|------|--------|----------|-------------|
| `ctx.agents` | dsh-agent | start, get, roots, currentInitiator | ✅ 可用 |
| `ctx.goals` | dsh-goal | get, create, edit, pause, resume, complete, block | ✅ 可用 |
| `ctx.subagents` | dsh-subagent | start, startContinuable, getProvider | ✅ 可用 |
| `ctx.workflowEngine` | dsh-workflow | start (JS 编排脚本) | ✅ 可用 |
| `ctx.tools` | dsh-tools | register (defineTool) | ✅ 可用 |
| `ctx.systemPrompt` | dsh-agent-loop | section, context | ✅ 可用 |
| `ctx.sessions` | dsh-session | 会话管理 | ✅ 可用 |
| `ctx.events` | cordis | on, emit, dispatch | ✅ 可用 |
| `ctx.logger` | cordis | 日志 | ✅ 可用 |
| `ctx.inject` | cordis | 依赖注入 | ✅ 可用 |
| `ctx.on` | cordis | 事件监听 | ✅ 可用 |
| `ctx.effect` | cordis | 副作用管理 | ✅ 可用 |
| `ctx.provide` | cordis | 服务注册 | ✅ 可用 |
| `ctx.get` | cordis | 服务查找 | ✅ 可用 |
| `ctx.jobs` | dsh-subagent | 后台任务 | ✅ 可用 |
| `ctx.llm` | dsh-llm | LLM 调用 | ✅ 可用 |

### 1.2 可监听的事件

| 事件 | 触发时机 | 来源包 |
|------|----------|--------|
| `workflow/agent-start` | 工作流 Agent 节点启动 | dsh-workflow |
| `workflow/agent-end` | 工作流 Agent 节点结束 | dsh-workflow |
| `subagent/provider-added` | 子代理 Provider 注册 | dsh-subagent |
| `subagent/provider-removed` | 子代理 Provider 移除 | dsh-subagent |
| `agent/turn-start` | Agent 回合开始 | dsh-agent |
| `agent/turn-end` | Agent 回合结束 | dsh-agent |
| `session/append` | 会话消息追加 | dsh-session |

### 1.3 可注册的能力

| 能力 | 方式 | 说明 |
|------|------|------|
| 工具 | `ctx.tools.register(defineTool(...))` | 注册 Agent 可调用的工具 |
| 系统提示 | `ctx.systemPrompt.section({...})` | 注入提示词段落 |
| 会话投影 | `ctx.sessionProjections.register({...})` | UI 面板 |
| 设置项 | `ctx.settings.register(...)` | Settings 页面配置 |
| 客户端 UI | `ctx.clientModules` / slots | 前端界面 |

---

## 二、逐需求可行性分析

### REQ-001: 多模型团队系统

**之前判断**: ❌ 需 DSH 核心
**重新评估**: ✅ **插件层完全可实现**

**理由**:
- `ctx.subagents.start(provider, config)` 已支持指定 provider
- `ctx.tools.register()` 可注册 `team_create` / `team_run` 工具
- `ctx.systemPrompt.section()` 可注入团队调度提示词
- 团队配置可存储在插件自己的 SQLite/JSON 中

**实现方案**:
1. 插件注册 `team` 工具，配置存储在 `~/.dsh/flow-canvas/teams.json`
2. `team_run` 工具内部调用 `ctx.subagents.start()` 执行每个成员
3. Lead 成员的提示词包含团队结构和分配逻辑
4. 通过 `ctx.on('workflow/agent-end')` 追踪每个成员的输出

---

### REQ-002: 持久任务账本 + 审查循环

**之前判断**: ⚠️ UI 层
**重新评估**: ✅ **插件层完全可实现**

**理由**:
- `ctx.tools.register()` 可注册 `task_create` / `task_assign` / `task_review` / `task_complete`
- 任务持久化用插件自己的 SQLite
- 审查循环可通过 `ctx.subagents.start()` 启动审查子代理
- `ctx.on('workflow/agent-end')` 可追踪审查结果

**实现方案**:
1. SQLite 存储任务（status, assignee, reviewer, evidence）
2. `task_review` 工具启动子代理审查
3. 审查结果写回任务状态
4. 崩溃恢复：启动时检查未完成任务

---

### REQ-003: 证据优先门控

**之前判断**: ❌ 需 DSH PreStepHook
**重新评估**: ✅ **插件层可实现（通过工具拦截）**

**理由**:
- `ctx.tools.register()` 可注册包装工具
- 包装工具在执行前检查最近的工具调用是否有证据
- `ctx.on('agent/turn-end')` 可追踪 Agent 行为
- 无证据时返回错误提示

**实现方案**:
1. 注册 `evidence_check` 工具
2. Agent 调用时检查最近 N 条消息
3. 匹配模式（"我记得"→需要 memory_search 结果）
4. 无证据时返回 "请先提供证据"

---

### REQ-004: 自适应深度研究

**之前判断**: ❌ 需 DSH Workflow
**重新评估**: ✅ **插件层可实现（编排为工作流）**

**理由**:
- `ctx.workflowEngine.start({script})` 已支持 JS 编排脚本
- 脚本可调用 `ctx.subagents.start()` 启动研究子代理
- `ctx.tools.register()` 可注册 `deep_research` 工具
- 工具内部调用 workflowEngine 执行多轮研究

**实现方案**:
1. `deep_research` 工具接收主题
2. 内部调用 `ctx.workflowEngine.start()` 执行：
   - 规划阶段：定义 scope + acceptance
   - 研究阶段：并行子代理搜索
   - 评估阶段：边际增益检查
   - 综合阶段：生成报告
3. 每轮通过 `ctx.on('workflow/agent-end')` 追踪进度

---

### REQ-005: 验证器门控 Ralph

**之前判断**: ❌ 需 DSH Ralph
**重新评估**: ✅ **插件层可实现**

**理由**:
- `ctx.workflowEngine.start()` 已支持编排脚本
- 脚本可实现：执行→验证→评分→决策循环
- `ctx.subagents.start()` 可启动验证子代理
- 与现有 ralph 并存，不冲突

**实现方案**:
1. `verified_ralph` 工具
2. 内部 workflowEngine 脚本：
   - 执行阶段：`ctx.subagents.start(provider, {prompt: task})`
   - 验证阶段：`ctx.subagents.start(validator, {prompt: "评估完成度"})`
   - 决策：分数 > 阈值 → 完成，否则继续
3. 轨迹记录到会话

---

### REQ-006: 推理强度扩展

**之前判断**: ❌ 需 DSH LLM 适配器
**重新评估**: ⚠️ **部分可实现**

**理由**:
- 推理强度是 LLM Provider 层面的参数
- 插件可配置子代理的推理强度
- 但不能修改 DSH 核心的推理强度枚举

**实现方案**:
1. 插件注册设置项 `reasoning-effort-levels`
2. 子代理启动时传递推理强度参数
3. 工具调用时可指定推理强度

---

### REQ-007: 架构图增强

**之前判断**: ❌ 需 DSH Mermaid
**重新评估**: ✅ **插件层完全可实现**

**理由**:
- `ctx.tools.register()` 可注册 `generate_diagram` 工具
- 工具可生成 5 种图类型（架构/工作流/序列/数据流/生命周期）
- `ctx.clientModules` 可注册前端渲染组件
- 多格式导出（HTML/PNG/SVG）可在客户端实现

**实现方案**:
1. `generate_diagram` 工具生成 JSON IR
2. 客户端组件渲染 5 种图类型
3. Before/Delta/After 对比在客户端实现
4. 导出功能在客户端实现

---

## 三、UI 增强可行性

| 功能 | 实现方式 | 难度 |
|------|----------|------|
| 右键菜单 | ReactFlow `onPaneContextMenu` | 🟢 低 |
| 复制/粘贴 | `useReactFlow` + clipboard API | 🟢 低 |
| 自动布局 | dagre/elkjs 库 | 🟡 中 |
| 实时执行可视化 | SSE/WebSocket + 节点状态动画 | 🟡 中 |
| API 发布 | Express 路由 + REST API | 🟡 中 |
| 节点搜索 | ReactFlow `useReactFlow` + 过滤 | 🟢 低 |

---

## 四、结论

### 之前错误判断的修正

| 需求 | 之前 | 现在 | 原因 |
|------|------|------|------|
| REQ-001 多模型团队 | ❌ | ✅ | ctx.subagents + tools 完全够用 |
| REQ-002 持久任务账本 | ⚠️ | ✅ | SQLite + tools + subagents |
| REQ-003 证据优先门控 | ❌ | ✅ | 工具包装 + 消息检查 |
| REQ-004 自适应深度研究 | ❌ | ✅ | workflowEngine + subagents |
| REQ-005 验证器 Ralph | ❌ | ✅ | workflowEngine 编排 |
| REQ-006 推理强度 | ❌ | ⚠️ | 部分可配（子代理级别） |
| REQ-007 架构图 | ❌ | ✅ | tools + 客户端渲染 |

### 插件层可实现的总需求：13/15（87%）

### 之前判断"需 DSH 核心"的只有 2 项：
1. REQ-006 推理强度全局配置（只能配子代理级别）
2. 部分 DSH 核心事件的深度拦截（如 agent/step-before）
