/**
 * dsh-flow-canvas — Workflow compiler.
 * 将工作流模板编译为可执行的 CompiledWorkflow。
 * 参考 GM-HZ/dsh-dag-workflow compiler.ts。
 */

import { createHash } from 'node:crypto'
import type {
  WorkflowTemplate,
  WorkflowNodeTemplate,
  WorkflowEdgeTemplate,
  WorkflowNodeDefinition,
  WorkflowRequirement,
  CompiledWorkflow,
  CompiledWorkflowNode,
  WorkflowDiagnostic,
  JsonSchema,
  WorkflowBinding,
} from './types'

// ── 诊断工具 ──
function diagnostic(code: string, message: string, nodeId?: string, path?: readonly (string | number)[]): WorkflowDiagnostic {
  return { code, severity: 'error', message, nodeId, path }
}

function diagnosticWarning(code: string, message: string, nodeId?: string): WorkflowDiagnostic {
  return { code, severity: 'warning', message, nodeId }
}

// ── 结构校验 ──
function structuralDiagnostics(template: WorkflowTemplate): WorkflowDiagnostic[] {
  const diagnostics: WorkflowDiagnostic[] = []

  if (template.apiVersion !== 'dsh.flow-canvas/v1') {
    diagnostics.push(diagnostic('INVALID_API_VERSION', `Unsupported apiVersion: ${template.apiVersion}`))
  }
  if (template.kind !== 'WorkflowTemplate') {
    diagnostics.push(diagnostic('INVALID_KIND', `Invalid kind: ${template.kind}`))
  }
  if (!template.metadata?.id) {
    diagnostics.push(diagnostic('MISSING_ID', 'metadata.id is required'))
  }
  if (!template.metadata?.name) {
    diagnostics.push(diagnostic('MISSING_NAME', 'metadata.name is required'))
  }
  if (!template.spec?.nodes?.length) {
    diagnostics.push(diagnostic('NO_NODES', 'spec.nodes must have at least one node'))
  }

  return diagnostics
}

// ── Binding 校验 ──
function validateBinding(binding: WorkflowBinding, path: string): WorkflowDiagnostic[] {
  const diagnostics: WorkflowDiagnostic[] = []
  if ('literal' in binding) return diagnostics
  if ('input' in binding) {
    if (typeof binding.input !== 'string' || binding.input.length === 0) {
      diagnostics.push(diagnostic('INVALID_BINDING', `Invalid input binding at ${path}`, undefined, path.split('.')))
    }
    return diagnostics
  }
  if ('output' in binding) {
    if (!binding.output.node || !binding.output.path) {
      diagnostics.push(diagnostic('INVALID_BINDING', `Invalid output binding at ${path}`, undefined, path.split('.')))
    }
    return diagnostics
  }
  if ('secret' in binding) {
    if (!binding.secret.ref) {
      diagnostics.push(diagnostic('INVALID_BINDING', `Invalid secret binding at ${path}`, undefined, path.split('.')))
    }
    return diagnostics
  }
  diagnostics.push(diagnostic('UNKNOWN_BINDING', `Unknown binding type at ${path}`, undefined, path.split('.')))
  return diagnostics
}

// ── 语义哈希 ──
function computeSemanticHash(template: WorkflowTemplate): string {
  const payload = JSON.stringify({
    apiVersion: template.apiVersion,
    kind: template.kind,
    spec: template.spec,
  }, Object.keys(template.spec || {}).sort())
  return createHash('sha256').update(payload).digest('hex').slice(0, 16)
}

// ── 拓扑排序 ──
function topologicalSort(nodes: readonly WorkflowNodeTemplate[], edges: readonly WorkflowEdgeTemplate[]): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    adjacency.get(edge.source)?.push(edge.target)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const order: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(id)
    for (const target of adjacency.get(id) || []) {
      const newDegree = (inDegree.get(target) || 1) - 1
      inDegree.set(target, newDegree)
      if (newDegree === 0) queue.push(target)
    }
  }

  return order
}

// ── 查找 Start 节点 ──
function findStartNode(nodes: readonly WorkflowNodeTemplate[]): string | null {
  for (const node of nodes) {
    if (node.uses === 'core.start') return node.id
  }
  return nodes[0]?.id || null
}

// ── 校验输入/输出 ──
function createInputValidator(schema: JsonSchema): (value: unknown) => string[] {
  return (value: unknown): string[] => {
    const errors: string[] = []
    if (schema.type === 'object' && typeof value !== 'object') {
      errors.push('Input must be an object')
    }
    if (schema.required && Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof value !== 'object' || value === null || !(key in (value as object))) {
          errors.push(`Missing required field: ${key}`)
        }
      }
    }
    return errors
  }
}

