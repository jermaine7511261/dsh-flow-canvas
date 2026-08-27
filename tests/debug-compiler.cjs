/**
 * Debug test for compiler enhancements
 */
const { compileWorkflow } = require('../src/core/compiler.cjs')

// Simple test to see all diagnostics
const template = {
  apiVersion: 'dsh.flow-canvas/v1',
  kind: 'WorkflowTemplate',
  metadata: { id: 'test-debug', name: 'Test' },
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

console.log('Template nodes:', template.spec.nodes.map(n => n.id))
console.log('Template edges:', template.spec.edges.map(e => `${e.source}->${e.target}`))

const result = compileWorkflow(template, registry)
console.log('\nAll diagnostics:')
for (const diag of result.diagnostics) {
  console.log(`  ${diag.code}: ${diag.message} (node: ${diag.nodeId || 'none'})`)
}

// Check if BINDING_NOT_UPSTREAM is present
const bindingUpstreamDiags = result.diagnostics.filter(d => d.code === 'BINDING_NOT_UPSTREAM')
console.log(`\nBINDING_NOT_UPSTREAM diagnostics: ${bindingUpstreamDiags.length}`)
for (const diag of bindingUpstreamDiags) {
  console.log(`  ${diag.message}`)
}