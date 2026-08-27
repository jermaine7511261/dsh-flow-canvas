/**
 * dsh-flow-canvas — Workflow compiler (plain JS).
 */
const { createHash } = require('node:crypto')

function diagnostic(code, message, nodeId, path) {
  return { code, severity: 'error', message, nodeId, path }
}

function structuralDiagnostics(template) {
  const d = []
  if (template.apiVersion !== 'dsh.flow-canvas/v1') d.push(diagnostic('INVALID_API_VERSION', 'Unsupported apiVersion: ' + template.apiVersion))
  if (template.kind !== 'WorkflowTemplate') d.push(diagnostic('INVALID_KIND', 'Invalid kind: ' + template.kind))
  if (!template.metadata?.id) d.push(diagnostic('MISSING_ID', 'metadata.id is required'))
  if (!template.metadata?.name) d.push(diagnostic('MISSING_NAME', 'metadata.name is required'))
  if (!template.spec?.nodes?.length) d.push(diagnostic('NO_NODES', 'spec.nodes must have at least one node'))
  return d
}

function topologicalSort(nodes, edges) {
  const inDeg = new Map(), adj = new Map()
  for (const n of nodes) { inDeg.set(n.id, 0); adj.set(n.id, []) }
  for (const e of edges) { inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1); adj.get(e.source)?.push(e.target) }
  const q = []
  for (const [id, deg] of inDeg) if (deg === 0) q.push(id)
  const order = []
  while (q.length) { const id = q.shift(); order.push(id); for (const t of adj.get(id) || []) { const nd = (inDeg.get(t) || 1) - 1; inDeg.set(t, nd); if (nd === 0) q.push(t) } }
  return order
}

function parseNodeVersion(uses) {
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

function findStartNode(nodes) {
  for (const n of nodes) {
    const { type } = parseNodeVersion(n.uses)
    if (type === 'core.start') return n.id
  }
  return nodes[0]?.id || null
}

function createInputValidator(schema) {
  return (value) => {
    const errors = []
    if (schema.type === 'object' && typeof value !== 'object') errors.push('Input must be an object')
    if (schema.required && Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (typeof value !== 'object' || value === null || !(key in (value || {}))) errors.push('Missing required field: ' + key)
      }
    }
    return errors
  }
}

