/**
 * dsh-flow-canvas — Lossless JSON utilities (plain JS).
 * Deep freeze JSON values to prevent prototype pollution and circular references.
 */

/**
 * Deep freeze a JSON value to make it immutable.
 * This prevents prototype pollution and ensures the value cannot be modified.
 * @param {*} value The JSON value to freeze
 * @returns {*} The same value, deeply frozen
 */
function snapshotJsonValue(value) {
  if (value === null || typeof value !== 'object') {
    // Primitives are already immutable
    return value
  }

  if (Array.isArray(value)) {
    // Freeze each element in the array
    const frozenArray = value.map(item => snapshotJsonValue(item))
    return Object.freeze(frozenArray)
  }

  // For objects, freeze each property
  const obj = value
  const frozenObj = {}
  
  for (const key of Object.keys(obj)) {
    frozenObj[key] = snapshotJsonValue(obj[key])
  }

  return Object.freeze(frozenObj)
}

/**
 * Create a deep copy of a JSON value (useful for unfreezing if needed).
 * @param {*} value The JSON value to copy
 * @returns {*} A deep copy of the value
 */
function deepCopyJsonValue(value) {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => deepCopyJsonValue(item))
  }

  const obj = value
  const copy = {}
  
  for (const key of Object.keys(obj)) {
    copy[key] = deepCopyJsonValue(obj[key])
  }

  return copy
}

/**
 * Check if a value is a frozen JSON value (shallow check).
 * @param {*} value The value to check
 * @returns {boolean} true if the value is frozen
 */
function isFrozenJsonValue(value) {
  if (value === null || typeof value !== 'object') {
    return true // Primitives are considered frozen
  }
  return Object.isFrozen(value)
}

module.exports = {
  snapshotJsonValue,
  deepCopyJsonValue,
  isFrozenJsonValue
}