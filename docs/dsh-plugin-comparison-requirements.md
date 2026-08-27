# DSH 插件深度调研 × 功能对比 × 迭代需求文档

> 基于 7 个 DSH 插件的源码分析，与当前 DSH 系统功能逐项对比，
> 识别可增加/增强的能力，输出迭代需求清单。

**调研日期**: 2026-08-24
**调研范围**: toolclub/dsh-agent-team-gui, tt-a1i/archify, omdsh-dev/dsh-deep-research,
LeslieWylie/dsh-agent-orchestration (+dsh-ops-kit), MistyBridge/dsh-agent-bus,
omdsh-dev/dsh-verified-ralph, TOBYCAI/dsh-patch-reasoning

---

## 一、当前 DSH 系统能力基线

| 能力模块 | DSH 实现 | 成熟度 |
|----------|----------|--------|
| **Goal 系统** | 长期目标追踪 + 自动续行 + round 上限 + blocked/paused | ✅ 成熟 |
| **Ralph** | 无上下文种子的全新代理迭代循环 | ✅ 成熟 |
| **Workflow** | 多阶段流水线 + phase + agent/pipeline/parallel | ✅ 成熟 |
| **Subagent** | 后台/分叉/可续传子代理 + 消息传递 | ✅ 成熟 |
| **Todo** | 任务列表管理 (pending/in_progress/completed) | ✅ 成熟 |
| **Flow Canvas** | 可视化 DAG 工作流编辑器 | ✅ 成熟 |
| **Skills** | 可加载的指令/资源包 | ✅ 成熟 |
| **Web Search** | 网页搜索集成 | ✅ 成熟 |
| **Sandbox** | 文件/命令访问控制 | ✅ 成熟 |
| **Web GUI** | 浏览器可视化管理 | ✅ 成熟 |
| **User Interaction** | 选择题/确认/自定义输入 | ✅ 成熟 |
| **多模型 Provider** | 支持多种 LLM 提供商 | ✅ 成熟 |
| **Skill 系统** | 加载/管理/执行技能 | ✅ 成熟 |


---

## 二、7 个插件逐项深度分析

### 2.1 toolclub/dsh-agent-team-gui (123 stars)

**定位**: 持久化多模型 Agent 团队管理

**核心能力**:
| 能力 | 说明 |
|------|------|
| 成员模型独立 | 每个成员可配不同模型/角色/回退路由/token 限额/工具策略 |
| 动态工作流规划 | Lead 模型根据当前请求自动分配工作和依赖 |
| Team/Solo/Inherited 三种模式 | 持久对话覆盖 / 项目默认 / 单消息例外 |
| 有界 DAG + 重试 + 质量门 | 长任务可观测、可取消、有限、可重启 |
| 官方 Provider Token 用量 | input/cache-read/cache-write/output Token，不虚构价格 |
| 版本/配方/定义备份 | 可复现团队、无凭证共享、影响预览、模型路由重映射 |

**与 DSH 现有能力对比**:
| 功能 | DSH 现有 | agent-team-gui | 差距 |
|------|----------|----------------|------|
| 多模型分配 | ❌ 单会话单模型 | ✅ 每成员独立模型 | **需要新增** |
| 持久化团队 | ❌ 无 | ✅ Settings→Teams 管理 | **需要新增** |
| 角色/工具策略 | ❌ 无 | ✅ 每成员独立配置 | **需要新增** |
| 有界 DAG | ⚠️ Workflow 有阶段 | ✅ 真正 DAG + 重试 + 质量门 | **需增强** |
| Token 用量追踪 | ⚠️ 基础 usage | ✅ Provider 级精确追踪 | **需增强** |
| 团队版本管理 | ❌ 无 | ✅ 版本/配方/备份 | **需要新增** |

### 2.2 tt-a1i/archify (15K stars)

**定位**: 架构/工作流/序列/数据流/生命周期图 — 自包含 HTML + 动画

