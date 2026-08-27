const fs = require('fs');
const path = 'E:/Agent/dsh-flow-canvas/src/server/index.ts';
let src = fs.readFileSync(path, 'utf8');

// Add diagram generation tool
if (!src.includes("name: 'generate_diagram'")) {
  const diagramTools = `
  // ── 架构图生成 (REQ-007) ──

  ctx.tools.register({
    name: 'generate_diagram',
    description: 'Generate architecture/workflow/sequence/dataflow/lifecycle diagrams.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'], description: 'Diagram type' },
        title: { type: 'string', description: 'Diagram title' },
        nodes: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, label: { type: 'string' }, type: { type: 'string' } } }, description: 'Diagram nodes' },
        edges: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } } }, description: 'Diagram edges' },
      },
      required: ['type', 'title'],
    },
    output: workflowToolOutput,
    async execute(args) {
      var diagram = {
        apiVersion: 'dsh.flow-canvas/v1',
        kind: 'Diagram',
        type: args.type,
        title: args.title,
        nodes: (args.nodes || []).map(function(n) { return { id: n.id, label: n.label, type: n.type || 'component' } }),
        edges: (args.edges || []).map(function(e) { return { from: e.from, to: e.to, label: e.label || '' } }),
        metadata: { createdAt: Date.now(), version: 1 },
      }

      // Generate Mermaid syntax based on type
      var mermaid = ''
      switch (args.type) {
        case 'architecture':
          mermaid = 'graph TD\\n'
          diagram.nodes.forEach(function(n) { mermaid += '  ' + n.id + '[' + n.label + ']\\n' })
          diagram.edges.forEach(function(e) { mermaid += '  ' + e.from + ' --> ' + e.to + (e.label ? '|' + e.label + '|' : '') + '\\n' })
          break
        case 'workflow':
          mermaid = 'flowchart LR\\n'
          diagram.nodes.forEach(function(n) { mermaid += '  ' + n.id + '{' + n.label + '}\\n' })
          diagram.edges.forEach(function(e) { mermaid += '  ' + e.from + ' --> ' + e.to + '\\n' })
          break
        case 'sequence':
          mermaid = 'sequenceDiagram\\n'
          diagram.nodes.forEach(function(n) { mermaid += '  participant ' + n.id + ' as ' + n.label + '\\n' })
          diagram.edges.forEach(function(e) { mermaid += '  ' + e.from + '->>' + e.to + ': ' + e.label + '\\n' })
          break
        case 'dataflow':
          mermaid = 'flowchart LR\\n'
          diagram.nodes.forEach(function(n) { mermaid += '  ' + n.id + '((' + n.label + '))\\n' })
          diagram.edges.forEach(function(e) { mermaid += '  ' + e.from + ' ==> ' + e.to + '\\n' })
          break
        case 'lifecycle':
          mermaid = 'stateDiagram-v2\\n'
          diagram.nodes.forEach(function(n) { mermaid += '  [*] --> ' + n.id + '\\n' })
          diagram.edges.forEach(function(e) { mermaid += '  ' + e.from + ' --> ' + e.to + ': ' + e.label + '\\n' })
          break
      }

      diagram.mermaid = mermaid

      return {
        ok: true,
        message: args.type + ' diagram generated: ' + args.title,
        data: diagram,
      }
    },
  })

`;
  src = src.replace('  // 注入系统提示上下文', diagramTools + '\n  // 注入系统提示上下文');
}

fs.writeFileSync(path, src);
console.log('Added generate_diagram');
