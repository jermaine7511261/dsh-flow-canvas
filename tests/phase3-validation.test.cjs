/**
 * Test for Phase 3 requirements (REQ-011~013+028).
 * Run with: node tests/phase3-validation.test.js
 */
const { compileWorkflow } = require('../src/core/compiler.cjs')
const { snapshotJsonValue, deepCopyJsonValue, isFrozenJsonValue } = require('../src/core/lossless-json.cjs')

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

// Test 1: REQ-011 - spec.requires validation
console.log('\n=== Test: REQ-011 spec.requires validation ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-requires', name: 'Test Requires' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.tool', with: { toolName: 'test' }, inputs: {} },
        { id: 'c', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
      outputs: {},
      requires: [], // Missing required capability
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.tool', { type: 'core.tool', version: 1, title: 'Tool', description: '', role: 'regular', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: ['dsh.tools.execute'], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: [], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics } = compileWorkflow(template, registry)
  assert(assertDiagnostic(diagnostics, 'WORKFLOW_REQUIREMENT_UNDECLARED', 'Node requires undeclared dependency: capability:dsh.tools.execute'), 'Should detect undeclared requirement')
}

// Test 2: REQ-012 - Node versioning
console.log('\n=== Test: REQ-012 Node versioning ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-version', name: 'Test Version' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start@1', with: {}, inputs: {} },
        { id: 'b', uses: 'core.end@1', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
      ],
      outputs: {},
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics, workflow } = compileWorkflow(template, registry)
  // Should compile successfully with versioned node types
  assert(workflow !== undefined, 'Versioned node types should compile successfully')
  assert(!assertDiagnostic(diagnostics, 'UNKNOWN_NODE_TYPE', 'Unknown node type'), 'Should not report unknown node type for versioned nodes')
}

// Test 3: REQ-012 - Node version mismatch warning
console.log('\n=== Test: REQ-012 Node version mismatch ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-version-mismatch', name: 'Test Version Mismatch' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start@2', with: {}, inputs: {} }, // Version 2 but definition has version 1
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
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics, workflow } = compileWorkflow(template, registry)
  assert(workflow !== undefined, 'Workflow with version mismatch should still compile')
  assert(assertDiagnostic(diagnostics, 'NODE_VERSION_MISMATCH', 'specifies version 2 but definition has version 1'), 'Should warn about version mismatch')
}

// Test 4: REQ-013 - NodeDefinition.validateConfig
console.log('\n=== Test: REQ-013 NodeDefinition.validateConfig ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-validate-config', name: 'Test Validate Config' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.tool', with: { toolName: 'test' }, inputs: {} },
        { id: 'c', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
      outputs: {},
      requires: [{ kind: 'capability', uses: 'dsh.tools.execute' }],
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.tool', { 
      type: 'core.tool', 
      version: 1, 
      title: 'Tool', 
      description: '', 
      role: 'regular', 
      configSchema: {}, 
      inputSchema: {}, 
      outputSchema: {}, 
      outputPorts: ['success', 'error'], 
      capabilities: ['dsh.tools.execute'], 
      retry: 'never', 
      validateConfig: (config) => {
        // Example validation: toolName must be provided
        if (!config.toolName || typeof config.toolName !== 'string') {
          return ['toolName must be a string']
        }
        return []
      },
      execute: async () => ({}) 
    }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics, workflow } = compileWorkflow(template, registry)
  assert(workflow !== undefined, 'Workflow should compile successfully')
}

// Test 5: REQ-028 - Lossless JSON
console.log('\n=== Test: REQ-028 Lossless JSON ===')
{
  // Test snapshotJsonValue
  const obj = { a: 1, b: { c: 'test', d: [1, 2, 3] } }
  const frozen = snapshotJsonValue(obj)
  assert(isFrozenJsonValue(frozen), 'snapshotJsonValue should freeze the object')
  assert(isFrozenJsonValue(frozen.b), 'snapshotJsonValue should freeze nested objects')
  assert(isFrozenJsonValue(frozen.b.d), 'snapshotJsonValue should freeze arrays')
  
  // Test deepCopyJsonValue
  const copy = deepCopyJsonValue(frozen)
  assert(!isFrozenJsonValue(copy), 'deepCopyJsonValue should create unfrozen copy')
  assert(copy.b !== frozen.b, 'deepCopyJsonValue should create new references')
  
  // Test that primitives are handled correctly
  const frozenPrimitive = snapshotJsonValue(42)
  assert(frozenPrimitive === 42, 'snapshotJsonValue should return primitives as-is')
  
  const frozenNull = snapshotJsonValue(null)
  assert(frozenNull === null, 'snapshotJsonValue should handle null')
}

// Test 6: NodeDefinition with dependencies
console.log('\n=== Test: REQ-013 NodeDefinition.dependencies ===')
{
  const template = {
    apiVersion: 'dsh.flow-canvas/v1',
    kind: 'WorkflowTemplate',
    metadata: { id: 'test-dependencies', name: 'Test Dependencies' },
    spec: {
      inputSchema: {},
      outputSchema: {},
      nodes: [
        { id: 'a', uses: 'core.start', with: {}, inputs: {} },
        { id: 'b', uses: 'core.tool', with: { toolName: 'test', customDependency: 'my-dep' }, inputs: {} },
        { id: 'c', uses: 'core.end', with: {}, inputs: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
      outputs: {},
      requires: [
        { kind: 'capability', uses: 'dsh.tools.execute' },
        { kind: 'dependency', uses: 'my-dep' },
      ],
    },
  }
  const registry = new Map([
    ['core.start', { type: 'core.start', version: 1, title: 'Start', description: '', role: 'start', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
    ['core.tool', { 
      type: 'core.tool', 
      version: 1, 
      title: 'Tool', 
      description: '', 
      role: 'regular', 
      configSchema: {}, 
      inputSchema: {}, 
      outputSchema: {}, 
      outputPorts: ['success', 'error'], 
      capabilities: ['dsh.tools.execute'], 
      dependencyKinds: ['capability', 'dependency'],
      retry: 'never', 
      dependencies: (config) => {
        // Return dependencies based on config
        if (config.customDependency) {
          return [{ kind: 'dependency', uses: config.customDependency }]
        }
        return []
      },
      execute: async () => ({}) 
    }],
    ['core.end', { type: 'core.end', version: 1, title: 'End', description: '', role: 'end', configSchema: {}, inputSchema: {}, outputSchema: {}, outputPorts: ['success'], capabilities: [], retry: 'never', execute: async () => ({}) }],
  ])
  const { diagnostics, workflow } = compileWorkflow(template, registry)
  assert(workflow !== undefined, 'Workflow with dependencies should compile successfully')
  assert(!assertDiagnostic(diagnostics, 'WORKFLOW_REQUIREMENT_UNDECLARED', 'Node requires undeclared dependency'), 'Should not report undeclared dependency when it is declared')
}

// Summary
console.log('\n=== Summary ===')
console.log(`Passed: ${passed}, Failed: ${failed}`)
process.exit(failed > 0 ? 1 : 0)