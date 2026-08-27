const fs = require('fs');
const path = 'E:/Agent/dsh-flow-canvas/src/server/index.ts';
let src = fs.readFileSync(path, 'utf8');

// Add verified ralph tool
if (!src.includes("name: 'verified_ralph'")) {
  const ralphTools = `
  // ── 验证器门控 Ralph (REQ-005) ──

  ctx.tools.register({
    name: 'verified_ralph',
    description: 'Execute a task with independent verifier scoring. Each round is verified before proceeding.',
    parameters: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description' },
        provider: { type: 'string', description: 'Subagent provider for execution' },
        verifier: { type: 'string', description: 'Verifier provider (defaults to same as executor)' },
        maxRounds: { type: 'number', description: 'Maximum rounds (default 5)' },
        passThreshold: { type: 'number', description: 'Score threshold to pass (0-100, default 80)' },
      },
      required: ['task'],
    },
    output: workflowToolOutput,
    async execute(args) {
      var task = args.task
      var provider = args.provider || 'default'
      var verifier = args.verifier || provider
      var maxRounds = args.maxRounds || 5
      var threshold = args.passThreshold || 80

      var prompt = 'Verified Ralph Execution Plan:\\n\\n' +
        'Task: ' + task + '\\n' +
        'Max Rounds: ' + maxRounds + '\\n' +
        'Pass Threshold: ' + threshold + '/100\\n\\n' +
        'Execution Loop:\\n' +
        '1. EXECUTE: Agent works on the task (subagent start)\\n' +
        '2. VERIFY: Independent verifier scores completion (0-100)\\n' +
        '3. DECIDE:\\n' +
        '   - Score >= ' + threshold + ': COMPLETE (task done)\\n' +
        '   - Score < ' + threshold + ' AND rounds < ' + maxRounds + ': CONTINUE (give feedback to agent)\\n' +
        '   - Score < ' + threshold + ' AND rounds >= ' + maxRounds + ': BLOCKED (max rounds reached)\\n' +
        '4. RECORD: Log round number, score, and verifier feedback\\n\\n' +
        'Verifier must be INDEPENDENT from the executor to avoid self-assessment bias.'

      return {
        ok: true,
        message: 'Verified Ralph plan generated',
        data: {
          task: task,
          executor: provider,
          verifier: verifier,
          maxRounds: maxRounds,
          passThreshold: threshold,
          planPrompt: prompt,
        },
      }
    },
  })

`;
  src = src.replace('  // 注入系统提示上下文', ralphTools + '\n  // 注入系统提示上下文');
}

fs.writeFileSync(path, src);
console.log('Added verified ralph');
