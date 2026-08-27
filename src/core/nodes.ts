/**
 * dsh-flow-canvas — Core node definitions.
 * 10 种核心节点，参考 GM-HZ/dsh-dag-workflow nodes.ts。
 */

import type {
  WorkflowNodeDefinition,
  WorkflowNodeExecutionContext,
  WorkflowNodeExecutionResult,
  JsonObject,
  JsonValue,
} from './types'

// ── Start Node ──
export const startNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.start',
  version: 1,
  title: '开始',
  description: '验证并暴露工作流输入',
  role: 'start',
  configSchema: { type: 'object', additionalProperties: false },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['success'],
  capabilities: [],
  retry: 'safe',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    return { outputs: context.workflowInputs }
  },
}

// ── End Node ──
export const endNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.end',
  version: 1,
  title: '结束',
  description: '物化终端工作流输出',
  role: 'end',
  configSchema: { type: 'object', additionalProperties: false },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['success'],
  capabilities: [],
  retry: 'safe',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    return { outputs: context.inputs }
  },
}

// ── Condition Node ──
export const conditionNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.condition',
  version: 1,
  title: '条件',
  description: '使用固定运算符选择 true 或 false 边',
  role: 'regular',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['operator'],
    properties: {
      operator: { enum: ['truthy', 'falsy', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'regex'] },
    },
  },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['left'],
    properties: { left: {}, right: {} },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['result'],
    properties: { result: { type: 'boolean' } },
  },
  outputPorts: ['true', 'false'],
  requiredOutputPorts: ['true', 'false'],
  capabilities: [],
  retry: 'safe',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    const { operator } = context.config as { operator: string }
    const left = (context.inputs as any).left
    const right = (context.inputs as any).right

    let result = false
    switch (operator) {
      case 'truthy': result = Boolean(left); break
      case 'falsy': result = !Boolean(left); break
      case 'eq': result = left === right; break
      case 'neq': result = left !== right; break
      case 'gt': result = Number(left) > Number(right); break
      case 'gte': result = Number(left) >= Number(right); break
      case 'lt': result = Number(left) < Number(right); break
      case 'lte': result = Number(left) <= Number(right); break
      case 'contains': result = String(left).includes(String(right)); break
      case 'regex': result = new RegExp(String(right)).test(String(left)); break
    }

    return {
      outputs: { result },
      selectedPorts: [result ? 'true' : 'false'],
    }
  },
}

// ── Tool Node ──
export const toolNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.tool',
  version: 1,
  title: '工具',
  description: '调用 DSH 工具',
  role: 'regular',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['toolName'],
    properties: {
      toolName: { type: 'string' },
      args: { type: 'object' },
    },
  },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['success', 'error'],
  capabilities: ['dsh.tools.execute'],
  retry: 'safe',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    const { toolName, args } = context.config as { toolName: string; args: JsonObject }
    if (!context.toolGateway) {
      throw new Error('Tool gateway not available')
    }
    const result = await context.toolGateway.execute({
      runId: context.nodeId,
      nodeId: context.nodeId,
      name: toolName,
      input: { ...args, ...context.inputs },
      signal: context.signal,
    })
    return { outputs: result as JsonObject }
  },
}

// ── Agent Node ──
export const agentNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.agent',
  version: 1,
  title: 'Agent',
  description: '委托子 Agent 执行任务',
  role: 'regular',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['provider', 'prompt'],
    properties: {
      provider: { type: 'string' },
      prompt: { type: 'string' },
      model: { type: 'string' },
      profile: { type: 'string' },
      tools: { type: 'array', items: { type: 'string' } },
      maxSteps: { type: 'number' },
    },
  },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['success', 'error'],
  capabilities: ['dsh.subagents.execute'],
  retry: 'safe',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    const { provider, prompt } = context.config as { provider: string; prompt: string }
    if (!context.agentGateway) {
      throw new Error('Agent gateway not available')
    }
    const result = await context.agentGateway.execute({
      runId: context.nodeId,
      nodeId: context.nodeId,
      provider,
      prompt,
      signal: context.signal,
    })
    return { outputs: result as JsonObject }
  },
}

