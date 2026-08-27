/**
 * dsh-flow-canvas — Task Ledger (SQLite).
 * 持久化任务账本 + 审查循环 + 崩溃恢复。
 */
const { existsSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

let db = null

function initTaskLedger(storagePath) {
  const dir = join(storagePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  try {
    const Database = require('better-sqlite3')
    const sqliteDb = new Database(join(storagePath, 'tasks.db'))
    sqliteDb.pragma('journal_mode = WAL')
    sqliteDb.pragma('foreign_keys = ON')
    db = sqliteDb
  } catch (e) {
    console.log('[task-ledger] SQLite not available, using JSON fallback')
    db = { type: 'json', path: storagePath, tasks: new Map(), reviews: new Map() }
    return db
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      assignee TEXT,
      reviewer TEXT,
      priority TEXT DEFAULT 'P2',
      evidence TEXT DEFAULT '[]',
      token_input INTEGER DEFAULT 0,
      token_output INTEGER DEFAULT 0,
      parent_id TEXT,
      dependencies TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000),
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      score INTEGER,
      comments TEXT DEFAULT '[]',
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
  `)

  return { type: 'sqlite', db }
}

// ── 任务 CRUD ──

function createTask({ title, description, assignee, reviewer, priority, parentId, dependencies }) {
  const id = 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  const now = Date.now()

  if (db?.type === 'json') {
    const task = {
      id, title, description: description || '', status: 'pending',
      assignee: assignee || null, reviewer: reviewer || null,
      priority: priority || 'P2', evidence: [], token_input: 0, token_output: 0,
      parent_id: parentId || null, dependencies: dependencies || [],
      created_at: now, updated_at: now, completed_at: null,
    }
    db.tasks.set(id, task)
    return task
  }

  db.prepare(`
    INSERT INTO tasks (id, title, description, status, assignee, reviewer, priority, parent_id, dependencies, created_at, updated_at)
    VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description || '', assignee || null, reviewer || null,
    priority || 'P2', parentId || null, JSON.stringify(dependencies || []), now, now)

  return getTask(id)
}

function getTask(id) {
  if (db?.type === 'json') return db.tasks.get(id) || null
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
  if (row) { row.evidence = JSON.parse(row.evidence || '[]'); row.dependencies = JSON.parse(row.dependencies || '[]') }
  return row || null
}

function listTasks(filters = {}) {
  if (db?.type === 'json') {
    let tasks = [...db.tasks.values()]
    if (filters.status) tasks = tasks.filter(t => t.status === filters.status)
    if (filters.assignee) tasks = tasks.filter(t => t.assignee === filters.assignee)
    return tasks.sort((a, b) => b.created_at - a.created_at)
  }

  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params = []
  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status) }
  if (filters.assignee) { sql += ' AND assignee = ?'; params.push(filters.assignee) }
  sql += ' ORDER BY created_at DESC'
  if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit) }

  return db.prepare(sql).all(...params).map(r => {
    r.evidence = JSON.parse(r.evidence || '[]'); r.dependencies = JSON.parse(r.dependencies || '[]'); return r
  })
}

function updateTask(id, updates) {
  const now = Date.now()
  if (db?.type === 'json') {
    const task = db.tasks.get(id)
    if (!task) return null
    Object.assign(task, updates, { updated_at: now })
    return task
  }

  const sets = ['updated_at = ?']
  const params = [now]
  for (const [key, val] of Object.entries(updates)) {
    if (key === 'evidence' || key === 'dependencies') {
      sets.push(`${key} = ?`); params.push(JSON.stringify(val))
    } else {
      sets.push(`${key} = ?`); params.push(val)
    }
  }
  params.push(id)
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return getTask(id)
}

function deleteTask(id) {
  if (db?.type === 'json') { db.tasks.delete(id); return true }
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return true
}

// ── 状态机 ──

