const fs = require('fs');
const path = 'E:/Agent/dsh-flow-canvas/src/server/index.ts';
let src = fs.readFileSync(path, 'utf8');

// Add deep research tool
if (!src.includes("name: 'deep_research'")) {
  const researchTools = `
  // ── 自适应深度研究 (REQ-004) ──

  ctx.tools.register({
    name: 'deep_research',
    description: 'Conduct adaptive deep research on a topic with evidence tracking and marginal gain control.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Research topic' },
        scope: { type: 'string', description: 'Research scope and boundaries' },
        acceptance: { type: 'string', description: 'Acceptance criteria for the report' },
        maxRounds: { type: 'number', description: 'Maximum research rounds (default 5)' },
      },
      required: ['topic'],
    },
    output: workflowToolOutput,
    async execute(args) {
      var topic = args.topic
      var scope = args.scope || topic
      var acceptance = args.acceptance || 'Comprehensive coverage with cited sources'
      var maxRounds = args.maxRounds || 5

      // Build research plan prompt
      var planPrompt = 'Research Plan for: ' + topic + '\\n\\n' +
        'Scope: ' + scope + '\\n' +
        'Acceptance Criteria: ' + acceptance + '\\n' +
        'Max Rounds: ' + maxRounds + '\\n\\n' +
        'Execute the following adaptive research workflow:\\n' +
        '1. PLAN: Define sub-questions and information dimensions\\n' +
        '2. RESEARCH: Search for each sub-question (use web_search)\\n' +
        '3. EVALUATE: For each finding, mark as confirmed/uncertain/gap\\n' +
        '4. MARGINAL GAIN: Check if new information adds value. If zero gain, stop.\\n' +
        '5. REPEAT: If gaps remain and rounds < maxRounds, go to step 2\\n' +
        '6. SYNTHESIZE: Generate report with confidence levels and contradictions\\n\\n' +
        'Evidence states: confirmed (high confidence), uncertain (medium), gap (not found)\\n' +
        'Stop condition: Zero marginal information gain OR max rounds reached'

      return {
        ok: true,
        message: 'Deep research plan generated for: ' + topic,
        data: {
          topic: topic,
          scope: scope,
          acceptance: acceptance,
          maxRounds: maxRounds,
          planPrompt: planPrompt,
          phases: ['plan', 'research', 'evaluate', 'marginal_gain', 'synthesize'],
        },
      }
    },
  })

  // ── 工作流执行工具 (集成 workflowEngine) ──

  ctx.tools.register({
    name: 'workflow_execute',
    description: 'Execute a workflow using DSH workflowEngine with subagent orchestration.',
    parameters: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JavaScript orchestration script' },
        args: { type: 'object', description: 'Arguments to pass to the script' },
        meta: { type: 'object', description: 'Metadata for the workflow run' },
      },
      required: ['script'],
    },
    output: workflowToolOutput,
    async execute(args, execution) {
      try {
        var run = ctx.workflowEngine.start({
          script: args.script,
          args: args.args || {},
          meta: args.meta || { name: 'flow-canvas-workflow' },
          parent: execution,
          signal: execution.signal,
        })
        var result = await run.result
        return {
          ok: true,
          message: 'Workflow completed',
          data: { runId: run.id, result: result, agentsStarted: result.agentsStarted },
        }
      } catch (err) {
        return { ok: false, message: 'Workflow failed: ' + err.message }
      }
    },
  })

`;
  src = src.replace('  // 注入系统提示上下文', researchTools + '\n  // 注入系统提示上下文');
}

fs.writeFileSync(path, src);
console.log('Added deep research + workflow execute');
