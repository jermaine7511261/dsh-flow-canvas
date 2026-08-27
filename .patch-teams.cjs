const fs = require('fs');
const path = 'E:/Agent/dsh-flow-canvas/src/server/index.ts';
let src = fs.readFileSync(path, 'utf8');

// 1) Add teamStore import
if (!src.includes("require('./teamStore.cjs')")) {
  src = src.replace(
    "const taskLedger = require('./taskLedger.cjs')",
    "const taskLedger = require('./taskLedger.cjs')\nconst teamStore = require('./teamStore.cjs')"
  );
}

// 2) Add teamStore init
if (!src.includes('teamStore.initTeamStore')) {
  src = src.replace(
    "console.log(`[dsh-flow-canvas] Task ledger: ${taskDb.type}`)",
    "console.log(`[dsh-flow-canvas] Task ledger: ${taskDb.type}`)\n\n  // Initialize team store\n  const teamDb = teamStore.initTeamStore(storagePath)\n  console.log(`[dsh-flow-canvas] Team store: ${teamDb.type || 'json'}`)"
  );
}

// 3) Add 4 team tools
if (!src.includes("name: 'team_create'")) {
  const teamTools = `
  // ── 4 个团队工具 (REQ-001) ──

  ctx.tools.register({
    name: 'team_create',
    description: 'Create a multi-model agent team.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Team name' },
        description: { type: 'string', description: 'Team description' },
        leadId: { type: 'string', description: 'Lead member ID (set after adding members)' },
        mode: { type: 'string', enum: ['team', 'solo', 'inherited'], description: 'Team mode' },
      },
      required: ['name'],
    },
    output: workflowToolOutput,
    async execute(args) {
      var team = teamStore.createTeam(args)
      return { ok: true, message: 'Team created: ' + team.id, data: { team: team } }
    },
  })

  ctx.tools.register({
    name: 'team_add_member',
    description: 'Add a member to a team.',
    parameters: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
        name: { type: 'string', description: 'Member name' },
        role: { type: 'string', enum: ['planner', 'implementer', 'reviewer', 'specialist'], description: 'Member role' },
        model: { type: 'string', description: 'Model to use (e.g. deepseek-pro, deepseek-chat)' },
        tools: { type: 'array', items: { type: 'string' }, description: 'Allowed tools' },
      },
      required: ['teamId', 'name'],
    },
    output: workflowToolOutput,
    async execute(args) {
      var member = teamStore.addMember(args.teamId, {
        name: args.name, role: args.role, model: args.model, tools: args.tools,
      })
      return { ok: true, message: 'Member added: ' + member.name + ' (' + member.role + ')', data: { member: member } }
    },
  })

  ctx.tools.register({
    name: 'team_list',
    description: 'List all teams with their members.',
    parameters: { type: 'object', properties: {} },
    output: workflowToolOutput,
    async execute() {
      var teams = teamStore.listTeams()
      var detailed = teams.map(function(t) { return teamStore.getTeam(t.id) })
      return { ok: true, message: 'Found ' + teams.length + ' teams', data: { teams: detailed } }
    },
  })

  ctx.tools.register({
    name: 'team_run',
    description: 'Execute a task using a team. The lead agent plans and delegates to members.',
    parameters: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID' },
        task: { type: 'string', description: 'Task description for the team' },
      },
      required: ['teamId', 'task'],
    },
    output: workflowToolOutput,
    async execute(args) {
      var team = teamStore.getTeam(args.teamId)
      if (!team) return { ok: false, message: 'Team not found: ' + args.teamId }
      if (!team.members || team.members.length === 0) return { ok: false, message: 'Team has no members' }

      // Build team prompt with member info
      var memberInfo = team.members.map(function(m) {
        return '- ' + m.name + ' (' + m.role + ', model: ' + m.model + ', tools: ' + (m.tools || []).join(',') + ')'
      }).join('\\n')

      var leadPrompt = 'You are the lead of team \"' + team.name + '\".\\n\\n' +
        'Team members:\\n' + memberInfo + '\\n\\n' +
        'Task: ' + args.task + '\\n\\n' +
        'Plan the work and delegate to appropriate members. For each member, specify what they should do.'

      return {
        ok: true,
        message: 'Team \"' + team.name + '\" task ready (' + team.members.length + ' members)',
        data: {
          teamId: team.id,
          teamName: team.name,
          memberCount: team.members.length,
          leadPrompt: leadPrompt,
          members: team.members.map(function(m) { return { name: m.name, role: m.role, model: m.model } }),
        },
      }
    },
  })

`;
  src = src.replace('  // 注入系统提示上下文', teamTools + '\n  // 注入系统提示上下文');
  console.log('Added 4 team tools');
}

fs.writeFileSync(path, src);
console.log('Done');
