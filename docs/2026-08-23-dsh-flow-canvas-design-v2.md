# dsh-flow-canvas 设计文档 v2

> DSH 可视化工作流编排插件 — 多维度参考同类项目后的详细需求

**日期**: 2026-08-23
**状态**: 设计阶段 v2
**参考项目**: Langflow (153k⭐), Flowise (55k⭐), n8n (202k⭐), Dify (153k⭐), ReactFlow (38k⭐), ComfyUI (70k⭐)

---

## 1. 竞品分析

### 1.1 同类项目功能矩阵

| 功能 | Langflow | Flowise | n8n | Dify | ComfyUI | **dsh-flow-canvas** |
|------|----------|---------|-----|------|---------|---------------------|
| **可视化画布** | ✅ ReactFlow | ✅ ReactFlow | ✅ 自研 | ✅ ReactFlow | ✅ 自研 | ✅ ReactFlow |
| **拖拽节点** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **连线定义依赖** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **自定义节点** | ✅ Python | ✅ TS/JS | ✅ TS/JS | ❌ 有限 | ✅ Python | ✅ TS/JS |
| **条件分支** | ✅ | ✅ AgentFlow | ✅ IF/Switch | ✅ IF/ELSE | ✅ | ✅ |
| **循环节点** | ❌ | ✅ AgentFlow | ✅ Loop | ✅ Iteration | ✅ KSampler循环 | ✅ v2 |
| **子工作流** | ❌ | ✅ | ✅ Sub-workflow | ❌ | ❌ | ✅ v2 |
| **MiniMap** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **缩放控件** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **网格背景** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **右键菜单** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **撤销/重做** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **快捷键** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **复制/粘贴** | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **自动布局** | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **模板库** | ✅ 社区 | ✅ | ✅ 280+ | ✅ | ✅ 工作流 | ✅ |
| **导入/导出** | ✅ JSON | ✅ JSON | ✅ JSON | ✅ DSL | ✅ JSON | ✅ JSON/YAML |
| **实时执行可视化** | ❌ | ❌ | ✅ | ❌ | ✅ 预览 | ✅ |
| **执行历史** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **调试面板** | ✅ Playground | ✅ | ✅ | ✅ | ✅ Console | ✅ |
| **版本管理** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **API 发布** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ v2 |
| **多 Agent 协作** | ✅ | ✅ AgentFlow | ❌ | ✅ | ❌ | ✅ 核心 |
| **Git Worktree** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **独家** |
| **DSH 原生集成** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **独家** |

### 1.2 各项目优缺点

#### Langflow (153k⭐) — AI 工作流平台

**优点**:
- 组件库丰富（LLM、Vector Store、Embeddings、Tools）
- Playground 即时测试
- API 自动生成
- 社区模板丰富

**缺点**:
- 重量级（需要后端服务）
- 不支持子工作流
- 无自动布局
- Python 生态，与 DSH JS 生态不兼容

**借鉴**: 组件分类系统、Playground 调试、模板市场

#### Flowise (55k⭐) — AI Agent 可视化构建

**优点**:
- AgentFlow 支持多 Agent 循环
- 轻量级（npm install -g flowise）
- 自定义节点开发简单

**缺点**:
- 已归档（Archived）
- 无撤销/重做
- 无快捷键
- 无自动布局

**借鉴**: AgentFlow 的 Agent 循环概念、轻量部署

#### n8n (202k⭐) — 工作流自动化

**优点**:
- 400+ 集成（Gmail、Slack、GitHub 等）
- 触发器节点（Webhook、Cron、Event）
- IF/Switch/Loop 高级控制流
- 子工作流
- 凭证管理
- 执行历史完整

**缺点**:
- 自研画布（非 ReactFlow）
- 学习曲线较陡
- 不专注 AI/Agent

**借鉴**: 触发器系统、凭证管理、执行历史、错误处理模式

#### Dify (153k⭐) — AI 应用开发平台

**优点**:
- 节点类型丰富（LLM、知识检索、问题分类、代码、HTTP）
- Chatflow/Workflow 双模式
- 调试面板完善
- 版本管理

**缺点**:
- 不支持循环
- 无子工作流
- 无自动布局
- 无撤销/重做

**借鉴**: 节点类型设计、调试面板、版本管理

#### ComfyUI (70k⭐) — 图像生成工作流

**优点**:
- 实时预览（每个节点都有输出预览）
- 强大的条件分支和循环
- 社区节点生态丰富
- 高性能渲染

**缺点**:
- 专注图像生成
- 自研画布
- 不通用

