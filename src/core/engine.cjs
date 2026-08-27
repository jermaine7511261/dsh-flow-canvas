/**
 * dsh-flow-canvas — DAG Workflow Engine (plain JS).
 */
class DagWorkflowEngine {
  constructor(compiled, options) {
    this.compiled = compiled
    this.opts = Object.assign({ maxConcurrentNodes: 4, maxNodeRuns: 100, maxDurationMs: 600000 }, options || {})
    this.nodeOutputs = new Map()
    this.run = this._createRun()
    this.ac = new AbortController()
  }

  _createRun() {
    const nodeStates = new Map(), edgeStates = new Map()
    for (const nodeId of this.compiled.order) nodeStates.set(nodeId, { nodeId, status: 'pending' })
    for (const [, edge] of this.compiled.edges) edgeStates.set(edge.id, { edgeId: edge.id, status: 'pending' })
    return { runId: 'run-' + Date.now(), workflowId: this.compiled.template.metadata.id, status: 'pending', startedAt: Date.now(), nodeStates, edgeStates }
  }

  getRun() { return this.run }

  _emit() { this.opts.onStateChange?.(Object.assign({}, this.run)) }
  _log(nodeId, msg) { this.opts.onNodeLog?.(nodeId, msg) }

  async _executeNode(nodeId) {
    const cn = this.compiled.nodes.get(nodeId)
    if (!cn) throw new Error('Node not found: ' + nodeId)
    const { definition, template, incoming } = cn
    const inputs = {}
    for (const edge of incoming) { const so = this.nodeOutputs.get(edge.source); if (so) Object.assign(inputs, so) }
    for (const [key, binding] of Object.entries(template.inputs || {})) {
      if (binding && binding.literal !== undefined) inputs[key] = binding.literal
      else if (binding && binding.output) {
        const so = this.nodeOutputs.get(binding.output.node)
        if (so) { let v = so; for (const p of binding.output.path) v = v?.[p]; inputs[key] = v }
      }
    }
    return await definition.execute({
      nodeId, config: template.with || {}, inputs,
      workflowInputs: this.run.result || {},
      signal: this.ac.signal,
      toolGateway: this.opts.toolGateway,
      agentGateway: this.opts.agentGateway,
    })
  }

  _getReady() {
    const ready = []
    for (const nodeId of this.compiled.order) {
      if (this.run.nodeStates.get(nodeId)?.status !== 'pending') continue
      const cn = this.compiled.nodes.get(nodeId)
      if (!cn) continue
      if (cn.incoming.every(e => { const s = this.run.nodeStates.get(e.source)?.status; return s === 'completed' || s === 'skipped' })) ready.push(nodeId)
    }
    return ready
  }

  async execute(inputs) {
    this.run.status = 'running'
    this.run.startedAt = Date.now()
    this.run.result = inputs || {}
    this._emit()
    let nodeRuns = 0

    try {
      for (let iter = 0; iter < 1000; iter++) {
        if (this.ac.signal.aborted) { this.run.status = 'cancelled'; break }
        const ready = this._getReady()
        if (ready.length === 0) break
        const batch = ready.slice(0, this.opts.maxConcurrentNodes)

        for (const nodeId of batch) {
          if (nodeRuns >= this.opts.maxNodeRuns) throw new Error('Max node runs exceeded')
          this.run.nodeStates.set(nodeId, { nodeId, status: 'running', startedAt: Date.now() })
          this._emit()
          try {
            const result = await this._executeNode(nodeId)
            this.nodeOutputs.set(nodeId, result.outputs || {})
            this.run.nodeStates.set(nodeId, { nodeId, status: 'completed', startedAt: this.run.nodeStates.get(nodeId)?.startedAt, completedAt: Date.now() })
            this._log(nodeId, 'Completed')
            nodeRuns++
          } catch (err) {
            this.run.nodeStates.set(nodeId, { nodeId, status: 'failed', startedAt: this.run.nodeStates.get(nodeId)?.startedAt, completedAt: Date.now(), error: String(err) })
            this._log(nodeId, 'Failed: ' + err)
            this.run.status = 'failed'
            this.run.completedAt = Date.now()
            this._emit()
            return this.run
          }
          this._emit()
        }
      }
      if (this.run.status === 'running') { this.run.status = 'completed'; this.run.completedAt = Date.now() }
    } catch (err) {
      if (this.run.status === 'running') { this.run.status = 'failed'; this.run.error = String(err); this.run.completedAt = Date.now() }
    }
    this._emit()
    return this.run
  }

  stop() { this.ac.abort(); this.run.status = 'cancelled'; this.run.completedAt = Date.now(); this._emit() }
}

module.exports = { DagWorkflowEngine }
