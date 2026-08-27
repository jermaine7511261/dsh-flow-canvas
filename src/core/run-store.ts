/**
 * dsh-flow-canvas — In-memory workflow run store with checkpoint support.
 */

import type {
  WorkflowRunCheckpoint,
  WorkflowRunRecord,
  CheckpointRunStore,
  WorkflowEvent,
  WorkflowRun,
  WorkflowNodeStatus,
  WorkflowEdgeStatus,
  JsonObject,
} from './types'

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export class InMemoryWorkflowRunStore implements CheckpointRunStore {
  private records = new Map<string, WorkflowRunRecord>()

  createRun(record: WorkflowRunRecord): void {
    if (this.records.has(record.runId)) {
      throw new Error(`Run already exists: ${record.runId}`)
    }
    this.records.set(record.runId, deepClone(record))
  }

  commit(runId: string, expectedSeq: number, checkpoint: WorkflowRunCheckpoint, events: WorkflowEvent[]): void {
    const current = this.records.get(runId)
    if (!current) {
      throw new Error(`Run not found: ${runId}`)
    }
    if (current.checkpoint.seq !== expectedSeq) {
      throw new Error(`Sequence conflict: expected ${current.checkpoint.seq}, got ${expectedSeq}`)
    }
    current.checkpoint = deepClone(checkpoint)
    current.events.push(...events)
  }

  loadRun(runId: string): WorkflowRunRecord | undefined {
    const record = this.records.get(runId)
    return record ? deepClone(record) : undefined
  }

  listRecoverableRuns(): WorkflowRunRecord[] {
    return [...this.records.values()]
      .filter(r => r.checkpoint.status === 'running' || r.checkpoint.status === 'paused')
      .sort((a, b) => a.createdAt - b.createdAt)
  }
}