**借鉴**: 节点实时预览、高性能渲染、社区节点生态

#### ReactFlow (38k⭐) — DAG 编辑器库

**优点**:
- 最流行的 React DAG 编辑器
- 丰富的自定义节点/边类型
- MiniMap、Controls、Background 内置
- 连接验证
- 拖拽放置
- 键盘快捷键
- 无限可定制

**缺点**:
- 只是库，需要自己实现业务逻辑
- 无内置的执行引擎

**借鉴**: 直接作为画布引擎

---

## 2. 功能需求（按优先级）

### 2.1 P0 — 核心功能（v1.0 必须）

#### 2.1.1 画布基础

| 功能 | 描述 | 参考来源 |
|------|------|---------|
| **节点拖拽放置** | 从左侧面板拖拽节点到画布 | ReactFlow DnD |
| **节点连线** | 从输出口拖拽到输入口创建边 | ReactFlow |
| **连接验证** | 只允许合法的连接（如不能连到自己） | ReactFlow |
| **多选** | Ctrl+点击 或 框选多个节点 | ReactFlow |
| **缩放** | 滚轮缩放，pinch-to-zoom | ReactFlow |
| **平移** | 拖拽空白区域移动画布 | ReactFlow |
| **删除** | Delete/Backspace 删除选中节点/边 | ReactFlow |
| **复制粘贴** | Ctrl+C/V 复制粘贴节点 | n8n |
| **撤销重做** | Ctrl+Z/Y 撤销重做 | n8n |
| **MiniMap** | 右下角小地图导航 | ReactFlow |
| **缩放控件** | +/- 按钮和 fit-view | ReactFlow |
| **网格背景** | 点阵/线条背景对齐 | ReactFlow |
| **节点选择高亮** | 选中节点边框高亮 | 通用 |

#### 2.1.2 节点系统

**6 种基础节点类型**:

| 节点 | 图标 | 功能 | 输入口 | 输出口 | 参考 |
|------|------|------|--------|--------|------|
| **START** | 🟢 | 工作流入口，定义输入参数 | 0 | 1 | Dify Start |
| **END** | 🔴 | 工作流出口，汇总结果 | 1+ | 0 | Dify End |
| **AGENT** | 🤖 | 执行 agent 任务 | 1+ | 1+ | Langflow Agent |
| **TOOL** | 🔧 | 调用 DSH 工具 | 1+ | 1+ | n8n Action |
| **CONDITION** | 🔀 | 条件分支 (true/false) | 1 | 2 | n8n IF |
| **MERGE** | 🔗 | 合并多路结果 | 2+ | 1 | n8n Merge |

**AGENT 节点属性面板**:

```yaml
标签: 实现 REST API
描述: 实现用户认证的 REST API
提示词: |
  请实现一个用户认证的 REST API，
  包括注册、登录、登出功能。
  使用 JWT token 认证。
子代理 Profile: reviewer (可选)
模型: deepseek-pro (可选，覆盖默认)
工具白名单: read_file, write_file, bash (可选)
写路径: src/api/ (可选)
只读模式: false (可选)
最大步数: 50 (可选)
```

**CONDITION 节点属性面板**:

```yaml
标签: 检查测试结果
条件类型: 字符串匹配 / 正则 / 自定义表达式
条件值: "All tests passed"
True 分支: → Agent (Review)
False 分支: → Agent (Fix Tests)
```

**TOOL 节点属性面板**:

```yaml
标签: 创建 Worktree
工具名: worktree_create
参数:
  task_id: "{{previous_node.task_id}}"
  branch: "fleet/{{node.label}}"
```

#### 2.1.3 工作流管理

| 功能 | 描述 | 参考来源 |
|------|------|---------|
| **保存** | Ctrl+S 保存工作流到本地 | Dify |
| **加载** | 从文件加载工作流 | Dify |
| **导出 JSON** | 导出工作流定义 | n8n |
| **导入 JSON** | 导入工作流定义 | n8n |
| **自动保存** | 每次编辑自动保存 | Dify |
| **工作流命名** | 顶部标题可编辑 | Dify |

#### 2.1.4 执行引擎

| 功能 | 描述 | 参考来源 |
|------|------|---------|
| **运行按钮** | 点击 ▶ 运行工作流 | n8n |
| **状态可视化** | 节点实时显示状态 (⏳🔄✅❌) | ComfyUI |
| **执行日志** | 底部面板显示执行日志 | n8n |
| **停止按钮** | 运行中可停止 | n8n |
| **进度指示** | 边上的动画显示数据流 | ReactFlow animated |
| **错误处理** | 失败节点高亮 + 错误信息 | n8n |