**核心能力**:
| 能力 | 说明 |
|------|------|
| 5 种图类型 | 架构图、工作流图、序列图、数据流图、生命周期图 |
| 4 种预设 | 不同风格/用途预设 |
| 暗/亮主题 | 内置主题切换 |
| Before/Delta/After 对比 | 两个快照的增/删/改/移/路由变更 |
| 节点搜索 + 源码追溯 | 搜索节点、打开验证过的源码、追踪上下游 |
| 引导式故事播放 | 不发明拓扑的引导式故事 |
| 类型化 JSON IR | 类型安全的中间表示 |
| 确定性检查 | 可验证的确定性检查 |
| 多格式导出 | HTML/PNG/SVG/WebM/1200×630 分享卡片 |

**与 DSH 现有能力对比**:
| 功能 | DSH 现有 | archify | 差距 |
|------|----------|---------|------|
| Mermaid 图表 | ✅ 内置渲染 | ✅ 5 种图+4 预设 | **可增强** |
| 架构对比 | ❌ 无 | ✅ Before/Delta/After | **需要新增** |
| 节点搜索/追溯 | ❌ 无 | ✅ 搜索+源码追溯 | **需要新增** |
| 多格式导出 | ⚠️ 仅 Mermaid 文本 | ✅ HTML/PNG/SVG/WebM | **需增强** |
| 分享卡片 | ❌ 无 | ✅ 1200×630 | **需要新增** |

### 2.3 omdsh-dev/dsh-deep-research (18 stars)

**定位**: 基于控制论+信息论的自适应深度研究编排器

**核心能力**:
| 能力 | 理论基础 | 说明 |
|------|----------|------|
| 答案空间+验收标准 | 控制论：参考信号校准 | 规划代理先定义 scope + acceptance |
| 覆盖度自检 | Ashby 必要多样性定律 | 枚举信息维度，映射子问题，输出 coverage_gaps |
| 三态证据追踪 | 信息论：信息=不确定性减少 | confirmed/uncertain/gaps |
| 边际信息增益验证 | 信息论：EIG 递减 | 预期新增→行动→更新→验证；零增益即停 |
| 自适应再规划 | 控制论：自适应控制 | 每轮收集 high-priority 缺口→自动补充研究 |
| 有损压缩综合 | 信息论：率失真 | 只保留对结论有区分度的信息 |
| 对抗性审查 | 信息论：信道纠错 | 引用抽查+覆盖度审计+矛盾标注 |

**与 DSH 现有能力对比**:
| 功能 | DSH 现有 | deep-research | 差距 |
|------|----------|---------------|------|
| 研究流程 | ⚠️ 基础 web_search | ✅ 控制论闭环 | **需要新增** |
| 证据追踪 | ❌ 无 | ✅ 三态(confirmed/uncertain/gaps) | **需要新增** |
| 边际增益控制 | ❌ 无 | ✅ 零增益即停 + 硬上限 | **需要新增** |
| 自适应再规划 | ❌ 无 | ✅ 每轮自动补充 | **需要新增** |
| 对抗性审查 | ❌ 无 | ✅ 引用抽查+矛盾标注 | **需要新增** |
| 覆盖度分析 | ❌ 无 | ✅ 信息维度枚举 | **需要新增** |

### 2.4 LeslieWylie/dsh-agent-orchestration → dsh-ops-kit (3 stars)

**定位**: 证据优先的多代理编排 + 5 个只读技能包

**核心能力 (dsh-ops-kit)**:
| 能力包 | 工具 | 说明 |
|--------|------|------|
| 记忆搜索 | dsh_memory_search | 有界记忆搜索 |
| 编排规划 | dsh_orchestration_plan | 研究/实现/基准/发布/事件计划 |
| 代理循环协调 | — | agent-loop 协调规则 |
| 基准结果门控 | — | 基准测试通过/失败门控 |
| 插件发布卫生 | — | 插件发布流程规范 |
| PTY 诊断 | — | PTY 提示握手运行时诊断 |

**核心原则**: 代理声称"我记得这个"/"计划已就绪"/"基准通过"/"发布安全"之前，必须能指向证据。

**与 DSH 现有能力对比**:
| 功能 | DSH 现有 | ops-kit | 差距 |
|------|----------|---------|------|
| 记忆搜索 | ⚠️ 基础 | ✅ 有界搜索+证据 | **需增强** |
| 编排规划 | ⚠️ Workflow | ✅ 5 种计划模板 | **需增强** |
| 证据优先原则 | ❌ 无 | ✅ 强制证据门控 | **需要新增** |
| 插件发布规范 | ❌ 无 | ✅ 发布卫生 | **需要新增** |

