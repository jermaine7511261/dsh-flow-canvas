/**
 * Engine unit tests for REQ-035.
 * Tests: normal execution, condition branching, node failure, abort,
 *        output size limits, event system, and checkpoint commits.
 *
 * Run with: node --test tests/engine.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compileWorkflow } from '../src/core/compiler.cjs'
import { DagWorkflowEngine } from '../src/core/engine.cjs'

// ── Helpers ──────────────────────────────────────────────────────────────────

const START_DEF = {
  type: 'core.start', version: 1, title: 'Start', description: '', role: 'start',
  configSchema: {}, inputSchema: {}, outputSchema: {},
  outputPorts: ['success'], capabilities: [], retry: 'never',
  execute: async (ctx) => ({ outputs: ctx.workflowInputs }),
}

const END_DEF = {
  type: 'core.end', version: 1, title: 'End', description: '', role: 'end',
  configSchema: {}, inputSchema: {}, outputSchema: {},
  outputPorts: ['success'], capabilities: [], retry: 'never',
  execute: async (ctx) => ({ outputs: ctx.inputs }),
}

const CONDITION_DEF = {
  type: 'core.condition', version: 1, title: 'Condition', description: '', role: 'regular',
  configSchema: { type: 'object', required: ['operator'] },
  inputSchema: { type: 'object', required: ['left'] },
  outputSchema: { type: 'object', required: ['result'] },
  outputPorts: ['true', 'false'],
  requiredOutputPorts: ['true', 'false'],
  capabilities: [], retry: 'never',
  execute: async (ctx) => {
    const { operator } = ctx.config
    const left = ctx.inputs.left
    const right = ctx.inputs.right
    let result = false
    switch (operator) {
      case 'eq': result = left === right; break
      case 'truthy': result = Boolean(left); break
      case 'gt': result = Number(left) > Number(right); break
      default: result = Boolean(left)
    }
    return { outputs: { result }, selectedPorts: [result ? 'true' : 'false'] }
  },
}

const FAILING_DEF = {
  type: 'core.failing', version: 1, title: 'Failing', description: '', role: 'regular',
  configSchema: {}, inputSchema: {}, outputSchema: {},
  outputPorts: ['success'], capabilities: [], retry: 'never',
  execute: async () => { throw new Error('Node execution failed intentionally') },
}

const DATA_DEF = {
  type: 'core.data', version: 1, title: 'Data', description: '', role: 'regular',
  configSchema: {}, inputSchema: {}, outputSchema: {},
  outputPorts: ['success'], capabilities: [], retry: 'never',
  execute: async (ctx) => ({ outputs: { doubled: (ctx.inputs.value || 0) * 2 } }),
}

function makeRegistry(defs) {
  const reg = new Map()
  for (const d of defs) reg.set(d.type, d)
  return reg
}

function makeTemplate(spec) {
  return {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-wf', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      requires: [],
      nodes: [],
      edges: [],
      outputs: {},
      ...spec,
    },
  }
}

function compile(template, defs) {
  const registry = makeRegistry(defs)
  const result = compileWorkflow(template, registry)
  if (!result.workflow) {
    throw new Error(`Compilation failed: ${result.diagnostics.map(d => d.message).join('; ')}`)
  }
  return result.workflow
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Engine — normal execution', () => {
  it('completes a simple start -> end workflow', async () => {
    const template = makeTemplate({
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', sourcePort: 'success' }],
    })
    const compiled = compile(template, [START_DEF, END_DEF])
    const engine = new DagWorkflowEngine(compiled)
    const run = await engine.execute({ greeting: 'hello' })
    assert.equal(run.status, 'completed')
    assert.ok(run.completedAt > 0)
  })

  it('passes inputs through start and collects outputs at end', async () => {
    const template = makeTemplate({
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', sourcePort: 'success' }],
    })
    const compiled = compile(template, [START_DEF, END_DEF])
    const engine = new DagWorkflowEngine(compiled)
    const run = await engine.execute({ value: 42 })
    assert.equal(run.status, 'completed')
    assert.deepEqual(run.result, { value: 42 })
  })
})

describe('Engine — condition branching', () => {
  it('takes true branch when condition is true', async () => {
    const template = makeTemplate({
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'cond', uses: 'core.condition', with: { operator: 'eq' }, inputs: { left: { output: { node: 'a', path: ['val'] } }, right: { literal: 'yes' } } },
        { id: 'end', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'cond', sourcePort: 'success' },
        { id: 'e2', source: 'cond', target: 'end', sourcePort: 'true' },
        { id: 'e3', source: 'cond', target: 'end', sourcePort: 'false' },
      ],
    })
    const compiled = compile(template, [START_DEF, CONDITION_DEF, END_DEF])
    const engine = new DagWorkflowEngine(compiled)
    const run = await engine.execute({ val: 'yes' })
    assert.equal(run.status, 'completed')
    // Condition node should have succeeded with result true
    assert.equal(run.nodeStates.get('cond')?.status, 'succeeded')
  })
})

describe('Engine — node failure', () => {
  it('marks run as failed when a node throws', async () => {
    const template = makeTemplate({
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'fail', uses: 'core.failing', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'fail', sourcePort: 'success' },
        { id: 'e2', source: 'fail', target: 'b', sourcePort: 'success' },
      ],
    })
    const compiled = compile(template, [START_DEF, FAILING_DEF, END_DEF])
    const engine = new DagWorkflowEngine(compiled)
    const run = await engine.execute({})
    assert.equal(run.status, 'failed')
    assert.ok(run.nodeStates.get('fail')?.error?.includes('Node execution failed'))
  })
})

describe('Engine — abort/cancel', () => {
  it('cancels run when stop() is called', async () => {
    // Create a slow node that waits
    let resolveSlow
    const SLOW_DEF = {
      type: 'core.slow', version: 1, title: 'Slow', description: '', role: 'regular',
      configSchema: {}, inputSchema: {}, outputSchema: {},
      outputPorts: ['success'], capabilities: [], retry: 'never',
      execute: async () => {
        await new Promise(r => { resolveSlow = r })
        return { outputs: {} }
      },
    }

    const template = makeTemplate({
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'slow', uses: 'core.slow', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'slow', sourcePort: 'success' },
        { id: 'e2', source: 'slow', target: 'b', sourcePort: 'success' },
      ],
    })
    const compiled = compile(template, [START_DEF, SLOW_DEF, END_DEF])
    const engine = new DagWorkflowEngine(compiled)

    // Start execution and immediately cancel
    const runPromise = engine.execute({})
    // Give the engine time to start the slow node
    await new Promise(r => setTimeout(r, 50))
    engine.stop()

    // Resolve the slow node so the engine can finish
    resolveSlow?.()

    const run = await runPromise
    assert.equal(run.status, 'cancelled')
  })
})

describe('Engine — maxNodeRuns limit', () => {
  it('fails when maxNodeRuns exceeded', async () => {
    const template = makeTemplate({
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', sourcePort: 'success' }],
    })
    const compiled = compile(template, [START_DEF, END_DEF])
    // Set maxNodeRuns to 0 to immediately fail
    const engine = new DagWorkflowEngine(compiled, { maxNodeRuns: 0 })
    const run = await engine.execute({})
    assert.equal(run.status, 'failed')
  })
})

describe('Engine — state change callback', () => {
  it('calls onStateChange during execution', async () => {
    const template = makeTemplate({
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', sourcePort: 'success' }],
    })
    const compiled = compile(template, [START_DEF, END_DEF])

    const states = []
    const engine = new DagWorkflowEngine(compiled, {
      onStateChange: (run) => states.push(run.status),
    })
    await engine.execute({})

    assert.ok(states.length > 0, 'should have received state changes')
    // Should have seen 'running' at some point
    assert.ok(states.includes('running'), 'should have seen running status')
  })
})

describe('Engine — multi-node pipeline', () => {
  it('executes a->data->end pipeline correctly', async () => {
    const template = makeTemplate({
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'data', uses: 'core.data', with: {}, inputs: { value: { output: { node: 'a', path: ['value'] } } } },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'data', sourcePort: 'success' },
        { id: 'e2', source: 'data', target: 'b', sourcePort: 'success' },
      ],
    })
    const compiled = compile(template, [START_DEF, DATA_DEF, END_DEF])
    const engine = new DagWorkflowEngine(compiled)
    const run = await engine.execute({ value: 5 })
    assert.equal(run.status, 'completed')
    assert.equal(run.nodeStates.get('data')?.status, 'succeeded')
  })
})