**节点执行状态**:

```
⏳ pending    — 灰色，等待执行
🔄 running    — 蓝色边框 + 脉冲动画
✅ completed  — 绿色边框
❌ failed     — 红色边框 + 错误图标
⏭️ skipped    — 灰色虚线
⏸️ paused     — 黄色，等待用户确认
```

### 2.2 P1 — 增强功能（v1.1）

#### 2.2.1 高级节点

| 节点 | 图标 | 功能 | 参考来源 |
|------|------|------|---------|
| **PARALLEL** | ⚡ | 并行分组，同时执行多个子任务 | Langflow |
| **CODE** | 💻 | 执行自定义 JS/TS 代码 | n8n Code |
| **HTTP** | 🌐 | 调用外部 HTTP API | Dify HTTP |
| **VARIABLE** | 📦 | 变量赋值/传递 | Dify Variable |

#### 2.2.2 模板系统

| 功能 | 描述 | 参考来源 |
|------|------|---------|
| **预置模板** | 4+ 个工作流模板 | n8n 280+ 模板 |
| **模板分类** | 按用途分类（开发/审查/测试） | Langflow |
| **模板预览** | 预览模板结构 | Dify |
| **从模板创建** | 一键从模板新建工作流 | n8n |
| **保存为模板** | 将当前工作流保存为模板 | n8n |

**预置模板**:

```
📂 开发流程
  ├── API 开发流水线
  ├── 项目脚手架
  └── 代码重构流程

📂 审查流程
  ├── 代码审查
  ├── 安全审计
  └── 性能分析

📂 测试流程
  ├── 测试生成 + 执行
  ├── Bug 修复流程
  └── 回归测试

📂 文档流程
  ├── API 文档生成
  ├── README 更新
  └── Changelog 生成
```

#### 2.2.3 键盘快捷键

| 快捷键 | 功能 | 参考来源 |
|--------|------|---------|
| `Ctrl+S` | 保存 | 通用 |
| `Ctrl+Z` | 撤销 | n8n |
| `Ctrl+Shift+Z` | 重做 | n8n |
| `Ctrl+C` | 复制 | 通用 |
| `Ctrl+V` | 粘贴 | 通用 |
| `Ctrl+A` | 全选 | 通用 |
| `Delete` | 删除选中 | 通用 |
| `Ctrl+D` | 复制并粘贴 | n8n |
| `Ctrl+G` | 自动布局 | **新增** |
| `Ctrl+E` | 导出 JSON | **新增** |
| `Ctrl+Shift+E` | 运行工作流 | **新增** |
| `Space+拖拽` | 平移画布 | ComfyUI |
| `Ctrl+滚轮` | 缩放 | 通用 |
| `Ctrl+0` | 重置缩放 | ComfyUI |
| `Ctrl+1` | 适应画布 | ComfyUI |
| `F2` | 重命名选中节点 | **新增** |
| `Ctrl+L` | 锁定/解锁节点 | **新增** |

#### 2.2.4 右键菜单

| 菜单项 | 功能 | 参考来源 |
|--------|------|---------|
| 复制节点 | 复制选中节点 | n8n |
| 粘贴节点 | 粘贴节点 | n8n |
| 删除节点 | 删除选中节点 | n8n |
| 重命名 | 重命名节点 | Dify |
| 运行此节点 | 从选中节点开始执行 | ComfyUI |
| 禁用节点 | 禁用/启用节点 | n8n |
| 添加注释 | 添加便签/注释 | n8n |
| 自动布局 | 自动排列节点 | **新增** |
| 全选 | 选中所有节点 | n8n |

#### 2.2.5 自动布局

| 算法 | 描述 | 参考来源 |
|------|------|---------|
| **dagre** | 分层布局（默认） | dagre.js |
| **elkjs** | 力导向布局 | ELK |
| **grid** | 网格布局 | 通用 |
| **tree** | 树形布局 | 通用 |

### 2.3 P2 — 高级功能（v2.0）

#### 2.3.1 子工作流

| 功能 | 描述 | 参考来源 |
|------|------|---------|
| **SUBFLOW 节点** | 引用另一个工作流 | n8n Sub-workflow |
| **内联展开** | 展开子工作流到当前画布 | ComfyUI |
| **参数传递** | 父工作流向子工作流传参 | n8n |

#### 2.3.2 循环支持

| 功能 | 描述 | 参考来源 |
|------|------|---------|
| **LOOP 节点** | 循环执行子图 | Flowise AgentFlow |
| **ITERATION 节点** | 遍历数组 | Dify Iteration |
| **最大迭代** | 防止无限循环 | 通用 |