### 2.5 MistyBridge/dsh-agent-bus (2 stars)

**定位**: 多代理编排 — 隔离会话→团队协作 + DAG 工作流

**核心能力**:
| 能力 | 说明 |
|------|------|
| 持久任务账本 | 真正的工作项，不是消息；create_task/assign/review/complete |
| 审查循环 | 代理之间真正的审查，不是人工粘贴 |
| DAG 调度器 | 前置节点完成后才交付后续节点 |
| 崩溃安全恢复 | 持久化状态，崩溃后可恢复 |
| Token 成本追踪 | 每个任务的 token 消耗可见 |
| Flow (DAG) 看板 | 可视化 DAG 节点状态 |

**与 DSH 现有能力对比**:
| 功能 | DSH 现有 | agent-bus | 差距 |
|------|----------|-----------|------|
| 任务账本 | ⚠️ Todo (简单) | ✅ 持久+审查+分配 | **需增强** |
| 代理间审查 | ❌ 无自动审查 | ✅ 审查循环 | **需要新增** |
| DAG 调度 | ⚠️ Workflow 阶段 | ✅ 真正 DAG | **需增强** |
| 崩溃恢复 | ❌ 无 | ✅ 持久化+恢复 | **需要新增** |
| DAG 看板 | ⚠️ Flow Canvas | ✅ 任务级状态看板 | **可增强** |

### 2.6 omdsh-dev/dsh-verified-ralph (0 stars)

**定位**: 验证器门控的 fresh-agent Ralph 工作流

**核心能力**:
| 能力 | 说明 |
|------|------|
| 验证器门控 | 每轮 Ralph 由独立验证器评分完成进度 |
| 可观察轨迹 | 将不可变 DSH session 投影为可观测轨迹步骤 |
| 独立评分 | 验证器独立于执行代理，避免自我评估偏见 |
| 协议隔离 | 不修改 DSH 核心，不重定义验证器 API |

**与 DSH 现有能力对比**:
| 功能 | DSH 现有 | verified-ralph | 差距 |
|------|----------|----------------|------|
| Ralph 循环 | ✅ 基础 | ✅ + 验证器门控 | **需增强** |
| 完成度评估 | ⚠️ 基础 goal 状态 | ✅ 独立评分 | **需要新增** |
| 轨迹可观测 | ❌ 无 | ✅ 可观测轨迹步骤 | **需要新增** |
| 反自我偏见 | ❌ 无 | ✅ 独立验证器 | **需要新增** |

### 2.7 TOBYCAI/dsh-patch-reasoning (0 stars)

**定位**: DeepSeek 推理强度补丁 + 默认模型切换

**核心能力**:
| 能力 | 说明 |
|------|------|
| 推理强度拓宽 | off/high/max → off/minimal/low/medium/high/xhigh/max (7 档) |
| workflow 默认模型 | 子 agent 默认使用 deepseek-v4-flash |
| ralph 默认模型 | ralph worker 默认使用 deepseek-v4-flash |
| 幂等补丁 | 重复运行不重复打补丁，已标记则跳过 |

**与 DSH 现有能力对比**:
| 功能 | DSH 现有 | patch-reasoning | 差距 |
|------|----------|-----------------|------|
| 推理强度档位 | ⚠️ 3 档 (off/high/max) | ✅ 7 档 | **需增强** |
| 子 agent 模型 | ⚠️ 继承父模型 | ✅ 可独立配置 | **需增强** |
| ralph 模型配置 | ⚠️ 固定 | ✅ 可自定义 | **需增强** |

---

## 三、功能差距矩阵

### 3.1 按优先级排列的新增能力

