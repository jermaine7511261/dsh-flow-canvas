# dsh-flow-canvas 配置指南

> 完整的插件配置参考

## 快速开始

插件使用自己的配置文件（不修改 DSH 全局 `settings.yaml`）：

```
~/.dsh/flow-canvas.json
```

首次启动时自动生成示例文件，直接编辑即可：

```json
{
  "execution": {
    "defaultModel": "mimo-v2.5",
    "defaultProvider": "opencode-go"
  }
}
```

修改后重启 DSH 生效。以下 YAML 示例中的键与 JSON 文件中的层级一一对应。

## 配置文件位置

```
~/.dsh/settings.yaml
```

## 完整配置

```yaml
flow-canvas:
  # ============================================
  # 存储配置
  # ============================================
  storage:
    path: "~/.dsh/workflows"        # 工作流存储目录
    format: "json"                   # 保存格式: json | yaml
    autoSave: true                   # 自动保存
    autoSaveInterval: 30000          # 自动保存间隔 (ms)
    maxVersions: 10                  # 最大版本数

  # ============================================
  # 执行配置
  # ============================================
  execution:
    defaultModel: "mimo-v2.5"        # 默认 AI 模型
    defaultProvider: "opencode-go"   # 默认 provider
    allowedTools:                    # 允许使用的工具
      - read_file
      - write_file
      - bash
      - search
    writePaths:                      # 允许写入的路径
      - "src/"
      - "tests/"
    readOnly: false                  # 只读模式
    maxSteps: 50                     # 最大执行步数
    timeout: 300000                  # 执行超时 (ms)
    retryCount: 3                    # 失败重试次数
    parallelExecution: true          # 允许并行执行

  # ============================================
  # UI 配置
  # ============================================
  ui:
    theme: "auto"                    # 主题: auto | dark | light
    showMiniMap: true                # 显示小地图
    showControls: true               # 显示缩放控件
    snapToGrid: true                 # 对齐网格
    gridSize: 15                     # 网格大小
    autoLayout: "dagre"              # 自动布局算法: dagre | grid | tree
    nodePanelWidth: 200              # 节点面板宽度
    propsPanelWidth: 300             # 属性面板宽度
    logPanelHeight: 150              # 日志面板高度

  # ============================================
  # 模板配置
  # ============================================
  templates:
    enabled: true                    # 启用模板系统
    builtinPath: "builtin"          # 内置模板目录
    customPath: "~/.dsh/templates"  # 自定义模板目录

  # ============================================
  # 自动化配置
  # ============================================
  automation:
    # 触发器配置
    triggers:
      manual: true                   # 手动触发
      
      cron:                          # 定时触发
        enabled: false
        schedule: "0 9 * * *"       # cron 表达式
      
      webhook:                       # Webhook 触发
        enabled: false
        path: "/api/flow-canvas/trigger"
      
      fileWatch:                     # 文件监听触发
        enabled: false
        paths:
          - "src/**/*.ts"
          - "tests/**/*.ts"
        events:
          - "change"
          - "add"
      
      gitEvent:                      # Git 事件触发
        enabled: false
        events:
          - "commit"
          - "push"

    # 自动化规则
    rules:
      - name: "auto-review"
        description: "代码提交时自动审查"
        enabled: true
        trigger:
          type: "gitEvent"
          event: "push"
        workflow: "code-review"
        conditions:
          - path: "src/**"
            event: "change"

      - name: "auto-test"
        description: "文件保存时自动测试"
        enabled: false
        trigger:
          type: "fileWatch"
          event: "change"
        workflow: "test-runner"
        conditions:
          - path: "tests/**/*.test.ts"

      - name: "daily-report"
        description: "每日生成报告"
        enabled: false
        trigger:
          type: "cron"
          schedule: "0 18 * * 1-5"
        workflow: "daily-report"

  # ============================================
  # API 配置
  # ============================================
  api:
    enabled: true                    # 启用 API
    port: 3081                       # API 端口
    cors: true                       # 允许 CORS
    auth:                            # 认证配置
      enabled: false
      type: "bearer"
      token: ""                      # 访问令牌

  # ============================================
  # 日志配置
  # ============================================
  logging:
    level: "info"                    # 日志级别: debug | info | warn | error
    file: "~/.dsh/logs/flow-canvas.log"  # 日志文件
    maxSize: "10mb"                  # 最大文件大小
    maxFiles: 5                      # 最大文件数

  # ============================================
  # 导出配置
  # ============================================
  export:
    formats:                         # 支持的导出格式
      - json
      - yaml
    includeMetadata: true            # 包含元数据
    prettyPrint: true                # 格式化输出
```

## 配置项详解

### 存储配置 (storage)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `path` | string | `~/.dsh/workflows` | 工作流存储目录 |
| `format` | string | `json` | 保存格式: json 或 yaml |
| `autoSave` | boolean | `true` | 是否自动保存 |
| `autoSaveInterval` | number | `30000` | 自动保存间隔 (毫秒) |
| `maxVersions` | number | `10` | 最大版本历史数 |