#### 2.3.3 触发器系统

| 触发器 | 描述 | 参考来源 |
|--------|------|---------|
| **手动触发** | 点击运行按钮 | n8n |
| **Cron 触发** | 定时执行 | n8n Cron |
| **Webhook 触发** | HTTP 请求触发 | n8n Webhook |
| **文件变更触发** | 文件保存时触发 | VS Code |
| **Git 事件触发** | Git commit/push 时触发 | GitHub Actions |

#### 2.3.4 变量系统

| 功能 | 描述 | 参考来源 |
|------|------|---------|
| **节点输出变量** | `{{node_id.output}}` | Dify |
| **工作流输入变量** | `{{workflow.input}}` | n8n |
| **环境变量** | `{{env.VAR}}` | n8n |
| **变量面板** | 可视化管理所有变量 | Dify |

#### 2.3.5 调试面板

| 功能 | 描述 | 参考来源 |
|------|------|---------|
| **节点输入/输出** | 查看每个节点的输入输出 | ComfyUI Console |
| **执行时间** | 每个节点的执行耗时 | n8n |
| **Token 用量** | LLM 节点的 token 消耗 | Langflow |
| **成本估算** | 总成本估算 | **新增** |
| **重放** | 从某个节点重新执行 | ComfyUI |

---

## 3. UI/UX 设计

### 3.1 整体布局

```
┌──────────────────────────────────────────────────────────────┐
│  🚀 dsh-flow-canvas   [workflow-name]   [▶Run] [💾] [📤] [⚙] │
├─────────┬────────────────────────────────────────────────────┤
│         │                                                    │
│  Node   │                                                    │
│  Panel  │                Canvas (ReactFlow)                  │
│  200px  │                                                    │
│         │    ┌──────┐        ┌──────┐                        │
│ ─────── │    │Agent │───────▶│Agent │                        │
│ 🔍 搜索 │    │  ✅  │        │  🔄  │                        │
│         │    └──────┘        └──────┘                        │
│ 📂 开发 │         │                                          │
│  🟢 Start│        ▼                                          │
│  🔴 End  │    ┌──────┐                                       │
│  🤖 Agent│    │Agent │                                       │
│  🔧 Tool │    │  ⏳  │                                       │
│  🔀 Cond │    └──────┘                                       │
│  🔗 Merge│                                                    │
│         │                                                    │
│ 📂 审查 │              ┌──────┐                              │
│  🤖 Agent│             │MiniMap│                              │
│  🔧 Tool │             └──────┘                              │
│         │                                                    │
│ 📂 测试 │    [+ Controls]  [Zoom 100%]  [Fit View]          │
│         │                                                    │
├─────────┴────────────────────────────────────────────────────┤
│  Properties Panel (选中节点时展开，高度 200px)                  │
│  ┌─────────┬──────────┬──────────┬──────────┐                │
│  │ General │ Content  │ Advanced │ History  │                │
│  ├─────────┴──────────┴──────────┴──────────┤                │
│  │ Label:    [实现 REST API            ]     │                │
│  │ Profile:  [reviewer               ▼]     │                │
│  │ Model:    [deepseek-pro           ▼]     │                │
│  │ Prompt:   [请实现用户认证的 REST   ]     │                │
│  │           [API...                 ]       │                │
│  │ Tools:    [read_file] [bash] [write_file]│                │
│  │ Write:    [src/api/                ]     │                │
│  │ Max Steps:[50                      ]     │                │
│  └──────────────────────────────────────────┘                │
├──────────────────────────────────────────────────────────────┤
│  Execution Log (可折叠，高度 150px)                            │
│  [14:32:01] 🟢 START completed (0.1s)                        │
│  [14:32:01] 🤖 Agent "Research" running...                   │
│  [14:32:15] 🤖 Agent "Research" completed (14.2s, 1,234 tokens)│
│  [14:32:15] 🤖 Agent "Implement" running...                  │
│  [14:33:42] 🤖 Agent "Implement" completed (87.3s, 4,567 tokens)│
└──────────────────────────────────────────────────────────────┘
```

### 3.2 节点详细设计

#### AGENT 节点

