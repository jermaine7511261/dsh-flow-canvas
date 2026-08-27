const fs = require('fs');
const path = 'E:/Agent/dsh-flow-canvas/src/server/index.ts';
let src = fs.readFileSync(path, 'utf8');

// 1) Add taskLedger import
if (!src.includes("require('./taskLedger.cjs')")) {
  src = src.replace(
    "const converter = require('./converter.cjs')",
    "const converter = require('./converter.cjs')\nconst taskLedger = require('./taskLedger.cjs')"
  );
  console.log('Added taskLedger import');
}

// 2) Add taskLedger init
if (!src.includes('taskLedger.initTaskLedger')) {
  src = src.replace(
    "console.log(`[dsh-flow-canvas] Database: ${db.type}`)",
    "console.log(`[dsh-flow-canvas] Database: ${db.type}`)\n\n  // Initialize task ledger\n  const taskDb = taskLedger.initTaskLedger(storagePath)\n  console.log(`[dsh-flow-canvas] Task ledger: ${taskDb.type}`)\n\n  // Crash recovery: check for recoverable tasks\n  const recoverable = taskLedger.getRecoverableTasks()\n  if (recoverable.length > 0) {\n    console.log(`[dsh-flow-canvas] Found ${recoverable.length} recoverable tasks`)\n  }"
  );
  console.log('Added taskLedger init');
}

// 3) Add 5 task tools before system prompt
if (!src.includes("name: 'task_create'")) {
  const taskTools = `
  // ── 5 个任务账本工具 (REQ-002) ──

  ctx.tools.register({
    name: 'task_create',
    description: 'Create a new task in the task ledger.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        description: { type: 'string', description: 'Task description' },
        assignee: { type: 'string', description: 'Assignee name' },
        reviewer: { type: 'string', description: 'Reviewer name' },
        priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'], description: 'Priority' },
      },
      required: ['title'],
    },
    output: workflowToolOutput,
    async execute(args) {
      const task = taskLedger.createTask(args)
      return { ok: true, message: 'Task created: ' + task.id, data: { task } }
    },
  })

  ctx.tools.register({
    name: 'task_assign',
    description: 'Assign a task to a team member.',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        assignee: { type: 'string' },
      },
      required: ['task_id', 'assignee'],
    },
    output: workflowToolOutput,
    async execute(args) {
      taskLedger.transitionTask(args.task_id, 'assigned')
      taskLedger.updateTask(args.task_id, { assignee: args.assignee })
      return { ok: true, message: 'Task ' + args.task_id + ' assigned to ' + args.assignee }
    },
  })

  ctx.tools.register({
    name: 'task_review',
    description: 'Submit or complete a task review.',
    parameters: {
      type: 'object',
      properties: {
        task_id: { type: 'string' },
        action: { type: 'string', enum: ['submit', 'approve', 'reject'] },
        reviewer: { type: 'string' },
        score: { type: 'number' },
        comments: { type: 'array', items: { type: 'string' } },
      },
      required: ['task_id', 'action'],
    },
    output: workflowToolOutput,
    async execute(args) {
      if (args.action === 'submit') {
        taskLedger.transitionTask(args.task_id, 'review')
        taskLedger.createReview(args.task_id, args.reviewer || 'agent')
        return { ok: true, message: 'Task ' + args.task_id + ' submitted for review' }
      }
      var reviews = taskLedger.getTaskReviews(args.task_id)
      var pending = reviews.find(function(r) { return r.status === 'pending' })
      if (!pending) return { ok: false, message: 'No pending review found' }
      taskLedger.completeReview(pending.id, args.action === 'approve' ? 'approved' : 'rejected', args.score, args.comments)
      if (args.action === 'approve') {
        taskLedger.transitionTask(args.task_id, 'completed')
        return { ok: true, message: 'Task ' + args.task_id + ' approved and completed' }
      } else {
        taskLedger.transitionTask(args.task_id, 'in_progress')
        return { ok: true, message: 'Task ' + args.task_id + ' rejected, returned to in_progress' }
      }
    },
  })

  ctx.tools.register({
    name: 'task_complete',
    description: 'Mark a task as completed.',
    parameters: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] },
    output: workflowToolOutput,
    async execute(args) {
      taskLedger.transitionTask(args.task_id, 'completed')
      return { ok: true, message: 'Task ' + args.task_id + ' completed' }
    },
  })

  ctx.tools.register({
    name: 'task_list',
    description: 'List tasks with optional filters.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        assignee: { type: 'string' },
        limit: { type: 'number' },
      },
    },
    output: workflowToolOutput,
    async execute(args) {
      var tasks = taskLedger.listTasks(args)
      var stats = taskLedger.getStats()
      return { ok: true, message: 'Found ' + tasks.length + ' tasks', data: { tasks: tasks, stats: stats } }
    },
  })

`;
  src = src.replace('  // 注入系统提示上下文', taskTools + '\n  // 注入系统提示上下文');
  console.log('Added 5 task tools');
}

fs.writeFileSync(path, src);
console.log('Done');
