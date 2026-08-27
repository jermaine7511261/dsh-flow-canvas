/**
 * Quick validation test for compiler enhancements (REQ-003~006).
 * Run with: node tests/compiler-validation.test.js
 */
const { compileWorkflow } = require('../src/core/compiler.cjs')

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log('  ✓ ' + message)
  } else {
    failed++
    console.log('  ✗ ' + message)
  }
}

function assertDiagnostic(diagnostics, code, messageContains) {
  return diagnostics.some(d => d.code === code && d.message.includes(messageContains))
}

// Test 1: REQ-003 - Duplicate Edge ID
console.log('\n=== Test: REQ-003 Duplicate Edge ID ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-1', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e1', source: 'a', target: 'b' },  // Duplicate!
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'DUPLICATE_EDGE_ID', 'Duplicate edge id: e1'), 'Should detect duplicate edge id')
}

// Test 2: REQ-004 - Unknown Output Port
console.log('\n=== Test: REQ-004 Unknown Output Port ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-2', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', sourcePort: 'nonexistent' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['output'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'UNKNOWN_OUTPUT_PORT', 'does not declare output port nonexistent'), 'Should detect unknown output port')
}

// Test 3: REQ-005 - Required Output Port Missing
console.log('\n=== Test: REQ-005 Required Output Port Missing ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-3', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', sourcePort: 'output' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['output', 'branch'], requiredOutputPorts: ['branch'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'REQUIRED_OUTPUT_PORT_MISSING', 'Required output port has no edge: branch'), 'Should detect missing required output port')
}

// Test 4: REQ-006 - Unreachable Node
console.log('\n=== Test: REQ-006 Unreachable Node ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-4', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
        { id: 'c', uses: 'core.end', with: {}, inputs: {} },  // Unreachable
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'UNREACHABLE_NODE', 'Node is not reachable from start'), 'Should detect unreachable node')
}

// Test 5: REQ-006 - Node Cannot Reach End
// Node 'c' -> 'd' (a regular node with no outgoing edge to end)
console.log('\n=== Test: REQ-006 Node Cannot Reach End ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-5', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
        { id: 'c', uses: 'core.start', with: {}, inputs: {} },
        { id: 'd', uses: 'core.regular', with: {}, inputs: {} },  // Dead end: no path to end
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'c', target: 'd' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.regular', { type: 'core.regular', version: 1, title: 'Regular', description: '', role: 'regular', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'NODE_CANNOT_REACH_END', 'Node has no path to an end node'), 'Should detect node cannot reach end')
}

// Test 6: REQ-004 - Default port 'success' validation
console.log('\n=== Test: REQ-004 Default Port Success Validation ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-6', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },  // No sourcePort, defaults to 'success'
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  // Should NOT produce UNKNOWN_OUTPUT_PORT because 'success' is in outputPorts
  assert(!assertDiagnostic(diagnostics, 'UNKNOWN_OUTPUT_PORT', 'does not declare output port success'), 'Default port success should be valid when declared')
}

// Test 7: REQ-004 - Default port 'success' not declared
console.log('\n=== Test: REQ-004 Default Port Success Not Declared ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-7', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },  // No sourcePort, defaults to 'success'
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['output'], capabilities: [], retry: 'never', execute: async () => ({}) }],  // No 'success' port!
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'UNKNOWN_OUTPUT_PORT', 'does not declare output port success'), 'Should detect missing default port success')
}

// Test 8: Valid workflow - no errors from REQ-003~006
console.log('\n=== Test: Valid Workflow (no REQ-003~006 errors) ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-6', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', sourcePort: 'output' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['output'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics, workflow } = compileWorkflow(template, registry)
  const reqErrors = diagnostics.filter(d => 
    ['DUPLICATE_EDGE_ID', 'UNKNOWN_OUTPUT_PORT', 'REQUIRED_OUTPUT_PORT_MISSING', 'UNREACHABLE_NODE', 'NODE_CANNOT_REACH_END'].includes(d.code)
  )
  assert(reqErrors.length === 0, 'Valid workflow should have no REQ-003~006 errors')
  assert(workflow !== undefined, 'Valid workflow should compile successfully')
}

// Summary
console.log('\n=== Summary ===')
console.log(`Passed: ${passed}, Failed: ${failed}`)
process.exit(failed > 0 ? 1 : 0)