function compileWorkflow(template, registry) {
  const diagnostics = []
  const structDiags = structuralDiagnostics(template)
  if (structDiags.length > 0) return { diagnostics: structDiags }

  const declaredReqs = new Map()
  for (const [i, req] of (template.spec.requires || []).entries()) {
    const key = req.kind + ':' + req.uses
    if (declaredReqs.has(key)) diagnostics.push(diagnostic('DUPLICATE_REQUIREMENT', 'Duplicate: ' + key))
    else declaredReqs.set(key, req)
  }

  const nodesById = new Map(), defs = new Map(), nodeReqs = new Map()
  for (const [i, node] of template.spec.nodes.entries()) {
    if (nodesById.has(node.id)) { diagnostics.push(diagnostic('DUPLICATE_NODE_ID', 'Duplicate: ' + node.id, node.id)); continue }
    nodesById.set(node.id, node)
    
    // Parse node version from uses (REQ-012)
    const { type: nodeType, version } = parseNodeVersion(node.uses)
    
    // Look up definition by type
    const def = registry.get(nodeType)
    if (!def) { diagnostics.push(diagnostic('UNKNOWN_NODE_TYPE', 'Unknown: ' + node.uses, node.id)); continue }
    
    // If version specified, check if it matches the definition version (REQ-012)
    if (version !== undefined && version !== def.version) {
      diagnostics.push({ code: 'NODE_VERSION_MISMATCH', severity: 'warning', message: 'Node ' + node.id + ' specifies version ' + version + ' but definition has version ' + def.version, nodeId: node.id })
    }
    
    defs.set(node.id, def)
    
    // 收集节点能力需求
    const reqs = [...(def.capabilities || []).map(uses => ({ kind: 'capability', uses }))]
    
    // If node has dependencies function, call it to get additional requirements
    if (def.dependencies) {
      const nodeDeps = def.dependencies(node.with)
      reqs.push(...nodeDeps)
    }
    
    nodeReqs.set(node.id, reqs)
  }

  
  // REQ-016: 需求声明校验 — 收集节点的需求并检查是否在 spec.requires 中声明
  for (const [nodeId, templateNode] of nodesById) {
    const definition = defs.get(nodeId)
    if (!definition) continue
    
    // 检查是否在 spec.requires 中声明
    for (const req of (nodeReqs.get(nodeId) || [])) {
      const key = req.kind + ':' + req.uses
      if (!declaredReqs.has(key)) {
        diagnostics.push(diagnostic('WORKFLOW_REQUIREMENT_UNDECLARED', 'Node requires undeclared dependency: ' + key, nodeId))
      }
    }
  }

  // REQ-003: Duplicate Edge ID, REQ-004: Output port validation
  // Build outgoing/incoming index (REQ-005/006)
  const outgoing = new Map(), incoming = new Map()
  for (const node of (template.spec.nodes || [])) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
  }

  const edgeIds = new Set()
  for (const [i, edge] of (template.spec.edges || []).entries()) {
    // REQ-003: Duplicate edge id detection
    if (edgeIds.has(edge.id)) {
      diagnostics.push(diagnostic('DUPLICATE_EDGE_ID', 'Duplicate edge id: ' + edge.id))
      continue
    }
    edgeIds.add(edge.id)

    if (!nodesById.has(edge.source)) diagnostics.push(diagnostic('EDGE_SOURCE_MISSING', 'Source not found: ' + edge.source))
    if (!nodesById.has(edge.target)) diagnostics.push(diagnostic('EDGE_TARGET_MISSING', 'Target not found: ' + edge.target))

    // Build outgoing/incoming index
    if (outgoing.has(edge.source)) outgoing.get(edge.source).push(edge)
    if (incoming.has(edge.target)) incoming.get(edge.target).push(edge)

    // REQ-004: Output port validation — default port is 'success'
    const port = edge.sourcePort || 'success'
    const sourceDef = defs.get(edge.source)
    if (sourceDef !== undefined && !sourceDef.outputPorts.includes(port)) {
      diagnostics.push(diagnostic('UNKNOWN_OUTPUT_PORT', edge.source + ' does not declare output port ' + port))
    }
  }

  const order = topologicalSort(template.spec.nodes || [], template.spec.edges || [])
  if (order.length < (template.spec.nodes || []).length) diagnostics.push(diagnostic('CYCLE_DETECTED', 'Workflow contains a cycle'))

  const startNodeId = findStartNode(template.spec.nodes || [])
  if (!startNodeId) diagnostics.push(diagnostic('NO_START_NODE', 'No start node found'))

  // REQ-005: requiredOutputPorts validation
  for (const [nodeId, definition] of defs) {
    const usedPorts = new Set((outgoing.get(nodeId) || []).map(e => e.sourcePort || 'success'))
    for (const port of (definition.requiredOutputPorts || [])) {
      if (!usedPorts.has(port)) {
        diagnostics.push(diagnostic('REQUIRED_OUTPUT_PORT_MISSING', 'Required output port has no edge: ' + port, nodeId))
      }
    }
  }

  // REQ-006: Reachability analysis
  if (startNodeId) {
    // Forward BFS from start
    const reachable = new Set()
    const q = [startNodeId]
    while (q.length > 0) {
      const id = q.shift()
      if (reachable.has(id)) continue
      reachable.add(id)
      for (const edge of (outgoing.get(id) || [])) {
        q.push(edge.target)
      }
    }
    // Check unreachable nodes
    for (const nodeId of nodesById.keys()) {
      if (!reachable.has(nodeId)) {
        diagnostics.push(diagnostic('UNREACHABLE_NODE', 'Node is not reachable from start', nodeId))
      }
    }

    // Reverse BFS from end nodes
    const endNodeIds = [...defs].filter(([, def]) => def.role === 'end').map(([id]) => id)
    const canReachEnd = new Set()
    const reverseQueue = [...endNodeIds]
    while (reverseQueue.length > 0) {
      const id = reverseQueue.shift()
      if (canReachEnd.has(id)) continue
      canReachEnd.add(id)
      for (const edge of (incoming.get(id) || [])) {
        reverseQueue.push(edge.source)
      }
    }
    for (const nodeId of nodesById.keys()) {
      if (!canReachEnd.has(nodeId)) {
        diagnostics.push(diagnostic('NODE_CANNOT_REACH_END', 'Node has no path to an end node', nodeId))
      }
    }
  }

  // Calculate ancestor sets for each node (for Binding upstream validation)
  const ancestors = new Map()
  for (const nodeId of order) {
    const ancestorSet = new Set()
    for (const edge of (incoming.get(nodeId) || [])) {
      ancestorSet.add(edge.source)
      for (const ancestor of (ancestors.get(edge.source) || [])) {
        ancestorSet.add(ancestor)
      }
    }
    ancestors.set(nodeId, ancestorSet)
  }

  // REQ-014: Binding source must be strict upstream
  for (const [nodeId, templateNode] of nodesById) {
    const nodeAncestors = ancestors.get(nodeId) || new Set()
    for (const [inputKey, binding] of Object.entries(templateNode.inputs || {})) {
      if ('output' in binding) {
        const sourceId = binding.output.node
        if (!nodeAncestors.has(sourceId) && sourceId !== nodeId) {
          diagnostics.push(diagnostic('BINDING_NOT_UPSTREAM', 'Binding source ' + sourceId + ' is not a strict upstream node', nodeId))
        }
      }
    }
  }

  // REQ-014: Required binding missing detection
  for (const [nodeId, templateNode] of nodesById) {
    const definition = defs.get(nodeId)
    if (!definition) continue
    
    const required = (definition.inputSchema || {}).required || []
    for (const field of required) {
      if (typeof field === 'string' && !(field in (templateNode.inputs || {}))) {
        diagnostics.push(diagnostic('REQUIRED_BINDING_MISSING', 'Required input binding is missing: ' + field, nodeId))
      }
    }
  }

  // REQ-015: Config semantic validation
  for (const [nodeId, templateNode] of nodesById) {
    const definition = defs.get(nodeId)
    if (!definition) continue
    
    if (definition.validateConfig) {
      const configErrors = definition.validateConfig(templateNode.with || {})
      for (const message of configErrors) {
        diagnostics.push(diagnostic('NODE_CONFIG_SEMANTIC_INVALID', message, nodeId))
      }
    }
  }

  if (diagnostics.some(d => d.severity === 'error')) return { diagnostics }

  const nodesMap = new Map(), edgesMap = new Map()
  for (const nodeId of order) {
    const tn = nodesById.get(nodeId), def = defs.get(nodeId)
    if (!tn || !def) continue
    nodesMap.set(nodeId, {
      template: tn, definition: def,
      incoming: incoming.get(nodeId) || [],
      outgoing: outgoing.get(nodeId) || [],
      validateInputs: createInputValidator(def.inputSchema || {}),
      validateOutputs: createInputValidator(def.outputSchema || {}),
      requirements: nodeReqs.get(nodeId) || [],
    })
  }
  for (const edge of (template.spec.edges || [])) edgesMap.set(edge.id, edge)

  const allReqs = [...declaredReqs.values()]
  for (const reqs of nodeReqs.values()) for (const req of reqs) {
    const key = req.kind + ':' + req.uses
    if (!allReqs.some(r => r.kind + ':' + r.uses === key)) allReqs.push(req)
  }

  const payload = JSON.stringify({ apiVersion: template.apiVersion, spec: template.spec }, Object.keys(template.spec || {}).sort())
  const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16)

  const workflow = {
    template, nodes: nodesMap, edges: edgesMap, order, startNodeId: startNodeId,
    semanticHash: hash, requirements: allReqs,
    validateWorkflowInputs: createInputValidator(template.spec.inputSchema || {}),
    validateWorkflowOutputs: createInputValidator(template.spec.outputSchema || {}),
  }
  return { workflow, diagnostics }
}

function compileWorkflowOrThrow(template, registry) {
  const result = compileWorkflow(template, registry)
  if (result.diagnostics.some(d => d.severity === 'error')) {
    const errors = result.diagnostics.filter(d => d.severity === 'error')
    throw new Error('Workflow compilation failed:\n' + errors.map(e => '- ' + e.code + ': ' + e.message).join('\n'))
  }
  return result.workflow
}

module.exports = { compileWorkflow, compileWorkflowOrThrow }