| # | 能力 | 来源插件 | 优先级 | DSH 现状 | 建议方案 |
|---|------|----------|--------|----------|----------|
| 1 | **多模型团队管理** | agent-team-gui | 🔴 P0 | 单会话单模型 | 新增 Team 系统：Settings→Teams 管理 |
| 2 | **持久任务账本 + 审查循环** | agent-bus | 🔴 P0 | Todo 简单列表 | 增强 Todo → TaskLedger + ReviewLoop |
| 3 | **证据优先门控** | ops-kit | 🔴 P0 | 无 | 新增 EvidenceGate 中间件 |
| 4 | **自适应深度研究** | deep-research | 🟡 P1 | 基础 web_search | 新增 DeepResearch 工具 + 控制论闭环 |
| 5 | **验证器门控 Ralph** | verified-ralph | 🟡 P1 | 基础 Ralph | 增强 Ralph + Verifier 评分 |
| 6 | **崩溃安全恢复** | agent-bus | 🟡 P1 | 无持久化 | 新增 TaskPersistence 层 |
| 7 | **推理强度 7 档** | patch-reasoning | 🟡 P1 | 3 档 | 扩展 reasoning_efforts 配置 |
| 8 | **架构对比图** | archify | 🟢 P2 | 仅 Mermaid | 增强 Mermaid → 多图类型+对比 |
| 9 | **Token 精确追踪** | agent-team-gui | 🟢 P2 | 基础 usage | 增强 TokenTracker → Provider 级 |
| 10 | **DAG 看板** | agent-bus | 🟢 P2 | Flow Canvas 基础 | 增强 Flow Canvas → 任务级状态 |
| 11 | **节点搜索/源码追溯** | archify | 🟢 P2 | 无 | 新增 GraphSearch + SourceTrace |
| 12 | **多格式导出** | archify | 🟢 P2 | 仅文本 | 新增 HTML/PNG/SVG/WebM 导出 |
| 13 | **团队版本管理** | agent-team-gui | 🔵 P3 | 无 | 新增 TeamVersioning |
| 14 | **编排计划模板** | ops-kit | 🔵 P3 | 无 | 新增 5 种计划模板 |
| 15 | **插件发布规范** | ops-kit | 🔵 P3 | 无 | 新增 ReleaseHygiene 检查 |

---

## 四、详细迭代需求

### REQ-001: 多模型团队系统 (来自 agent-team-gui)

**需求描述**: 支持创建持久化的多模型 Agent 团队，每个成员拥有独立的模型、角色、工具策略。

**功能点**:
- [ ] Settings → Teams 管理界面
- [ ] 成员配置：模型/角色/回退路由/token 限额/工具策略
- [ ] Team/Solo/Inherited 三种模式
- [ ] Lead 模型动态规划
- [ ] 团队版本管理（版本/配方/定义备份）
- [ ] 跨项目/跨会话复用

**验收标准**:
1. 用户可在 Settings 创建包含 3+ 成员的团队
2. 每成员可独立配置模型和工具
3. 团队可在不同会话中复用
4. Lead 自动规划 DAG 并分配工作

### REQ-002: 持久任务账本 + 审查循环 (来自 agent-bus)

**需求描述**: 将 Todo 增强为持久化任务账本，支持代理间自动审查。

**功能点**:
- [ ] create_task / assign / review / complete 语义
- [ ] 任务持久化到磁盘
- [ ] 代理间自动审查循环
- [ ] 崩溃安全恢复
- [ ] 每任务 Token 成本追踪

**验收标准**:
1. 任务在崩溃后可恢复
2. 审查自动触发，无需人工粘贴
3. 每任务显示 token 消耗

### REQ-003: 证据优先门控 (来自 ops-kit)

**需求描述**: 代理声称完成某操作前，必须提供证据。

**功能点**:
- [ ] 记忆声称门控：声称"我记得"前必须搜索+引用
- [ ] 计划声称门控：声称"计划就绪"前必须展示计划
- [ ] 基准声称门控：声称"测试通过"前必须展示结果
- [ ] 发布声称门控：声称"发布安全"前必须展示检查

**验收标准**:
1. 无证据的声称被自动拒绝
2. 门控可配置开关

### REQ-004: 自适应深度研究 (来自 deep-research)

**需求描述**: 基于控制论+信息论的自适应研究编排。

**功能点**:
- [ ] deep_research 工具
- [ ] 答案空间 (scope) + 验收标准 (acceptance) 定义
- [ ] 覆盖度自检 (coverage_gaps)
- [ ] 三态证据追踪 (confirmed/uncertain/gaps)
- [ ] 边际信息增益验证 (零增益即停)
- [ ] 自适应再规划 (每轮补充研究)
- [ ] 对抗性审查 (引用抽查+矛盾标注)
- [ ] 有损压缩综合报告

