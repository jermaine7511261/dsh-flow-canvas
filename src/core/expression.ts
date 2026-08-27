/**
 * dsh-flow-canvas — Deterministic Expression DSL.
 *
 * A safe, eval-free expression language that replaces new Function() / eval.
 * Implements a custom tokenizer + recursive descent parser.
 *
 * Supported:
 *   - Literals: numbers, strings, booleans, null, arrays, objects
 *   - Arithmetic: +, -, *, /, %
 *   - Comparison: ==, !=, >, <, >=, <=
 *   - Logical: &&, ||, !
 *   - Member access: obj.key, obj["key"], arr[index]
 *   - Function calls: fn(args...)
 *   - Ternary: cond ? a : b
 *   - Variable binding via context: name -> value
 *   - Built-in functions: len, upper, lower, trim, join, split, keys, values,
 *     get, sum, min, max, unique, sort, filter, map, typeof, toString, toNumber,
 *     contains, startsWith, endsWith, replace, slice, concat, push
 *
 * Operand count is capped at 10 000 to prevent resource abuse.
 *
 * @module dsh-flow-canvas/expression
 */

// ── Token Types ──────────────────────────────────────────────────────────────

const TT = {
  // Literals
  Number: 0,
  String: 1,
  True: 2,
  False: 3,
  Null: 4,
  // Identifiers & keywords
  Ident: 5,
  // Punctuation
  LParen: 6,
  RParen: 7,
  LBracket: 8,
  RBracket: 9,
  LBrace: 10,
  RBrace: 11,
  Colon: 12,
  Comma: 13,
  Dot: 14,
  Question: 15,
  // Operators
  Plus: 16,
  Minus: 17,
  Star: 18,
  Slash: 19,
  Percent: 20,
  Eq: 21,
  Neq: 22,
  Gt: 23,
  Lt: 24,
  Gte: 25,
  Lte: 26,
  And: 27,
  Or: 28,
  Not: 29,
  // Special
  Eof: 30,
} as const

type TT = typeof TT[keyof typeof TT]

interface Token {
  type: TT
  value: string
  pos: number
}

// ── Tokenizer ────────────────────────────────────────────────────────────────

class Tokenizer {
  private src: string
  private pos = 0

  constructor(src: string) {
    this.src = src
  }

  /** Produce the next token (skipping whitespace & comments). */
  next(): Token {
    this.skipWhitespaceAndComments()
    if (this.pos >= this.src.length) return this.make(TT.Eof, '')

    const ch = this.src[this.pos]
    const start = this.pos

    // --- Strings ---
    if (ch === '"' || ch === "'") return this.readString()
    if (ch === '`') return this.readTemplate()

    // --- Numbers ---
    if (this.isDigit(ch) || (ch === '.' && this.peekIsDigit())) return this.readNumber()

    // --- Identifiers / keywords ---
    if (this.isIdentStart(ch)) return this.readIdent()

    // --- Two-char operators ---
    if (this.pos + 1 < this.src.length) {
      const two = this.src.slice(this.pos, this.pos + 2)
      if (two === '==') { this.pos += 2; return this.make(TT.Eq, two) }
      if (two === '!=') { this.pos += 2; return this.make(TT.Neq, two) }
      if (two === '>=') { this.pos += 2; return this.make(TT.Gte, two) }
      if (two === '<=') { this.pos += 2; return this.make(TT.Lte, two) }
      if (two === '&&') { this.pos += 2; return this.make(TT.And, two) }
      if (two === '||') { this.pos += 2; return this.make(TT.Or, two) }
    }

    // --- Single-char operators / punctuation ---
    this.pos++
    switch (ch) {
      case '+': return this.make(TT.Plus, ch)
      case '-': return this.make(TT.Minus, ch)
      case '*': return this.make(TT.Star, ch)
      case '/': return this.make(TT.Slash, ch)
      case '%': return this.make(TT.Percent, ch)
      case '>': return this.make(TT.Gt, ch)
      case '<': return this.make(TT.Lt, ch)
      case '!': return this.make(TT.Not, ch)
      case '(': return this.make(TT.LParen, ch)
      case ')': return this.make(TT.RParen, ch)
      case '[': return this.make(TT.LBracket, ch)
      case ']': return this.make(TT.RBracket, ch)
      case '{': return this.make(TT.LBrace, ch)
      case '}': return this.make(TT.RBrace, ch)
      case ':': return this.make(TT.Colon, ch)
      case ',': return this.make(TT.Comma, ch)
      case '.': return this.make(TT.Dot, ch)
      case '?': return this.make(TT.Question, ch)
      default:
        throw new ExpressionError(`Unexpected character '${ch}' at position ${start}`)
    }
  }

