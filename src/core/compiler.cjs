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

function findStartNode(nodes) {
  for (const n of nodes) if (n.uses === 'core.start') return n.id
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
    const def = registry.get(node.uses)
    if (!def) { diagnostics.push(diagnostic('UNKNOWN_NODE_TYPE', 'Unknown: ' + node.uses, node.id)); continue }
    defs.set(node.id, def)
    nodeReqs.set(node.id, (def.capabilities || []).map(uses => ({ kind: 'capability', uses })))
  }

  for (const [i, edge] of (template.spec.edges || []).entries()) {
    if (!nodesById.has(edge.source)) diagnostics.push(diagnostic('EDGE_SOURCE_MISSING', 'Source not found: ' + edge.source))
    if (!nodesById.has(edge.target)) diagnostics.push(diagnostic('EDGE_TARGET_MISSING', 'Target not found: ' + edge.target))
  }

  const order = topologicalSort(template.spec.nodes || [], template.spec.edges || [])
  if (order.length < (template.spec.nodes || []).length) diagnostics.push(diagnostic('CYCLE_DETECTED', 'Workflow contains a cycle'))

  const startNodeId = findStartNode(template.spec.nodes || [])
  if (!startNodeId) diagnostics.push(diagnostic('NO_START_NODE', 'No start node found'))

  if (diagnostics.some(d => d.severity === 'error')) return { diagnostics }

  const nodesMap = new Map(), edgesMap = new Map()
  for (const nodeId of order) {
    const tn = nodesById.get(nodeId), def = defs.get(nodeId)
    if (!tn || !def) continue
    nodesMap.set(nodeId, {
      template: tn, definition: def,
      incoming: (template.spec.edges || []).filter(e => e.target === nodeId),
      outgoing: (template.spec.edges || []).filter(e => e.source === nodeId),
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
