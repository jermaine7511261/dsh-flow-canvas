/**
 * dsh-flow-canvas — Core types.
 * 框架无关的类型定义，参考 GM-HZ/dsh-dag-workflow。
 */

// ── JSON 基础类型 ──
export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[]
export interface JsonObject { [key: string]: JsonValue }
export type JsonSchema = Record<string, unknown>

// ── 工作流绑定 ──
export type WorkflowBinding =
  | { readonly literal: JsonValue }
  | { readonly input: string }
  | { readonly output: { readonly node: string; readonly path: readonly (string | number)[] } }
  | { readonly secret: { readonly ref: string } }

// ── 工作流需求 ──
export interface WorkflowRequirement {
  readonly kind: string
  readonly uses: string
}

// ── 节点期望 ──
export interface WorkflowNodeExpectation {
  readonly schema: JsonSchema
  readonly maxBytes?: number
}

// ── 节点模板 ──
export interface WorkflowNodeTemplate {
  readonly id: string
  readonly uses: string
  readonly title?: string
  readonly with: JsonObject
  readonly inputs: Readonly<Record<string, WorkflowBinding>>
  readonly expects?: WorkflowNodeExpectation
  readonly policy?: {
    readonly timeoutMs?: number
    readonly retry?: { readonly maxAttempts: number }
  }
}

// ── 边模板 ──
export interface WorkflowEdgeTemplate {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly sourcePort?: string
}

// ── 工作流策略 ──
export interface WorkflowPolicies {
  readonly maxConcurrentNodes?: number
  readonly maxNodeRuns?: number
  readonly maxDurationMs?: number
  readonly maxOutputBytes?: number
  readonly subworkflowMaxDepth?: number
}

// ── 工作流模板 ──
export interface WorkflowTemplate {
  readonly apiVersion: string
  readonly kind: 'WorkflowTemplate'
  readonly metadata: {
    readonly id: string
    readonly name: string
    readonly description?: string
  }
  readonly spec: {
    readonly inputSchema: JsonSchema
    readonly outputSchema: JsonSchema
    readonly requires?: readonly WorkflowRequirement[]
    readonly nodes: readonly WorkflowNodeTemplate[]
    readonly edges: readonly WorkflowEdgeTemplate[]
    readonly outputs: Readonly<Record<string, WorkflowBinding>>
    readonly policies?: WorkflowPolicies
  }
  readonly layout?: JsonObject
}

// ── 节点定义 ──
export type NodeRole = 'start' | 'end' | 'regular'
export type NodeRetryMode = 'never' | 'safe' | 'idempotent'

export interface WorkflowNodeDefinition {
  readonly type: string
  readonly version: number
  readonly title: string
  readonly description: string
  readonly role: NodeRole
  readonly configSchema: JsonSchema
  readonly defaultConfig?: JsonObject
  readonly inputSchema: JsonSchema
  readonly outputSchema: JsonSchema
  readonly outputPorts: string[]
  readonly requiredOutputPorts?: string[]
  readonly capabilities: string[]
  readonly retry: NodeRetryMode
  readonly validateConfig?(config: JsonObject): string[]
  readonly dependencies?(config: JsonObject): WorkflowRequirement[]
  readonly dependencyKinds?: string[]
  readonly execution?: 'activity' | 'human-wait'
  readonly execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult>
}

// ── 节点执行上下文 ──
export interface WorkflowNodeExecutionContext {
  readonly nodeId: string
  readonly config: JsonObject
  readonly inputs: JsonObject
  readonly workflowInputs: JsonObject
  readonly signal: AbortSignal
  readonly capabilities?: WorkflowCapabilityResolver
  readonly services?: WorkflowNodeServices
  readonly requirements: readonly WorkflowRequirement[]
  readonly owner?: unknown
}

// ── 节点服务集合 ──
export interface WorkflowNodeServices {
  readonly tools?: WorkflowToolGateway
  readonly agents?: WorkflowAgentGateway
  readonly approvals?: WorkflowApprovalGateway
  readonly secrets?: WorkflowSecretGateway
  readonly subworkflows?: WorkflowSubworkflowGateway
}

// ── Approval 网关 (REQ-023) ──
export type WorkflowApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

export interface WorkflowApprovalGateway {
  request(request: WorkflowApprovalRequest): Promise<WorkflowApprovalOutcome>
}