```
┌─────────────────────────────┐
│ 🤖 实现 REST API        ✏️  │  ← 标题栏（图标 + 标签 + 编辑按钮）
├─────────────────────────────┤
│                             │
│  📝 请实现用户认证的 REST   │  ← 提示词预览（截断显示）
│     API...                  │
│                             │
│  🏷️ reviewer                │  ← Profile 标签
│  🧠 deepseek-pro            │  ← Model 标签
│  🔧 3 tools                 │  ← 工具数量
│  📁 src/api/                │  ← 写路径
│                             │
├─────────────────────────────┤
│  ● status: ✅ completed     │  ← 状态指示器
│     duration: 87.3s         │  ← 执行耗时
│     tokens: 4,567           │  ← Token 用量
└─────────────────────────────┘
  ●                            ← 输入口（左侧）
                  ●            ← 输出口（右侧）
```

#### CONDITION 节点

```
┌─────────────────────────────┐
│ 🔀 检查测试结果          ✏️  │
├─────────────────────────────┤
│                             │
│  条件: "All tests passed"   │
│  类型: 字符串包含           │
│                             │
├──────────────┬──────────────┤
│  ✅ True     │  ❌ False    │  ← 两个输出口
│  → Review    │  → Fix       │
└──────────────┴──────────────┘
```

#### MERGE 节点

```
┌─────────────────────────────┐
│ 🔗 合并结果              ✏️  │
├─────────────────────────────┤
│                             │
│  等待: 3/3 个输入完成       │
│  模式: 全部完成             │
│                             │
└─────────────────────────────┘
  ●  ← 输入口 1
  ●  ← 输入口 2
  ●  ← 输入口 3
          ●  ← 输出口
```

### 3.3 连线样式

| 状态 | 样式 | 说明 |
|------|------|------|
| **默认** | 灰色实线 | 未执行 |
| **执行中** | 蓝色虚线 + 动画 | 数据流动画 |
| **完成** | 绿色实线 | 执行成功 |
| **失败** | 红色实线 | 执行失败 |
| **条件 True** | 绿色实线 | 条件为真 |
| **条件 False** | 红色虚线 | 条件为假 |

### 3.4 主题支持

| 主题 | 配色 | 适用场景 |
|------|------|---------|
| **自动** | 跟随 DSH 主题 | 默认 |
| **暗色** | 深色背景 + 亮色节点 | 夜间 |
| **亮色** | 白色背景 + 深色节点 | 白天 |
| **高对比** | 高对比度 | 无障碍 |

---

## 4. 数据模型（详细）

### 4.1 完整类型定义

```typescript
// ── 工作流 ──────────────────────────────────────────────

interface Workflow {
  id: string                          // "wf-abc123def"
  name: string                        // "API 开发流水线"
  description: string
  version: number                     // 语义化版本
  createdAt: number                   // Unix timestamp
  updatedAt: number
  author?: string
  tags?: string[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  viewport: Viewport
  variables?: WorkflowVariable[]
  metadata?: Record<string, any>
}

interface Viewport {
  x: number
  y: number
  zoom: number
}

interface WorkflowVariable {
  name: string                        // "project_root"
  type: 'string' | 'number' | 'boolean' | 'json'
  defaultValue?: any
  description?: string
  required?: boolean
}

// ── 节点 ──────────────────────────────────────────────

interface WorkflowNode {
  id: string                          // "node-abc123"
  type: NodeType
  position: { x: number; y: number }
  data: NodeData
  width?: number
  height?: number
  selected?: boolean
  dragging?: boolean
}

type NodeType = 'start' | 'end' | 'agent' | 'tool' | 'condition' | 'merge'
  | 'parallel' | 'code' | 'http' | 'variable' | 'subflow'

// ── 节点数据 ──────────────────────────────────────────

interface StartNodeData {
  type: 'start'
  label: string
  inputs?: WorkflowVariable[]
}

interface EndNodeData {
  type: 'end'
  label: string
  outputs?: string[]                  // 聚合哪些节点的输出
}

interface AgentNodeData {
  type: 'agent'
  label: string
  description?: string
  prompt: string
  profile?: string                    // SubAgent profile 名
  model?: string                      // 模型覆盖
  tools?: string[]                    // 工具白名单
  writePaths?: string[]               // 写路径声明
  readOnly?: boolean
  maxSteps?: number
  effort?: string                     // 推理力度
  temperature?: number
}

interface ToolNodeData {
  type: 'tool'
  label: string
  description?: string
  toolName: string                    // DSH 工具名
  args: Record<string, any>           // 工具参数（支持变量引用）
}

interface ConditionNodeData {
  type: 'condition'
  label: string
  description?: string
  conditionType: 'string_contains' | 'string_equals' | 'regex'
    | 'json_path' | 'custom_expression'
  conditionValue: string
  trueLabel?: string
  falseLabel?: string
}

interface MergeNodeData {
  type: 'merge'
  label: string
  description?: string
  mode: 'all' | 'any' | 'first'      // 等待模式
}

interface ParallelNodeData {
  type: 'parallel'
  label: string
  description?: string
  maxConcurrency?: number
}

interface CodeNodeData {
  type: 'code'
  label: string
  description?: string
  language: 'javascript' | 'typescript'
  code: string
  inputs?: string[]                   // 接收哪些变量
  outputs?: string[]                  // 输出哪些变量
}

interface HttpNodeData {
  type: 'http'
  label: string
  description?: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  url: string
  headers?: Record<string, string>
  body?: any
}

interface VariableNodeData {
  type: 'variable'
  label: string
  description?: string
  variableName: string
  value: any
}

type NodeData = StartNodeData | EndNodeData | AgentNodeData | ToolNodeData
  | ConditionNodeData | MergeNodeData | ParallelNodeData | CodeNodeData
  | HttpNodeData | VariableNodeData

// ── 边 ──────────────────────────────────────────────

interface WorkflowEdge {
  id: string                          // "edge-abc123"
  source: string                      // 源节点 id
  target: string                      // 目标节点 id
  sourceHandle?: string               // 源节点输出口 id
  targetHandle?: string               // 目标节点输入口 id
  label?: string                      // 边标签
  animated?: boolean                  // 执行时动画
  type?: 'default' | 'conditional'   // 边类型
  style?: Record<string, any>         // 自定义样式
}

// ── 执行状态 ──────────────────────────────────────────

interface ExecutionState {
  workflowId: string
  runId: string                       // "run-abc123"
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  nodeStates: Record<string, NodeExecutionState>
  startedAt?: number
  completedAt?: number
  totalTokens?: number
  totalCost?: number
}

interface NodeExecutionState {
  nodeId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'paused'
  startedAt?: number
  completedAt?: number
  duration?: number                   // ms
  tokens?: number
  cost?: number
  input?: any
  output?: any
  error?: string
  retries?: number
}
```

