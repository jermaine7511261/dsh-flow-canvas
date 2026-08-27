const fs = require('fs');
const path = 'E:/Agent/dsh-flow-canvas/src/server/index.ts';
let src = fs.readFileSync(path, 'utf8');

// Add evidence gate tools before system prompt
if (!src.includes("name: 'evidence_check'")) {
  const evidenceTools = `
  // ── 证据优先门控 (REQ-003) ──

  var EVIDENCE_RULES = [
    { pattern: /i remember|from memory|我记得|从记忆/i, required: 'memory_search', evidenceType: 'memory' },
    { pattern: /plan is ready|计划就绪|plan complete/i, required: 'todo_write', evidenceType: 'plan' },
    { pattern: /test passed|测试通过|test ok|all tests/i, required: 'tool_output', evidenceType: 'test' },
    { pattern: /release safe|发布安全|deploy safe/i, required: 'verification_report', evidenceType: 'release' },
    { pattern: /code review|代码审查|review complete/i, required: 'review_output', evidenceType: 'review' },
  ]

  ctx.tools.register({
    name: 'evidence_check',
    description: 'Check if recent claims have supporting evidence. Use when you need to verify assertions before making them.',
    parameters: {
      type: 'object',
      properties: {
        claim: { type: 'string', description: 'The claim to check for evidence' },
        recentTools: { type: 'array', items: { type: 'string' }, description: 'Recent tool calls made' },
      },
      required: ['claim'],
    },
    output: workflowToolOutput,
    async execute(args) {
      var claim = args.claim || ''
      var recentTools = args.recentTools || []
      var violations = []

      for (var i = 0; i < EVIDENCE_RULES.length; i++) {
        var rule = EVIDENCE_RULES[i]
        if (rule.pattern.test(claim)) {
          var hasEvidence = recentTools.some(function(t) { return t.includes(rule.required) || t.includes(rule.evidenceType) })
          if (!hasEvidence) {
            violations.push({
              rule: rule.evidenceType,
              required: rule.required,
              message: 'Claim requires ' + rule.required + ' evidence but none found in recent tool calls',
            })
          }
        }
      }

      if (violations.length > 0) {
        return {
          ok: false,
          message: 'Evidence gate BLOCKED: ' + violations.length + ' violation(s)',
          data: { blocked: true, violations: violations, suggestion: 'Please provide evidence before making this claim.' },
        }
      }

      return {
        ok: true,
        message: 'Evidence check passed',
        data: { blocked: false, claim: claim },
      }
    },
  })

`;
  src = src.replace('  // 注入系统提示上下文', evidenceTools + '\n  // 注入系统提示上下文');
}

fs.writeFileSync(path, src);
console.log('Added evidence gate');
