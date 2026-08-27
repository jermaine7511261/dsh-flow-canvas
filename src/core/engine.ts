/**
 * dsh-flow-canvas — DAG Workflow Engine.
 * 执行编译后的工作流，参考 GM-HZ/dsh-dag-workflow engine.ts。
 */

import type {
  CompiledWorkflow,
  CompiledWorkflowNode,
  WorkflowRun,
  WorkflowNodeStatus,
  WorkflowEdgeStatus,
  WorkflowNodeExecutionResult,
  WorkflowToolGateway,
  WorkflowAgentGateway,
  WorkflowSecretGateway,
  PersistedWorkflowRunStatus,
  JsonObject,
  JsonValue,
  WorkflowEvent,
  WorkflowEventInput,
  WorkflowCapabilitySource,
  WorkflowCapabilityResolver,
  WorkflowNodeServices,
  WorkflowRunCheckpoint,
  WorkflowRunRecord,
  CheckpointRunStore,
} from './types'
import { snapshotJsonValue } from './json'

export interface DagWorkflowEngineOptions {
  maxConcurrentNodes?: number
  maxNodeRuns?: number
  maxDurationMs?: number
  maxOutputBytes?: number
  toolGateway?: WorkflowToolGateway
  agentGateway?: WorkflowAgentGateway
  secretGateway?: WorkflowSecretGateway
  onStateChange?: (run: WorkflowRun) => void
  onNodeLog?: (nodeId: string, message: string) => void
  onEvent?: (event: WorkflowEvent) => void
  capabilitySource?: WorkflowCapabilitySource
  owner?: unknown
  runStore?: CheckpointRunStore
}

const DEFAULT_POLICIES = {
  maxConcurrentNodes: 4,
  maxNodeRuns: 100,
  maxDurationMs: 10 * 60_000,
  maxOutputBytes: 1_048_576, // 1 MB default
}

function scopeNodeServices(
  services: WorkflowNodeServices | undefined,
  capabilities: string[]
): WorkflowNodeServices {
  if (!services) return {}
  const allowed = new Set(capabilities)
  return {
    ...(allowed.has('dsh.tools.execute') && services.tools ? { tools: services.tools } : {}),
    ...(allowed.has('dsh.subagents.start') && services.agents ? { agents: services.agents } : {}),
    ...(allowed.has('dsh.approval.request') && services.approvals ? { approvals: services.approvals } : {}),
    ...(allowed.has('dsh.tools.execute') && services.secrets ? { secrets: services.secrets } : {}),
    ...(allowed.has('dsh.workflows.execute') && services.subworkflows ? { subworkflows: services.subworkflows } : {}),
  }
}

function createScopedWorkflowCapabilityResolver(
  source: WorkflowCapabilitySource | undefined,
  declared: string[],
  nodeId: string
): WorkflowCapabilityResolver {
  const allowed = new Set(declared)
  return {
    declared: [...allowed],
    has(capability: string): boolean {
      return allowed.has(capability) && source?.resolve(capability) !== undefined
    },
    optional<T = unknown>(capability: string): T | undefined {
      if (!allowed.has(capability)) return undefined
      return source?.resolve<T>(capability)
    },
    require<T = unknown>(capability: string): T {
      if (!allowed.has(capability)) {
        throw new Error(`Node ${nodeId} did not declare capability ${capability}`)
      }
      const service = source?.resolve<T>(capability)
      if (service === undefined) {
        throw new Error(`Workflow capability is not installed: ${capability}`)
      }
      return service
    },
  }
}

// ── Checkpoint Serialization Helpers ──

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function serializeMapToRecord<V>(map: Map<string, V>): Record<string, V> {
  const result: Record<string, V> = {}
  for (const [key, value] of map) {
    result[key] = value
  }
  return result
}

function deserializeRecordToMap<V>(record: Record<string, V>): Map<string, V> {
  const map = new Map<string, V>()
  for (const [key, value] of Object.entries(record)) {
    map.set(key, value)
  }
  return map
}

