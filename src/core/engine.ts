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
  PersistedWorkflowRunStatus,
  JsonObject,
} from './types'

export interface DagWorkflowEngineOptions {
  maxConcurrentNodes?: number
  maxNodeRuns?: number
  maxDurationMs?: number
  toolGateway?: WorkflowToolGateway
  agentGateway?: WorkflowAgentGateway
  onStateChange?: (run: WorkflowRun) => void
  onNodeLog?: (nodeId: string, message: string) => void
}

const DEFAULT_POLICIES = {
  maxConcurrentNodes: 4,
  maxNodeRuns: 100,
  maxDurationMs: 10 * 60_000,
}

export class DagWorkflowEngine {
  private compiled: CompiledWorkflow
  private options: DagWorkflowEngineOptions
  private run: WorkflowRun
  private abortController: AbortController
  private nodeOutputs = new Map<string, JsonObject>()
  private running = false

  constructor(compiled: CompiledWorkflow, options: DagWorkflowEngineOptions = {}) {
    this.compiled = compiled
    this.options = {
      maxConcurrentNodes: options.maxConcurrentNodes ?? DEFAULT_POLICIES.maxConcurrentNodes,
      maxNodeRuns: options.maxNodeRuns ?? DEFAULT_POLICIES.maxNodeRuns,
      maxDurationMs: options.maxDurationMs ?? DEFAULT_POLICIES.maxDurationMs,
      toolGateway: options.toolGateway,
      agentGateway: options.agentGateway,
      onStateChange: options.onStateChange,
      onNodeLog: options.onNodeLog,
    }
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
      }
    }

    // 执行节点
    const result = await definition.execute({
      nodeId,
      config: template.with,
      inputs,
      workflowInputs: this.run.result || {},
      signal: this.abortController.signal,
      toolGateway: this.options.toolGateway,
      agentGateway: this.options.agentGateway,
    })

    return result
  }

  private getReadyNodes(): string[] {
    const ready: string[] = []
    for (const nodeId of this.compiled.order) {
      const status = this.run.nodeStates.get(nodeId)?.status
      if (status !== 'pending') continue

      // 检查所有前置节点是否完成
      const compiledNode = this.compiled.nodes.get(nodeId)
      if (!compiledNode) continue

      const allPredecessorsComplete = compiledNode.incoming.every(edge => {
        const sourceStatus = this.run.nodeStates.get(edge.source)?.status
        return sourceStatus === 'completed' || sourceStatus === 'skipped'
      })

      if (allPredecessorsComplete) {
        ready.push(nodeId)
      }
    }
    return ready
  }

  private shouldSkipNode(nodeId: string): boolean {
    const compiledNode = this.compiled.nodes.get(nodeId)
    if (!compiledNode) return false

    // 检查条件节点的 false 分支
    for (const edge of compiledNode.incoming) {
      if (edge.sourcePort === 'false') {
        const sourceStatus = this.run.nodeStates.get(edge.source)?.status
        if (sourceStatus === 'completed') {
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
    this.emitState()

    let nodeRuns = 0

    try {
      while (this.running || this.getReadyNodes().length > 0) {
        if (this.abortController.signal.aborted) {
          this.run.status = 'cancelled'
          break
        }

        const ready = this.getReadyNodes()
        if (ready.length === 0) break

        // 执行就绪节点（限制并发）
        const batch = ready.slice(0, this.options.maxConcurrentNodes)
        const promises = batch.map(async (nodeId) => {
          if (nodeRuns >= (this.options.maxNodeRuns || DEFAULT_POLICIES.maxNodeRuns)) {
            throw new Error('Max node runs exceeded')
          }

          // 检查是否应该跳过
          if (this.shouldSkipNode(nodeId)) {
            this.run.nodeStates.set(nodeId, { nodeId, status: 'skipped' })
            this.log(nodeId, `Skipped (condition branch not taken)`)
            return
          }

          this.run.nodeStates.set(nodeId, { nodeId, status: 'running', startedAt: Date.now() })
          this.emitState()

          try {
            const result = await this.executeNode(nodeId)
            this.nodeOutputs.set(nodeId, result.outputs)
            this.run.nodeStates.set(nodeId, {
              nodeId,
              status: 'completed',
              startedAt: this.run.nodeStates.get(nodeId)?.startedAt,
              completedAt: Date.now(),
            })
            this.log(nodeId, `Completed`)
            nodeRuns++
          } catch (error) {
            this.run.nodeStates.set(nodeId, {
              nodeId,
              status: 'failed',
              startedAt: this.run.nodeStates.get(nodeId)?.startedAt,
              completedAt: Date.now(),
              error: String(error),
            })
            this.log(nodeId, `Failed: ${error}`)
            throw error
          }

          this.emitState()
        })

        await Promise.allSettled(promises)

        // 检查是否有失败的节点
        for (const nodeId of batch) {
          if (this.run.nodeStates.get(nodeId)?.status === 'failed') {
            this.run.status = 'failed'
            this.run.completedAt = Date.now()
            this.emitState()
            return this.run
          }
        }
      }

      // 完成
      if (this.run.status === 'running') {
        this.run.status = 'completed'
        this.run.completedAt = Date.now()
      }
    } catch (error) {
      if (this.run.status === 'running') {
        this.run.status = 'failed'
        this.run.error = String(error)
        this.run.completedAt = Date.now()
      }
    }

    this.emitState()
    return this.run
  }

  stop(): void {
    this.abortController.abort()
    this.run.status = 'cancelled'
    this.run.completedAt = Date.now()
    this.emitState()
  }
}
