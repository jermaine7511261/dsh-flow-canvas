/**
 * dsh-flow-canvas — Lossless JSON utilities.
 * Deep freeze JSON values to prevent prototype pollution and circular references.
 */

import type { JsonValue, JsonObject } from './types'

/**
 * Deep freeze a JSON value to make it immutable.
 * This prevents prototype pollution and ensures the value cannot be modified.
 * @param value The JSON value to freeze
 * @returns The same value, deeply frozen
 */
export function snapshotJsonValue<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== 'object') {
    // Primitives are already immutable
    return value
  }

  if (Array.isArray(value)) {
    // Freeze each element in the array
    const frozenArray = value.map(item => snapshotJsonValue(item)) as any[]
    return Object.freeze(frozenArray) as T
  }

  // For objects, freeze each property
  const obj = value as JsonObject
  const frozenObj: any = {}
  
  for (const key of Object.keys(obj)) {
    frozenObj[key] = snapshotJsonValue(obj[key])
  }

  return Object.freeze(frozenObj) as T
}

/**
 * Create a deep copy of a JSON value (useful for unfreezing if needed).
 * @param value The JSON value to copy
 * @returns A deep copy of the value
 */
export function deepCopyJsonValue<T extends JsonValue>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => deepCopyJsonValue(item)) as T
  }

  const obj = value as JsonObject
  const copy: any = {}
  
  for (const key of Object.keys(obj)) {
    copy[key] = deepCopyJsonValue(obj[key])
  }

  return copy as T
}

/**
 * Check if a value is a frozen JSON value (shallow check).
 * @param value The value to check
 * @returns true if the value is frozen
 */
export function isFrozenJsonValue(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return true // Primitives are considered frozen
  }
  return Object.isFrozen(value)
}