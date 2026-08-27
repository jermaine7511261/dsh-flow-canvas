/**
 * Tests for dsh-flow-canvas workflow serialization.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ── Workflow validation logic (extracted for testing) ─────────

function validateWorkflow(workflow) {
  const errors = []
  const { nodes, edges } = workflow

  // Check Start node
  const startNodes = nodes.filter(n => n.type === 'start')
  if (startNodes.length === 0) errors.push('Must have Start node')
  if (startNodes.length > 1) errors.push('Only one Start node allowed')

  // Check End node
  const endNodes = nodes.filter(n => n.type === 'end')
  if (endNodes.length === 0) errors.push('Must have End node')

  // Check cycle
  const inDegree = new Map()
  const adj = new Map()
  nodes.forEach(n => { inDegree.set(n.id, 0); adj.set(n.id, []) })
  edges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
    adj.get(e.source).push(e.target)
  })
  const queue = []
  inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id) })
  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()
    visited++
    for (const next of adj.get(id)) {
      inDegree.set(next, inDegree.get(next) - 1)
      if (inDegree.get(next) === 0) queue.push(next)
    }
  }
  if (visited !== nodes.length) errors.push('Cycle detected')

  return { valid: errors.length === 0, errors }
}

// ── Workflow factory ──────────────────────────────────────────

function createWorkflow(overrides = {}) {
  return {
    id: 'test-wf',
    name: 'Test Workflow',
    description: '',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────

describe('validateWorkflow', () => {
  it('rejects workflow without Start node', () => {
    const wf = createWorkflow({
      nodes: [{ id: 'n1', type: 'end', position: { x: 0, y: 0 }, data: { type: 'end', label: 'End' } }],
      edges: [],
    })
    const result = validateWorkflow(wf)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('Start')))
  })

  it('rejects workflow without End node', () => {
    const wf = createWorkflow({
      nodes: [{ id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: { type: 'start', label: 'Start' } }],
      edges: [],
    })
    const result = validateWorkflow(wf)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('End')))
  })

  it('rejects workflow with cycle', () => {
    const wf = createWorkflow({
      nodes: [
        { id: 'a', type: 'agent', position: { x: 0, y: 0 }, data: { type: 'agent', label: 'A' } },
        { id: 'b', type: 'agent', position: { x: 100, y: 0 }, data: { type: 'agent', label: 'B' } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    })
    const result = validateWorkflow(wf)
    assert.equal(result.valid, false)
    assert.ok(result.errors.some(e => e.includes('Cycle')))
  })

  it('accepts valid workflow', () => {
    const wf = createWorkflow({
      nodes: [
        { id: 'start', type: 'start', position: { x: 0, y: 0 }, data: { type: 'start', label: 'Start' } },
        { id: 'agent', type: 'agent', position: { x: 100, y: 0 }, data: { type: 'agent', label: 'Agent' } },
        { id: 'end', type: 'end', position: { x: 200, y: 0 }, data: { type: 'end', label: 'End' } },
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'agent' },
        { id: 'e2', source: 'agent', target: 'end' },
      ],
    })
    const result = validateWorkflow(wf)
    assert.equal(result.valid, true)
  })
})

describe('workflow serialization', () => {
  it('serializes and deserializes correctly', () => {
    const wf = createWorkflow({
      nodes: [
        { id: 'n1', type: 'start', position: { x: 10, y: 20 }, data: { type: 'start', label: 'Start' } },
        { id: 'n2', type: 'agent', position: { x: 100, y: 200 }, data: { type: 'agent', label: 'Agent', prompt: 'Do stuff' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    })

    const json = JSON.stringify(wf)
    const parsed = JSON.parse(json)

    assert.equal(parsed.id, wf.id)
    assert.equal(parsed.nodes.length, 2)
    assert.equal(parsed.edges.length, 1)
    assert.equal(parsed.nodes[0].position.x, 10)
    assert.equal(parsed.nodes[1].data.prompt, 'Do stuff')
  })
})