**验收标准**:
1. 简单主题一轮收敛
2. 复杂主题自动扩展
3. 零增益时自动停止
4. 报告保留置信度与矛盾

### REQ-005: 验证器门控 Ralph (来自 verified-ralph)

**需求描述**: 每轮 Ralph 由独立验证器评分完成进度。

**功能点**:
- [ ] verified_ralph 工具（与现有 ralph 并存）
- [ ] 独立验证器评分
- [ ] 可观察轨迹步骤
- [ ] 进度评分反馈

**验收标准**:
1. 验证器独立于执行代理
2. 每轮输出进度分数
3. 不修改 DSH 核心

### REQ-006: 推理强度扩展 (来自 patch-reasoning)

**需求描述**: 推理强度从 3 档扩展到 7 档。

**功能点**:
- [ ] 推理强度: off / minimal / low / medium / high / xhigh / max
- [ ] 子 agent 默认模型可配置
- [ ] ralph worker 默认模型可配置

**验收标准**:
1. 所有 7 档均可用
2. 子 agent 模型独立于主 agent

### REQ-007: 架构图增强 (来自 archify)

**需求描述**: 增强 Mermaid 为多图类型+对比能力。

**功能点**:
- [ ] 5 种图类型 (架构/工作流/序列/数据流/生命周期)
- [ ] Before/Delta/After 对比
- [ ] 节点搜索 + 源码追溯
- [ ] 多格式导出 (HTML/PNG/SVG)
- [ ] 暗/亮主题

**验收标准**:
1. 支持 5 种图类型
2. 可对比两个版本差异

---


---

## 五、参考点与实现方法

### REQ-001: 多模型团队系统 — 参考与实现

**参考点**:
| 参考来源 | 路径 | 关键模式 |
|----------|------|----------|
| Goal 系统 | `packages/goal/goal/src/index.ts` | 事件溯源状态 + 比较交换变更 + 进程本地激活 |
| Subagent | `packages/subagent/tool-subagent/src/index.ts` | Provider 模式 + agentOptions + toolFilter |
| Session Projection | `packages/session/session-projection/` | 会话投影键声明 + UI 渲染 |
| agent-team-gui | `github:toolclub/dsh-agent-team-gui` | 持久化团队 + Settings UI + 模型路由 |

**数据模型**:
```typescript
interface TeamMember {
  id: string; name: string;
  role: "planner" | "implementer" | "reviewer" | "specialist";
  model: string; fallbackModel?: string; maxTokens?: number;
  toolPolicy: { allow?: string[]; deny?: string[] };
}

interface Team {
  id: string; name: string; version: number;
  members: TeamMember[]; leadId: string;
  config: { mode: "team"|"solo"|"inherited"; maxRetries: number; qualityGate: boolean; };
}
```

**实现步骤**: 1) 创建 packages/team/ → 2) TeamService (参考 GoalService) → 3) team_run 工具 (参考 tool-subagent) → 4) Settings UI (参考 ui-goal) → 5) Session Projection

### REQ-002: 持久任务账本 — 参考与实现

**参考点**:
| 参考来源 | 路径 | 关键模式 |
|----------|------|----------|
| Todo 工具 | `packages/todo/tool-todo/src/index.ts` | 全列表替换 + Session Projection + last-write-wins |
| Goal fold | `packages/goal/goal/src/fold.ts` | 事件溯源 + fold + 比较交换 |
| Session 持久化 | `packages/session/session-persistence/` | SQLite 持久化策略 |
| agent-bus | `github:MistyBridge/dsh-agent-bus` | 持久任务账本 + 审查循环 + DAG 调度 |

**数据模型**:
```typescript
interface Task {
  id: string; title: string; description?: string;
  status: "pending"|"assigned"|"in_progress"|"review"|"completed"|"failed";
  assignee?: string; reviewer?: string; parentId?: string;
  dependencies: string[]; priority: "P0"|"P1"|"P2"|"P3";
  tokenCost: { input: number; output: number };
  evidence: string[];
}

interface ReviewRequest {
  taskId: string; reviewerId: string;
  status: "pending"|"approved"|"rejected"; comments: string[];
}
```

