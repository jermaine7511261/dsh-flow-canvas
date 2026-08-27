/**
 * dsh-flow-canvas — SQLite persistence layer.
 * 替换文件系统存储，支持工作流模板版本化、执行历史、检查点。
 */
const { existsSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')
const { homedir } = require('node:os')

// SQLite 简易封装（使用 better-sqlite3 或内置 sqlite3）
let db = null

function initDatabase(storagePath) {
  const dbPath = join(storagePath, 'flow-canvas.db')
  const dir = join(storagePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // 尝试加载 better-sqlite3
  try {
    const Database = require('better-sqlite3')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  } catch (e) {
    // fallback: 使用 JSON 文件存储（兼容模式）
    console.log('[dsh-flow-canvas] SQLite not available, using JSON file storage')
    db = initJsonStorage(storagePath); return db
  }

  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      template JSON NOT NULL,
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS workflow_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      template JSON NOT NULL,
      semantic_hash TEXT,
      published_at INTEGER DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
      UNIQUE(workflow_id, version)
    );

    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      started_at INTEGER,
      completed_at INTEGER,
      node_states JSON,
      result JSON,
      error TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workflow_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      status TEXT,
      output JSON,
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE
    );
  `)

  return { type: 'sqlite', db }
}

function initJsonStorage(storagePath) {
  // JSON 文件存储的简易实现
  const store = {
    type: 'json',
    path: storagePath,
    workflows: new Map(),
    versions: new Map(),
    runs: new Map(),
  }

  // 加载现有工作流
  if (existsSync(storagePath)) {
    const { readdirSync, readFileSync } = require('node:fs')
    const files = readdirSync(storagePath).filter(f => f.endsWith('.json'))
    for (const f of files) {
      try {
        const data = JSON.parse(readFileSync(join(storagePath, f), 'utf8'))
        if (data.id) store.workflows.set(data.id, data)
      } catch (e) { /* skip invalid files */ }
    }
  }

  return store
}

// ── 工作流 CRUD ──

function saveWorkflow(template) {
  if (!template?.metadata?.id) throw new Error('template.metadata.id is required')
  const id = template.metadata.id

  if (db?.type === 'sqlite') {
    const stmt = db.db.prepare(`
      INSERT OR REPLACE INTO workflows (id, name, description, template, updated_at)
      VALUES (?, ?, ?, ?, unixepoch() * 1000)
    `)
    stmt.run(id, template.metadata.name, template.metadata.description || '', JSON.stringify(template))
  } else {
    // JSON fallback
    const { writeFileSync } = require('node:fs')
    writeFileSync(join(db.path, `${id}.json`), JSON.stringify(template, null, 2))
    db.workflows.set(id, template)
  }

  return id
}

function loadWorkflow(id) {
  if (db?.type === 'sqlite') {
    const row = db.db.prepare('SELECT template FROM workflows WHERE id = ?').get(id)
    return row ? JSON.parse(row.template) : null
  } else {
    return db.workflows.get(id) || null
  }
}

function listWorkflows() {
  if (db?.type === 'sqlite') {
    const rows = db.db.prepare('SELECT id, name, description, created_at, updated_at FROM workflows ORDER BY updated_at DESC').all()
    return rows.map(r => ({ ...r, template: undefined }))
  } else {
    return [...db.workflows.values()].map(w => ({
      id: w.metadata.id,
      name: w.metadata.name,
      description: w.metadata.description,
    }))
  }
}

function deleteWorkflow(id) {
  if (db?.type === 'sqlite') {
    db.db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
  } else {
    db.workflows.delete(id)
  }
}

// ── 版本管理 ──

function publishVersion(template) {
  if (!template?.metadata?.id) throw new Error('template.metadata.id is required')
  const id = template.metadata.id

  if (db?.type === 'sqlite') {
    // 获取下一个版本号
    const last = db.db.prepare('SELECT MAX(version) as v FROM workflow_versions WHERE workflow_id = ?').get(id)
    const version = (last?.v || 0) + 1

    // 计算语义哈希
    const { createHash } = require('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify(template.spec)).digest('hex').slice(0, 16)

    db.db.prepare(`
      INSERT INTO workflow_versions (workflow_id, version, template, semantic_hash)
      VALUES (?, ?, ?, ?)
    `).run(id, version, JSON.stringify(template), hash)

    return { version, semanticHash: hash }
  } else {
    // JSON fallback
    const { writeFileSync } = require('node:fs')
    writeFileSync(join(db.path, `published-${id}.json`), JSON.stringify(template, null, 2))
    return { version: 1, semanticHash: 'json-fallback' }
  }
}

function loadVersion(id, version) {
  if (db?.type === 'sqlite') {
    const row = db.db.prepare('SELECT template FROM workflow_versions WHERE workflow_id = ? AND version = ?').get(id, version)
    return row ? JSON.parse(row.template) : null
  } else {
    const { readFileSync, existsSync } = require('node:fs')
    const filepath = join(db.path, `published-${id}.json`)
    return existsSync(filepath) ? JSON.parse(readFileSync(filepath, 'utf8')) : null
  }
}

function listVersions(id) {
  if (db?.type === 'sqlite') {
    return db.db.prepare('SELECT version, semantic_hash, published_at FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC').all(id)
  } else {
    return [{ version: 1, semantic_hash: 'json-fallback' }]
  }
}

// ── 执行历史 ──

function saveRun(run) {
  if (db?.type === 'sqlite') {
    db.db.prepare(`
      INSERT OR REPLACE INTO workflow_runs (id, workflow_id, status, started_at, completed_at, node_states, result, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(run.runId, run.workflowId, run.status, run.startedAt, run.completedAt || null,
      JSON.stringify(Object.fromEntries(run.nodeStates || [])), JSON.stringify(run.result || {}), run.error || null)
  }
}

function loadRun(runId) {
  if (db?.type === 'sqlite') {
    const row = db.db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(runId)
    if (!row) return null
    return {
      ...row,
      nodeStates: new Map(Object.entries(JSON.parse(row.node_states || '{}'))),
      result: JSON.parse(row.result || '{}'),
    }
  }
  return null
}

function listRuns(workflowId, limit = 50) {
  if (db?.type === 'sqlite') {
    return db.db.prepare('SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?').all(workflowId, limit)
  }
  return []
}

// ── 检查点 ──

function saveCheckpoint(runId, nodeId, status, output) {
  if (db?.type === 'sqlite') {
    db.db.prepare(`
      INSERT INTO workflow_checkpoints (run_id, node_id, status, output)
      VALUES (?, ?, ?, ?)
    `).run(runId, nodeId, status, JSON.stringify(output || {}))
  }
}

function loadCheckpoints(runId) {
  if (db?.type === 'sqlite') {
    return db.db.prepare('SELECT * FROM workflow_checkpoints WHERE run_id = ? ORDER BY created_at ASC').all(runId)
  }
  return []
}

// ── 关闭 ──

function close() {
  if (db?.type === 'sqlite' && db.db) {
    db.db.close()
  }
}

module.exports = {
  initDatabase, saveWorkflow, loadWorkflow, listWorkflows, deleteWorkflow,
  publishVersion, loadVersion, listVersions,
  saveRun, loadRun, listRuns,
  saveCheckpoint, loadCheckpoints,
  close,
}