  /** Peek at the next token without consuming it. */
  peek(): Token {
    const saved = this.pos
    const tok = this.next()
    this.pos = saved
    return tok
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private make(type: TT, value: string): Token {
    return { type, value, pos: this.pos - value.length }
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.src.length) {
      const ch = this.src[this.pos]
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.pos++
      } else if (ch === '/' && this.pos + 1 < this.src.length && this.src[this.pos + 1] === '/') {
        // Line comment
        while (this.pos < this.src.length && this.src[this.pos] !== '\n') this.pos++
      } else if (ch === '/' && this.pos + 1 < this.src.length && this.src[this.pos + 1] === '*') {
        // Block comment
        this.pos += 2
        while (this.pos + 1 < this.src.length && !(this.src[this.pos] === '*' && this.src[this.pos + 1] === '/')) this.pos++
        this.pos += 2
      } else {
        break
      }
    }
  }

  private readString(): Token {
    const quote = this.src[this.pos]
    this.pos++ // skip opening quote
    let val = ''
    while (this.pos < this.src.length && this.src[this.pos] !== quote) {
      if (this.src[this.pos] === '\\') {
        this.pos++
        if (this.pos >= this.src.length) throw new ExpressionError('Unterminated string escape')
        const esc = this.src[this.pos]
        switch (esc) {
          case 'n': val += '\n'; break
          case 't': val += '\t'; break
          case 'r': val += '\r'; break
          case '\\': val += '\\'; break
          case "'": val += "'"; break
          case '"': val += '"'; break
          default: val += esc; break
        }
      } else {
        val += this.src[this.pos]
      }
      this.pos++
    }
    if (this.pos >= this.src.length) throw new ExpressionError('Unterminated string literal')
    this.pos++ // skip closing quote
    return this.make(TT.String, val)
  }

  private readTemplate(): Token {
    this.pos++ // skip opening backtick
    let val = ''
    while (this.pos < this.src.length && this.src[this.pos] !== '`') {
      if (this.src[this.pos] === '\\') {
        this.pos++
        if (this.pos < this.src.length) {
          const esc = this.src[this.pos]
          switch (esc) {
            case 'n': val += '\n'; break
            case 't': val += '\t'; break
            case 'r': val += '\r'; break
            case '\\': val += '\\'; break
            case '`': val += '`'; break
            default: val += esc; break
          }
        }
      } else {
        val += this.src[this.pos]
      }
      this.pos++
    }
    if (this.pos >= this.src.length) throw new ExpressionError('Unterminated template literal')
    this.pos++ // skip closing backtick
    return this.make(TT.String, val)
  }

  private readNumber(): Token {
    const start = this.pos
    while (this.pos < this.src.length && (this.isDigit(this.src[this.pos]) || this.src[this.pos] === '.')) this.pos++
    // Handle scientific notation: 1e10, 1E-5
    if (this.pos < this.src.length && (this.src[this.pos] === 'e' || this.src[this.pos] === 'E')) {
      this.pos++
      if (this.pos < this.src.length && (this.src[this.pos] === '+' || this.src[this.pos] === '-')) this.pos++
      while (this.pos < this.src.length && this.isDigit(this.src[this.pos])) this.pos++
    }
    const raw = this.src.slice(start, this.pos)
    const num = Number(raw)
    if (isNaN(num)) throw new ExpressionError(`Invalid number '${raw}' at position ${start}`)
    return this.make(TT.Number, raw)
  }

  private readIdent(): Token {
    const start = this.pos
    while (this.pos < this.src.length && this.isIdentPart(this.src[this.pos])) this.pos++
    const word = this.src.slice(start, this.pos)
    switch (word) {
      case 'true': return this.make(TT.True, word)
      case 'false': return this.make(TT.False, word)
      case 'null': return this.make(TT.Null, word)
      default: return this.make(TT.Ident, word)
    }
  }

  private peekIsDigit(): boolean {
    return this.pos + 1 < this.src.length && this.isDigit(this.src[this.pos + 1])
  }

  private isDigit(ch: string): boolean { return ch >= '0' && ch <= '9' }
  private isIdentStart(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$'
  }
  private isIdentPart(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch)
  }
}