**实现步骤**: 1) 创建 packages/task/ → 2) TaskPersistence (SQLite, 参考 Goal fold) → 3) task_create/assign/review/complete 工具 → 4) ReviewLoop (参考 Subagent Provider) → 5) 崩溃恢复 resumeAll()

### REQ-003: 证据优先门控 — 参考与实现

**参考点**:
| 参考来源 | 路径 | 关键模式 |
|----------|------|----------|
| Agent Loop | `packages/core/agent/` | PreStepHook + 工具执行拦截 |
| Guard | `packages/guard/` | 重复工具提醒 + 超时策略 |
| ops-kit | `github:LeslieWylie/dsh-ops-kit` | 证据优先原则 (memory_search/todo_write/verification_report) |

**实现步骤**: 1) 创建 packages/guard/evidence-gate/ → 2) 定义证据规则 (trigger → required evidence type) → 3) 实现 PreStepHook 拦截器 → 4) 检查最近工具调用是否有证据 → 5) 无证据时阻止并提示

**证据规则示例**:
```
trigger: /i remember|from memory/  → required: memory_search
trigger: /plan is ready/            → required: todo_write
trigger: /test passed/              → required: tool_output
trigger: /release safe/             → required: verification_report
```

### REQ-004: 自适应深度研究 — 参考与实现

**参考点**:
| 参考来源 | 路径 | 关键模式 |
|----------|------|----------|
| Workflow | `packages/workflow/workflow/src/` | 脚本执行 + 阶段 + 并发 agent/pipeline/parallel |
| Subagent | `packages/subagent/` | 子代理启动 + 结果收集 |
| deep-research | `github:omdsh-dev/dsh-deep-research` | 控制论闭环 + 边际增益 + 三态证据 |

**实现步骤**: 1) 创建 packages/research/deep-research/ → 2) plan() 定义 scope + acceptance + coverage_gaps → 3) researchSubQuestion() web_search + 三态证据 (confirmed/uncertain/gaps) → 4) 边际增益验证 (零增益即停) → 5) 自适应再规划 (每轮补充缺口) → 6) synthesize() 有损压缩综合报告

**控制论闭环流程**:
```
规划(scope+acceptance) → 并行研究 → 三态证据更新 → 边际增益检查
       ↑                                              ↓
       └──── 零增益? ← 否 ← 有新缺口? ──→ 补充研究 ──┘
                   ↓ 是
              综合报告(有损压缩)
```

### REQ-005: 验证器门控 Ralph — 参考与实现

**参考点**:
| 参考来源 | 路径 | 关键模式 |
|----------|------|----------|
| Ralph 工具 | `packages/workflow/tool-ralph/src/index.ts` | 固定脚本 + 结构化输出 + 轮次限制 + subagentProvider |
| verified-ralph | `github:omdsh-dev/dsh-verified-ralph` | 独立验证器 + 轨迹可观测 + 进度评分 |

**实现步骤**: 1) 创建 packages/workflow/verified-ralph/ → 2) 复用 Ralph 的 fresh-agent 循环 (参考 tool-ralph 的 subagentProvider + maxRounds) → 3) 每轮后启动独立验证器子代理 → 4) 验证器评分 → 决策 (complete/continue/blocked) → 5) 记录轨迹步骤

### REQ-006: 推理强度扩展 — 参考与实现

**参考点**:
| 参考来源 | 路径 | 关键模式 |
|----------|------|----------|
| Provider Core | `packages/llm/llm/src/` | 推理模式检测 + 适配器映射 |
| patch-reasoning | `github:TOBYCAI/dsh-patch-reasoning` | 7 档推理 (off/minimal/low/medium/high/xhigh/max) |

**实现步骤**: 1) 修改 packages/llm/llm/src/reasoning.ts → 2) 扩展 ReasoningEffort 类型 → 3) 更新所有 Provider 适配器映射 → 4) 添加子 agent 默认模型配置 → 5) 添加 Ralph worker 默认模型配置