export interface WorkflowApprovalRequest {
  readonly runId: string
  readonly nodeId: string
  readonly token: string
  readonly action: string
  readonly reason: string
  readonly details: JsonObject
  readonly signal: AbortSignal
  readonly owner?: unknown
}

// ── Subworkflow 网关 (REQ-021) ──
export interface WorkflowSubworkflowGateway {
  execute(request: WorkflowSubworkflowRequest): Promise<WorkflowSubworkflowResult>
}

export interface WorkflowSubworkflowRequest {
  readonly parentRunId: string
  readonly nodeId: string
  readonly invocationId: string
  readonly templateId: string
  readonly revision: number
  readonly inputs: JsonObject
  readonly depth: number
  readonly depthLimit: number
  readonly signal: AbortSignal
  readonly owner?: unknown
}

export interface WorkflowSubworkflowResult {
  readonly runId: string
  readonly outputs: JsonObject
}

// ── 节点执行结果 ──
export interface WorkflowNodeExecutionResult {
  readonly outputs: JsonObject
  readonly selectedPorts?: readonly string[]
}

// ── 工具网关 ──
export interface WorkflowToolGateway {
  execute(request: WorkflowToolRequest): Promise<JsonValue>
}

export interface WorkflowToolRequest {
  readonly runId: string
  readonly nodeId: string
  readonly name: string
  readonly input: JsonObject
  readonly signal: AbortSignal
  owner?: unknown
}

// ── Agent 网关 ──
export interface WorkflowAgentGateway {
  execute(request: WorkflowAgentRequest): Promise<JsonValue>
}

export interface WorkflowAgentRequest {
  readonly runId: string
  readonly nodeId: string
  readonly provider: string
  readonly prompt: string
  readonly label?: string
  readonly outputSchema?: JsonSchema
  readonly maxDepth?: number
  readonly signal: AbortSignal
  owner?: unknown
}

// ── Secret 网关 ──
export interface WorkflowSecretGateway {
  resolve(ref: string, context: { runId: string; nodeId: string; signal: AbortSignal }): Promise<JsonValue>
}

// ── 能力作用域 ──
export interface WorkflowCapabilityResolver {
  readonly declared: string[]
  has(capability: string): boolean
  optional<T = unknown>(capability: string): T | undefined
  require<T = unknown>(capability: string): T
}

export interface WorkflowCapabilitySource {
  resolve<T = unknown>(capability: string): T | undefined
}

// ── 编译结果 ──
export interface CompiledWorkflowNode {
  readonly template: WorkflowNodeTemplate
  readonly definition: WorkflowNodeDefinition
  readonly incoming: readonly WorkflowEdgeTemplate[]
  readonly outgoing: readonly WorkflowEdgeTemplate[]
  readonly validateInputs: (value: unknown) => readonly string[]
  readonly validateOutputs: (value: unknown) => readonly string[]
  readonly requirements: readonly WorkflowRequirement[]
}

export interface CompiledWorkflow {
  readonly template: WorkflowTemplate
  readonly nodes: ReadonlyMap<string, CompiledWorkflowNode>
  readonly edges: ReadonlyMap<string, WorkflowEdgeTemplate>
  readonly order: readonly string[]
  readonly startNodeId: string
  readonly semanticHash: string
  readonly requirements: readonly WorkflowRequirement[]
  readonly validateWorkflowInputs: (value: unknown) => readonly string[]
  readonly validateWorkflowOutputs: (value: unknown) => readonly string[]
}

// ── 运行状态 ──
export type PersistedWorkflowRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'

export interface WorkflowNodeStatus {
  readonly nodeId: string
  readonly status: 'pending' | 'ready' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'cancelled' | 'skipped' | 'needs_attention'
  readonly startedAt?: number
  readonly completedAt?: number
  readonly error?: string
}

export interface WorkflowEdgeStatus {
  readonly edgeId: string
  readonly status: 'pending' | 'active' | 'completed'
}

export interface WorkflowRun {
  readonly runId: string
  readonly workflowId: string
  readonly status: PersistedWorkflowRunStatus
  readonly startedAt: number
  readonly completedAt?: number
  readonly nodeStates: ReadonlyMap<string, WorkflowNodeStatus>
  readonly edgeStates: ReadonlyMap<string, WorkflowEdgeStatus>
  readonly result?: JsonObject
  readonly error?: string
  readonly events: WorkflowEvent[]
}

