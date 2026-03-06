/**
 * Tests for helper utilities: tagToProperty, getNestedValue, deepClone
 */
import { tagToProperty, getNestedValue, deepClone } from '../src/spirit.js'

// ---------------------------------------------------------------------------
// tagToProperty
// ---------------------------------------------------------------------------
describe('tagToProperty', () => {
  test('simple single-word tag', () => {
    expect(tagToProperty('model-counter')).toBe('counter')
  })

  test('two-word kebab-case tag', () => {
    expect(tagToProperty('model-user-name')).toBe('userName')
  })

  test('three-word kebab-case tag', () => {
    expect(tagToProperty('model-is-loading')).toBe('isLoading')
  })

  test('tag with many segments', () => {
    expect(tagToProperty('model-my-long-property-name')).toBe('myLongPropertyName')
  })
})

// ---------------------------------------------------------------------------
// getNestedValue
// ---------------------------------------------------------------------------
describe('getNestedValue', () => {
  const obj = { a: { b: { c: 42 } }, x: 'hello' }

  test('top-level key', () => {
    expect(getNestedValue(obj, 'x')).toBe('hello')
  })

  test('nested key', () => {
    expect(getNestedValue(obj, 'a.b.c')).toBe(42)
  })

  test('missing key returns undefined', () => {
    expect(getNestedValue(obj, 'a.z')).toBeUndefined()
  })

  test('deeply missing key returns undefined', () => {
    expect(getNestedValue(obj, 'a.z.q.r')).toBeUndefined()
  })

  test('null obj returns undefined', () => {
    expect(getNestedValue(null, 'a')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// deepClone
// ---------------------------------------------------------------------------
describe('deepClone', () => {
  test('primitives pass through', () => {
    expect(deepClone(42)).toBe(42)
    expect(deepClone('hi')).toBe('hi')
    expect(deepClone(null)).toBeNull()
    expect(deepClone(true)).toBe(true)
  })

  test('clones a flat object', () => {
    const src = { a: 1, b: 2 }
    const clone = deepClone(src)
    expect(clone).toEqual(src)
    expect(clone).not.toBe(src)
  })

  test('clones nested objects', () => {
    const src = { a: { b: { c: 3 } } }
    const clone = deepClone(src)
    expect(clone).toEqual(src)
    clone.a.b.c = 999
    expect(src.a.b.c).toBe(3)
  })

  test('clones arrays', () => {
    const src = [1, [2, 3], { x: 4 }]
    const clone = deepClone(src)
    expect(clone).toEqual(src)
    clone[1][0] = 99
    expect(src[1][0]).toBe(2)
  })
})
