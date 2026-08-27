# dsh-flow-canvas 竞品深度调研 + 迭代需求 v4

> 基于 GitHub 8 个同类插件 + DSH 核心包源码分析

---

## 一、竞品深度调研

### 1.1 竞品矩阵

| 插件 | Stars | 核心特色 | 技术栈 | 与我们的差距 |
|------|-------|----------|--------|-------------|
| **GM-HZ/dsh-dag-workflow** | ⭐2 | 6 个 Cordis Service + SQLite + 10 工具 + Canvas Studio | pnpm monorepo, 6 包 | 架构最完整，我们缺 Studio |
| **PiedPiper911/dsh-workflow-canvas** | ⭐2 | transport-agnostic model + toStepList | vite + react-flow + zustand | 我们功能更多 |
| **Lhy723/dsh-agent-canvas** | ⭐2 | 实时 Agent/Workflow 可视化 + 力导向布局 | tsdown + conversation.view | 我们缺实时可视化 |
| **Kyriewang798** | ⭐0 | 13 业务节点 + 执行引擎 + 运行轨迹 | React 18 + Vite | 我们节点更多 |
| **U202414031** | ⭐0 | Coze 风格 UI + sidebar.workflow 插槽 | yarn + tsdown | 我们 UI 更好 |
| **ruby1304** | ⭐0 | MCP server 架构 + canvas_validate/diff | Python MCP | 我们缺 MCP |
| **Chasen-Liao** | ⭐0 | 简历工作流 + bundled Canvas editor | HTML | 垂直场景 |

### 1.2 核心差距分析

#### 我们领先的
| 能力 | 我们 | 最强竞品 |
|------|------|----------|
| 节点类型 | 21+ | 13 (Kyriewang798) |
| 工具 API | 34 | 10 (GM-HZ) |
| 团队管理 | ✅ TeamPanel | ❌ 无 |
| 任务账本 | ✅ TaskLedger | ❌ 无 |
| 证据门控 | ✅ evidence_check | ❌ 无 |
| 深度研究 | ✅ deep_research | ❌ 无 |
| 验证器 Ralph | ✅ verified_ralph | ❌ 无 |
| 架构图 | ✅ generate_diagram | ❌ 无 |
| 主题切换 | ✅ Dark/Light | ❌ 无 |

#### 我们落后的
| 能力 | 我们 | 竞品实现 |
|------|------|----------|
| Cordis Service 注册 | ❌ 无 | GM-HZ: 6 个 Service |
| SQLite 持久化 | ✅ JSON fallback | GM-HZ: 原生 SQLite |
| Canvas Studio | ❌ 无 | GM-HZ: XYFlow Studio |
| 实时 Agent 可视化 | ❌ 无 | Lhy723: 力导向布局 |
| MCP server | ❌ 无 | ruby1304: Python MCP |
| 节点版本化 | ❌ 无 | GM-HZ: type@version |
| 能力系统 | ❌ 无 | GM-HZ: capabilities |
| 表达式语言 | ❌ 无 | GM-HZ: dsh.expr@1 |
| 语义哈希 | ❌ 无 | GM-HZ: CAS |
| 检查点恢复 | ❌ 无 | GM-HZ: checkpoint |

### 1.3 技术模式提取

#### GM-HZ 的 6 个 Cordis Service（可借鉴）
```
ctx.workflowCapabilities  — 节点生命周期
ctx.workflowScripts       — 确定性脚本
ctx.workflowNodes         — 节点注册
ctx.workflowTemplates     — draft/CAS/校验/发布
ctx.workflowRuns          — 事件日志
ctx.dagWorkflowEngine     — 执行引擎
```

#### Lhy723 的实时可视化（可借鉴）
- conversation.view tab 注册
- 力导向布局参数可调
- 实时节点状态动画
- 深色/浅色主题自动适配

#### GM-HZ 的节点定义接口（可借鉴）
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

---

## 二、迭代需求 v4

### P0 — 核心竞争力（1 周）

