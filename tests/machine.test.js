/**
 * Tests for createMachine – the built-in state machine engine.
 */
import { createMachine } from '../src/spirit.js'

// ---------------------------------------------------------------------------
// Basic machine setup
// ---------------------------------------------------------------------------
function counterMachine() {
  return createMachine({
    id: 'counter',
    initial: 'active',
    context: { count: 0 },
    states: {
      active: {
        on: {
          INCREMENT: { actions: (ctx) => { ctx.count++ } },
          DECREMENT: { actions: (ctx) => { ctx.count-- } },
          ADD: { actions: (ctx, e) => { ctx.count += e.amount } },
          RESET: { target: 'active', actions: (ctx) => { ctx.count = 0 } },
          DISABLE: 'disabled',
        },
      },
      disabled: {
        on: {
          ENABLE: 'active',
        },
      },
    },
  })
}

function trafficLightMachine() {
  return createMachine({
    id: 'traffic',
    initial: 'green',
    context: {},
    states: {
      green: { on: { NEXT: 'yellow' } },
      yellow: { on: { NEXT: 'red' } },
      red: { on: { NEXT: 'green' } },
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('createMachine', () => {
  test('returns an object with initialState and transition', () => {
    const m = counterMachine()
    expect(m.initialState).toBeDefined()
    expect(typeof m.transition).toBe('function')
  })

  test('initialState has the correct value and context', () => {
    const m = counterMachine()
    expect(m.initialState.value).toBe('active')
    expect(m.initialState.context).toEqual({ count: 0 })
  })

  test('initialState.matches() works', () => {
    const m = counterMachine()
    expect(m.initialState.matches('active')).toBe(true)
    expect(m.initialState.matches('disabled')).toBe(false)
  })
})

describe('transition – basic state changes', () => {
  test('string target transitions to another state', () => {
    const m = counterMachine()
    const next = m.transition(m.initialState, 'DISABLE')
    expect(next.value).toBe('disabled')
  })

  test('can transition back', () => {
    const m = counterMachine()
    const disabled = m.transition(m.initialState, 'DISABLE')
    const active = m.transition(disabled, 'ENABLE')
    expect(active.value).toBe('active')
  })

  test('cycles through traffic light states', () => {
    const m = trafficLightMachine()
    let s = m.initialState
    expect(s.value).toBe('green')

    s = m.transition(s, 'NEXT')
    expect(s.value).toBe('yellow')

    s = m.transition(s, 'NEXT')
    expect(s.value).toBe('red')

    s = m.transition(s, 'NEXT')
    expect(s.value).toBe('green')
  })
})

describe('transition – context actions', () => {
  test('INCREMENT increases count', () => {
    const m = counterMachine()
    const next = m.transition(m.initialState, 'INCREMENT')
    expect(next.context.count).toBe(1)
  })

  test('DECREMENT decreases count', () => {
    const m = counterMachine()
    let s = m.transition(m.initialState, 'INCREMENT')
    s = m.transition(s, 'INCREMENT')
    s = m.transition(s, 'DECREMENT')
    expect(s.context.count).toBe(1)
  })

  test('actions receive event data', () => {
    const m = counterMachine()
    const next = m.transition(m.initialState, { type: 'ADD', amount: 5 })
    expect(next.context.count).toBe(5)
  })

  test('actions with target (RESET)', () => {
    const m = counterMachine()
    let s = m.transition(m.initialState, 'INCREMENT')
    s = m.transition(s, 'INCREMENT')
    s = m.transition(s, 'RESET')
    expect(s.context.count).toBe(0)
    expect(s.value).toBe('active')
  })

  test('context is deeply cloned on each transition', () => {
    const m = counterMachine()
    const s1 = m.transition(m.initialState, 'INCREMENT')
    const s2 = m.transition(s1, 'INCREMENT')
    expect(s1.context.count).toBe(1)
    expect(s2.context.count).toBe(2)
    // original initialState unaffected
    expect(m.initialState.context.count).toBe(0)
  })
})

describe('transition – unknown events & states', () => {
  test('unknown event returns same state', () => {
    const m = counterMachine()
    const same = m.transition(m.initialState, 'NONEXISTENT')
    expect(same).toBe(m.initialState)
  })

  test('event not handled in current state is ignored', () => {
    const m = counterMachine()
    const disabled = m.transition(m.initialState, 'DISABLE')
    const same = m.transition(disabled, 'INCREMENT')
    expect(same).toBe(disabled)
  })
})

describe('transition – guards', () => {
  test('guard that returns true allows transition', () => {
    const m = createMachine({
      initial: 'idle',
      context: { count: 0 },
      states: {
        idle: {
          on: {
            GO: {
              target: 'running',
              guard: (ctx) => ctx.count === 0,
            },
          },
        },
        running: {},
      },
    })
    const next = m.transition(m.initialState, 'GO')
    expect(next.value).toBe('running')
  })

  test('guard that returns false blocks transition', () => {
    const m = createMachine({
      initial: 'idle',
      context: { count: 5 },
      states: {
        idle: {
          on: {
            GO: {
              target: 'running',
              guard: (ctx) => ctx.count === 0,
            },
          },
        },
        running: {},
      },
    })
    const next = m.transition(m.initialState, 'GO')
    expect(next).toBe(m.initialState) // blocked
  })

  test('guard receives event data', () => {
    const m = createMachine({
      initial: 'idle',
      context: {},
      states: {
        idle: {
          on: {
            GO: {
              target: 'running',
              guard: (_ctx, event) => event.allowed === true,
            },
          },
        },
        running: {},
      },
    })
    const blocked = m.transition(m.initialState, { type: 'GO', allowed: false })
    expect(blocked.value).toBe('idle')

    const allowed = m.transition(m.initialState, { type: 'GO', allowed: true })
    expect(allowed.value).toBe('running')
  })
})

describe('transition – multiple actions (array)', () => {
  test('runs all actions in array', () => {
    const m = createMachine({
      initial: 'idle',
      context: { a: 0, b: 0 },
      states: {
        idle: {
          on: {
            BOTH: {
              actions: [
                (ctx) => { ctx.a = 1 },
                (ctx) => { ctx.b = 2 },
              ],
            },
          },
        },
      },
    })
    const next = m.transition(m.initialState, 'BOTH')
    expect(next.context.a).toBe(1)
    expect(next.context.b).toBe(2)
  })
})
