/**
 * Spirit - A lightweight, explicit, vanilla-first state management library.
 *
 * Combines XState statecharts with vanilla HTML/JS and Web Components.
 * Provides one-way data binding and event handling without framework overhead.
 *
 * @module spirit
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a kebab-case tag name to a camelCase property key.
 * e.g. "model-user-name" → "userName"
 *
 * @param {string} tagName - A custom element tag like "model-user-name"
 * @returns {string} camelCase property name
 */
function tagToProperty(tagName) {
  // Strip leading "model-" prefix, then camelCase the rest
  const withoutPrefix = tagName.replace(/^model-/, '')
  return withoutPrefix.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase())
}

/**
 * Get a (possibly nested) value from an object using a dot-separated path.
 * e.g. getNestedValue({ a: { b: 1 } }, 'a.b') → 1
 *
 * @param {object} obj
 * @param {string} path - Dot-separated property path
 * @returns {*}
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined
    return acc[key]
  }, obj)
}

/**
 * Deep-clone a plain object / array (JSON-safe values only).
 *
 * @param {*} value
 * @returns {*}
 */
function deepClone(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(deepClone)
  const out = {}
  for (const key of Object.keys(value)) {
    out[key] = deepClone(value[key])
  }
  return out
}

// ---------------------------------------------------------------------------
// Tiny built-in state machine (no XState dependency required)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} MachineDefinition
 * @property {string} id               - Machine identifier
 * @property {string} initial           - Initial state key
 * @property {Object} context           - Initial context data
 * @property {Object} states            - State definitions
 */

/**
 * @typedef {Object} MachineState
 * @property {string} value             - Current state name
 * @property {Object} context           - Current context data
 * @property {function} matches         - Check if current state matches a value
 * @property {Object} _definition       - Reference back to machine definition
 */

/**
 * Create a lightweight state machine from a definition object.
 *
 * The definition mirrors XState's basic shape:
 *   { id, initial, context, states }
 *
 * Each state can define `on: { EVENT: targetOrConfig }` where
 * `targetOrConfig` is either:
 *   - A string (target state name)
 *   - An object `{ target?, actions?, guard? }`
 *
 * Actions receive a mutable *copy* of context and the event object.
 * Guards receive context and event and should return a boolean.
 *
 * @param {MachineDefinition} definition
 * @returns {{ transition: Function, initialState: MachineState, definition: MachineDefinition }}
 */
export function createMachine(definition) {
  const { id = 'machine', initial, context = {}, states = {} } = definition

  function buildState(value, ctx) {
    return {
      value,
      context: ctx,
      matches(v) {
        return value === v
      },
      _definition: definition,
    }
  }

  const initialState = buildState(initial, deepClone(context))

  /**
   * Pure transition function – returns a new MachineState.
   *
   * @param {MachineState} currentState
   * @param {string|{type: string}} event
   * @returns {MachineState}
   */
  function transition(currentState, event) {
    const eventType = typeof event === 'string' ? event : event.type
    const eventObj = typeof event === 'string' ? { type: event } : event

    const stateDef = states[currentState.value]
    if (!stateDef || !stateDef.on) return currentState

    const handler = stateDef.on[eventType]
    if (handler === undefined) return currentState

    let target = currentState.value
    let actions = null
    let guard = null

    if (typeof handler === 'string') {
      target = handler
    } else if (typeof handler === 'object' && handler !== null) {
      target = handler.target || currentState.value
      actions = handler.actions || null
      guard = handler.guard || null
    }

    // Validate target state exists
    if (!states[target]) {
      console.warn(`[Spirit] Unknown target state "${target}"`)
      return currentState
    }

    const newCtx = deepClone(currentState.context)

    // Evaluate guard
    if (guard && typeof guard === 'function') {
      if (!guard(newCtx, eventObj)) return currentState
    }

    // Run actions
    if (typeof actions === 'function') {
      actions(newCtx, eventObj)
    } else if (Array.isArray(actions)) {
      actions.forEach((fn) => {
        if (typeof fn === 'function') fn(newCtx, eventObj)
      })
    }

    return buildState(target, newCtx)
  }

  return { transition, initialState, definition }
}

// ---------------------------------------------------------------------------
// AppState — the subscription / bridge layer
// ---------------------------------------------------------------------------

/**
 * AppState wraps a Spirit machine and provides:
 *   - `.send(event)` to advance the state machine
 *   - `.subscribe(callback)` to listen for state changes
 *   - Automatic DOM binding via `[data-model]` and `<model-*>` elements
 *
 * @example
 *   const app = new AppState(createMachine({ ... }))
 *   app.start()
 *   app.send('INCREMENT')
 */
