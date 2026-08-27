/**
 * Test for json.ts module.
 * Run with: node tests/json.test.cjs
 */
const { snapshotJsonValue, snapshotJsonObject } = require('../src/core/json.cjs')

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

// Test 1: snapshotJsonValue creates deep copies
console.log('\n=== Test 1: snapshotJsonValue creates deep copies ===')
{
  const original = { a: 1, b: { c: 'test' } }
  const copy = snapshotJsonValue(original)
  assert(copy.a === 1, 'Primitive values should be copied')
  assert(copy.b !== original.b, 'Nested objects should be new references')
  assert(copy.b.c === 'test', 'Nested values should be copied')
}

// Test 2: snapshotJsonValue preserves structure
console.log('\n=== Test 2: snapshotJsonValue preserves structure ===')
{
  const original = { arr: [1, 2, { nested: true }] }
  const copy = snapshotJsonValue(original)
  assert(Array.isArray(copy.arr), 'Arrays should be preserved')
  assert(copy.arr.length === 3, 'Array length should be preserved')
  assert(typeof copy.arr[2] === 'object', 'Nested objects should be preserved')
  assert(copy.arr[2].nested === true, 'Nested values should be preserved')
}

// Test 3: snapshotJsonValue handles primitives
console.log('\n=== Test 3: snapshotJsonValue handles primitives ===')
{
  const num = snapshotJsonValue(42)
  assert(num === 42, 'Numbers should be copied')
  
  const str = snapshotJsonValue('hello')
  assert(str === 'hello', 'Strings should be copied')
  
  const bool = snapshotJsonValue(true)
  assert(bool === true, 'Booleans should be copied')
  
  const nullVal = snapshotJsonValue(null)
  assert(nullVal === null, 'Null should be copied')
}

// Test 4: snapshotJsonObject works the same
console.log('\n=== Test 4: snapshotJsonObject works the same ===')
{
  const original = { x: 1, y: { z: 2 } }
  const copy = snapshotJsonObject(original)
  assert(copy.x === 1, 'Primitive values should be copied')
  assert(copy.y !== original.y, 'Nested objects should be new references')
  assert(copy.y.z === 2, 'Nested values should be copied')
}

// Test 5: snapshotJsonValue creates independent copies
console.log('\n=== Test 5: snapshotJsonValue creates independent copies ===')
{
  const original = { a: 1 }
  const copy1 = snapshotJsonValue(original)
  const copy2 = snapshotJsonValue(original)
  assert(copy1 !== copy2, 'Different copies should be different objects')
  assert(copy1.a === copy2.a, 'Different copies should have same values')
}

// Summary
console.log('\n=== Summary ===')
console.log(`Passed: ${passed}, Failed: ${failed}`)
process.exit(failed > 0 ? 1 : 0)