### 4.2 持久化格式

```json
{
  "id": "wf-abc123def",
  "name": "API 开发流水线",
  "version": 1,
  "createdAt": 1692800000000,
  "updatedAt": 1692800000000,
  "nodes": [
    {
      "id": "node-1",
      "type": "start",
      "position": { "x": 100, "y": 200 },
      "data": { "type": "start", "label": "Start" }
    },
    {
      "id": "node-2",
      "type": "agent",
      "position": { "x": 300, "y": 200 },
      "data": {
        "type": "agent",
        "label": "Research API",
        "prompt": "Research REST API best practices",
        "model": "deepseek-pro"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "node-1",
      "target": "node-2"
    }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

---

## 5. 技术架构（详细）

### 5.1 技术栈

| 层 | 技术 | 版本 | 理由 |
|----|------|------|------|
| **DAG 引擎** | @xyflow/react | 12.x | 最流行，功能完整 |
| **状态管理** | zustand | 5.x | 轻量，DSH 生态常用 |
| **自动布局** | dagre | 0.8.x | 分层 DAG 布局 |
| **ID 生成** | nanoid | 3.x | 轻量唯一 ID |
| **样式** | Tailwind CSS | 4.x | DSH Web UI 已用 |
| **类型** | TypeScript | 5.x | DSH 插件标准 |
| **框架** | React | 18.x | DSH Web UI 已用 |

### 5.2 目录结构

```
dsh-flow-canvas/
├── package.json
├── tsconfig.json
├── README.md
│
├── src/
│   ├── client/                      # 客户端 (React/TSX)
│   │   ├── index.ts                 # 入口
│   │   ├── FlowCanvas.tsx           # 主画布组件
│   │   ├── nodes/                   # 自定义节点
│   │   │   ├── StartNode.tsx
│   │   │   ├── EndNode.tsx
│   │   │   ├── AgentNode.tsx
│   │   │   ├── ToolNode.tsx
│   │   │   ├── ConditionNode.tsx
│   │   │   ├── MergeNode.tsx
│   │   │   └── index.ts
│   │   ├── edges/                   # 自定义边
│   │   │   ├── AnimatedEdge.tsx
│   │   │   └── index.ts
│   │   ├── panels/                  # 面板组件
│   │   │   ├── NodePanel.tsx        # 左侧节点面板
│   │   │   ├── PropsPanel.tsx       # 底部属性面板
│   │   │   ├── LogPanel.tsx         # 底部日志面板
│   │   │   └── TemplatePanel.tsx    # 模板面板
│   │   ├── store/                   # 状态管理
│   │   │   ├── workflowStore.ts     # 工作流状态
│   │   │   ├── executionStore.ts    # 执行状态
│   │   │   └── uiStore.ts          # UI 状态
│   │   ├── hooks/                   # 自定义 Hooks
│   │   │   ├── useAutoSave.ts
│   │   │   ├── useKeyboard.ts
│   │   │   ├── useExecution.ts
│   │   │   └── useLayout.ts
│   │   ├── utils/                   # 工具函数
│   │   │   ├── workflowToFleet.ts   # 工作流 → Fleet 转换
│   │   │   ├── validation.ts        # 连接验证
│   │   │   ├── serialization.ts     # 序列化/反序列化
│   │   │   └── layout.ts           # 自动布局
│   │   └── styles/                  # 样式
│   │       └── flow-canvas.css
│   │
│   └── server/                      # 服务端 (Node.js)
│       ├── index.ts                 # 插件入口
│       ├── tools.ts                 # 工具注册
│       └── templates.ts            # 模板存储
│
├── lib/                             # 构建输出
│   ├── index.js
│   └── client/
│       └── ...
│
├── tests/                           # 测试
│   ├── workflow.test.ts
│   ├── execution.test.ts
│   ├── validation.test.ts
│   ├── serialization.test.ts
│   └── layout.test.ts
│
├── templates/                       # 预置模板
│   ├── api-development.json
│   ├── code-review.json
│   ├── bug-fix.json
│   └── documentation.json
│
└── docs/                            # 文档
    └── 2026-08-23-dsh-flow-canvas-design-v2.md