export class AppState {
  /**
   * @param {{ transition: Function, initialState: Object, definition: Object }} machine
   *        A machine created by `createMachine()`.
   */
  constructor(machine) {
    this.machine = machine
    this.currentState = null
    /** @type {Set<Function>} */
    this.subscribers = new Set()
    this._started = false
  }

  // -- public API -----------------------------------------------------------

  /**
   * Start the state machine and perform the initial DOM update.
   * @returns {AppState} this (for chaining)
   */
  start() {
    if (this._started) return this
    this._started = true
    this.currentState = this.machine.initialState
    this._notifySubscribers()
    this._updateDataModels()
    return this
  }

  /**
   * Send an event to the state machine.
   *
   * @param {string|{type: string}} event
   * @returns {AppState} this
   */
  send(event) {
    if (!this._started) {
      console.warn('[Spirit] AppState has not been started. Call .start() first.')
      return this
    }
    const next = this.machine.transition(this.currentState, event)
    // Only notify when something actually changed
    if (next !== this.currentState) {
      this.currentState = next
      this._notifySubscribers()
      this._updateDataModels()
    }
    return this
  }

  /**
   * Register a subscriber that is called whenever the state changes.
   * The callback receives the current `MachineState`.
   * Returns an unsubscribe function.
   *
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  subscribe(callback) {
    this.subscribers.add(callback)
    // Immediately call with current state if already started
    if (this.currentState) {
      try {
        callback(this.currentState)
      } catch (err) {
        console.error('[Spirit] Error in subscriber:', err)
      }
    }
    return () => this.subscribers.delete(callback)
  }

  /**
   * Get the current state snapshot.
   * @returns {MachineState|null}
   */
  getState() {
    return this.currentState
  }

  /**
   * Get a context value by key (supports dot-paths).
   * @param {string} key
   * @returns {*}
   */
  getContext(key) {
    if (!this.currentState) return undefined
    return getNestedValue(this.currentState.context, key)
  }

  /**
   * Stop the state machine and clear all subscribers.
   */
  destroy() {
    this.subscribers.clear()
    this._started = false
    this.currentState = null
  }

  // -- internal -------------------------------------------------------------

  /** @private */
  _notifySubscribers() {
    this.subscribers.forEach((cb) => {
      try {
        cb(this.currentState)
      } catch (err) {
        console.error('[Spirit] Error in subscriber:', err)
      }
    })
  }

  /** @private – update every element that carries a `data-model` attribute */
  _updateDataModels() {
    if (typeof document === 'undefined') return // SSR / Node guard

    document.querySelectorAll('[data-model]').forEach((el) => {
      const prop = el.getAttribute('data-model')
      const value = getNestedValue(this.currentState.context, prop)

      if (value === undefined) return

      const strValue = String(value)

      // For input / select / textarea set .value; for everything else .textContent
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        if (el.value !== strValue) el.value = strValue
      } else {
        if (el.textContent !== strValue) el.textContent = strValue
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Web Component auto-registration  (<model-*> elements)
// ---------------------------------------------------------------------------

/**
 * Scan the DOM (or a given root) for elements whose tag name starts with
 * `model-` and register matching Custom Elements that automatically reflect
 * a context property.
 *
 * Call this **before** `appState.start()` so the elements exist when the
 * first update runs.
 *
 * @param {AppState} appState
 * @param {Element}  [root=document.body]
 */
export function registerModelElements(appState, root) {
  if (typeof document === 'undefined') return

  const container = root || document.body
  const tags = new Set()

  // Collect unique model-* tag names
  container.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    if (tag.startsWith('model-') && !customElements.get(tag)) {
      tags.add(tag)
    }
  })

  tags.forEach((tag) => {
    const prop = tagToProperty(tag)

    customElements.define(
      tag,
      class extends HTMLElement {
        connectedCallback() {
          // Add data-model so the normal update path picks it up
          if (!this.hasAttribute('data-model')) {
            this.setAttribute('data-model', prop)
          }
        }
      },
    )
  })
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

/**
 * Shorthand: create a machine + AppState in one call.
 *
 * @param {MachineDefinition} definition
 * @returns {AppState}
 *
 * @example
 *   const app = createAppState({
 *     initial: 'idle',
 *     context: { count: 0 },
 *     states: {
 *       idle: { on: { INC: { actions: ctx => ctx.count++ } } }
 *     }
 *   })
 *   app.start()
 */
export function createAppState(definition) {
  return new AppState(createMachine(definition))
}

// ---------------------------------------------------------------------------
// Exports (also attach to globalThis for non-module usage)
// ---------------------------------------------------------------------------

export { tagToProperty, getNestedValue, deepClone }

if (typeof globalThis !== 'undefined') {
  globalThis.Spirit = {
    createMachine,
    AppState,
    createAppState,
    registerModelElements,
    tagToProperty,
    getNestedValue,
    deepClone,
  }
}
