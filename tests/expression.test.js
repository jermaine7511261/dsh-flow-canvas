/**
 * Tests for the deterministic Expression DSL.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluate, compile, filterPredicate, mapTransform, sortComparator, ExpressionError } from '../src/core/expression.ts'

describe('Expression DSL — literals', () => {
  it('number', () => assert.equal(evaluate('42'), 42))
  it('negative number', () => assert.equal(evaluate('-5'), -5))
  it('float', () => assert.equal(evaluate('3.14'), 3.14))
  it('string double quote', () => assert.equal(evaluate('"hello"'), 'hello'))
  it('string single quote', () => assert.equal(evaluate("'world'"), 'world'))
  it('template literal', () => assert.equal(evaluate('`foo`'), 'foo'))
  it('boolean true', () => assert.equal(evaluate('true'), true))
  it('boolean false', () => assert.equal(evaluate('false'), false))
  it('null', () => assert.equal(evaluate('null'), null))
  it('array', () => assert.deepEqual(evaluate('[1, 2, 3]'), [1, 2, 3]))
  it('nested array', () => assert.deepEqual(evaluate('[1, [2, 3]]'), [1, [2, 3]]))
  it('object', () => assert.deepEqual(evaluate('{ a: 1, b: "x" }'), { a: 1, b: 'x' }))
  it('object with string keys', () => assert.deepEqual(evaluate('{ "key": 42 }'), { key: 42 }))
  it('trailing comma in array', () => assert.deepEqual(evaluate('[1, 2, 3,]'), [1, 2, 3]))
})

describe('Expression DSL — arithmetic', () => {
  it('addition', () => assert.equal(evaluate('1 + 2'), 3))
  it('subtraction', () => assert.equal(evaluate('10 - 3'), 7))
  it('multiplication', () => assert.equal(evaluate('4 * 5'), 20))
  it('division', () => assert.equal(evaluate('10 / 2'), 5))
  it('modulo', () => assert.equal(evaluate('10 % 3'), 1))
  it('precedence', () => assert.equal(evaluate('2 + 3 * 4'), 14))
  it('parentheses', () => assert.equal(evaluate('(2 + 3) * 4'), 20))
  it('string concat', () => assert.equal(evaluate('"hello" + " " + "world"'), 'hello world'))
  it('mixed concat', () => assert.equal(evaluate('"age: " + 25'), 'age: 25'))
})

describe('Expression DSL — comparison', () => {
  it('equal', () => assert.equal(evaluate('1 == 1'), true))
  it('not equal', () => assert.equal(evaluate('1 != 2'), true))
  it('greater than', () => assert.equal(evaluate('3 > 2'), true))
  it('less than', () => assert.equal(evaluate('2 < 3'), true))
  it('gte', () => assert.equal(evaluate('3 >= 3'), true))
  it('lte', () => assert.equal(evaluate('2 <= 3'), true))
  it('string comparison', () => assert.equal(evaluate('"a" == "a"'), true))
})

describe('Expression DSL — logical', () => {
  it('and', () => assert.equal(evaluate('true && true'), true))
  it('and false', () => assert.equal(evaluate('true && false'), false))
  it('or', () => assert.equal(evaluate('false || true'), true))
  it('not', () => assert.equal(evaluate('!true'), false))
  it('complex logic', () => assert.equal(evaluate('(1 < 2) && (3 > 2)'), true))
})

describe('Expression DSL — ternary', () => {
  it('basic', () => assert.equal(evaluate('true ? 1 : 2'), 1))
  it('false branch', () => assert.equal(evaluate('false ? 1 : 2'), 2))
  it('nested', () => assert.equal(evaluate('1 > 0 ? (2 > 1 ? "a" : "b") : "c"'), 'a'))
})

describe('Expression DSL — variables', () => {
  it('simple variable', () => assert.equal(evaluate('x', { x: 42 }), 42))
  it('nested access', () => assert.equal(evaluate('obj.key', { obj: { key: 'val' } }), 'val'))
  it('deep nested', () => assert.equal(evaluate('a.b.c', { a: { b: { c: 10 } } }), 10))
  it('computed access', () => assert.equal(evaluate('arr[1]', { arr: [10, 20, 30] }), 20))
  it('computed string key', () => assert.equal(evaluate('obj["name"]', { obj: { name: 'Alice' } }), 'Alice'))
  it('array length', () => assert.equal(evaluate('items.length', { items: [1, 2, 3] }), 3))
})

describe('Expression DSL — built-in functions', () => {
  it('len string', () => assert.equal(evaluate('len("hello")'), 5))
  it('len array', () => assert.equal(evaluate('len([1, 2, 3])'), 3))
  it('len object', () => assert.equal(evaluate('len({ a: 1, b: 2 })'), 2))
  it('upper', () => assert.equal(evaluate('upper("hello")'), 'HELLO'))
  it('lower', () => assert.equal(evaluate('lower("HELLO")'), 'hello'))
  it('trim', () => assert.equal(evaluate('trim("  hi  ")'), 'hi'))
  it('split', () => assert.deepEqual(evaluate('split("a,b,c", ",")'), ['a', 'b', 'c']))
  it('join', () => assert.equal(evaluate('join(["a", "b"], "-")'), 'a-b'))
  it('keys', () => assert.deepEqual(evaluate('keys({ a: 1, b: 2 })'), ['a', 'b']))
  it('values', () => assert.deepEqual(evaluate('values({ a: 1, b: 2 })'), [1, 2]))
  it('get', () => assert.equal(evaluate('get({ a: 1 }, "a")'), 1))
  it('sum', () => assert.equal(evaluate('sum([1, 2, 3])'), 6))
  it('min', () => assert.equal(evaluate('min([3, 1, 2])'), 1))
  it('max', () => assert.equal(evaluate('max([3, 1, 2])'), 3))
  it('unique', () => assert.deepEqual(evaluate('unique([1, 2, 1, 3])'), [1, 2, 3]))
  it('sort', () => assert.deepEqual(evaluate('sort([3, 1, 2])'), [1, 2, 3]))
  it('toString', () => assert.equal(evaluate('toString(42)'), '42'))
  it('toNumber', () => assert.equal(evaluate('toNumber("42")'), 42))
  it('typeof', () => assert.equal(evaluate('typeof(42)'), 'number'))
  it('typeof array', () => assert.equal(evaluate('typeof([1, 2])'), 'array'))
  it('typeof null', () => assert.equal(evaluate('typeof(null)'), 'null'))
  it('contains', () => assert.equal(evaluate('contains("hello world", "world")'), true))
  it('startsWith', () => assert.equal(evaluate('startsWith("hello", "hel")'), true))
  it('endsWith', () => assert.equal(evaluate('endsWith("hello", "llo")'), true))
  it('replace', () => assert.equal(evaluate('replace("hello world", "world", "there")'), 'hello there'))
  it('slice', () => assert.deepEqual(evaluate('slice([1,2,3,4], 1, 3)'), [2, 3]))
  it('concat arrays', () => assert.deepEqual(evaluate('concat([1, 2], [3, 4])'), [1, 2, 3, 4]))
  it('range', () => assert.deepEqual(evaluate('range(5)'), [0, 1, 2, 3, 4]))
  it('range with start', () => assert.deepEqual(evaluate('range(1, 5)'), [1, 2, 3, 4]))
  it('abs', () => assert.equal(evaluate('abs(-5)'), 5))
  it('round', () => assert.equal(evaluate('round(3.7)'), 4))
  it('floor', () => assert.equal(evaluate('floor(3.7)'), 3))
  it('ceil', () => assert.equal(evaluate('ceil(3.2)'), 4))
  it('isEmpty', () => assert.equal(evaluate('isEmpty("")'), true))
  it('isEmpty non-empty', () => assert.equal(evaluate('isEmpty("x")'), false))
  it('default', () => assert.equal(evaluate('default(null, "fallback")'), 'fallback'))
  it('default existing', () => assert.equal(evaluate('default("value", "fallback")'), 'value'))
  it('merge objects', () => assert.deepEqual(evaluate('merge({ a: 1 }, { b: 2 })'), { a: 1, b: 2 }))
  it('pick', () => assert.deepEqual(evaluate('pick({ a: 1, b: 2, c: 3 }, "a", "c")'), { a: 1, c: 3 }))
  it('omit', () => assert.deepEqual(evaluate('omit({ a: 1, b: 2, c: 3 }, "b")'), { a: 1, c: 3 }))
  it('push', () => assert.deepEqual(evaluate('push([1, 2], 3)'), [1, 2, 3]))
})

describe('Expression DSL — unary operators', () => {
  it('negative', () => assert.equal(evaluate('-5'), -5))
  it('double negative', () => assert.equal(evaluate('--5'), 5))
  it('not', () => assert.equal(evaluate('!false'), true))
  it('not truthy', () => assert.equal(evaluate('!1'), false))
})

describe('Expression DSL — complex expressions', () => {
  it('workflow-style string template', () => {
    const result = evaluate(
      'inputs.name + " is " + toString(inputs.age) + " years old"',
      { inputs: { name: 'Alice', age: 30 } }
    )
    assert.equal(result, 'Alice is 30 years old')
  })

  it('chained member access', () => {
    const result = evaluate('data.users[0].name', {
      data: { users: [{ name: 'Bob' }, { name: 'Alice' }] }
    })
    assert.equal(result, 'Bob')
  })

  it('nested ternary', () => {
    assert.equal(evaluate('1 > 2 ? "a" : 1 < 2 ? "b" : "c"'), 'b')
  })

  it('parentheses override', () => {
    assert.equal(evaluate('(1 + 2) * (3 + 4)'), 21)
  })
})

describe('Expression DSL — error handling', () => {
  it('empty expression', () => {
    assert.throws(() => evaluate(''), ExpressionError)
  })

  it('undefined variable', () => {
    assert.throws(() => evaluate('undefined_var'), ExpressionError)
  })

  it('division by zero', () => {
    assert.throws(() => evaluate('10 / 0'), ExpressionError)
  })

  it('modulo by zero', () => {
    assert.throws(() => evaluate('10 % 0'), ExpressionError)
  })

  it('unexpected token', () => {
    assert.throws(() => evaluate('1 @ 2'), ExpressionError)
  })

  it('unterminated string', () => {
    assert.throws(() => evaluate('"hello'), ExpressionError)
  })

  it('unknown function call throws TypeError', () => {
    // Calling a non-function variable should throw
    assert.throws(() => evaluate('nonexistentFunc(1)'), ExpressionError)
  })

  it('operand limit exceeded', () => {
    // Create an expression with many operands to exceed the limit
    const manyAdds = Array.from({ length: 6 }, (_, i) => i).join(' + ')
    assert.throws(() => evaluate(manyAdds, {}, { maxOperands: 3 }), ExpressionError)
  })
})

describe('Expression DSL — compile', () => {
  it('compiles reusable function', () => {
    const fn = compile('a + b')
    assert.equal(fn({ a: 1, b: 2 }), 3)
    assert.equal(fn({ a: 10, b: 20 }), 30)
  })
})

describe('Expression DSL — helper functions', () => {
  it('filterPredicate', () => {
    const pred = filterPredicate('item.age >= 18')
    assert.equal(pred({ age: 20 }), true)
    assert.equal(pred({ age: 15 }), false)
  })

  it('mapTransform', () => {
    const transform = mapTransform('item.name')
    assert.equal(transform({ name: 'Alice' }), 'Alice')
  })

  it('sortComparator', () => {
    const cmp = sortComparator('a.priority - b.priority')
    const items = [{ priority: 3 }, { priority: 1 }, { priority: 2 }]
    items.sort(cmp)
    assert.deepEqual(items.map(i => i.priority), [1, 2, 3])
  })
})

describe('Expression DSL — comments', () => {
  it('line comment', () => {
    assert.equal(evaluate('42 // this is a comment'), 42)
  })
  it('block comment', () => {
    assert.equal(evaluate('/* start */ 42 /* end */'), 42)
  })
})

describe('Expression DSL — escape sequences', () => {
  it('newline in string', () => assert.equal(evaluate('"hello\\nworld"'), 'hello\nworld'))
  it('tab in string', () => assert.equal(evaluate('"hello\\tworld"'), 'hello\tworld'))
})

describe('Expression DSL — workflow inputs pattern', () => {
  it('access inputs deeply', () => {
    const result = evaluate('inputs.config.setting', {
      inputs: { config: { setting: 'enabled' } }
    })
    assert.equal(result, 'enabled')
  })

  it('transform inputs', () => {
    const result = evaluate('inputs.items.length + inputs.offset', {
      inputs: { items: [1, 2, 3], offset: 10 }
    })
    assert.equal(result, 13)
  })
})
