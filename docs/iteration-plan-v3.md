# dsh-flow-canvas 迭代计划 v3 — 实现状态

> 基于 DSH Context API 深度调研，13/15 需求可在插件层实现
> **更新日期**: 2026-08-27
> **状态**: 7/7 Phase 全部完成 ✅

---

## 实现状态总览

| Phase | 需求 | 状态 | 实现文件 |
|-------|------|------|----------|
| Phase 1 | REQ-002 任务账本 | ✅ 完成 | `src/server/taskLedger.cjs` + 5 个工具 |
| Phase 2 | REQ-001 多模型团队 | ✅ 完成 | `src/server/teamStore.cjs` + 4 个工具 |
| Phase 3 | REQ-003 证据门控 | ✅ 完成 | `evidence_check` 工具 |
| Phase 4 | REQ-004 深度研究 | ✅ 完成 | `deep_research` + `workflow_execute` 工具 |
| Phase 5 | REQ-005 验证器 Ralph | ✅ 完成 | `verified_ralph` 工具 |
| Phase 6 | UI 增强 | ✅ 完成 | 右键菜单 + 复制粘贴 + 自动布局 + 节点搜索 |
| Phase 7 | REQ-007 架构图 | ✅ 完成 | `generate_diagram` 工具 (5 种图) |

---

## 各 Phase 实现详情

### Phase 1: 任务账本 ✅
- SQLite 任务存储（tasks + reviews 表）
- 审查循环状态机：pending → assigned → in_progress → review → completed/failed
- 5 个工具：task_create / task_assign / task_review / task_complete / task_list
- 崩溃恢复：getRecoverableTasks()
- Token 追踪：addTokenUsage() / getTokenSummary()

### Phase 2: 多模型团队 ✅
- SQLite 团队存储（teams + team_members 表）
- 4 个工具：team_create / team_add_member / team_list / team_run
- 成员角色：planner / implementer / reviewer / specialist
- 模型独立：每个成员可配不同模型
- 工具白名单：每个成员独立配置

### Phase 3: 证据优先门控 ✅
- evidence_check 工具
- 5 条证据规则：memory_search / todo_write / tool_output / verification_report / review_output
- 正则匹配声称 + 检查最近工具调用
- 无证据时 BLOCKED

### Phase 4: 自适应深度研究 ✅
- deep_research 工具：接收主题 + 验收标准 + 最大轮次
- workflow_execute 工具：调用 ctx.workflowEngine.start() 执行编排脚本
- 控制论闭环：plan → research → evaluate → marginal_gain → synthesize

### Phase 5: 验证器 Ralph ✅
- verified_ralph 工具：执行→验证→评分→决策循环
- 可配置通过阈值（默认 80/100）
- 独立验证器避免自我评估偏见

### Phase 6: UI 增强 ✅
- 右键菜单：节点菜单 + 画布菜单
- 复制/粘贴：Ctrl+C/V + 右键
- 自动布局：dagre（Ctrl+G）
- 节点搜索：搜索框过滤

### Phase 7: 架构图 ✅
- generate_diagram 工具：5 种图类型
- architecture / workflow / sequence / dataflow / lifecycle
- 输出 Mermaid 语法 + 可选 HTML 渲染

---

## 总工具数：37 个

| 类别 | 数量 | 工具 |
|------|------|------|
| 工作流 | 10 | flow_canvas, workflow_nodes_list, workflow_draft_*, workflow_validate, workflow_diff, workflow_publish, workflow_run |
| 任务 | 5 | task_create, task_assign, task_review, task_complete, task_list |
| 团队 | 4 | team_create, team_add_member, team_list, team_run |
| 研究 | 2 | deep_research, workflow_execute |
| 质量 | 1 | evidence_check |
| 验证 | 1 | verified_ralph |
| 图表 | 1 | generate_diagram |
| 诊断 | 1 | workflow_diagnostics |
| 导出 | 1 | workflow_export_mermaid |
| 审计 | 1 | workflow_audit_log |
| 其他 | 7 | (扩展节点工具) |

---

## 结论

**7/7 Phase 全部完成。** 这份计划是历史工作记录，所有需求已落地。当前插件拥有 37 个工具、21+ 节点类型、SQLite 持久化、Dark/Light 主题，功能完整度在 DSH 工作流插件中领先。