// ── Error ────────────────────────────────────────────────────────────────────

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExpressionError'
  }
}

// ── AST Node Types ───────────────────────────────────────────────────────────

type AstNode =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  | { kind: 'identifier'; name: string }
  | { kind: 'array'; elements: AstNode[] }
  | { kind: 'object'; entries: [AstNode, AstNode][] }
  | { kind: 'unary'; op: string; operand: AstNode }
  | { kind: 'binary'; op: string; left: AstNode; right: AstNode }
  | { kind: 'ternary'; condition: AstNode; consequent: AstNode; alternate: AstNode }
  | { kind: 'member'; object: AstNode; property: AstNode; computed: boolean }
  | { kind: 'call'; callee: AstNode; args: AstNode[] }

// ── Parser (Recursive Descent) ──────────────────────────────────────────────

class Parser {
  private tokens: Tokenizer
  private current: Token
  private operandCount = 0
  private readonly maxOperands: number

  constructor(src: string, maxOperands = 10000) {
    this.tokens = new Tokenizer(src)
    this.maxOperands = maxOperands
    this.current = this.tokens.next()
  }

  /** Entry point — parse the entire expression and expect EOF. */
  parse(): AstNode {
    const node = this.parseExpression()
    if (this.current.type !== TT.Eof) {
      throw new ExpressionError(`Unexpected token '${this.current.value}' at position ${this.current.pos}`)
    }
    return node
  }

  // Grammar (precedence low → high):
  //   expression  → ternary
  //   ternary     → logicOr ('?' expression ':' expression)?
  //   logicOr     → logicAnd ('||' logicAnd)*
  //   logicAnd    → equality ('&&' equality)*
  //   equality    → comparison (('==' | '!=') comparison)*
  //   comparison  → addition (('<' | '>' | '<=' | '>=') addition)*
  //   addition    → multiply (('+' | '-') multiply)*
  //   multiply    → unary (('*' | '/' | '%') unary)*
  //   unary       → ('-' | '!' | '+') unary | call
  //   call        → primary ( '(' args? ')' | '.' ident | '[' expression ']' )*
  //   primary     → number | string | bool | null | ident | array | object | '(' expression ')'

  private parseExpression(): AstNode {
    return this.parseTernary()
  }

  private parseTernary(): AstNode {
    let node = this.parseLogicOr()
    if (this.current.type === TT.Question) {
      this.advance()
      const consequent = this.parseExpression()
      this.expect(TT.Colon)
      const alternate = this.parseExpression()
      node = { kind: 'ternary', condition: node, consequent, alternate }
    }
    return node
  }

  private parseLogicOr(): AstNode {
    let left = this.parseLogicAnd()
    while (this.current.type === TT.Or) {
      this.advance()
      const right = this.parseLogicAnd()
      left = { kind: 'binary', op: '||', left, right }
    }
    return left
  }

  private parseLogicAnd(): AstNode {
    let left = this.parseEquality()
    while (this.current.type === TT.And) {
      this.advance()
      const right = this.parseEquality()
      left = { kind: 'binary', op: '&&', left, right }
    }
    return left
  }