```

### 5.3 组件通信

```
┌─────────────────────────────────────────────────┐
│                  FlowCanvas                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ NodePanel │  │ ReactFlow│  │PropsPanel│      │
│  │ (DnD源)  │  │ (画布)   │  │ (属性)   │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │              │              │            │
│       │         ┌────┴────┐         │            │
│       │         │ Zustand │         │            │
│       │         │ Store   │         │            │
│       │         └────┬────┘         │            │
│       │              │              │            │
│  ┌────┴──────────────┴──────────────┴────┐      │
│  │           useWorkflowStore             │      │
│  │  - nodes, edges, viewport             │      │
│  │  - addNode, removeNode, updateNode    │      │
│  │  - addEdge, removeEdge                │      │
│  │  - save, load, export, import         │      │
│  └───────────────────────────────────────┘      │
│                                                  │
│  ┌───────────────────────────────────────┐      │
│  │           useExecutionStore            │      │
│  │  - executionState, nodeStates         │      │
│  │  - startExecution, stopExecution      │      │
│  │  - updateNodeState                    │      │
│  └───────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

### 5.4 执行流程

```
用户点击 "Run"
      │
      ▼
┌─────────────┐
│ 1. 验证工作流│ ← 检查节点完整性、连接合法性
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 2. 拓扑排序  │ ← 计算执行顺序和并行组
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 3. 转换为    │ ← workflowToFleet()
│    Fleet     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 4. 派发执行  │ ← 调用 dsh-fleet-board fleet tool
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 5. 状态追踪  │ ← 轮询 fleet_status，更新画布
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 6. 完成处理  │ ← 汇总结果，更新 END 节点
└─────────────┘
```

---

## 6. 与 dsh-fleet-board 集成

### 6.1 集成方式

```typescript
// workflowToFleet.ts
import { createFleetRun, validateFleet } from 'dsh-fleet-board/fleet'

export function workflowToFleet(workflow: Workflow): FleetTasks {
  const tasks = workflow.nodes
    .filter(n => n.type === 'agent')
    .map(node => ({
      id: node.id,
      prompt: (node.data as AgentNodeData).prompt,
      profile: (node.data as AgentNodeData).profile,
      model: (node.data as AgentNodeData).model,
      tools: (node.data as AgentNodeData).tools,
      write_paths: (node.data as AgentNodeData).writePaths,
      read_only: (node.data as AgentNodeData).readOnly,
      depends_on: getDependencies(workflow, node.id)
    }))

  const validation = validateFleet(tasks)
  if (!validation.valid) {
    throw new Error(`Invalid workflow: ${validation.errors.join('; ')}`)
  }

  return { tasks }
}
```

### 6.2 状态同步

```
dsh-flow-canvas                    dsh-fleet-board
┌─────────────┐                    ┌─────────────┐
│ 工作流画布   │ ── fleet() ──────▶ │ Fleet Engine │
│             │                    │             │
│ 节点状态 ◀──│ ◀── fleet_status ──│ 状态追踪    │
│ 实时更新     │                    │             │
└─────────────┘                    └─────────────┘
```