function restoreState(record: WorkflowRunRecord): WorkflowRun {
  const cp = record.checkpoint
  return {
    runId: record.runId,
    workflowId: record.template.metadata.id,
    status: cp.status,
    startedAt: record.createdAt,
    nodeStates: deserializeRecordToMap(cp.nodeStates),
    edgeStates: deserializeRecordToMap(cp.edgeStates),
    result: cp.resultOutputs,
    error: cp.error,
    events: [...record.events],
  }
}

export class DagWorkflowEngine {
  private compiled: CompiledWorkflow
  private options: DagWorkflowEngineOptions
  private run: WorkflowRun
  private abortController: AbortController
  private nodeOutputs = new Map<string, JsonObject>()
  private running = false
  private eventSeq = 0
  private services: WorkflowNodeServices
  private checkpointSeq = 0
  private nodeRuns = 0
  private runStore?: CheckpointRunStore
  private maxOutputBytes: number

  constructor(compiled: CompiledWorkflow, options: DagWorkflowEngineOptions = {}) {
    this.compiled = compiled
    this.options = {
      maxConcurrentNodes: options.maxConcurrentNodes ?? DEFAULT_POLICIES.maxConcurrentNodes,
      maxNodeRuns: options.maxNodeRuns ?? DEFAULT_POLICIES.maxNodeRuns,
      maxDurationMs: options.maxDurationMs ?? DEFAULT_POLICIES.maxDurationMs,
      maxOutputBytes: options.maxOutputBytes ?? DEFAULT_POLICIES.maxOutputBytes,
      toolGateway: options.toolGateway,
      agentGateway: options.agentGateway,
      secretGateway: options.secretGateway,
      onStateChange: options.onStateChange,
      onNodeLog: options.onNodeLog,
      onEvent: options.onEvent,
      capabilitySource: options.capabilitySource,
      owner: options.owner,
      runStore: options.runStore,
    }
    this.services = {
      tools: options.toolGateway,
      agents: options.agentGateway,
      secrets: options.secretGateway,
    }
    this.runStore = options.runStore
    this.maxOutputBytes = options.maxOutputBytes ?? DEFAULT_POLICIES.maxOutputBytes
    this.abortController = new AbortController()
    this.run = this.createRun()
  }

  private createRun(): WorkflowRun {
    const nodeStates = new Map<string, WorkflowNodeStatus>()
    const edgeStates = new Map<string, WorkflowEdgeStatus>()

    for (const nodeId of this.compiled.order) {
      nodeStates.set(nodeId, { nodeId, status: 'pending' })
    }
    for (const [, edge] of this.compiled.edges) {
      edgeStates.set(edge.id, { edgeId: edge.id, status: 'pending' })
    }

    return {
      runId: `run-${Date.now()}`,
      workflowId: this.compiled.template.metadata.id,
      status: 'pending',
      startedAt: Date.now(),
      nodeStates,
      edgeStates,
      events: [],
    }
  }

  getRun(): WorkflowRun {
    return this.run
  }

  private emitState(): void {
    this.options.onStateChange?.({ ...this.run })
  }

  private log(nodeId: string, message: string): void {
    this.options.onNodeLog?.(nodeId, message)
  }

  private commitEvents(inputs: WorkflowEventInput[]): void {
    if (inputs.length === 0) return
    for (const input of inputs) {
      this.eventSeq++
      this.run.events.push({ ...input, runId: this.run.runId, seq: this.eventSeq } as WorkflowEvent)
    }
    // 触发观察者回调
    for (const event of this.run.events.slice(-inputs.length)) {
      try { this.options.onEvent?.(event) } catch { /* observers cannot affect execution */ }
    }
  }

  // ── Checkpoint Persistence (REQ-009) ──

  private buildCheckpoint(): WorkflowRunCheckpoint {
    return {
      version: 1,
      runId: this.run.runId,
      semanticHash: this.compiled.semanticHash,
      seq: this.checkpointSeq,
      status: this.run.status,
      nodeStates: serializeMapToRecord(this.run.nodeStates),
      edgeStates: serializeMapToRecord(this.run.edgeStates),
      nodeOutputs: Object.fromEntries(this.nodeOutputs) as Record<string, JsonObject>,
      nodeProgress: {},
      ready: this.getReadyNodes(),
      nodeRuns: this.nodeRuns,
      updatedAt: Date.now(),
      resultOutputs: this.run.result,
      error: this.run.error,
    }
  }

