/**
 * Test compiler enhancements for REQ-014~016.
 * Run with: node tests/compiler-req-014-016.test.cjs
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

// Test 1: REQ-014 - Binding source not upstream
console.log('\n=== Test: REQ-014 Binding Source Not Upstream ===')
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
        { id: 'b', uses: 'core.end', with: {}, inputs: { value: { output: { node: 'c', path: ['result'] } } } },
        { id: 'c', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'c' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'BINDING_NOT_UPSTREAM', 'Binding source c is not a strict upstream node'), 'Should detect non-upstream binding source')
}

// Test 2: REQ-014 - Binding source is upstream (valid)
console.log('\n=== Test: REQ-014 Binding Source Is Upstream (Valid) ===')
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
        { id: 'b', uses: 'core.end', with: {}, inputs: { value: { output: { node: 'a', path: ['result'] } } } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(!assertDiagnostic(diagnostics, 'BINDING_NOT_UPSTREAM', 'Binding source a is not a strict upstream node'), 'Should not detect upstream binding as error')
}

// Test 3: REQ-014 - Required binding missing
console.log('\n=== Test: REQ-014 Required Binding Missing ===')
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
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },  // Missing required input
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: { type: 'object', required: ['value'] }, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'REQUIRED_BINDING_MISSING', 'Required input binding is missing: value'), 'Should detect missing required binding')
}

// Test 4: REQ-015 - Config semantic validation
console.log('\n=== Test: REQ-015 Config Semantic Validation ===')
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
        { id: 'b', uses: 'core.end', with: { invalid: 'config' }, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', validateConfig: (config) => {
      if (config.invalid) return ['Invalid config property']
      return []
    }, execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'NODE_CONFIG_SEMANTIC_INVALID', 'Invalid config property'), 'Should detect config semantic error')
}

// Test 5: REQ-015 - Config semantic validation (valid)
console.log('\n=== Test: REQ-015 Config Semantic Validation (Valid) ===')
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
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', validateConfig: (config) => {
      return []
    }, execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(!assertDiagnostic(diagnostics, 'NODE_CONFIG_SEMANTIC_INVALID', ''), 'Should not detect config error for valid config')
}

// Test 6: REQ-016 - Requirement declaration validation
console.log('\n=== Test: REQ-016 Requirement Declaration Validation ===')
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
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: ['dsh.tools.execute'], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'WORKFLOW_REQUIREMENT_UNDECLARED', 'Node requires undeclared dependency: capability:dsh.tools.execute'), 'Should detect undeclared requirement')
}

// Test 7: REQ-016 - Requirement declaration validation (declared)
console.log('\n=== Test: REQ-016 Requirement Declaration Validation (Declared) ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-7', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      requires: [{ kind: 'capability', uses: 'dsh.tools.execute' }],
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: ['dsh.tools.execute'], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(!assertDiagnostic(diagnostics, 'WORKFLOW_REQUIREMENT_UNDECLARED', 'capability:dsh.tools.execute'), 'Should not detect undeclared requirement when declared')
}

// Test 8: REQ-016 - Requirement declaration validation with dependencies
console.log('\n=== Test: REQ-016 Requirement Declaration Validation with Dependencies ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-8', name: 'Test' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', dependencies: (config) => {
      return [{ kind: 'service', uses: 'dsh.database' }]
    }, execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'WORKFLOW_REQUIREMENT_UNDECLARED', 'Node requires undeclared dependency: service:dsh.database'), 'Should detect undeclared dependency requirement')
}

// Summary
console.log('\n=== Summary ===')
console.log(`Passed: ${passed}, Failed: ${failed}`)
process.exit(failed > 0 ? 1 : 0)