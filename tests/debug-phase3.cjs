/**
 * Debug script for Phase 3 validation
 */
const { compileWorkflow } = require('../src/core/compiler.cjs')

// Test 1: Basic versioned node type
console.log('\n=== Test: Basic versioned node type ===')
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
  console.log('Workflow:', workflow !== undefined)
  console.log('Diagnostics:', JSON.stringify(diagnostics, null, 2))
}

// Test 2: Node with dependencies
console.log('\n=== Test: Node with dependencies ===')
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
  console.log('Workflow:', workflow !== undefined)
  console.log('Diagnostics:', JSON.stringify(diagnostics, null, 2))
}