  private createRunRecord(inputs: JsonObject): void {
    if (!this.runStore) return

    const checkpoint: WorkflowRunCheckpoint = {
      version: 1,
      runId: this.run.runId,
      semanticHash: this.compiled.semanticHash,
      seq: 0,
      status: 'running',
      nodeStates: serializeMapToRecord(this.run.nodeStates),
      edgeStates: serializeMapToRecord(this.run.edgeStates),
      nodeOutputs: {},
      nodeProgress: {},
      ready: [],
      nodeRuns: 0,
      updatedAt: Date.now(),
    }

    const record: WorkflowRunRecord = {
      runId: this.run.runId,
      template: this.compiled.template,
      semanticHash: this.compiled.semanticHash,
      inputs,
      createdAt: Date.now(),
      checkpoint,
      events: [],
    }

    this.runStore.createRun(record)
  }

  private persistCheckpoint(eventsToCommit: WorkflowEvent[]): void {
    if (!this.runStore) return

    this.checkpointSeq++
    const checkpoint = this.buildCheckpoint()
    checkpoint.seq = this.checkpointSeq

    try {
      this.runStore.commit(
        this.run.runId,
        this.checkpointSeq - 1, // expectedSeq
        checkpoint,
        eventsToCommit,
      )
    } catch (err) {
      // CAS conflict or other store error — log but don't crash execution
      this.log('_checkpoint', `Checkpoint commit failed: ${err}`)
    }
  }

  // ── Output Size Limit (REQ-019) ──

  private checkOutputSize(nodeId: string, outputs: JsonObject): void {
    const outputBytes = Buffer.byteLength(JSON.stringify(outputs), 'utf8')
    if (outputBytes > this.maxOutputBytes) {
      throw new Error(
        `Node ${nodeId} output is ${outputBytes} bytes, limit is ${this.maxOutputBytes}`,
      )
    }
  }

  private async executeNode(nodeId: string): Promise<WorkflowNodeExecutionResult> {
    const compiledNode = this.compiled.nodes.get(nodeId)
    if (!compiledNode) throw new Error(`Node not found: ${nodeId}`)

    const { definition, template, incoming } = compiledNode

    // 收集输入
    const inputs: JsonObject = {}
    for (const edge of incoming) {
      const sourceOutput = this.nodeOutputs.get(edge.source)
      if (sourceOutput) {
        Object.assign(inputs, sourceOutput)
      }
    }

    // 解析 binding 输入
    const resolvedSecrets: JsonValue[] = []
    for (const [key, binding] of Object.entries(template.inputs || {})) {
      if ('literal' in binding) {
        inputs[key] = binding.literal as any
      } else if ('output' in binding) {
        const sourceOutput = this.nodeOutputs.get(binding.output.node)
        if (sourceOutput) {
          let value: any = sourceOutput
          for (const path of binding.output.path) {
            value = value?.[path]
          }
          inputs[key] = value
        }
      } else if ('secret' in binding && this.options.secretGateway) {
        // 解析 secret binding
        const secretValue = await this.options.secretGateway.resolve(binding.secret.ref, {
          runId: this.run.runId,
          nodeId,
          signal: this.abortController.signal,
        })
        inputs[key] = secretValue as any
        resolvedSecrets.push(secretValue)
      }
    }

    // 创建作用域服务和能力解析器
    const nodeServices = scopeNodeServices(this.services, definition.capabilities)
    const capabilities = createScopedWorkflowCapabilityResolver(
      this.options.capabilitySource,
      definition.capabilities,
      nodeId
    )

    // 执行节点
    const result = await definition.execute({
      nodeId,
      config: template.with,
      inputs,
      workflowInputs: this.run.result || {},
      signal: this.abortController.signal,
      capabilities,
      services: nodeServices,
      requirements: compiledNode.requirements,
      owner: this.options.owner,
    })

    // 输出泄漏检测
    if (resolvedSecrets.length > 0) {
      const outputString = JSON.stringify(result.outputs)
      for (const secretValue of resolvedSecrets) {
        const secretString = JSON.stringify(secretValue)
        if (secretString && outputString.includes(secretString)) {
          throw new Error(`SECRET_OUTPUT_LEAK: Node output contains resolved secret value`)
        }
      }
    }

    // REQ-019: 输出大小限制
    this.checkOutputSize(nodeId, result.outputs)

    return result
  }