**7 档推理映射**:
```
off(1.0x) → minimal(1.2x) → low(1.5x) → medium(2.0x) → high(3.0x) → xhigh(5.0x) → max(8.0x)
(括号内为近似 token 消耗倍数)
```

### REQ-007: 架构图增强 — 参考与实现

**参考点**:
| 参考来源 | 路径 | 关键模式 |
|----------|------|----------|
| Mermaid | jcode-tui-mermaid | 内置 Mermaid 渲染 |
| archify | `github:tt-a1i/archify` | 5 种图 + Before/Delta/After 对比 + 多格式导出 |

**实现步骤**: 1) 扩展 Mermaid 为 5 种图类型 (架构/工作流/序列/数据流/生命周期) → 2) 实现 DiagramSnapshot + DiagramDiff 数据模型 → 3) compareDiagrams() 对比函数 → 4) 多格式导出 (HTML/PNG/SVG/WebM) → 5) 节点搜索 + 源码追溯

**图类型枚举**:
```
type DiagramType = "architecture" | "workflow" | "sequence" | "dataflow" | "lifecycle";
```

## 六、实施路线图

| Phase | 需求 | 工作量 | 依赖 | 产出 |
|-------|------|--------|------|------|
| **P0-a** | REQ-002 持久任务账本 | 2 周 | 无 | TaskLedger + ReviewLoop |
| **P0-b** | REQ-003 证据优先门控 | 1 周 | REQ-002 | EvidenceGate 中间件 |
| **P0-c** | REQ-001 多模型团队 | 3 周 | REQ-002 | Team 系统 + UI |
| **P1-a** | REQ-004 自适应深度研究 | 2 周 | REQ-003 | DeepResearch 工具 |
| **P1-b** | REQ-005 验证器 Ralph | 1 周 | REQ-002 | verified_ralph 工具 |
| **P1-c** | REQ-006 推理强度扩展 | 3 天 | 无 | 7 档推理 |
| **P1-d** | REQ-006 崩溃恢复 | 1 周 | REQ-002 | TaskPersistence |
| **P2-a** | REQ-007 架构图增强 | 2 周 | 无 | 多图类型+对比+导出 |
| **P2-b** | Token 精确追踪 | 1 周 | REQ-001 | Provider 级 TokenTracker |
| **P2-c** | DAG 看板增强 | 1 周 | REQ-002 | 任务级 Flow Canvas |
| **P3** | 团队版本+计划模板+发布规范 | 2 周 | 全部 | 版本/模板/规范 |

**总计**: ~16 周 (4 个月)

---

## 七、总结

### 关键发现

1. **dsh-agent-team-gui** (123★) — 最接近生产可用的多模型团队方案，核心价值是"持久化团队对象"而非一次性调度
2. **archify** (15K★) — 最成熟的架构可视化方案，核心价值是"5 种图+对比+导出"
3. **dsh-deep-research** (18★) — 最有理论深度的研究编排，核心价值是"控制论闭环+边际增益控制"
4. **dsh-agent-bus** (2★) — 最完整的代理协调方案，核心价值是"持久任务账本+审查循环+崩溃恢复"
5. **dsh-ops-kit** (3★) — 最有价值的原则："证据优先"，可作为全局中间件
6. **dsh-verified-ralph** (0★) — 最巧妙的 Ralph 增强，"独立验证器"避免自我评估偏见
7. **dsh-patch-reasoning** (0★) — 最实用的配置补丁，7 档推理强度

### 最高优先级行动

1. **REQ-002 持久任务账本** — 一切多代理协作的基础
2. **REQ-003 证据优先门控** — 全局质量保证
3. **REQ-001 多模型团队** — 最大差异化能力
4. **REQ-006 推理强度扩展** — 最小工作量最大收益

### 预期收益

| 维度 | 当前 | 迭代后 |
|------|------|--------|
| 多代理协作 | 基础 Subagent | 持久团队+审查循环+DAG |
| 研究能力 | 基础 web_search | 控制论闭环+边际增益 |
| 质量保证 | 无 | 证据优先门控+验证器 |
| 可靠性 | 无持久化 | 崩溃恢复+任务账本 |
| 可视化 | Mermaid | 5 种图+对比+导出 |
| 模型控制 | 3 档推理 | 7 档+子 agent 独立模型 |