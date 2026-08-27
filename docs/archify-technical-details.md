# archify 集成技术细节

## 1. archify JSON 规格

archify 使用 JSON 格式定义图表。以下是常见的图表类型规格：

### 1.1 架构图 JSON 规格

```json
{
  "type": "architecture",
  "title": "系统架构图",
  "theme": "dark",
  "nodes": [
    {
      "id": "node1",
      "label": "前端应用",
      "type": "component",
      "position": { "x": 100, "y": 100 },
      "size": { "width": 120, "height": 60 },
      "style": {
        "fill": "#4a90e2",
        "stroke": "#2d6cb4",
        "text": "#ffffff"
      }
    },
    {
      "id": "node2",
      "label": "后端服务",
      "type": "service",
      "position": { "x": 300, "y": 100 },
      "size": { "width": 120, "height": 60 },
      "style": {
        "fill": "#7ed321",
        "stroke": "#5a9a15",
        "text": "#ffffff"
      }
    }
  ],
  "edges": [
    {
      "id": "edge1",
      "source": "node1",
      "target": "node2",
      "label": "API 调用",
      "style": {
        "stroke": "#999999",
        "strokeWidth": 2,
        "marker": "arrowhead"
      }
    }
  ],
  "metadata": {
    "author": "archify",
    "version": "1.0",
    "created": "2026-08-24"
  }
}
```

### 1.2 工作流图 JSON 规格

```json
{
  "type": "workflow",
  "title": "业务流程",
  "theme": "light",
  "nodes": [
    {
      "id": "start",
      "label": "开始",
      "type": "start",
      "position": { "x": 100, "y": 50 },
      "size": { "width": 80, "height": 40 },
      "style": {
        "fill": "#4caf50",
        "stroke": "#388e3c",
        "text": "#ffffff"
      }
    },
    {
      "id": "process",
      "label": "处理数据",
      "type": "process",
      "position": { "x": 100, "y": 150 },
      "size": { "width": 120, "height": 60 },
      "style": {
        "fill": "#2196f3",
        "stroke": "#1976d2",
        "text": "#ffffff"
      }
    },
    {
      "id": "end",
      "label": "结束",
      "type": "end",
      "position": { "x": 100, "y": 250 },
      "size": { "width": 80, "height": 40 },
      "style": {
        "fill": "#f44336",
        "stroke": "#d32f2f",
        "text": "#ffffff"
      }
    }
  ],
  "edges": [
    {
      "id": "edge1",
      "source": "start",
      "target": "process",
      "label": ""
    },
    {
      "id": "edge2",
      "source": "process",
      "target": "end",
      "label": ""
    }
  ]
}
```

## 2. archify 导出 API

### 2.1 导出格式

| 格式 | 描述 | 用途 |
|------|------|------|
| HTML | 自包含 HTML 文件 | 分享和展示 |
| PNG | 高清 PNG 图片 | 文档和演示 |
| SVG | 矢量 SVG 图形 | 编辑和缩放 |

### 2.2 导出参数

```javascript
const exportOptions = {
  format: 'html', // 'html' | 'png' | 'svg'
  quality: 1.0,   // 图片质量 (0.1 - 1.0)
  scale: 2,       // 缩放比例
  theme: 'dark',  // 主题 ('dark' | 'light')
  background: true, // 是否包含背景
  animations: true  // 是否包含动画
}
```

### 2.3 导出示例

```javascript
// 导出为 HTML
const htmlContent = archify.exportToHTML(diagramSpec, exportOptions)

// 导出为 PNG
const pngBuffer = archify.exportToPNG(diagramSpec, exportOptions)

// 导出为 SVG
const svgContent = archify.exportToSVG(diagramSpec, exportOptions)
```

## 3. Before/Delta/After 对比功能

### 3.1 数据模型

```typescript
interface DiagramComparison {
  before: DiagramSpec    // 变更前的图表
  delta: DiagramDelta    // 变更内容
  after: DiagramSpec     // 变更后的图表
}

interface DiagramDelta {
  addedNodes: Node[]     // 新增的节点
  removedNodes: Node[]   // 移除的节点
  modifiedNodes: Node[]  // 修改的节点
  addedEdges: Edge[]     // 新增的边
  removedEdges: Edge[]   // 移除的边
  modifiedEdges: Edge[]  // 修改的边
}
```

### 3.2 对比渲染

```javascript
// 渲染对比视图
function renderComparison(comparison: DiagramComparison) {
  // 1. 渲染 before 视图
  renderDiagram(comparison.before, { opacity: 0.5 })
  
  // 2. 渲染 delta 标记
  renderDeltaMarkers(comparison.delta)
  
  // 3. 渲染 after 视图
  renderDiagram(comparison.after, { opacity: 1.0 })
  
  // 4. 添加交互控制
  addComparisonControls()
}
```

## 4. 集成实现步骤

### 4.1 安装 archify 依赖

```bash
npm install @tt-a1i/archify
# 或
pnpm add @tt-a1i/archify
```

### 4.2 增强 DiagramNode 组件

