/**
 * dsh-flow-canvas — JSON utilities.
 * Simple deep copy for lossless JSON materialization.
 */

/**
 * Deep copy a JSON value using JSON serialization.
 * This creates a new independent copy that prevents prototype pollution.
 * @param value The JSON value to snapshot
 * @returns A deep copy of the value
 */
export function snapshotJsonValue(value: any): any {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Deep copy a JSON object using JSON serialization.
 * @param value The JSON object to snapshot
 * @returns A deep copy of the object
 */
export function snapshotJsonObject(value: Record<string, any>): Record<string, any> {
  return snapshotJsonValue(value)
}