/**
 * Tests for dsh-flow-canvas DAG validation engine.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Import the DAG functions (we'll test the pure logic)
// Since the source is TypeScript, we test the algorithm logic directly

// ── Test helpers ──────────────────────────────────────────────

function makeNode(id, type = 'agent') {
  return { id, type, position: { x: 0, y: 0 }, data: { type, label: id } }
}

function makeEdge(source, target) {
  return { id: `edge-${source}-${target}`, source, target }
}

// ── Kahn's algorithm for cycle detection ──────────────────────

function hasCycle(nodes, edges) {
  const inDegree = new Map()
  const adj = new Map()

  nodes.forEach(n => {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  })

  edges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
    adj.get(e.source).push(e.target)
  })

  const queue = []
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id)
  })

  let visited = 0
  while (queue.length > 0) {
    const id = queue.shift()
    visited++
    for (const next of adj.get(id)) {
      inDegree.set(next, inDegree.get(next) - 1)
      if (inDegree.get(next) === 0) queue.push(next)
    }
  }

  return visited !== nodes.length
}

// ── Topological sort ─────────────────────────────────────────

function topologicalSort(nodes, edges) {
  const inDegree = new Map()
  const adj = new Map()

  nodes.forEach(n => {
    inDegree.set(n.id, 0)
    adj.set(n.id, [])
  })

  edges.forEach(e => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1)
    adj.get(e.source).push(e.target)
  })

  const groups = []
  let queue = []

  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id)
  })

  while (queue.length > 0) {
    groups.push([...queue])
    const nextQueue = []
    for (const id of queue) {
      for (const next of adj.get(id)) {
        inDegree.set(next, inDegree.get(next) - 1)
        if (inDegree.get(next) === 0) nextQueue.push(next)
      }
    }
    queue = nextQueue
  }

  return groups
}

// ── Tests ─────────────────────────────────────────────────────

describe('hasCycle', () => {
  it('returns false for DAG without cycles', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    assert.equal(hasCycle(nodes, edges), false)
  })

  it('returns true for graph with cycle', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'a')]
    assert.equal(hasCycle(nodes, edges), true)
  })

  it('returns false for single node', () => {
    const nodes = [makeNode('a')]
    const edges = []
    assert.equal(hasCycle(nodes, edges), false)
  })

  it('returns false for disconnected nodes', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const edges = []
    assert.equal(hasCycle(nodes, edges), false)
  })
})

describe('topologicalSort', () => {
  it('returns single group for independent nodes', () => {
    const nodes = [makeNode('a'), makeNode('b')]
    const edges = []
    const groups = topologicalSort(nodes, edges)
    assert.equal(groups.length, 1)
    assert.equal(groups[0].length, 2)
  })

  it('returns ordered groups for sequential nodes', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    const groups = topologicalSort(nodes, edges)
    assert.equal(groups.length, 3)
    assert.deepEqual(groups[0], ['a'])
    assert.deepEqual(groups[1], ['b'])
    assert.deepEqual(groups[2], ['c'])
  })

  it('groups parallel nodes together', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c')]
    const groups = topologicalSort(nodes, edges)
    assert.equal(groups.length, 2)
    assert.deepEqual(groups[0], ['a'])
    assert.deepEqual(groups[1].sort(), ['b', 'c'])
  })

  it('handles complex DAG', () => {
    const nodes = [
      makeNode('start'),
      makeNode('research'),
      makeNode('implement'),
      makeNode('test'),
      makeNode('review'),
      makeNode('end'),
    ]
    const edges = [
      makeEdge('start', 'research'),
      makeEdge('research', 'implement'),
      makeEdge('implement', 'test'),
      makeEdge('implement', 'review'),
      makeEdge('test', 'end'),
      makeEdge('review', 'end'),
    ]
    const groups = topologicalSort(nodes, edges)
    assert.equal(groups.length, 5)
    assert.deepEqual(groups[0], ['start'])
    assert.deepEqual(groups[1], ['research'])
    assert.deepEqual(groups[2], ['implement'])
    assert.ok(groups[3].includes('test'))
    assert.ok(groups[3].includes('review'))
    assert.deepEqual(groups[4], ['end'])
  })
})