  private parseEquality(): AstNode {
    let left = this.parseComparison()
    while (this.current.type === TT.Eq || this.current.type === TT.Neq) {
      const op = this.current.value
      this.advance()
      const right = this.parseComparison()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseComparison(): AstNode {
    let left = this.parseAddition()
    while (
      this.current.type === TT.Gt || this.current.type === TT.Lt ||
      this.current.type === TT.Gte || this.current.type === TT.Lte
    ) {
      const op = this.current.value
      this.advance()
      const right = this.parseAddition()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseAddition(): AstNode {
    let left = this.parseMultiply()
    while (this.current.type === TT.Plus || this.current.type === TT.Minus) {
      const op = this.current.value
      this.advance()
      const right = this.parseMultiply()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseMultiply(): AstNode {
    let left = this.parseUnary()
    while (
      this.current.type === TT.Star || this.current.type === TT.Slash || this.current.type === TT.Percent
    ) {
      const op = this.current.value
      this.advance()
      const right = this.parseUnary()
      left = { kind: 'binary', op, left, right }
    }
    return left
  }

  private parseUnary(): AstNode {
    if (this.current.type === TT.Minus) {
      this.advance()
      const operand = this.parseUnary()
      this.countOperand()
      return { kind: 'unary', op: '-', operand }
    }
    if (this.current.type === TT.Not) {
      this.advance()
      const operand = this.parseUnary()
      this.countOperand()
      return { kind: 'unary', op: '!', operand }
    }
    if (this.current.type === TT.Plus) {
      this.advance()
      return this.parseUnary()
    }
    return this.parseCall()
  }

  private parseCall(): AstNode {
    let node = this.parsePrimary()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.current.type === TT.LParen) {
        // Function call
        this.advance()
        const args: AstNode[] = []
        if (this.current.type !== TT.RParen) {
          args.push(this.parseExpression())
          while (this.current.type === TT.Comma) {
            this.advance()
            args.push(this.parseExpression())
          }
        }
        this.expect(TT.RParen)
        node = { kind: 'call', callee: node, args }
      } else if (this.current.type === TT.Dot) {
        this.advance()
        const propName = this.expect(TT.Ident)
        node = { kind: 'member', object: node, property: { kind: 'string', value: propName }, computed: false }
      } else if (this.current.type === TT.LBracket) {
        this.advance()
        const prop = this.parseExpression()
        this.expect(TT.RBracket)
        node = { kind: 'member', object: node, property: prop, computed: true }
      } else {
        break
      }
    }
    return node
  }

  private parsePrimary(): AstNode {
    const tok = this.current

    if (tok.type === TT.Number) {
      this.advance()
      this.countOperand()
      return { kind: 'number', value: Number(tok.value) }
    }

    if (tok.type === TT.String) {
      this.advance()
      this.countOperand()
      return { kind: 'string', value: tok.value }
    }

    if (tok.type === TT.True) { this.advance(); this.countOperand(); return { kind: 'boolean', value: true } }
    if (tok.type === TT.False) { this.advance(); this.countOperand(); return { kind: 'boolean', value: false } }
    if (tok.type === TT.Null) { this.advance(); this.countOperand(); return { kind: 'null' } }

    if (tok.type === TT.Ident) {
      this.advance()
      this.countOperand()
      return { kind: 'identifier', name: tok.value }
    }

    if (tok.type === TT.LBracket) {
      this.advance()
      const elements: AstNode[] = []
      if (this.current.type !== TT.RBracket) {
        elements.push(this.parseExpression())
        while (this.current.type === TT.Comma) {
          this.advance()
          if (this.current.type === TT.RBracket) break // trailing comma
          elements.push(this.parseExpression())
        }
      }
      this.expect(TT.RBracket)
      return { kind: 'array', elements }
    }

    if (tok.type === TT.LBrace) {
      this.advance()
      const entries: [AstNode, AstNode][] = []
      if (this.current.type !== TT.RBrace) {
        entries.push(this.parseObjectEntry())
        while (this.current.type === TT.Comma) {
          this.advance()
          if (this.current.type === TT.RBrace) break
          entries.push(this.parseObjectEntry())
        }
      }
      this.expect(TT.RBrace)
      return { kind: 'object', entries }
    }

    if (tok.type === TT.LParen) {
      this.advance()
      const node = this.parseExpression()
      this.expect(TT.RParen)
      return node
    }

    throw new ExpressionError(`Unexpected token '${tok.value}' at position ${tok.pos}`)
  }

  private parseObjectEntry(): [AstNode, AstNode] {
    // Allow string keys, identifier keys, or computed [expr] keys
    let key: AstNode
    if (this.current.type === TT.String) {
      key = { kind: 'string', value: this.current.value }
      this.advance()
    } else if (this.current.type === TT.Ident) {
      key = { kind: 'string', value: this.current.value }
      this.advance()
    } else if (this.current.type === TT.LBracket) {
      this.advance()
      key = this.parseExpression()
      this.expect(TT.RBracket)
    } else {
      throw new ExpressionError(`Unexpected object key '${this.current.value}'`)
    }
    this.expect(TT.Colon)
    const value = this.parseExpression()
    return [key, value]
  }

  private advance(): Token {
    const tok = this.current
    this.current = this.tokens.next()
    return tok
  }

  private expect(type: TT): string {
    if (this.current.type !== type) {
      throw new ExpressionError(`Expected token type ${type} but got '${this.current.value}' at position ${this.current.pos}`)
    }
    const val = this.current.value
    this.advance()
    return val
  }

  private countOperand(): void {
    this.operandCount++
    if (this.operandCount > this.maxOperands) {
      throw new ExpressionError(`Operand limit exceeded (max ${this.maxOperands})`)
    }
  }
}

// ── Built-in Functions ───────────────────────────────────────────────────────

type BuiltinFn = (...args: any[]) => any

function toArr(v: any): any[] {
  if (Array.isArray(v)) return v
  if (v == null) return []
  return [v]
}

function toNum(v: any): number {
  const n = Number(v)
  if (isNaN(n)) throw new ExpressionError(`Cannot convert to number: ${JSON.stringify(v)}`)
  return n
}

const BUILTINS: Record<string, BuiltinFn> = {
  // String
  len: (v: any) => {
    if (typeof v === 'string') return v.length
    if (Array.isArray(v)) return v.length
    if (v && typeof v === 'object') return Object.keys(v).length
    return String(v).length
  },
  upper: (v: any) => String(v).toUpperCase(),
  lower: (v: any) => String(v).toLowerCase(),
  trim: (v: any) => String(v).trim(),
  contains: (v: any, sub: any) => String(v).includes(String(sub)),
  startsWith: (v: any, sub: any) => String(v).startsWith(String(sub)),
  endsWith: (v: any, sub: any) => String(v).endsWith(String(sub)),
  replace: (v: any, search: any, rep: any) => String(v).split(String(search)).join(String(rep)),
  split: (v: any, sep: any) => String(v).split(String(sep)),
  join: (v: any, sep?: any) => toArr(v).join(sep != null ? String(sep) : ','),
  slice: (v: any, start: any, end?: any) => {
    const s = toArr(v)
    return end !== undefined ? s.slice(toNum(start), toNum(end)) : s.slice(toNum(start))
  },
  concat: (v: any, ...rest: any[]) => {
    const arr = toArr(v)
    for (const r of rest) arr.push(...toArr(r))
    return arr
  },
  toString: (v: any) => String(v),
  toNumber: (v: any) => toNum(v),
  typeof: (v: any) => {
    if (v === null) return 'null'
    if (Array.isArray(v)) return 'array'
    return typeof v
  },

  // Object
  keys: (v: any) => Object.keys(v ?? {}),
  values: (v: any) => Object.values(v ?? {}),
  get: (v: any, key: any) => (v != null ? v[key] : undefined),
  has: (v: any, key: any) => v != null && key in Object(v),

  // Array / collection
  sum: (v: any) => toArr(v).reduce((s, x) => s + toNum(x), 0),
  min: (v: any) => Math.min(...toArr(v).map(toNum)),
  max: (v: any) => Math.max(...toArr(v).map(toNum)),
  unique: (v: any) => [...new Set(toArr(v))],
  sort: (v: any, fn?: any) => {
    const arr = [...toArr(v)]
    if (typeof fn === 'function') {
      arr.sort(fn)
    } else {
      arr.sort((a: any, b: any) => {
        if (a < b) return -1
        if (a > b) return 1
        return 0
      })
    }
    return arr
  },
  filter: (v: any, fn: any) => {
    if (typeof fn === 'function') return toArr(v).filter(fn)
    // If fn is a string expression, evaluate as predicate (truthy check)
    return toArr(v).filter((item) => Boolean(fn))
  },
  map: (v: any, fn: any) => {
    if (typeof fn === 'function') return toArr(v).map(fn)
    return toArr(v).map(() => fn)
  },
  find: (v: any, fn: any) => {
    if (typeof fn === 'function') return toArr(v).find(fn)
    return toArr(v)[0]
  },
  flatMap: (v: any, fn: any) => {
    if (typeof fn === 'function') return toArr(v).flatMap(fn)
    return toArr(v)
  },
  reduce: (v: any, fn: any, init?: any) => {
    const arr = toArr(v)
    if (typeof fn !== 'function') throw new ExpressionError('reduce requires a function argument')
    return init !== undefined ? arr.reduce(fn, init) : arr.reduce(fn)
  },
  range: (a: number, b?: number, step?: number) => {
    const start = b !== undefined ? toNum(a) : 0
    const end = b !== undefined ? toNum(b) : toNum(a)
    const s = step != null ? toNum(step) : (start <= end ? 1 : -1)
    const result: number[] = []
    for (let i = start; s > 0 ? i < end : i > end; i += s) result.push(i)
    return result
  },
  push: (v: any, ...items: any[]) => {
    const arr = [...toArr(v)]
    arr.push(...items)
    return arr
  },
  merge: (v: any, ...rest: any[]) => {
    const obj = { ...(v ?? {}) }
    for (const r of rest) Object.assign(obj, r ?? {})
    return obj
  },
  pick: (v: any, ...keys: any[]) => {
    const obj: Record<string, any> = {}
    for (const k of keys) {
      const str = String(k)
      if (v != null && str in Object(v)) obj[str] = v[str]
    }
    return obj
  },
  omit: (v: any, ...keys: any[]) => {
    const obj: Record<string, any> = { ...(v ?? {}) }
    for (const k of keys) delete obj[String(k)]
    return obj
  },
  isEmpty: (v: any) => {
    if (v == null) return true
    if (typeof v === 'string' || Array.isArray(v)) return v.length === 0
    return Object.keys(v).length === 0
  },
  default: (v: any, def: any) => (v != null && v !== '' ? v : def),
  number: (v: any) => toNum(v),
  string: (v: any) => String(v),
  bool: (v: any) => Boolean(v),
  clamp: (v: any, lo: any, hi: any) => Math.min(Math.max(toNum(v), toNum(lo)), toNum(hi)),
  round: (v: any) => Math.round(toNum(v)),
  floor: (v: any) => Math.floor(toNum(v)),
  ceil: (v: any) => Math.ceil(toNum(v)),
  abs: (v: any) => Math.abs(toNum(v)),
}

// ── Evaluator (AST interpreter) ─────────────────────────────────────────────

class Evaluator {
  private context: Record<string, any>

  constructor(context: Record<string, any>) {
    this.context = context
  }

  eval(node: AstNode): any {
    switch (node.kind) {
      case 'number': return node.value
      case 'string': return node.value
      case 'boolean': return node.value
      case 'null': return null
      case 'identifier': {
        if (Object.prototype.hasOwnProperty.call(this.context, node.name)) return this.context[node.name]
        if (Object.prototype.hasOwnProperty.call(BUILTINS, node.name)) return BUILTINS[node.name]
        throw new ExpressionError(`Undefined variable '${node.name}'`)
      }
      case 'unary': {
        const val = this.eval(node.operand)
        if (node.op === '-') return -toNum(val)
        if (node.op === '!') return !val
        return val
      }
      case 'binary': {
        const left = this.eval(node.left)
        const right = this.eval(node.right)
        return this.evalBinaryOp(node.op, left, right)
      }
      case 'ternary': {
        return this.eval(node.condition) ? this.eval(node.consequent) : this.eval(node.alternate)
      }
      case 'member': {
        const obj = this.eval(node.object)
        const key = this.eval(node.property)
        if (obj == null) return undefined
        return (obj as any)[key]
      }
      case 'call': {
        const callee = this.eval(node.callee)
        const args = node.args.map((a) => this.eval(a))
        if (typeof callee !== 'function') {
          throw new ExpressionError(`Cannot call non-function value: ${typeof callee}`)
        }
        return callee(...args)
      }
      case 'array': {
        return node.elements.map((e) => this.eval(e))
      }
      case 'object': {
        const obj: Record<string, any> = {}
        for (const [k, v] of node.entries) {
          const key = String(this.eval(k))
          obj[key] = this.eval(v)
        }
        return obj
      }
    }
  }

  private evalBinaryOp(op: string, left: any, right: any): any {
    switch (op) {
      case '+': {
        if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right)
        return toNum(left) + toNum(right)
      }
      case '-': return toNum(left) - toNum(right)
      case '*': return toNum(left) * toNum(right)
      case '/': {
        const r = toNum(right)
        if (r === 0) throw new ExpressionError('Division by zero')
        return toNum(left) / r
      }
      case '%': {
        const r = toNum(right)
        if (r === 0) throw new ExpressionError('Modulo by zero')
        return toNum(left) % r
      }
      case '==': return left === right
      case '!=': return left !== right
      case '>': return toNum(left) > toNum(right)
      case '<': return toNum(left) < toNum(right)
      case '>=': return toNum(left) >= toNum(right)
      case '<=': return toNum(left) <= toNum(right)
      case '&&': return left && right
      case '||': return left || right
      default:
        throw new ExpressionError(`Unknown operator '${op}'`)
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate a DSL expression string with the given variable context.
 *
 * @param expression - The expression source code.
 * @param context    - Variable bindings available in the expression.
 * @param options    - Optional configuration.
 * @returns The evaluated result (must be JSON-serializable).
 *
 * @example
 * ```ts
 * evaluate('inputs.name + " is " + inputs.age', { inputs: { name: 'Alice', age: 30 } })
 * // => "Alice is 30"
 *
 * evaluate('items | map(item => item.price) | sum()', {
 *   items: [{ price: 10 }, { price: 20 }]
 * })
 * ```
 */
export function evaluate(
  expression: string,
  context: Record<string, any> = {},
  options?: { maxOperands?: number },
): any {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new ExpressionError('Expression must be a non-empty string')
  }

  const parser = new Parser(expression.trim(), options?.maxOperands ?? 10000)
  const ast = parser.parse()
  const evaluator = new Evaluator(context)
  const result = evaluator.eval(ast)

  // Ensure result is JSON-serializable
  if (result === undefined) return null
  return result
}

/**
 * Create a reusable expression evaluator from source code.
 * Returns a function that can be called with different contexts.
 */
export function compile(
  expression: string,
  options?: { maxOperands?: number },
): (context?: Record<string, any>) => any {
  const parser = new Parser(expression.trim(), options?.maxOperands ?? 10000)
  const ast = parser.parse()

  return (context: Record<string, any> = {}) => {
    const evaluator = new Evaluator(context)
    const result = evaluator.eval(ast)
    return result === undefined ? null : result
  }
}

/**
 * Safe sort comparator from an expression string.
 * The expression receives two arguments (a, b) and should return
 * a number: negative if a < b, 0 if equal, positive if a > b.
 *
 * @example
 * ```ts
 * const cmp = sortComparator('a.priority - b.priority')
 * items.sort(cmp)
 * ```
 */
export function sortComparator(
  expression: string,
  options?: { maxOperands?: number },
): (a: any, b: any) => number {
  const fn = compile(expression, options)
  return (a: any, b: any) => {
    const result = fn({ a, b })
    return toNum(result)
  }
}

/**
 * Safe filter predicate from an expression string.
 * The expression receives `item` and should return a truthy/falsy value.
 *
 * @example
 * ```ts
 * const pred = filterPredicate('item.age >= 18')
 * items.filter(pred)
 * ```
 */
export function filterPredicate(
  expression: string,
  options?: { maxOperands?: number },
): (item: any, index?: number) => boolean {
  const fn = compile(expression, options)
  return (item: any, _index?: number) => Boolean(fn({ item }))
}

/**
 * Safe map transform from an expression string.
 * The expression receives `item` and should return the transformed value.
 *
 * @example
 * ```ts
 * const transform = mapTransform('item.name')
 * items.map(transform)
 * ```
 */
export function mapTransform(
  expression: string,
  options?: { maxOperands?: number },
): (item: any, index?: number) => any {
  const fn = compile(expression, options)
  return (item: any, _index?: number) => fn({ item })
}
