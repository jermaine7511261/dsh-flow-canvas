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
import { snapshotJsonValue } from './json'

// ── 诊断工具 ──
function diagnostic(code: string, message: string, nodeId?: string, path?: readonly (string | number)[]): WorkflowDiagnostic {
  return { code, severity: 'error', message, nodeId, path }
}

function diagnosticWarning(code: string, message: string, nodeId?: string): WorkflowDiagnostic {
  return { code, severity: 'warning', message, nodeId }
}

// ── 节点版本解析 ──
function parseNodeVersion(uses: string): { type: string; version?: number } {
  const atIndex = uses.indexOf('@')
  if (atIndex === -1) {
    return { type: uses }
  }
  const type = uses.slice(0, atIndex)
  const versionStr = uses.slice(atIndex + 1)
  const version = parseInt(versionStr, 10)
  if (isNaN(version) || version < 1) {
    return { type: uses } // Invalid version, return as-is
  }
  return { type, version }
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
    const { type } = parseNodeVersion(node.uses)
    if (type === 'core.start') return node.id
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

// ── Lossless JSON 物化 ──
function materializeJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value
  }
  return snapshotJsonValue(value as any)
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

    // Parse node version from uses (REQ-012)
    const { type: nodeType, version } = parseNodeVersion(node.uses)
    
    // Look up definition by type
    const definition = registry.get(nodeType)
    if (!definition) {
      diagnostics.push(diagnostic('UNKNOWN_NODE_TYPE', `Unknown node type: ${node.uses}`, node.id, ['spec', 'nodes', index, 'uses']))
      continue
    }
    
    // If version specified, check if it matches the definition version (REQ-012)
    if (version !== undefined && version !== definition.version) {
      diagnostics.push(diagnosticWarning('NODE_VERSION_MISMATCH', `Node ${node.id} specifies version ${version} but definition has version ${definition.version}`, node.id))
    }
    
    definitions.set(node.id, definition)

    // 收集节点能力需求
    const reqs: WorkflowRequirement[] = [
      ...definition.capabilities.map(uses => ({ kind: 'capability', uses })),
    ]
    
    // If node has dependencies function, call it to get additional requirements
    if (definition.dependencies) {
      const nodeDeps = definition.dependencies(node.with)
      reqs.push(...nodeDeps)
    }
    
    nodeRequirements.set(node.id, reqs)
  }

  // 4. 校验边（REQ-003: 重复 Edge ID, REQ-004: Output port 校验）
  // 构建 outgoing/incoming 索引（REQ-005/006 使用）
  const outgoing = new Map<string, WorkflowEdgeTemplate[]>()
  const incoming = new Map<string, WorkflowEdgeTemplate[]>()
  for (const node of template.spec.nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }

  const edgeIds = new Set<string>()
  for (const [index, edge] of template.spec.edges.entries()) {
    // REQ-003: 重复 Edge ID 检测
    if (edgeIds.has(edge.id)) {
      diagnostics.push(diagnostic('DUPLICATE_EDGE_ID', `Duplicate edge id: ${edge.id}`, undefined, ['spec', 'edges', index, 'id']))
      continue
    }
    edgeIds.add(edge.id)

    if (!nodesById.has(edge.source)) {
      diagnostics.push(diagnostic('EDGE_SOURCE_MISSING', `Edge source not found: ${edge.source}`, edge.source, ['spec', 'edges', index]))
    }
    if (!nodesById.has(edge.target)) {
      diagnostics.push(diagnostic('EDGE_TARGET_MISSING', `Edge target not found: ${edge.target}`, edge.target, ['spec', 'edges', index]))
    }

    // 构建 outgoing/incoming 索引
    outgoing.get(edge.source)?.push(edge)
    incoming.get(edge.target)?.push(edge)

    // REQ-004: Output port 校验 — sourcePort 默认为 'success'
    const port = edge.sourcePort ?? 'success'
    const definition = definitions.get(edge.source)
    if (definition !== undefined && !definition.outputPorts.includes(port)) {
      diagnostics.push(diagnostic('UNKNOWN_OUTPUT_PORT', `${edge.source} does not declare output port ${port}`, edge.source, ['spec', 'edges', index, 'sourcePort']))
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

  // 计算每个节点的祖先集（用于 Binding 上游校验）
  const ancestors = new Map<string, Set<string>>()
  for (const nodeId of order) {
    const ancestorSet = new Set<string>()
    for (const edge of incoming.get(nodeId) ?? []) {
      ancestorSet.add(edge.source)
      for (const ancestor of ancestors.get(edge.source) ?? []) {
        ancestorSet.add(ancestor)
      }
    }
    ancestors.set(nodeId, ancestorSet)
  }

  // REQ-005: requiredOutputPorts 校验 — 每个 required port 必须有出边
  for (const [nodeId, definition] of definitions) {
    const usedPorts = new Set((outgoing.get(nodeId) ?? []).map(edge => edge.sourcePort ?? 'success'))
    for (const port of definition.requiredOutputPorts ?? []) {
      if (!usedPorts.has(port)) {
        diagnostics.push(diagnostic('REQUIRED_OUTPUT_PORT_MISSING', `Required output port has no edge: ${port}`, nodeId))
      }
    }
  }

  // REQ-014: Binding 校验增强 — Binding source 必须是严格上游
  for (const [nodeId, templateNode] of nodesById) {
    const nodeAncestors = ancestors.get(nodeId) ?? new Set()
    for (const [inputKey, binding] of Object.entries(templateNode.inputs)) {
      if ('output' in binding) {
        const sourceId = binding.output.node
        if (!nodeAncestors.has(sourceId) && sourceId !== nodeId) {
          diagnostics.push(diagnostic('BINDING_NOT_UPSTREAM', `Binding source ${sourceId} is not a strict upstream node`, nodeId, ['spec', 'nodes', template.spec.nodes.findIndex(n => n.id === nodeId), 'inputs', inputKey]))
        }
      }
    }
  }

  // REQ-014: Binding 校验增强 — 必填 binding 缺失检测
  for (const [nodeId, templateNode] of nodesById) {
    const definition = definitions.get(nodeId)
    if (!definition) continue
    
    const required = definition.inputSchema?.required ?? []
    for (const field of required) {
      if (typeof field === 'string' && !(field in templateNode.inputs)) {
        diagnostics.push(diagnostic('REQUIRED_BINDING_MISSING', `Required input binding is missing: ${field}`, nodeId, ['spec', 'nodes', template.spec.nodes.findIndex(n => n.id === nodeId), 'inputs']))
      }
    }
  }

  // REQ-015: Config 语义校验 — 调用 validateConfig()
  for (const [nodeId, templateNode] of nodesById) {
    const definition = definitions.get(nodeId)
    if (!definition) continue
    
    if (definition.validateConfig) {
      const configErrors = definition.validateConfig(templateNode.with)
      for (const message of configErrors) {
        diagnostics.push(diagnostic('NODE_CONFIG_SEMANTIC_INVALID', message, nodeId, ['spec', 'nodes', template.spec.nodes.findIndex(n => n.id === nodeId), 'with']))
      }
    }
  }

  // REQ-016: 需求声明校验 — 收集节点的需求并检查是否在 spec.requires 中声明
  for (const [nodeId, templateNode] of nodesById) {
    const definition = definitions.get(nodeId)
    if (!definition) continue
    
    // 收集节点需求（capabilities + dependencies(config)）
    const nodeReqs: WorkflowRequirement[] = [
      ...definition.capabilities.map(uses => ({ kind: 'capability', uses })),
      ...(definition.dependencies?.(templateNode.with) ?? []),
    ]
    
    // 检查是否在 spec.requires 中声明
    for (const req of nodeReqs) {
      const key = `${req.kind}:${req.uses}`
      if (!declaredRequirements.has(key)) {
        diagnostics.push(diagnostic('WORKFLOW_REQUIREMENT_UNDECLARED', `Node requires undeclared dependency: ${key}`, nodeId, ['spec', 'requires']))
      }
    }
  }

  // REQ-006: 可达性分析
  // 从 start BFS 检测可达性
  if (startNodeId) {
    const reachable = new Set<string>()
    const queue: string[] = [startNodeId]
    while (queue.length > 0) {
      const id = queue.shift()!
      if (reachable.has(id)) continue
      reachable.add(id)
      for (const edge of outgoing.get(id) ?? []) {
        queue.push(edge.target)
      }
    }
    // 检查不可达节点
    for (const nodeId of nodesById.keys()) {
      if (!reachable.has(nodeId)) {
        diagnostics.push(diagnostic('UNREACHABLE_NODE', 'Node is not reachable from start', nodeId))
      }
    }

    // 从 end 反向 BFS 检测可达 end
    const endNodes = [...definitions].filter(([, def]) => def.role === 'end').map(([id]) => id)
    const canReachEnd = new Set<string>()
    const reverseQueue = [...endNodes]
    while (reverseQueue.length > 0) {
      const id = reverseQueue.shift()!
      if (canReachEnd.has(id)) continue
      canReachEnd.add(id)
      for (const edge of incoming.get(id) ?? []) {
        reverseQueue.push(edge.source)
      }
    }
    for (const nodeId of nodesById.keys()) {
      if (!canReachEnd.has(nodeId)) {
        diagnostics.push(diagnostic('NODE_CANNOT_REACH_END', 'Node has no path to an end node', nodeId))
      }
    }
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

    nodesMap.set(nodeId, {
      template: templateNode,
      definition,
      incoming: incoming.get(nodeId) ?? [],
      outgoing: outgoing.get(nodeId) ?? [],
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
