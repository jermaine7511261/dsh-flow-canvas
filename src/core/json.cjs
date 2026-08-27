/**
 * dsh-flow-canvas — JSON utilities (plain JS).
 * Simple deep copy for lossless JSON materialization.
 */

/**
 * Deep copy a JSON value using JSON serialization.
 * This creates a new independent copy that prevents prototype pollution.
 * @param {*} value The JSON value to snapshot
 * @returns {*} A deep copy of the value
 */
function snapshotJsonValue(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Deep copy a JSON object using JSON serialization.
 * @param {Object} value The JSON object to snapshot
 * @returns {Object} A deep copy of the object
 */
function snapshotJsonObject(value) {
  return snapshotJsonValue(value)
}

module.exports = {
  snapshotJsonValue,
  snapshotJsonObject
}