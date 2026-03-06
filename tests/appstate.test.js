/**
 * Tests for AppState – the subscription & DOM-binding bridge.
 */
import { jest } from '@jest/globals'
import { createMachine, AppState, createAppState } from '../src/spirit.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function simpleCounterApp() {
  return createAppState({
    id: 'counter',
    initial: 'active',
    context: { count: 0, label: 'Clicks' },
    states: {
      active: {
        on: {
          INC: { actions: (ctx) => { ctx.count++ } },
          DEC: { actions: (ctx) => { ctx.count-- } },
          SET_LABEL: { actions: (ctx, e) => { ctx.label = e.label } },
          STOP: 'stopped',
        },
      },
      stopped: {
        on: { RESUME: 'active' },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
describe('AppState lifecycle', () => {
  test('start() sets currentState to initial', () => {
    const app = simpleCounterApp()
    expect(app.currentState).toBeNull()
    app.start()
    expect(app.currentState).not.toBeNull()
    expect(app.currentState.value).toBe('active')
    expect(app.currentState.context.count).toBe(0)
  })

  test('start() is idempotent', () => {
    const app = simpleCounterApp()
    app.start()
    const ref = app.currentState
    app.start() // second call should be a no-op
    expect(app.currentState).toBe(ref)
  })

  test('send() before start() warns and does nothing', () => {
    const app = simpleCounterApp()
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    app.send('INC')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not been started'))
    expect(app.currentState).toBeNull()
    warn.mockRestore()
  })

  test('destroy() clears state and subscribers', () => {
    const app = simpleCounterApp()
    const fn = jest.fn()
    app.start()
    app.subscribe(fn)
    app.destroy()
    expect(app.currentState).toBeNull()
    expect(app.subscribers.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// send()
// ---------------------------------------------------------------------------
describe('AppState.send()', () => {
  test('transitions state on valid event', () => {
    const app = simpleCounterApp()
    app.start()
    app.send('INC')
    expect(app.currentState.context.count).toBe(1)
  })

  test('multiple sends accumulate', () => {
    const app = simpleCounterApp()
    app.start()
    app.send('INC')
    app.send('INC')
    app.send('INC')
    expect(app.currentState.context.count).toBe(3)
  })

  test('event objects work (with payload)', () => {
    const app = simpleCounterApp()
    app.start()
    app.send({ type: 'SET_LABEL', label: 'Taps' })
    expect(app.currentState.context.label).toBe('Taps')
  })

  test('state change transitions', () => {
    const app = simpleCounterApp()
    app.start()
    app.send('STOP')
    expect(app.currentState.value).toBe('stopped')
    app.send('RESUME')
    expect(app.currentState.value).toBe('active')
  })

  test('send returns this for chaining', () => {
    const app = simpleCounterApp()
    app.start()
    const ret = app.send('INC')
    expect(ret).toBe(app)
  })
})

// ---------------------------------------------------------------------------
// subscribe()
// ---------------------------------------------------------------------------
describe('AppState.subscribe()', () => {
  test('subscriber is called on send()', () => {
    const app = simpleCounterApp()
    app.start()
    const fn = jest.fn()
    app.subscribe(fn)
    fn.mockClear() // ignore the immediate call

    app.send('INC')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'active' }),
    )
  })

  test('subscriber called immediately with current state', () => {
    const app = simpleCounterApp()
    app.start()
    app.send('INC')
    const fn = jest.fn()
    app.subscribe(fn)
    // Should have been called once immediately
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn.mock.calls[0][0].context.count).toBe(1)
  })

  test('unsubscribe stops future calls', () => {
    const app = simpleCounterApp()
    app.start()
    const fn = jest.fn()
    const unsub = app.subscribe(fn)
    fn.mockClear()

    app.send('INC')
    expect(fn).toHaveBeenCalledTimes(1)

    unsub()
    app.send('INC')
    expect(fn).toHaveBeenCalledTimes(1) // not called again
  })

  test('multiple subscribers all get notified', () => {
    const app = simpleCounterApp()
    app.start()
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    app.subscribe(fn1)
    app.subscribe(fn2)
    fn1.mockClear()
    fn2.mockClear()

    app.send('INC')
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
  })

  test('error in subscriber does not break others', () => {
    const app = simpleCounterApp()
    app.start()
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    const bad = jest.fn(() => { throw new Error('boom') })
    const good = jest.fn()
    app.subscribe(bad)
    app.subscribe(good)
    bad.mockClear()
    good.mockClear()

    app.send('INC')
    expect(bad).toHaveBeenCalledTimes(1)
    expect(good).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalled()

    errSpy.mockRestore()
  })

  test('no notification when event produces no state change', () => {
    const app = simpleCounterApp()
    app.start()
    const fn = jest.fn()
    app.subscribe(fn)
    fn.mockClear()

    app.send('NONEXISTENT')
    expect(fn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// getState() / getContext()
// ---------------------------------------------------------------------------
describe('AppState accessors', () => {
  test('getState() returns current state', () => {
    const app = simpleCounterApp()
    app.start()
    const s = app.getState()
    expect(s.value).toBe('active')
    expect(s.context.count).toBe(0)
  })

  test('getContext() returns a context value', () => {
    const app = simpleCounterApp()
    app.start()
    expect(app.getContext('count')).toBe(0)
    expect(app.getContext('label')).toBe('Clicks')
  })

  test('getContext() returns undefined for missing key', () => {
    const app = simpleCounterApp()
    app.start()
    expect(app.getContext('nope')).toBeUndefined()
  })

  test('getContext() works with dot-path', () => {
    const app = createAppState({
      initial: 's',
      context: { user: { name: 'Alice' } },
      states: { s: {} },
    })
    app.start()
    expect(app.getContext('user.name')).toBe('Alice')
  })
})

// ---------------------------------------------------------------------------
// DOM binding (_updateDataModels)
// ---------------------------------------------------------------------------
describe('AppState DOM binding', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('updates [data-model] text elements', () => {
    document.body.innerHTML = `
      <span data-model="count"></span>
      <span data-model="label"></span>
    `
    const app = simpleCounterApp()
    app.start()

    expect(document.querySelector('[data-model="count"]').textContent).toBe('0')
    expect(document.querySelector('[data-model="label"]').textContent).toBe('Clicks')

    app.send('INC')
    expect(document.querySelector('[data-model="count"]').textContent).toBe('1')
  })

  test('updates input[data-model] value', () => {
    document.body.innerHTML = '<input data-model="label" />'
    const app = simpleCounterApp()
    app.start()
    expect(document.querySelector('input').value).toBe('Clicks')

    app.send({ type: 'SET_LABEL', label: 'Taps' })
    expect(document.querySelector('input').value).toBe('Taps')
  })

  test('ignores elements with unknown data-model keys', () => {
    document.body.innerHTML = '<span data-model="nonexistent">original</span>'
    const app = simpleCounterApp()
    app.start()
    expect(document.querySelector('span').textContent).toBe('original')
  })
})

// ---------------------------------------------------------------------------
// createAppState shorthand
// ---------------------------------------------------------------------------
describe('createAppState()', () => {
  test('returns an AppState instance', () => {
    const app = createAppState({
      initial: 'idle',
      context: {},
      states: { idle: {} },
    })
    expect(app).toBeInstanceOf(AppState)
  })

  test('works end-to-end', () => {
    const app = createAppState({
      initial: 'on',
      context: { brightness: 50 },
      states: {
        on: {
          on: {
            DIM: { actions: (ctx) => { ctx.brightness -= 10 } },
            OFF: 'off',
          },
        },
        off: {
          on: { ON: 'on' },
        },
      },
    })
    app.start()
    expect(app.getState().value).toBe('on')
    app.send('DIM')
    expect(app.getContext('brightness')).toBe(40)
    app.send('OFF')
    expect(app.getState().value).toBe('off')
  })
})