// ── Script Node ──
export const scriptNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.script',
  version: 1,
  title: '脚本',
  description: '确定性 JSON 数据变换',
  role: 'regular',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['language', 'code'],
    properties: {
      language: { type: 'string' },
      code: { type: 'string' },
    },
  },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['success'],
  capabilities: [],
  retry: 'idempotent',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    const { language, code } = context.config as { language: string; code: string }

    if (language === 'json') {
      // JSON 变换：filter, map, sort, merge
      try {
        const transform = JSON.parse(code)
        let result = context.inputs

        if (transform.filter) {
          const arr = Array.isArray(result) ? result : [result]
          result = arr.filter((item: any) => {
            const fn = new Function('item', `return ${transform.filter}`)
            return fn(item)
          }) as any
        }

        if (transform.map) {
          const arr = Array.isArray(result) ? result : [result]
          result = arr.map((item: any) => {
            const fn = new Function('item', `return ${transform.map}`)
            return fn(item)
          }) as any
        }

        if (transform.sort) {
          const arr = Array.isArray(result) ? result : [result]
          result = arr.sort((a: any, b: any) => {
            const fn = new Function('a', 'b', `return ${transform.sort}`)
            return fn(a, b)
          }) as any
        }

        if (transform.merge) {
          result = { ...result, ...transform.merge }
        }

        return { outputs: result as JsonObject }
      } catch (error) {
        throw new Error(`Script execution failed: ${error}`)
      }
    }

    // JavaScript 执行
    const fn = new Function('inputs', `'use strict';\n${code}`)
    const result = await fn(context.inputs)
    return { outputs: result ?? null }
  },
}

// ── Human Approval Node ──
export const humanApprovalNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.human-approval',
  version: 1,
  title: '人工审批',
  description: '暂停执行等待人工确认',
  role: 'regular',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      message: { type: 'string' },
      approvers: { type: 'array', items: { type: 'string' } },
    },
  },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['approved', 'rejected'],
  capabilities: [],
  retry: 'never',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    // 标记为需要审批
    return {
      outputs: { needsApproval: true, input: context.inputs },
      selectedPorts: ['approved'], // 默认批准
    }
  },
}

// ── Subworkflow Node ──
export const subworkflowNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.subworkflow',
  version: 1,
  title: '子工作流',
  description: '引用并执行另一个工作流',
  role: 'regular',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['workflowId'],
    properties: {
      workflowId: { type: 'string' },
      passThrough: { type: 'boolean' },
    },
  },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['success', 'error'],
  capabilities: ['dsh.workflows.execute'],
  retry: 'safe',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    const { workflowId } = context.config as { workflowId: string }
    // 子工作流执行由引擎处理
    return { outputs: { subworkflowId: workflowId, input: context.inputs } }
  },
}

// ── Foreach Node ──
export const foreachNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.foreach',
  version: 1,
  title: '遍历',
  description: '遍历数组执行子图',
  role: 'regular',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      arrayPath: { type: 'string' },
      itemVariable: { type: 'string' },
      indexVariable: { type: 'string' },
      batchSize: { type: 'number' },
    },
  },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['body', 'done'],
  capabilities: [],
  retry: 'safe',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    const { arrayPath = 'items', batchSize = 1 } = context.config as any
    const array = (context.inputs as any)[arrayPath] || []
    return {
      outputs: { array, batchSize, totalItems: array.length },
      selectedPorts: array.length > 0 ? ['body'] : ['done'],
    }
  },
}

// ── Parallel Node ──
export const parallelNodeDefinition: WorkflowNodeDefinition = {
  type: 'core.parallel',
  version: 1,
  title: '并行',
  description: '并行执行多个分支',
  role: 'regular',
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      maxConcurrency: { type: 'number' },
    },
  },
  inputSchema: { type: 'object' },
  outputSchema: { type: 'object' },
  outputPorts: ['branch'],
  capabilities: [],
  retry: 'safe',
  async execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult> {
    const { maxConcurrency = 4 } = context.config as { maxConcurrency: number }
    return { outputs: { maxConcurrency, input: context.inputs } }
  },
}

// ── Node Registry ──
export const coreNodeDefinitions: WorkflowNodeDefinition[] = [
  startNodeDefinition,
  endNodeDefinition,
  conditionNodeDefinition,
  toolNodeDefinition,
  agentNodeDefinition,
  scriptNodeDefinition,
  humanApprovalNodeDefinition,
  subworkflowNodeDefinition,
  foreachNodeDefinition,
  parallelNodeDefinition,
]

export function createNodeRegistry(): Map<string, WorkflowNodeDefinition> {
  const registry = new Map<string, WorkflowNodeDefinition>()
  for (const def of coreNodeDefinitions) {
    registry.set(def.type, def)
  }
  return registry
}
