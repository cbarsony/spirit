/**
 * Tests for registerModelElements – custom element auto-registration.
 */
import { createAppState, registerModelElements } from '../src/spirit.js'

describe('registerModelElements', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('registers a custom element and sets data-model', () => {
    // We need a unique tag name per test because Custom Elements can only be
    // defined once per page. Use a random suffix.
    const suffix = Math.random().toString(36).slice(2, 8)
    const tag = `model-alpha${suffix}`
    const prop = `alpha${suffix}`

    document.body.innerHTML = `<${tag}></${tag}>`

    const app = createAppState({
      initial: 's',
      context: { [prop]: 'hello' },
      states: { s: {} },
    })

    registerModelElements(app, document.body)
    app.start()

    const el = document.querySelector(tag)
    expect(el.getAttribute('data-model')).toBe(prop)
    expect(el.textContent).toBe('hello')
  })

  test('does not re-register already defined elements', () => {
    const suffix = Math.random().toString(36).slice(2, 8)
    const tag = `model-beta${suffix}`

    // Define it ahead of time
    customElements.define(tag, class extends HTMLElement {})

    document.body.innerHTML = `<${tag}></${tag}>`

    const app = createAppState({
      initial: 's',
      context: {},
      states: { s: {} },
    })

    // Should not throw
    expect(() => registerModelElements(app, document.body)).not.toThrow()
  })
})