---

## 7. 开发计划（详细）

### Phase 1: 基础画布 (Week 1, 5 天)

| 天 | 任务 | 交付物 |
|----|------|--------|
| D1 | 项目初始化、ReactFlow 集成 | 空白画布可渲染 |
| D2 | 6 种节点类型渲染 + 拖拽放置 | 节点可拖拽到画布 |
| D3 | 节点连线 + 连接验证 | 节点可连线 |
| D4 | 属性面板 + 节点配置 | 可配置节点属性 |
| D5 | 保存/加载 JSON + MiniMap/Controls | 基础功能完整 |

### Phase 2: 执行引擎 (Week 2, 5 天)

| 天 | 任务 | 交付物 |
|----|------|--------|
| D1 | workflowToFleet 转换 + 验证 | 可转换为 Fleet |
| D2 | 执行状态追踪 + 节点状态更新 | 画布实时状态 |
| D3 | 执行日志面板 | 日志可查看 |
| D4 | 错误处理 + 重试逻辑 | 错误可恢复 |
| D5 | 模板系统 (4 个预置模板) | 可从模板创建 |

### Phase 3: 增强功能 (Week 3, 5 天)

| 天 | 任务 | 交付物 |
|----|------|--------|
| D1 | 键盘快捷键 + 右键菜单 | 交互增强 |
| D2 | 撤销/重做 + 复制粘贴 | 编辑增强 |
| D3 | 自动布局 (dagre) | 布局自动化 |
| D4 | 导入/导出 YAML | 格式扩展 |
| D5 | 注释/便签节点 | 文档能力 |

### Phase 4: 打磨发布 (Week 4, 5 天)

| 天 | 任务 | 交付物 |
|----|------|--------|
| D1 | 性能优化 (大工作流) | 流畅渲染 |
| D2 | 主题适配 (暗色/亮色) | 视觉一致 |
| D3 | 文档 + README | 文档完整 |
| D4 | 测试覆盖 (>80%) | 质量保证 |
| D5 | DSH 插件发布 | 可安装使用 |

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| ReactFlow 体积大 | 中 | 增加包大小 | 按需导入，tree-shaking |
| DSH SlotMap 限制 | 高 | 无法嵌入 tab | 研究 DSH 插件 API |
| 大工作流性能 | 低 | 渲染卡顿 | 虚拟化 + 分层渲染 |
| 执行超时 | 中 | 长工作流中断 | 异步执行 + 状态持久化 |
| 与 dsh-fleet-board 版本不兼容 | 低 | 功能失效 | 版本锁定 + 兼容测试 |

---

## 9. 成功指标

| 指标 | v1.0 目标 | v2.0 目标 |
|------|----------|----------|
| 创建到运行第一个工作流 | < 2 分钟 | < 1 分钟 |
| 10 节点画布帧率 | > 30fps | > 60fps |
| 50 节点画布帧率 | > 15fps | > 30fps |
| 保存/加载时间 | < 100ms | < 50ms |
| 测试覆盖率 | > 80% | > 90% |
| 文档完整度 | 所有节点有示例 | 含视频教程 |
| 模板数量 | 4+ | 20+ |
| 社区贡献 | - | 5+ 外部模板 |

---

## 10. 附录

### 10.1 竞品截图参考

| 项目 | 截图描述 | 参考点 |
|------|---------|--------|
| Langflow | 左侧组件面板 + 中间画布 + 右侧属性 | 布局参考 |
| Flowise | AgentFlow 多 Agent 循环画布 | Agent 编排参考 |
| n8n | 触发器 → IF → Action 链式画布 | 控制流参考 |
| Dify | 节点属性面板 + 调试面板 | 属性设计参考 |
| ComfyUI | 实时预览 + 高性能渲染 | 渲染性能参考 |
| ReactFlow | 官方示例（DnD、自定义节点） | 技术实现参考 |

### 10.2 术语表

| 术语 | 定义 |
|------|------|
| **DAG** | Directed Acyclic Graph，有向无环图 |
| **节点 (Node)** | 工作流中的一个执行单元 |
| **边 (Edge)** | 连接两个节点的有向边 |
| **工作流 (Workflow)** | 由节点和边组成的 DAG |
| **执行 (Execution)** | 工作流的一次运行 |
| **Fleet** | dsh-fleet-board 的任务调度系统 |
| **Profile** | SubAgent 的配置文件 |
| **SlotMap** | DSH 的 UI 扩展点 |
