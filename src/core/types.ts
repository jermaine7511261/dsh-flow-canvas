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
  readonly inputSchema: JsonSchema
  readonly outputSchema: JsonSchema
  readonly outputPorts: string[]
  readonly requiredOutputPorts?: string[]
  readonly capabilities: string[]
  readonly retry: NodeRetryMode
  readonly execute(context: WorkflowNodeExecutionContext): Promise<WorkflowNodeExecutionResult>
}

// ── 节点执行上下文 ──
export interface WorkflowNodeExecutionContext {
  readonly nodeId: string
  readonly config: JsonObject
  readonly inputs: JsonObject
  readonly workflowInputs: JsonObject
  readonly signal: AbortSignal
  readonly toolGateway?: WorkflowToolGateway
  readonly agentGateway?: WorkflowAgentGateway
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
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
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
}

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
