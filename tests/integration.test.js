/**
 * Integration tests – realistic end-to-end scenarios.
 */
import { createAppState } from '../src/spirit.js'

// ---------------------------------------------------------------------------
// Scenario 1: Counter with min/max boundaries using guards
// ---------------------------------------------------------------------------
describe('Integration: Bounded counter', () => {
  function boundedCounter() {
    return createAppState({
      id: 'bounded',
      initial: 'active',
      context: { count: 0 },
      states: {
        active: {
          on: {
            INC: {
              actions: (ctx) => { ctx.count++ },
              guard: (ctx) => ctx.count < 5,
            },
            DEC: {
              actions: (ctx) => { ctx.count-- },
              guard: (ctx) => ctx.count > 0,
            },
          },
        },
      },
    })
  }

  test('increments up to max', () => {
    const app = boundedCounter()
    app.start()
    for (let i = 0; i < 10; i++) app.send('INC')
    expect(app.getContext('count')).toBe(5)
  })

  test('decrements down to min', () => {
    const app = boundedCounter()
    app.start()
    app.send('INC').send('INC').send('INC') // count=3
    for (let i = 0; i < 10; i++) app.send('DEC')
    expect(app.getContext('count')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: Authentication flow
// ---------------------------------------------------------------------------
describe('Integration: Auth flow', () => {
  function authMachine() {
    return createAppState({
      id: 'auth',
      initial: 'loggedOut',
      context: { user: null, error: null },
      states: {
        loggedOut: {
          on: {
            LOGIN: {
              target: 'authenticating',
              actions: (ctx) => { ctx.error = null },
            },
          },
        },
        authenticating: {
          on: {
            SUCCESS: {
              target: 'loggedIn',
              actions: (ctx, e) => { ctx.user = e.user },
            },
            FAILURE: {
              target: 'loggedOut',
              actions: (ctx, e) => { ctx.error = e.message },
            },
          },
        },
        loggedIn: {
          on: {
            LOGOUT: {
              target: 'loggedOut',
              actions: (ctx) => { ctx.user = null },
            },
          },
        },
      },
    })
  }

  test('full login → logout cycle', () => {
    const app = authMachine()
    app.start()

    expect(app.getState().value).toBe('loggedOut')

    app.send('LOGIN')
    expect(app.getState().value).toBe('authenticating')

    app.send({ type: 'SUCCESS', user: 'Alice' })
    expect(app.getState().value).toBe('loggedIn')
    expect(app.getContext('user')).toBe('Alice')

    app.send('LOGOUT')
    expect(app.getState().value).toBe('loggedOut')
    expect(app.getContext('user')).toBeNull()
  })

  test('login failure preserves error message', () => {
    const app = authMachine()
    app.start()

    app.send('LOGIN')
    app.send({ type: 'FAILURE', message: 'Invalid password' })

    expect(app.getState().value).toBe('loggedOut')
    expect(app.getContext('error')).toBe('Invalid password')
  })

  test('cannot logout when not logged in', () => {
    const app = authMachine()
    app.start()
    app.send('LOGOUT')
    expect(app.getState().value).toBe('loggedOut') // no change
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: Todo list
// ---------------------------------------------------------------------------
describe('Integration: Todo list', () => {
  let nextId = 1

  function todoApp() {
    nextId = 1
    return createAppState({
      id: 'todo',
      initial: 'idle',
      context: { todos: [], filter: 'all' },
      states: {
        idle: {
          on: {
            ADD_TODO: {
              actions: (ctx, e) => {
                ctx.todos.push({ id: nextId++, text: e.text, done: false })
              },
            },
            TOGGLE_TODO: {
              actions: (ctx, e) => {
                const todo = ctx.todos.find((t) => t.id === e.id)
                if (todo) todo.done = !todo.done
              },
            },
            REMOVE_TODO: {
              actions: (ctx, e) => {
                ctx.todos = ctx.todos.filter((t) => t.id !== e.id)
              },
            },
            SET_FILTER: {
              actions: (ctx, e) => { ctx.filter = e.filter },
            },
          },
        },
      },
    })
  }

  test('add, toggle, remove todos', () => {
    const app = todoApp()
    app.start()

    app.send({ type: 'ADD_TODO', text: 'Buy milk' })
    app.send({ type: 'ADD_TODO', text: 'Walk dog' })
    expect(app.getContext('todos')).toHaveLength(2)

    const id = app.getContext('todos')[0].id
    app.send({ type: 'TOGGLE_TODO', id })
    expect(app.getContext('todos')[0].done).toBe(true)

    app.send({ type: 'REMOVE_TODO', id })
    expect(app.getContext('todos')).toHaveLength(1)
    expect(app.getContext('todos')[0].text).toBe('Walk dog')
  })

  test('filter changes', () => {
    const app = todoApp()
    app.start()
    app.send({ type: 'SET_FILTER', filter: 'completed' })
    expect(app.getContext('filter')).toBe('completed')
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: Form wizard (multi-step)
// ---------------------------------------------------------------------------
describe('Integration: Form wizard', () => {
  function wizardApp() {
    return createAppState({
      id: 'wizard',
      initial: 'step1',
      context: { name: '', email: '', plan: '' },
      states: {
        step1: {
          on: {
            SET_NAME: { actions: (ctx, e) => { ctx.name = e.name } },
            NEXT: {
              target: 'step2',
              guard: (ctx) => ctx.name.length > 0,
            },
          },
        },
        step2: {
          on: {
            SET_EMAIL: { actions: (ctx, e) => { ctx.email = e.email } },
            BACK: 'step1',
            NEXT: {
              target: 'step3',
              guard: (ctx) => ctx.email.includes('@'),
            },
          },
        },
        step3: {
          on: {
            SET_PLAN: { actions: (ctx, e) => { ctx.plan = e.plan } },
            BACK: 'step2',
            SUBMIT: {
              target: 'complete',
              guard: (ctx) => ctx.plan.length > 0,
            },
          },
        },
        complete: {},
      },
    })
  }

  test('complete wizard flow', () => {
    const app = wizardApp()
    app.start()

    // Step 1 – can't proceed without name
    app.send('NEXT')
    expect(app.getState().value).toBe('step1')

    app.send({ type: 'SET_NAME', name: 'Alice' })
    app.send('NEXT')
    expect(app.getState().value).toBe('step2')

    // Step 2 – can't proceed without valid email
    app.send('NEXT')
    expect(app.getState().value).toBe('step2')

    app.send({ type: 'SET_EMAIL', email: 'alice@example.com' })
    app.send('NEXT')
    expect(app.getState().value).toBe('step3')

    // Step 3 – back works
    app.send('BACK')
    expect(app.getState().value).toBe('step2')
    app.send('NEXT')
    expect(app.getState().value).toBe('step3')

    // Submit
    app.send('SUBMIT')
    expect(app.getState().value).toBe('step3') // blocked, no plan

    app.send({ type: 'SET_PLAN', plan: 'pro' })
    app.send('SUBMIT')
    expect(app.getState().value).toBe('complete')

    // Verify all data collected
    expect(app.getContext('name')).toBe('Alice')
    expect(app.getContext('email')).toBe('alice@example.com')
    expect(app.getContext('plan')).toBe('pro')
  })
})

// ---------------------------------------------------------------------------
// Scenario 5: DOM binding end-to-end
// ---------------------------------------------------------------------------
describe('Integration: DOM binding', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  test('full counter UI flow', () => {
    document.body.innerHTML = `
      <span data-model="count"></span>
      <span data-model="label"></span>
    `

    const app = createAppState({
      initial: 'on',
      context: { count: 0, label: 'Score' },
      states: {
        on: {
          on: {
            INC: { actions: (ctx) => { ctx.count++ } },
            SET: { actions: (ctx, e) => { ctx.label = e.label } },
          },
        },
      },
    })
    app.start()

    expect(document.querySelector('[data-model="count"]').textContent).toBe('0')
    expect(document.querySelector('[data-model="label"]').textContent).toBe('Score')

    app.send('INC')
    app.send('INC')
    expect(document.querySelector('[data-model="count"]').textContent).toBe('2')

    app.send({ type: 'SET', label: 'Points' })
    expect(document.querySelector('[data-model="label"]').textContent).toBe('Points')
  })
})
