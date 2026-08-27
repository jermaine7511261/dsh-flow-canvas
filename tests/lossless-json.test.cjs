/**
 * Test for lossless-json module.
 * Run with: node tests/lossless-json.test.cjs
 */
const { snapshotJsonValue, deepCopyJsonValue, isFrozenJsonValue } = require('../src/core/lossless-json.cjs')

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log('  ✓ ' + message)
  } else {
    failed++
    console.log('  ✗ ' + message)
  }
}

// Test 1: snapshotJsonValue freezes objects
console.log('\n=== Test 1: snapshotJsonValue freezes objects ===')
{
  const obj = { a: 1, b: 'test', c: true, d: null }
  const frozen = snapshotJsonValue(obj)
  assert(isFrozenJsonValue(frozen), 'Object should be frozen')
  assert(frozen.a === 1, 'Primitive values should be preserved')
  assert(frozen.b === 'test', 'String values should be preserved')
  assert(frozen.c === true, 'Boolean values should be preserved')
  assert(frozen.d === null, 'Null should be preserved')
}

// Test 2: snapshotJsonValue freezes nested objects
console.log('\n=== Test 2: snapshotJsonValue freezes nested objects ===')
{
  const obj = { nested: { deep: { value: 42 } } }
  const frozen = snapshotJsonValue(obj)
  assert(isFrozenJsonValue(frozen), 'Top object should be frozen')
  assert(isFrozenJsonValue(frozen.nested), 'Nested object should be frozen')
  assert(isFrozenJsonValue(frozen.nested.deep), 'Deep nested object should be frozen')
  assert(frozen.nested.deep.value === 42, 'Deep value should be preserved')
}

// Test 3: snapshotJsonValue freezes arrays
console.log('\n=== Test 3: snapshotJsonValue freezes arrays ===')
{
  const arr = [1, 2, 3, { a: 4 }]
  const frozen = snapshotJsonValue(arr)
  assert(isFrozenJsonValue(frozen), 'Array should be frozen')
  assert(frozen.length === 4, 'Array length should be preserved')
  assert(frozen[0] === 1, 'Array elements should be preserved')
  assert(isFrozenJsonValue(frozen[3]), 'Nested objects in arrays should be frozen')
}

// Test 4: snapshotJsonValue handles primitives
console.log('\n=== Test 4: snapshotJsonValue handles primitives ===')
{
  const frozenString = snapshotJsonValue('hello')
  assert(frozenString === 'hello', 'Strings should be returned as-is')
  
  const frozenNumber = snapshotJsonValue(42)
  assert(frozenNumber === 42, 'Numbers should be returned as-is')
  
  const frozenBool = snapshotJsonValue(true)
  assert(frozenBool === true, 'Booleans should be returned as-is')
  
  const frozenNull = snapshotJsonValue(null)
  assert(frozenNull === null, 'Null should be returned as-is')
}

// Test 5: deepCopyJsonValue creates deep copies
console.log('\n=== Test 5: deepCopyJsonValue creates deep copies ===')
{
  const original = { a: 1, b: { c: 2 } }
  const frozen = snapshotJsonValue(original)
  const copy = deepCopyJsonValue(frozen)
  
  assert(!isFrozenJsonValue(copy), 'Copy should not be frozen')
  assert(copy.a === 1, 'Primitive values should be copied')
  assert(copy.b !== frozen.b, 'Nested objects should be new references')
  assert(copy.b.c === 2, 'Nested values should be copied')
}

// Test 6: deepCopyJsonValue preserves structure
console.log('\n=== Test 6: deepCopyJsonValue preserves structure ===')
{
  const original = { arr: [1, 2, { nested: true }] }
  const frozen = snapshotJsonValue(original)
  const copy = deepCopyJsonValue(frozen)
  
  assert(Array.isArray(copy.arr), 'Arrays should be preserved')
  assert(copy.arr.length === 3, 'Array length should be preserved')
  assert(typeof copy.arr[2] === 'object', 'Nested objects should be preserved')
  assert(copy.arr[2].nested === true, 'Nested values should be preserved')
}

// Test 7: isFrozenJsonValue works correctly
console.log('\n=== Test 7: isFrozenJsonValue works correctly ===')
{
  assert(isFrozenJsonValue(42), 'Primitives should be considered frozen')
  assert(isFrozenJsonValue('test'), 'Strings should be considered frozen')
  assert(isFrozenJsonValue(null), 'Null should be considered frozen')
  
  const unfrozen = { a: 1 }
  assert(!isFrozenJsonValue(unfrozen), 'Unfrozen objects should not be considered frozen')
  
  const frozen = Object.freeze({ a: 1 })
  assert(isFrozenJsonValue(frozen), 'Frozen objects should be considered frozen')
}

// Summary
console.log('\n=== Summary ===')
console.log(`Passed: ${passed}, Failed: ${failed}`)
process.exit(failed > 0 ? 1 : 0)