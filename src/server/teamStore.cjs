/**
 * dsh-flow-canvas — Team Store (SQLite).
 * 持久化多模型团队 + 成员管理。
 */
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

let db = null

function initTeamStore(storagePath) {
  const dir = join(storagePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  try {
    const Database = require('better-sqlite3')
    const sqliteDb = new Database(join(storagePath, 'teams.db'))
    sqliteDb.pragma('journal_mode = WAL')
    db = sqliteDb
  } catch (e) {
    console.log('[team-store] SQLite not available, using JSON fallback')
    db = { type: 'json', path: join(storagePath, 'teams.json') }
    try {
      db.data = JSON.parse(readFileSync(db.path, 'utf8'))
    } catch { db.data = { teams: [] } }
    return db
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      lead_id TEXT,
      mode TEXT DEFAULT 'team',
      max_retries INTEGER DEFAULT 3,
      quality_gate INTEGER DEFAULT 80,
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      updated_at INTEGER DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'implementer',
      model TEXT DEFAULT 'deepseek-pro',
      fallback_model TEXT,
      tools TEXT DEFAULT '[]',
      max_tokens INTEGER DEFAULT 4096,
      created_at INTEGER DEFAULT (unixepoch() * 1000),
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );
  `)

  return db
}

// ── 团队 CRUD ──

function createTeam({ name, description, leadId, mode, maxRetries, qualityGate }) {
  const id = 'team-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)

  if (db?.type === 'json') {
    const team = {
      id, name, description: description || '', lead_id: leadId || null,
      mode: mode || 'team', max_retries: maxRetries || 3, quality_gate: qualityGate || 80,
      members: [], created_at: Date.now(), updated_at: Date.now(),
    }
    db.data.teams.push(team)
    saveJson()
    return team
  }

  db.prepare(`INSERT INTO teams (id, name, description, lead_id, mode, max_retries, quality_gate) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name, description || '', leadId || null, mode || 'team', maxRetries || 3, qualityGate || 80)
  return getTeam(id)
}

function getTeam(id) {
  if (db?.type === 'json') {
    const team = db.data.teams.find(t => t.id === id)
    if (!team) return null
    return { ...team, members: db.data.members?.filter(m => m.team_id === id) || [] }
  }

  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(id)
  if (!team) return null
  team.members = db.prepare('SELECT * FROM team_members WHERE team_id = ?').all(id)
  for (const m of team.members) m.tools = JSON.parse(m.tools || '[]')
  return team
}

function listTeams() {
  if (db?.type === 'json') {
    return db.data.teams.map(t => ({ ...t, members: undefined, memberCount: (db.data.members || []).filter(m => m.team_id === t.id).length }))
  }
  return db.prepare('SELECT * FROM teams ORDER BY updated_at DESC').all().map(t => {
    t.memberCount = db.prepare('SELECT COUNT(*) as c FROM team_members WHERE team_id = ?').get(t.id).c
    return t
  })
}

function deleteTeam(id) {
  if (db?.type === 'json') {
    db.data.teams = db.data.teams.filter(t => t.id !== id)
    db.data.members = (db.data.members || []).filter(m => m.team_id !== id)
    saveJson()
    return true
  }
  db.prepare('DELETE FROM teams WHERE id = ?').run(id)
  return true
}

function updateTeam(id, updates) {
  if (db?.type === 'json') {
    const team = db.data.teams.find(t => t.id === id)
    if (!team) return null
    Object.assign(team, updates, { updated_at: Date.now() })
    saveJson()
    return getTeam(id)
  }

  const sets = ['updated_at = ?']
  const params = [Date.now()]
  for (const [key, val] of Object.entries(updates)) {
    sets.push(`${key} = ?`); params.push(val)
  }
  params.push(id)
  db.prepare(`UPDATE teams SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return getTeam(id)
}

// ── 成员管理 ──

function addMember(teamId, { name, role, model, fallbackModel, tools, maxTokens }) {
  const id = 'member-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)

  if (db?.type === 'json') {
    const member = {
      id, team_id: teamId, name, role: role || 'implementer',
      model: model || 'deepseek-pro', fallback_model: fallbackModel || null,
      tools: tools || [], max_tokens: maxTokens || 4096, created_at: Date.now(),
    }
    if (!db.data.members) db.data.members = []
    db.data.members.push(member)
    saveJson()
    return member
  }

  db.prepare(`INSERT INTO team_members (id, team_id, name, role, model, fallback_model, tools, max_tokens) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, teamId, name, role || 'implementer', model || 'deepseek-pro', fallbackModel || null, JSON.stringify(tools || []), maxTokens || 4096)
  return getMember(id)
}

function getMember(id) {
  if (db?.type === 'json') {
    return db.data.members?.find(m => m.id === id) || null
  }
  const m = db.prepare('SELECT * FROM team_members WHERE id = ?').get(id)
  if (m) m.tools = JSON.parse(m.tools || '[]')
  return m || null
}

function removeMember(id) {
  if (db?.type === 'json') {
    db.data.members = (db.data.members || []).filter(m => m.id !== id)
    saveJson()
    return true
  }
  db.prepare('DELETE FROM team_members WHERE id = ?').run(id)
  return true
}

function updateMember(id, updates) {
  if (db?.type === 'json') {
    const m = db.data.members?.find(x => x.id === id)
    if (!m) return null
    Object.assign(m, updates)
    saveJson()
    return m
  }

  const sets = []
  const params = []
  for (const [key, val] of Object.entries(updates)) {
    if (key === 'tools') { sets.push(`${key} = ?`); params.push(JSON.stringify(val)) }
    else { sets.push(`${key} = ?`); params.push(val) }
  }
  if (sets.length === 0) return getMember(id)
  params.push(id)
  db.prepare(`UPDATE team_members SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return getMember(id)
}

// ── JSON 辅助 ──

function saveJson() {
  if (db?.type === 'json') {
    writeFileSync(db.path, JSON.stringify(db.data, null, 2))
  }
}

module.exports = {
  initTeamStore, createTeam, getTeam, listTeams, deleteTeam, updateTeam,
  addMember, getMember, removeMember, updateMember,
}
