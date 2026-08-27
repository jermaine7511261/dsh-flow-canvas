/**
 * dsh-flow-canvas — Canvas to WorkflowTemplate converter.
 * 将画布的 FlowNode/FlowEdge 格式转换为 dsh.flow-canvas/v1 WorkflowTemplate。
 */

/**
 * 将画布数据转换为 WorkflowTemplate
 * @param {Object} canvasData - 画布数据 { nodes, edges, name, description }
 * @returns {Object} WorkflowTemplate
 */
function canvasToTemplate(canvasData) {
  const { nodes = [], edges = [], name = 'Untitled', description = '' } = canvasData

  // 生成唯一 ID
  const workflowId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  // 转换节点
  const templateNodes = nodes.map(node => {
    const data = node.data || {}
    return {
      id: node.id,
      uses: mapNodeTypeToUses(data.type || node.type),
      title: data.label || node.id,
      with: extractNodeConfig(data),
      inputs: extractNodeInputs(data, edges, node.id),
    }
  })

  // 转换边
  const templateEdges = edges.map(edge => ({
    id: edge.id || `e-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    sourcePort: edge.sourceHandle || undefined,
  }))

  // 构建 WorkflowTemplate
  return {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: {
      id: workflowId,
      name,
      description,
    },
    spec: {
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
      nodes: templateNodes,
      edges: templateEdges,
      outputs: {},
    },
  }
}

/**
 * 将画布节点类型映射到 core 节点类型
 */
function mapNodeTypeToUses(type) {
  const mapping = {
    'start': 'core.start',
    'end': 'core.end',
    'agent': 'core.agent',
    'tool': 'core.tool',
    'condition': 'core.condition',
    'code': 'core.script',
    'script': 'core.script',
    'http': 'core.tool',
    'subflow': 'core.subworkflow',
    'loop': 'core.foreach',
    'iteration': 'core.foreach',
    'team': 'core.agent',
    'merge': 'core.parallel',
    'parallel': 'core.parallel',
    'human-approval': 'core.human-approval',
    'trigger': 'core.start',
    'cron-trigger': 'core.start',
    'webhook-trigger': 'core.start',
  }
  return mapping[type] || 'core.tool'
}

/**
 * 提取节点配置
 */
function extractNodeConfig(data) {
  const config = {}

  switch (data.type) {
    case 'agent':
    case 'team':
      config.provider = data.model || data.provider || 'default'
      config.prompt = data.prompt || ''
      config.tools = data.tools || []
      config.profile = data.profile || ''
      break

    case 'tool':
    case 'http':
      config.toolName = data.toolName || data.type
      config.args = data.args || {}
      config.method = data.method || 'GET'
      config.url = data.url || ''
      break

    case 'condition':
      config.operator = data.conditionType || 'truthy'
      config.conditionValue = data.conditionValue || ''
      break

    case 'code':
    case 'script':
      config.language = data.language || 'javascript'
      config.code = data.code || ''
      break

    case 'subflow':
      config.workflowId = data.subWorkflowName || data.workflowId || ''
      break

    case 'loop':
    case 'iteration':
      config.arrayPath = data.arraySource || 'items'
      config.batchSize = data.batchSize || 1
      config.maxIterations = data.maxIterations || 10
      break

    case 'merge':
    case 'parallel':
      config.maxConcurrency = data.maxConcurrency || 4
      break

    case 'human-approval':
      config.message = data.message || 'Please review and approve'
      break

    default:
      // 保留原始配置
      Object.assign(config, data)
  }

  return config
}

/**
 * 提取节点输入绑定
 */
function extractNodeInputs(data, edges, nodeId) {
  const inputs = {}

  // 查找指向此节点的边
  const incomingEdges = edges.filter(e => e.target === nodeId)

  for (const edge of incomingEdges) {
    // 从上游节点输出绑定到当前节点输入
    inputs[edge.targetHandle || 'default'] = {
      output: {
        node: edge.source,
        path: [edge.sourceHandle || 'outputs'],
      },
    }
  }

  return inputs
}

/**
 * 将 WorkflowTemplate 转换回画布格式
 */
function templateToCanvas(template) {
  if (!template?.spec) return { nodes: [], edges: [] }

  const nodes = (template.spec.nodes || []).map(tn => ({
    id: tn.id,
    type: mapUsesToNodeType(tn.uses),
    position: { x: 0, y: 0 }, // 默认位置
    data: {
      type: mapUsesToNodeType(tn.uses),
      label: tn.title || tn.id,
      ...extractCanvasData(tn),
    },
  }))

  const edges = (template.spec.edges || []).map(te => ({
    id: te.id,
    source: te.source,
    target: te.target,
    sourceHandle: te.sourcePort || undefined,
  }))

  return { nodes, edges }
}

/**
 * 将 core 节点类型映射回画布节点类型
 */
function mapUsesToNodeType(uses) {
  const mapping = {
    'core.start': 'start',
    'core.end': 'end',
    'core.agent': 'agent',
    'core.tool': 'tool',
    'core.condition': 'condition',
    'core.script': 'code',
    'core.subworkflow': 'subflow',
    'core.foreach': 'loop',
    'core.parallel': 'merge',
    'core.human-approval': 'human-approval',
  }
  return mapping[uses] || 'tool'
}

/**
 * 从节点配置提取画布数据
 */
function extractCanvasData(templateNode) {
  const config = templateNode.with || {}
  const data = {}

  switch (templateNode.uses) {
    case 'core.agent':
      data.model = config.provider
      data.prompt = config.prompt
      data.tools = config.tools
      break
    case 'core.tool':
      data.toolName = config.toolName
      data.args = config.args
      break
    case 'core.condition':
      data.conditionType = config.operator
      data.conditionValue = config.conditionValue
      break
    case 'core.script':
      data.language = config.language
      data.code = config.code
      break
    default:
      Object.assign(data, config)
  }

  return data
}

module.exports = { canvasToTemplate, templateToCanvas }