### 执行配置 (execution)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `defaultModel` | string | `mimo-v2.5` | 默认 AI 模型 |
| `defaultProvider` | string | `opencode-go` | 默认模型提供者 |
| `allowedTools` | string[] | `["read_file", "write_file", "bash", "search"]` | 允许使用的工具 |
| `writePaths` | string[] | `["src/", "tests/"]` | 允许写入的路径 |
| `readOnly` | boolean | `false` | 只读模式 |
| `maxSteps` | number | `50` | 最大执行步数 |
| `timeout` | number | `300000` | 执行超时 (毫秒) |
| `retryCount` | number | `3` | 失败重试次数 |
| `parallelExecution` | boolean | `true` | 允许并行执行 |

### UI 配置 (ui)

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `theme` | string | `auto` | 主题: auto, dark, light |
| `showMiniMap` | boolean | `true` | 显示小地图 |
| `showControls` | boolean | `true` | 显示缩放控件 |
| `snapToGrid` | boolean | `true` | 对齐网格 |
| `gridSize` | number | `15` | 网格大小 |
| `autoLayout` | string | `dagre` | 自动布局算法 |
| `nodePanelWidth` | number | `200` | 节点面板宽度 |
| `propsPanelWidth` | number | `300` | 属性面板宽度 |
| `logPanelHeight` | number | `150` | 日志面板高度 |

### 自动化配置 (automation)

#### 触发器 (triggers)

| 触发器 | 类型 | 说明 |
|--------|------|------|
| `manual` | boolean | 手动触发 |
| `cron` | object | 定时触发 |
| `cron.enabled` | boolean | 是否启用 |
| `cron.schedule` | string | cron 表达式 |
| `webhook` | object | Webhook 触发 |
| `webhook.enabled` | boolean | 是否启用 |
| `webhook.path` | string | Webhook 路径 |
| `fileWatch` | object | 文件监听触发 |
| `fileWatch.enabled` | boolean | 是否启用 |
| `fileWatch.paths` | string[] | 监听路径 (glob 模式) |
| `fileWatch.events` | string[] | 监听事件 |
| `gitEvent` | object | Git 事件触发 |
| `gitEvent.enabled` | boolean | 是否启用 |
| `gitEvent.events` | string[] | Git 事件 |

#### 自动化规则 (rules)

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `name` | string | 规则名称 |
| `description` | string | 规则描述 |
| `enabled` | boolean | 是否启用 |
| `trigger.type` | string | 触发器类型 |
| `trigger.event` | string | 触发事件 |
| `workflow` | string | 工作流 ID 或名称 |
| `conditions` | array | 触发条件 |

## 配置示例

### 示例 1: 基础配置

```yaml
flow-canvas:
  execution:
    defaultModel: "deepseek-v4-flash"
    maxSteps: 30
  ui:
    theme: "dark"
```

### 示例 2: 自动化配置

```yaml
flow-canvas:
  automation:
    triggers:
      fileWatch:
        enabled: true
        paths:
          - "src/**/*.ts"
      gitEvent:
        enabled: true
        events:
          - "push"
    rules:
      - name: "auto-review-on-push"
        enabled: true
        trigger:
          type: "gitEvent"
          event: "push"
        workflow: "code-review"
        conditions:
          - path: "src/**"
```

### 示例 3: Webhook 配置

```yaml
flow-canvas:
  api:
    enabled: true
    port: 3081
    auth:
      enabled: true
      type: "bearer"
      token: "your-secret-token"
  automation:
    triggers:
      webhook:
        enabled: true
        path: "/api/trigger"
```

## 环境变量

以下环境变量可以覆盖配置：

| 环境变量 | 配置项 | 说明 |
|----------|--------|------|
| `FLOW_CANVAS_STORAGE_PATH` | `storage.path` | 存储路径 |
| `FLOW_CANVAS_DEFAULT_MODEL` | `execution.defaultModel` | 默认模型 |
| `FLOW_CANVAS_DEFAULT_PROVIDER` | `execution.defaultProvider` | 默认 provider |
| `FLOW_CANVAS_LOG_LEVEL` | `logging.level` | 日志级别 |
| `FLOW_CANVAS_API_PORT` | `api.port` | API 端口 |

## 配置验证

DSH 会自动验证配置格式。如果配置无效，会显示错误信息：

```
flow-canvas: invalid config at execution.maxSteps: must be a number between 1 and 1000
```

## 工具使用

配置完成后，可以在 DSH 中使用以下命令：

```bash
# 打开画布
flow_canvas action=open

# 列出工作流
flow_canvas action=list

# 加载工作流
flow_canvas action=load workflow_id=my-workflow

# 保存工作流
flow_canvas action=save workflow_data={...}

# 查看配置
flow_canvas action=config
```