  private getReadyNodes(): string[] {
    const ready: string[] = []
    for (const nodeId of this.compiled.order) {
      const status = this.run.nodeStates.get(nodeId)?.status
      if (status !== 'ready') continue

      ready.push(nodeId)
    }
    return ready
  }

  private updateReadyNodes(): string[] {
    const newlyReady: string[] = []
    for (const nodeId of this.compiled.order) {
      const status = this.run.nodeStates.get(nodeId)?.status
      if (status !== 'pending') continue

      const compiledNode = this.compiled.nodes.get(nodeId)
      if (!compiledNode) continue

      const allPredecessorsComplete = compiledNode.incoming.every(edge => {
        const sourceStatus = this.run.nodeStates.get(edge.source)?.status
        return sourceStatus === 'succeeded' || sourceStatus === 'skipped' || sourceStatus === 'failed' || sourceStatus === 'cancelled'
      })

      if (allPredecessorsComplete) {
        this.run.nodeStates.set(nodeId, { nodeId, status: 'ready' })
        newlyReady.push(nodeId)
      }
    }
    return newlyReady
  }

  private shouldSkipNode(nodeId: string): boolean {
    const compiledNode = this.compiled.nodes.get(nodeId)
    if (!compiledNode) return false

    // 检查条件节点的 false 分支
    for (const edge of compiledNode.incoming) {
      if (edge.sourcePort === 'false') {
        const sourceStatus = this.run.nodeStates.get(edge.source)?.status
        if (sourceStatus === 'succeeded') {
          // 条件节点的 false 分支被选中，跳过此节点
          const sourceNode = this.compiled.nodes.get(edge.source)
          if (sourceNode?.definition.type === 'core.condition') {
            const sourceOutput = this.nodeOutputs.get(edge.source)
            if (sourceOutput?.result === false) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  async execute(inputs: JsonObject = {}): Promise<WorkflowRun> {
    this.run.status = 'running'
    this.run.startedAt = Date.now()
    this.run.result = inputs

    // REQ-009: Create run record in store
    this.createRunRecord(inputs)

    this.commitEvents([{ type: 'run.started' }])
    this.emitState()

    // Persist initial checkpoint
    this.persistCheckpoint([])

    try {
      while (this.running || this.getReadyNodes().length > 0) {
        if (this.abortController.signal.aborted) {
          this.run.status = 'cancelled'
          this.commitEvents([{ type: 'run.cancelled', reason: 'Abort signal received' }])
          break
        }

        // 更新就绪节点状态
        const newlyReady = this.updateReadyNodes()
        for (const nodeId of newlyReady) {
          this.commitEvents([{ type: 'node.ready', nodeId }])
          const compiledNode = this.compiled.nodes.get(nodeId)
          if (compiledNode) {
            for (const edge of compiledNode.incoming) {
              this.commitEvents([{ type: 'edge.taken', edgeId: edge.id }])
            }
          }
        }

        const ready = this.getReadyNodes()
        if (ready.length === 0) break

        // 执行就绪节点（限制并发）
        const batch = ready.slice(0, this.options.maxConcurrentNodes)

        const promises = batch.map(async (nodeId) => {
          if (this.nodeRuns >= (this.options.maxNodeRuns || DEFAULT_POLICIES.maxNodeRuns)) {
            throw new Error('Max node runs exceeded')
          }

          // 检查是否应该跳过
          if (this.shouldSkipNode(nodeId)) {
            this.run.nodeStates.set(nodeId, { nodeId, status: 'skipped' })
            this.log(nodeId, `Skipped (condition branch not taken)`)
            this.commitEvents([{ type: 'node.skipped', nodeId }])
            const compiledNode = this.compiled.nodes.get(nodeId)
            if (compiledNode) {
              for (const edge of compiledNode.incoming) {
                this.commitEvents([{ type: 'edge.skipped', edgeId: edge.id }])
              }
            }
            return
          }

          this.run.nodeStates.set(nodeId, { nodeId, status: 'running', startedAt: Date.now() })
          this.commitEvents([{ type: 'node.started', nodeId }])
          this.emitState()

          try {
            const result = await this.executeNode(nodeId)
            // Use lossless JSON snapshot to prevent prototype pollution (REQ-028)
            const frozenOutputs = snapshotJsonValue(result.outputs)
            this.nodeOutputs.set(nodeId, frozenOutputs as JsonObject)
            this.run.nodeStates.set(nodeId, {
              nodeId,
              status: 'succeeded',
              startedAt: this.run.nodeStates.get(nodeId)?.startedAt,
              completedAt: Date.now(),
            })
            this.commitEvents([{ type: 'node.completed', nodeId }])
            this.log(nodeId, `Completed`)
            this.nodeRuns++
          } catch (error) {
            this.run.nodeStates.set(nodeId, {
              nodeId,
              status: 'failed',
              startedAt: this.run.nodeStates.get(nodeId)?.startedAt,
              completedAt: Date.now(),
              error: String(error),
            })
            this.commitEvents([{ type: 'node.failed', nodeId, error: String(error) }])
            this.log(nodeId, `Failed: ${error}`)
            throw error
          }

          this.emitState()
        })

        await Promise.allSettled(promises)

        // Persist checkpoint after each batch
        this.persistCheckpoint([])

        // 检查是否有失败的节点
        for (const nodeId of batch) {
          if (this.run.nodeStates.get(nodeId)?.status === 'failed') {
            this.run.status = 'failed'
            this.run.completedAt = Date.now()
            this.commitEvents([{ type: 'run.failed', error: this.run.error || 'Node failed' }])
            this.persistCheckpoint([])
            this.emitState()
            return this.run
          }
        }
      }

      // 完成
      if (this.run.status === 'running') {
        this.run.status = 'completed'
        this.run.completedAt = Date.now()
        this.commitEvents([{ type: 'run.completed' }])
        this.persistCheckpoint([])
      }
    } catch (error) {
      if (this.run.status === 'running') {
        this.run.status = 'failed'
        this.run.error = String(error)
        this.run.completedAt = Date.now()
        this.commitEvents([{ type: 'run.failed', error: String(error) }])
        this.persistCheckpoint([])
      }
    }

    this.emitState()
    return this.run
  }

  // ── Resume (REQ-010) ──

  /**
   * Resume a previously persisted run from checkpoint.
   */
  resume(request: { runId: string; onEvent?: (event: WorkflowEvent) => void }): WorkflowRun {
    if (!this.runStore) throw new Error('Resume requires a CheckpointRunStore')
    const record = this.runStore.loadRun(request.runId)
    if (!record) throw new Error(`Run not found: ${request.runId}`)

    const state = restoreState(record)

    // If already terminal, return as-is
    if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
      this.run = state
      this.eventSeq = state.events.length > 0 ? state.events[state.events.length - 1].seq : 0
      this.emitState()
      return this.run
    }

    // Restore engine state from checkpoint
    this.run = state
    this.run.status = 'running'
    this.eventSeq = state.events.length > 0 ? state.events[state.events.length - 1].seq : 0
    this.checkpointSeq = record.checkpoint.seq
    this.nodeRuns = record.checkpoint.nodeRuns

    // Restore node outputs from checkpoint
    this.nodeOutputs = new Map<string, JsonObject>()
    for (const [key, value] of Object.entries(record.checkpoint.nodeOutputs)) {
      this.nodeOutputs.set(key, value as JsonObject)
    }

    // Wire up observer if provided
    if (request.onEvent) {
      this.options.onEvent = request.onEvent
    }

    this.abortController = new AbortController()
    this.emitState()

    return this.run
  }

  stop(): void {
    this.abortController.abort()
    this.run.status = 'cancelled'
    this.run.completedAt = Date.now()
    this.commitEvents([{ type: 'run.cancelled', reason: 'Manual cancellation' }])
    this.persistCheckpoint([])
    this.emitState()
  }
}