// ── 事件系统 ──
// 事件序列号类型
export type WorkflowEventSeq = number

// 工作流事件
export type WorkflowEvent =
  | { seq: WorkflowEventSeq; type: 'run.started'; runId: string }
  | { seq: WorkflowEventSeq; type: 'run.completed'; runId: string }
  | { seq: WorkflowEventSeq; type: 'run.failed'; runId: string; error: string }
  | { seq: WorkflowEventSeq; type: 'run.cancelled'; runId: string; reason: string }
  | { seq: WorkflowEventSeq; type: 'run.paused'; runId: string; reason: string }
  | { seq: WorkflowEventSeq; type: 'node.ready'; runId: string; nodeId: string }
  | { seq: WorkflowEventSeq; type: 'node.started'; runId: string; nodeId: string }
  | { seq: WorkflowEventSeq; type: 'node.completed'; runId: string; nodeId: string }
  | { seq: WorkflowEventSeq; type: 'node.failed'; runId: string; nodeId: string; error: string }
  | { seq: WorkflowEventSeq; type: 'node.skipped'; runId: string; nodeId: string }
  | { seq: WorkflowEventSeq; type: 'node.waiting'; runId: string; nodeId: string }
  | { seq: WorkflowEventSeq; type: 'node.cancelled'; runId: string; nodeId: string }
  | { seq: WorkflowEventSeq; type: 'node.needs-attention'; runId: string; nodeId: string }
  | { seq: WorkflowEventSeq; type: 'edge.taken'; runId: string; edgeId: string }
  | { seq: WorkflowEventSeq; type: 'edge.skipped'; runId: string; edgeId: string }
  | { seq: WorkflowEventSeq; type: 'checkpoint.committed'; runId: string; checkpointSeq: WorkflowEventSeq }

// 事件输入（不含 seq 和 runId，由引擎填充）
export type WorkflowEventInput = Omit<WorkflowEvent, 'seq' | 'runId'>

// ── 诊断 ──
export interface WorkflowDiagnostic {
  readonly code: string
  readonly severity: 'error' | 'warning'
  readonly message: string
  readonly nodeId?: string
  readonly path?: readonly (string | number)[]
}

// ── 工作流存储接口 ──
export interface WorkflowRunStore {
  saveRun(run: WorkflowRun): Promise<void>
  loadRun(runId: string): Promise<WorkflowRun | null>
  listRuns(workflowId: string): Promise<WorkflowRun[]>
  deleteRun(runId: string): Promise<void>
}

// ── Checkpoint 持久化接口 ──
export interface WorkflowRunCheckpoint {
  version: 1
  runId: string
  semanticHash: string
  seq: number
  status: PersistedWorkflowRunStatus
  nodeStates: Record<string, WorkflowNodeStatus>
  edgeStates: Record<string, WorkflowEdgeStatus>
  nodeOutputs: Record<string, JsonObject>
  nodeProgress: Record<string, JsonValue>
  ready: string[]
  nodeRuns: number
  updatedAt: number
  resultOutputs?: JsonObject
  error?: string
}

export interface WorkflowRunRecord {
  runId: string
  template: WorkflowTemplate
  semanticHash: string
  inputs: JsonObject
  createdAt: number
  checkpoint: WorkflowRunCheckpoint
  events: WorkflowEvent[]
}

export interface CheckpointRunStore {
  createRun(record: WorkflowRunRecord): void
  commit(runId: string, expectedSeq: number, checkpoint: WorkflowRunCheckpoint, events: WorkflowEvent[]): void
  loadRun(runId: string): WorkflowRunRecord | undefined
  listRecoverableRuns(): WorkflowRunRecord[]
}

// ── 工作流模板存储接口 ──
export interface WorkflowTemplateStore {
  saveDraft(template: WorkflowTemplate): Promise<void>
  loadDraft(id: string): Promise<WorkflowTemplate | null>
  listDrafts(): Promise<WorkflowTemplate[]>
  deleteDraft(id: string): Promise<void>
  publish(template: WorkflowTemplate): Promise<void>
  loadPublished(id: string, revision?: number): Promise<WorkflowTemplate | null>
  listPublished(): Promise<WorkflowTemplate[]>
}