```typescript
// src/client/nodes/DiagramNode.tsx
import { archify } from '@tt-a1i/archify'

export const DiagramNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as DiagramNodeData
  const [preview, setPreview] = useState<string | null>(null)
  
  // 渲染图表预览
  useEffect(() => {
    if (nodeData.content) {
      const spec = JSON.parse(nodeData.content)
      archify.renderToHTML(spec, { theme: nodeData.theme })
        .then(html => setPreview(html))
    }
  }, [nodeData.content, nodeData.theme])
  
  // 导出功能
  const handleExport = async (format: 'html' | 'png' | 'svg') => {
    const spec = JSON.parse(nodeData.content)
    const result = await archify.export(spec, { format, theme: nodeData.theme })
    // 下载或复制结果
  }
  
  return (
    <div className={`node diagram-node ${selected ? 'selected' : ''}`}>
      {/* 现有内容 */}
      {preview && (
        <div className="diagram-preview" dangerouslySetInnerHTML={{ __html: preview }} />
      )}
      <div className="export-buttons">
        <button onClick={() => handleExport('html')}>导出 HTML</button>
        <button onClick={() => handleExport('png')}>导出 PNG</button>
        <button onClick={() => handleExport('svg')}>导出 SVG</button>
      </div>
    </div>
  )
})
```

### 4.3 实现对比功能

```typescript
// src/client/components/DiagramComparison.tsx
import { archify } from '@tt-a1i/archify'

export const DiagramComparison = ({ comparison }: { comparison: DiagramComparison }) => {
  const [viewMode, setViewMode] = useState<'before' | 'delta' | 'after'>('after')
  
  return (
    <div className="diagram-comparison">
      <div className="comparison-controls">
        <button onClick={() => setViewMode('before')}>Before</button>
        <button onClick={() => setViewMode('delta')}>Delta</button>
        <button onClick={() => setViewMode('after')}>After</button>
      </div>
      <div className="comparison-view">
        {viewMode === 'before' && (
          <archify.Diagram spec={comparison.before} theme="light" />
        )}
        {viewMode === 'delta' && (
          <archify.DiagramDelta delta={comparison.delta} />
        )}
        {viewMode === 'after' && (
          <archify.Diagram spec={comparison.after} theme="light" />
        )}
      </div>
    </div>
  )
}
```

## 5. 测试用例

### 5.1 导出功能测试

```typescript
// tests/export.test.js
describe('DiagramNode export', () => {
  it('should export to HTML', async () => {
    const spec = { type: 'architecture', nodes: [], edges: [] }
    const html = await archify.exportToHTML(spec, { format: 'html' })
    assert.ok(html.includes('<html>'))
    assert.ok(html.includes('</html>'))
  })
  
  it('should export to PNG', async () => {
    const spec = { type: 'architecture', nodes: [], edges: [] }
    const png = await archify.exportToPNG(spec, { format: 'png' })
    assert.ok(png instanceof Buffer)
  })
  
  it('should export to SVG', async () => {
    const spec = { type: 'architecture', nodes: [], edges: [] }
    const svg = await archify.exportToSVG(spec, { format: 'svg' })
    assert.ok(svg.includes('<svg>'))
    assert.ok(svg.includes('</svg>'))
  })
})
```

### 5.2 对比功能测试

```typescript
// tests/comparison.test.js
describe('DiagramComparison', () => {
  it('should render before view', () => {
    const comparison = {
      before: { nodes: [], edges: [] },
      delta: { addedNodes: [], removedNodes: [], modifiedNodes: [] },
      after: { nodes: [], edges: [] }
    }
    render(<DiagramComparison comparison={comparison} />)
    expect(screen.getByText('Before')).toBeInTheDocument()
  })
  
  it('should switch between views', () => {
    const comparison = { /* ... */ }
    render(<DiagramComparison comparison={comparison} />)
    
    fireEvent.click(screen.getByText('Before'))
    expect(screen.getByTestId('before-view')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Delta'))
    expect(screen.getByTestId('delta-view')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('After'))
    expect(screen.getByTestId('after-view')).toBeInTheDocument()
  })
})
```

## 6. 性能优化

### 6.1 懒加载

```typescript
// 使用 React.lazy 延迟加载 archify
const ArchifyDiagram = React.lazy(() => import('@tt-a1i/archify'))

// 在 DiagramNode 中使用
<Suspense fallback={<div>加载中...</div>}>
  <ArchifyDiagram spec={spec} theme={theme} />
</Suspense>
```

### 6.2 缓存

```typescript
// 使用 React.memo 缓存渲染结果
const MemoizedDiagram = React.memo(({ spec, theme }) => {
  return <archify.Diagram spec={spec} theme={theme} />
}, (prev, next) => {
  return prev.spec === next.spec && prev.theme === next.theme
})
```

## 7. 注意事项

1. **依赖兼容性**：确保 archify 版本与现有依赖兼容
2. **包大小**：archify 可能增加 100-200KB，考虑按需加载
3. **主题同步**：确保 archify 主题与 dsh-flow-canvas 主题同步
4. **性能影响**：复杂图表可能影响渲染性能，需要优化
5. **浏览器兼容性**：确保支持现代浏览器（Chrome、Firefox、Safari）

## 8. 参考链接

- [archify GitHub 仓库](https://github.com/tt-a1i/archify)
- [dsh-archify 插件](https://github.com/GongYuanCaiJi/dsh-archify)
- [archify SKILL.md](https://github.com/tt-a1i/archify/blob/main/archify/SKILL.md)
- [archify schemas](https://github.com/tt-a1i/archify/blob/main/archify/schemas/README.md)