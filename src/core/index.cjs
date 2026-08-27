/**
 * dsh-flow-canvas — Core module (plain JS).
 */
const nodes = require('./nodes.cjs')
const compiler = require('./compiler.cjs')
const engine = require('./engine.cjs')

module.exports = {
  ...nodes,
  ...compiler,
  DagWorkflowEngine: engine.DagWorkflowEngine,
}