// ── 主编译函数 ──
export function compileWorkflow(
  template: WorkflowTemplate,
  registry: Map<string, WorkflowNodeDefinition>
): { workflow?: CompiledWorkflow; diagnostics: WorkflowDiagnostic[] } {
  const diagnostics: WorkflowDiagnostic[] = []

  // 1. 结构校验
  const structDiags = structuralDiagnostics(template)
  if (structDiags.length > 0) {
    return { diagnostics: structDiags }
  }

  // 2. 校验需求
  const declaredRequirements = new Map<string, WorkflowRequirement>()
  for (const [index, req] of (template.spec.requires || []).entries()) {
    const key = `${req.kind}:${req.uses}`
    if (declaredRequirements.has(key)) {
      diagnostics.push(diagnostic('DUPLICATE_REQUIREMENT', `Duplicate requirement: ${key}`, undefined, ['spec', 'requires', index]))
    } else {
      declaredRequirements.set(key, req)
    }
  }

  // 3. 解析节点
  const nodesById = new Map<string, WorkflowNodeTemplate>()
  const definitions = new Map<string, WorkflowNodeDefinition>()
  const nodeRequirements = new Map<string, WorkflowRequirement[]>()

  for (const [index, node] of template.spec.nodes.entries()) {
    if (nodesById.has(node.id)) {
      diagnostics.push(diagnostic('DUPLICATE_NODE_ID', `Duplicate node id: ${node.id}`, node.id, ['spec', 'nodes', index, 'id']))
      continue
    }
    nodesById.set(node.id, node)

    const definition = registry.get(node.uses)
    if (!definition) {
      diagnostics.push(diagnostic('UNKNOWN_NODE_TYPE', `Unknown node type: ${node.uses}`, node.id, ['spec', 'nodes', index, 'uses']))
      continue
    }
    definitions.set(node.id, definition)

    // 收集节点能力需求
    const reqs: WorkflowRequirement[] = [
      ...definition.capabilities.map(uses => ({ kind: 'capability', uses })),
    ]
    nodeRequirements.set(node.id, reqs)
  }

  // 4. 校验边
  for (const [index, edge] of template.spec.edges.entries()) {
    if (!nodesById.has(edge.source)) {
      diagnostics.push(diagnostic('EDGE_SOURCE_MISSING', `Edge source not found: ${edge.source}`, edge.source, ['spec', 'edges', index]))
    }
    if (!nodesById.has(edge.target)) {
      diagnostics.push(diagnostic('EDGE_TARGET_MISSING', `Edge target not found: ${edge.target}`, edge.target, ['spec', 'edges', index]))
    }
  }

  // 5. 检查环
  const order = topologicalSort(template.spec.nodes, template.spec.edges)
  if (order.length < template.spec.nodes.length) {
    diagnostics.push(diagnostic('CYCLE_DETECTED', 'Workflow contains a cycle'))
  }

  // 6. 查找 start 节点
  const startNodeId = findStartNode(template.spec.nodes)
  if (!startNodeId) {
    diagnostics.push(diagnostic('NO_START_NODE', 'No start node found'))
  }

  // 7. 校验输入/输出 binding
  for (const [key, binding] of Object.entries(template.spec.outputs || {})) {
    diagnostics.push(...validateBinding(binding, `spec.outputs.${key}`))
  }

  // 8. 如果有错误，返回诊断
  if (diagnostics.some(d => d.severity === 'error')) {
    return { diagnostics }
  }

  // 9. 构建 CompiledWorkflow
  const nodesMap = new Map<string, CompiledWorkflowNode>()
  for (const nodeId of order) {
    const templateNode = nodesById.get(nodeId)
    const definition = definitions.get(nodeId)
    if (!templateNode || !definition) continue

    const incoming = template.spec.edges.filter(e => e.target === nodeId)
    const outgoing = template.spec.edges.filter(e => e.source === nodeId)

    nodesMap.set(nodeId, {
      template: templateNode,
      definition,
      incoming,
      outgoing,
      validateInputs: createInputValidator(definition.inputSchema),
      validateOutputs: createInputValidator(definition.outputSchema),
      requirements: nodeRequirements.get(nodeId) || [],
    })
  }

  const edgesMap = new Map<string, WorkflowEdgeTemplate>()
  for (const edge of template.spec.edges) {
    edgesMap.set(edge.id, edge)
  }

  const allRequirements = [...declaredRequirements.values()]
  for (const reqs of nodeRequirements.values()) {
    for (const req of reqs) {
      const key = `${req.kind}:${req.uses}`
      if (!allRequirements.some(r => `${r.kind}:${r.uses}` === key)) {
        allRequirements.push(req)
      }
    }
  }

  const compiled: CompiledWorkflow = {
    template,
    nodes: nodesMap,
    edges: edgesMap,
    order,
    startNodeId: startNodeId!,
    semanticHash: computeSemanticHash(template),
    requirements: allRequirements,
    validateWorkflowInputs: createInputValidator(template.spec.inputSchema),
    validateWorkflowOutputs: createInputValidator(template.spec.outputSchema),
  }

  return { workflow: compiled, diagnostics }
}

export function compileWorkflowOrThrow(
  template: WorkflowTemplate,
  registry: Map<string, WorkflowNodeDefinition>
): CompiledWorkflow {
  const result = compileWorkflow(template, registry)
  if (result.diagnostics.some(d => d.severity === 'error')) {
    const errors = result.diagnostics.filter(d => d.severity === 'error')
    throw new Error(`Workflow compilation failed:\n${errors.map(e => `- ${e.code}: ${e.message}`).join('\n')}`)
  }
  return result.workflow!
}