const STATUS_TRANSITIONS = {
  pending: ['assigned'],
  assigned: ['in_progress'],
  in_progress: ['review', 'completed', 'failed'],
  review: ['completed', 'in_progress', 'failed'], // 审查后可退回
  completed: [],
  failed: ['pending'], // 可重试
}

function canTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) || false
}

function transitionTask(id, newStatus) {
  const task = getTask(id)
  if (!task) throw new Error(`Task not found: ${id}`)
  if (!canTransition(task.status, newStatus)) {
    throw new Error(`Invalid transition: ${task.status} → ${newStatus}`)
  }
  const updates = { status: newStatus }
  if (newStatus === 'completed') updates.completed_at = Date.now()
  return updateTask(id, updates)
}

// ── 审查 ──

function createReview(taskId, reviewerId) {
  const id = db?.type === 'json'
    ? Date.now()
    : db.prepare('INSERT INTO reviews (task_id, reviewer_id) VALUES (?, ?)').run(taskId, reviewerId).lastInsertRowid

  if (db?.type === 'json') {
    const review = { id, task_id: taskId, reviewer_id: reviewerId, status: 'pending', score: null, comments: [], created_at: Date.now() }
    db.reviews.set(id, review)
    return review
  }

  return db.prepare('SELECT * FROM reviews WHERE id = ?').get(id)
}

function completeReview(reviewId, status, score, comments) {
  if (db?.type === 'json') {
    const review = db.reviews.get(reviewId)
    if (!review) return null
    Object.assign(review, { status, score, comments: comments || [] })
    return review
  }

  db.prepare('UPDATE reviews SET status = ?, score = ?, comments = ? WHERE id = ?')
    .run(status, score || null, JSON.stringify(comments || []), reviewId)
  return db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId)
}

function getTaskReviews(taskId) {
  if (db?.type === 'json') {
    return [...db.reviews.values()].filter(r => r.task_id === taskId)
  }
  return db.prepare('SELECT * FROM reviews WHERE task_id = ? ORDER BY created_at ASC').all(taskId)
}

// ── Token 追踪 ──

function addTokenUsage(taskId, input, output) {
  if (db?.type === 'json') {
    const task = db.tasks.get(taskId)
    if (task) { task.token_input += input; task.token_output += output }
    return
  }
  db.prepare('UPDATE tasks SET token_input = token_input + ?, token_output = token_output + ? WHERE id = ?')
    .run(input || 0, output || 0, taskId)
}

function getTokenSummary() {
  if (db?.type === 'json') {
    const tasks = [...db.tasks.values()]
    return {
      totalInput: tasks.reduce((s, t) => s + t.token_input, 0),
      totalOutput: tasks.reduce((s, t) => s + t.token_output, 0),
      taskCount: tasks.length,
    }
  }
  const row = db.prepare('SELECT SUM(token_input) as totalInput, SUM(token_output) as totalOutput, COUNT(*) as taskCount FROM tasks').get()
  return { totalInput: row.totalInput || 0, totalOutput: row.totalOutput || 0, taskCount: row.taskCount || 0 }
}

// ── 崩溃恢复 ──

function getRecoverableTasks() {
  if (db?.type === 'json') {
    return [...db.tasks.values()].filter(t => ['assigned', 'in_progress', 'review'].includes(t.status))
  }
  return db.prepare("SELECT * FROM tasks WHERE status IN ('assigned', 'in_progress', 'review') ORDER BY updated_at ASC").all().map(r => {
    r.evidence = JSON.parse(r.evidence || '[]'); r.dependencies = JSON.parse(r.dependencies || '[]'); return r
  })
}

// ── 统计 ──

function getStats() {
  if (db?.type === 'json') {
    const tasks = [...db.tasks.values()]
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    }
  }
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status IN ('assigned', 'in_progress') THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM tasks
  `).get()
  return row
}

module.exports = {
  initTaskLedger, createTask, getTask, listTasks, updateTask, deleteTask,
  transitionTask, canTransition, createReview, completeReview, getTaskReviews,
  addTokenUsage, getTokenSummary, getRecoverableTasks, getStats,
}