#### REQ-001: Cordis Service 注册
**来源**: GM-HZ  
**差距**: 我们未注册任何 Cordis Service  
**需求**:
- 注册 `ctx.workflowCanvas` 服务
- 暴露 compile / load / export API
- 事件驱动通信

#### REQ-002: 节点版本化
**来源**: GM-HZ  
**差距**: 节点无版本号  
**需求**:
- 节点定义增加 `version` 字段
- 支持 `type@version` 格式
- 向后兼容

#### REQ-003: 实时 Agent 可视化
**来源**: Lhy723  
**差距**: 无实时状态动画  
**需求**:
- 执行时节点状态实时更新
- 连线动画显示数据流
- 力导向自动布局选项

#### REQ-004: 能力系统
**来源**: GM-HZ  
**差距**: 无能力声明  
**需求**:
- 节点声明能力需求
- 运行时验证能力可用
- 支持 `capability:dsh.tools.execute`

### P1 — 体验增强（1 周）

#### REQ-005: Canvas Studio
**来源**: GM-HZ  
**差距**: 无高级编辑功能  
**需求**:
- Schema/config 编辑器
- 诊断面板
- Draft 测试运行
- CAS 保存

#### REQ-006: MCP server
**来源**: ruby1304  
**差距**: 无 MCP 集成  
**需求**:
- 注册 MCP 工具
- 支持 canvas_validate / canvas_diff
- 与 DSH MCP 生态集成

#### REQ-007: 表达式语言
**来源**: GM-HZ  
**差距**: 条件判断用 JS eval  
**需求**:
- 实现 `dsh.expr@1` 表达式
- 不使用 eval
- 确定性执行

#### REQ-008: 语义哈希 + CAS
**来源**: GM-HZ  
**差距**: 无版本检测  
**需求**:
- 工作流模板语义哈希
- CAS 更新（Content-Addressable Storage）
- 变更检测

### P2 — 高级能力（2 周）

#### REQ-009: 检查点恢复
**来源**: GM-HZ  
**差距**: 崩溃后无法恢复  
**需求**:
- 执行状态持久化
- 检查点保存
- 崩溃后从检查点恢复

#### REQ-010: 执行历史 + 审计
**来源**: GM-HZ  
**差距**: 无执行日志  
**需求**:
- 执行事件日志
- 节点级耗时统计
- 审计追踪

#### REQ-011: 多格式导出
**来源**: archify  
**差距**: 仅 JSON/YAML  
**需求**:
- HTML 可视化导出
- PNG/SVG 图片导出
- Mermaid 文本导出

#### REQ-012: 节点搜索 + 源码追溯
**来源**: archify  
**差距**: 无搜索  
**需求**:
- 节点名称/类型搜索
- 源码文件链接
- 上下游追踪

---

## 三、实施路线图

| Phase | 需求 | 工作量 | 优先级 |
|-------|------|--------|--------|
| Phase A | REQ-001 Cordis Service + REQ-002 版本化 | 2 天 | P0 |
| Phase B | REQ-003 实时可视化 + REQ-004 能力系统 | 2 天 | P0 |
| Phase C | REQ-005 Canvas Studio + REQ-006 MCP | 2 天 | P1 |
| Phase D | REQ-007 表达式 + REQ-008 语义哈希 | 1 天 | P1 |
| Phase E | REQ-009~012 高级能力 | 3 天 | P2 |
| **总计** | | **10 天** |

---

## 四、我们的核心差异化

| 差异点 | 我们 | 竞品 |
|--------|------|------|
| **34 个工具 API** | ✅ 最多 | GM-HZ: 10 |
| **多模型团队** | ✅ TeamPanel | ❌ 无 |
| **持久任务账本** | ✅ TaskLedger | ❌ 无 |
| **证据优先门控** | ✅ evidence_check | ❌ 无 |
| **自适应深度研究** | ✅ deep_research | ❌ 无 |
| **验证器 Ralph** | ✅ verified_ralph | ❌ 无 |
| **架构图生成** | ✅ generate_diagram | ❌ 无 |
| **Dark/Light 主题** | ✅ 切换 | ❌ 无 |
