/**
 * dsh-flow-canvas — Core nodes (plain JS).
 */
var startNodeDefinition = {
  type: 'core.start', version: 1, title: '开始', description: '验证并暴露工作流输入',
  role: 'start',
  configSchema: { type: 'object', additionalProperties: false },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['success'],
  capabilities: [], retry: 'safe',
  async execute(ctx) { return { outputs: ctx.workflowInputs } },
}

var endNodeDefinition = {
  type: 'core.end', version: 1, title: '结束', description: '物化终端工作流输出',
  role: 'end',
  configSchema: { type: 'object', additionalProperties: false },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['success'],
  capabilities: [], retry: 'safe',
  async execute(ctx) { return { outputs: ctx.inputs } },
}

var conditionNodeDefinition = {
  type: 'core.condition', version: 1, title: '条件', description: '条件分支选择',
  role: 'regular',
  configSchema: {
    type: 'object', additionalProperties: false, required: ['operator'],
    properties: { operator: { enum: ['truthy','falsy','eq','neq','gt','gte','lt','lte','contains','regex'] } },
  },
  inputSchema: { type: 'object', properties: { left: {}, right: {} } },
  outputSchema: { type: 'object', properties: { result: { type: 'boolean' } } },
  outputPorts: ['true', 'false'], requiredOutputPorts: ['true', 'false'],
  capabilities: [], retry: 'safe',
  async execute(ctx) {
    var op = ctx.config.operator, L = ctx.inputs.left, R = ctx.inputs.right
    var r = false
    switch (op) {
      case 'truthy': r = Boolean(L); break
      case 'falsy': r = !Boolean(L); break
      case 'eq': r = L === R; break
      case 'neq': r = L !== R; break
      case 'gt': r = Number(L) > Number(R); break
      case 'gte': r = Number(L) >= Number(R); break
      case 'lt': r = Number(L) < Number(R); break
      case 'lte': r = Number(L) <= Number(R); break
      case 'contains': r = String(L).includes(String(R)); break
      case 'regex': r = new RegExp(String(R)).test(String(L)); break
    }
    return { outputs: { result: r }, selectedPorts: [r ? 'true' : 'false'] }
  },
}

var toolNodeDefinition = {
  type: 'core.tool', version: 1, title: '工具', description: '调用 DSH 工具',
  role: 'regular',
  configSchema: { type: 'object', required: ['toolName'], properties: { toolName: { type: 'string' }, args: { type: 'object' } } },
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  outputPorts: ['success', 'error'],
  capabilities: ['dsh.tools.execute'], retry: 'safe',
  async execute(ctx) {
    var toolName = ctx.config.toolName, args = ctx.config.args || {}
    if (!ctx.toolGateway) throw new Error('Tool gateway not available')
    var result = await ctx.toolGateway.execute({ runId: ctx.nodeId, nodeId: ctx.nodeId, name: toolName, input: Object.assign({}, args, ctx.inputs), signal: ctx.signal })
    return { outputs: result }
  },
}

var agentNodeDefinition = {
  type: 'core.agent', version: 1, title: 'Agent', description: '委托子 Agent 执行',
  role: 'regular',
  configSchema: { type: 'object', required: ['provider', 'prompt'], properties: { provider: { type: 'string' }, prompt: { type: 'string' }, model: { type: 'string' }, tools: { type: 'array', items: { type: 'string' } } } },
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  outputPorts: ['success', 'error'],
  capabilities: ['dsh.subagents.execute'], retry: 'safe',
  async execute(ctx) {
    if (!ctx.agentGateway) throw new Error('Agent gateway not available')
    var result = await ctx.agentGateway.execute({ runId: ctx.nodeId, nodeId: ctx.nodeId, provider: ctx.config.provider, prompt: ctx.config.prompt, signal: ctx.signal })
    return { outputs: result }
  },
}

var scriptNodeDefinition = {
  type: 'core.script', version: 1, title: '脚本', description: '确定性 JSON 数据变换',
  role: 'regular',
  configSchema: { type: 'object', required: ['language', 'code'], properties: { language: { type: 'string' }, code: { type: 'string' } } },
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  outputPorts: ['success'],
  capabilities: [], retry: 'idempotent',
  async execute(ctx) {
    var fn = new Function('inputs', "'use strict';\n" + ctx.config.code)
    var result = await fn(ctx.inputs)
    return { outputs: result || null }
  },
}

var humanApprovalNodeDefinition = {
  type: 'core.human-approval', version: 1, title: '人工审批', description: '暂停等待人工确认',
  role: 'regular',
  configSchema: { type: 'object', properties: { message: { type: 'string' } } },
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  outputPorts: ['approved', 'rejected'],
  capabilities: [], retry: 'never',
  async execute(ctx) {
    return { outputs: { needsApproval: true, input: ctx.inputs }, selectedPorts: ['approved'] }
  },
}

var subworkflowNodeDefinition = {
  type: 'core.subworkflow', version: 1, title: '子工作流', description: '引用执行另一个工作流',
  role: 'regular',
  configSchema: { type: 'object', required: ['workflowId'], properties: { workflowId: { type: 'string' } } },
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  outputPorts: ['success', 'error'],
  capabilities: ['dsh.workflows.execute'], retry: 'safe',
  async execute(ctx) {
    return { outputs: { subworkflowId: ctx.config.workflowId, input: ctx.inputs } }
  },
}

var foreachNodeDefinition = {
  type: 'core.foreach', version: 1, title: '遍历', description: '遍历数组执行子图',
  role: 'regular',
  configSchema: { type: 'object', properties: { arrayPath: { type: 'string' }, batchSize: { type: 'number' } } },
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  outputPorts: ['body', 'done'],
  capabilities: [], retry: 'safe',
  async execute(ctx) {
    var arrPath = ctx.config.arrayPath || 'items', arr = ctx.inputs[arrPath] || []
    return { outputs: { array: arr, batchSize: ctx.config.batchSize || 1, totalItems: arr.length }, selectedPorts: arr.length > 0 ? ['body'] : ['done'] }
  },
}

var parallelNodeDefinition = {
  type: 'core.parallel', version: 1, title: '并行', description: '并行执行多个分支',
  role: 'regular',
  configSchema: { type: 'object', properties: { maxConcurrency: { type: 'number' } } },
  inputSchema: { type: 'object' }, outputSchema: { type: 'object' },
  outputPorts: ['branch'],
  capabilities: [], retry: 'safe',
  async execute(ctx) {
    return { outputs: { maxConcurrency: ctx.config.maxConcurrency || 4, input: ctx.inputs } }
  },
}

function createNodeRegistry() {
  var registry = new Map()
  var defs = [startNodeDefinition, endNodeDefinition, conditionNodeDefinition, toolNodeDefinition,
    agentNodeDefinition, scriptNodeDefinition, humanApprovalNodeDefinition, subworkflowNodeDefinition,
    foreachNodeDefinition, parallelNodeDefinition]
  for (var i = 0; i < defs.length; i++) registry.set(defs[i].type, defs[i])
  return registry
}

module.exports = {
  startNodeDefinition, endNodeDefinition, conditionNodeDefinition,
  toolNodeDefinition, agentNodeDefinition, scriptNodeDefinition,
  humanApprovalNodeDefinition, subworkflowNodeDefinition,
  foreachNodeDefinition, parallelNodeDefinition, createNodeRegistry
}
