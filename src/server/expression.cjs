/**
 * dsh-flow-canvas — Expression language (dsh.expr@1).
 * 确定性 JSON 数据变换，不使用 eval。
 */

const OPERATORS = {
  // 比较
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),

  // 逻辑
  and: (...args) => args.every(Boolean),
  or: (...args) => args.some(Boolean),
  not: (a) => !Boolean(a),
  truthy: (a) => Boolean(a),
  falsy: (a) => !Boolean(a),

  // 字符串
  contains: (a, b) => String(a).includes(String(b)),
  startsWith: (a, b) => String(a).startsWith(String(b)),
  endsWith: (a, b) => String(a).endsWith(String(b)),
  length: (a) => String(a).length,
  upper: (a) => String(a).toUpperCase(),
  lower: (a) => String(a).toLowerCase(),
  trim: (a) => String(a).trim(),
  concat: (...args) => args.map(String).join(''),

  // 数学
  add: (...args) => args.reduce((s, n) => s + Number(n), 0),
  sub: (a, b) => Number(a) - Number(b),
  mul: (...args) => args.reduce((s, n) => s * Number(n), 1),
  div: (a, b) => Number(a) / Number(b),
  mod: (a, b) => Number(a) % Number(b),
  min: (...args) => Math.min(...args.map(Number)),
  max: (...args) => Math.max(...args.map(Number)),
  abs: (a) => Math.abs(Number(a)),
  round: (a) => Math.round(Number(a)),

  // 集合
  first: (a) => Array.isArray(a) ? a[0] : a,
  last: (a) => Array.isArray(a) ? a[a.length - 1] : a,
  flatten: (a) => Array.isArray(a) ? a.flat() : [a],
  unique: (a) => Array.isArray(a) ? [...new Set(a)] : [a],
  sort: (a) => Array.isArray(a) ? [...a].sort() : [a],
  reverse: (a) => Array.isArray(a) ? [...a].reverse() : [a],
  sum: (a) => Array.isArray(a) ? a.reduce((s, n) => s + Number(n), 0) : Number(a),
  count: (a) => Array.isArray(a) ? a.length : 1,
  map: (a, key) => Array.isArray(a) ? a.map(item => item[key]) : [],

  // 类型
  type: (a) => Array.isArray(a) ? 'array' : typeof a,
  isNull: (a) => a === null || a === undefined,
  isNumber: (a) => typeof a === 'number' && !isNaN(a),
  isString: (a) => typeof a === 'string',
  isArray: (a) => Array.isArray(a),

  // 变量引用
  var: (name, ctx) => ctx && ctx[name] !== undefined ? ctx[name] : null,
  input: (name, ctx) => ctx && ctx._inputs && ctx._inputs[name] !== undefined ? ctx._inputs[name] : null,
}

/**
 * 解析表达式
 * 格式: (operator arg1 arg2 ...) 或 { op: operator, args: [...] }
 */
function parseExpression(expr, context) {
  if (expr === null || expr === undefined) return expr

  // 纯值
  if (typeof expr === 'string' && !expr.startsWith('(') && !expr.startsWith('{')) {
    return expr
  }

  // 对象格式: { op: 'add', args: [1, 2] }
  if (typeof expr === 'object' && expr.op) {
    const op = OPERATORS[expr.op]
    if (!op) throw new Error('Unknown operator: ' + expr.op)
    const args = (expr.args || []).map(a => parseExpression(a, context))
    return op(...args, context)
  }

  // 数组格式: ['add', 1, 2]
  if (Array.isArray(expr) && typeof expr[0] === 'string') {
    const op = OPERATORS[expr[0]]
    if (!op) throw new Error('Unknown operator: ' + expr[0])
    const args = expr.slice(1).map(a => parseExpression(a, context))
    return op(...args, context)
  }

  // 字符串表达式: "(add 1 2)"
  if (typeof expr === 'string' && expr.startsWith('(') && expr.endsWith(')')) {
    const inner = expr.slice(1, -1).trim()
    const tokens = tokenize(inner)
    if (tokens.length === 0) return null

    const opName = tokens[0]
    const op = OPERATORS[opName]
    if (!op) throw new Error('Unknown operator: ' + opName)

    const args = tokens.slice(1).map(t => parseToken(t, context))
    return op(...args, context)
  }

  return expr
}

function tokenize(str) {
  const tokens = []
  let current = ''
  let inString = false
  let parenDepth = 0

  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === '"' || ch === "'") {
      inString = !inString
      current += ch
    } else if (ch === '(' && !inString) {
      parenDepth++
      current += ch
    } else if (ch === ')' && !inString) {
      parenDepth--
      current += ch
    } else if (ch === ' ' && !inString && parenDepth === 0) {
      if (current) { tokens.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) tokens.push(current)
  return tokens
}

function parseToken(token, context) {
  if (token.startsWith('"') && token.endsWith('"')) return token.slice(1, -1)
  if (token.startsWith("'") && token.endsWith("'")) return token.slice(1, -1)
  if (token === 'true') return true
  if (token === 'false') return false
  if (token === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token)
  if (token.startsWith('(')) return parseExpression(token, context)
  // Variable reference
  if (context && context[token] !== undefined) return context[token]
  return token
}

function evaluateWorkflowExpression(expr, inputs) {
  return parseExpression(expr, { _inputs: inputs || {}, ...inputs })
}

module.exports = { parseExpression, evaluateWorkflowExpression, OPERATORS }
