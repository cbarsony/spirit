# Spirit

A lightweight, explicit, vanilla-first state management library that combines statecharts with HTML and Web Components.

**No build step. No framework. No magic.**

```
Spirit = State Machine + Subscriptions + DOM Binding + Web Components
```

## Quick Start

```html
<!DOCTYPE html>
<html>
<body>
  <h1>Count: <span data-model="count"></span></h1>
  <button onclick="app.send('INC')">+1</button>
  <button onclick="app.send('DEC')">-1</button>

  <script type="module">
    import { createAppState } from './src/spirit.js'

    const app = createAppState({
      initial: 'active',
      context: { count: 0 },
      states: {
        active: {
          on: {
            INC: { actions: (ctx) => { ctx.count++ } },
            DEC: { actions: (ctx) => { ctx.count-- } },
          },
        },
      },
    })

    app.start()
    window.app = app
  </script>
</body>
</html>
```

Open the file in a browser — it just works.

## Features

- **Zero dependencies** — tiny built-in state machine engine (~4 KB)
- **No build step** — ES modules, works directly in the browser
- **Explicit state machines** — define states, transitions, guards, and actions
- **One-way data binding** — `State → DOM`, never the reverse
- **Web Components** — `<model-counter />` auto-maps to `context.counter`
- **Data attributes** — `<span data-model="count">` does the same
- **Subscriptions** — `app.subscribe(state => { ... })` for custom logic
- **Familiar API** — inspired by XState's shape, no learning curve

## Installation

Spirit needs no package manager for browser use. Just import from the file:

```html
<script type="module">
  import { createAppState } from './src/spirit.js'
</script>
```

For Node.js testing or bundlers:

```bash
npm install   # installs dev dependencies (jest)
```

## API Reference

### `createMachine(definition)`

Creates a state machine from a definition object.

```js
import { createMachine } from './src/spirit.js'

const machine = createMachine({
  id: 'traffic',          // optional identifier
  initial: 'green',       // starting state
  context: { count: 0 },  // initial data
  states: {
    green:  { on: { NEXT: 'yellow' } },
    yellow: { on: { NEXT: 'red' } },
    red:    { on: { NEXT: 'green' } },
  },
})
```

**Transition handlers** can be:

| Form | Example |
|------|---------|
| String (target) | `NEXT: 'yellow'` |
| Object with target | `NEXT: { target: 'yellow' }` |
| Object with action | `INC: { actions: (ctx) => { ctx.count++ } }` |
| Object with guard | `GO: { target: 'running', guard: (ctx) => ctx.ready }` |
| Array of actions | `INIT: { actions: [(ctx) => { ... }, (ctx) => { ... }] }` |

**Actions** receive `(context, event)` where context is a mutable copy.

**Guards** receive `(context, event)` and must return `true` to allow the transition.

### `createAppState(definition)`

Shorthand that creates a machine and wraps it in an `AppState`:

```js
const app = createAppState({ initial: 'idle', context: {}, states: { idle: {} } })
```

### `AppState`

The bridge between your state machine and the DOM.

| Method | Description |
|--------|-------------|
| `app.start()` | Initialize the machine and perform first DOM update |
| `app.send(event)` | Send an event string or `{ type, ...payload }` |
| `app.subscribe(fn)` | Register a listener; returns an unsubscribe function |
| `app.getState()` | Get the current `{ value, context, matches() }` |
| `app.getContext(key)` | Get a context value (supports `'user.name'` dot-paths) |
| `app.destroy()` | Clear subscribers and stop the machine |

### `registerModelElements(appState, root?)`

Scans the DOM for `<model-*>` tags and registers them as Custom Elements that auto-bind to the matching context property.

```html
<model-counter />      <!-- binds to context.counter -->
<model-user-name />    <!-- binds to context.userName -->
```

Call **before** `app.start()`:

```js
registerModelElements(app)
app.start()
```

### DOM Binding

Any element with `data-model="key"` will automatically display the context value:

```html
<span data-model="count"></span>       <!-- textContent = context.count -->
<input data-model="username" />        <!-- value = context.username -->
```

Updates happen automatically after every `send()`.

## Examples

Four working examples are in the `examples/` folder. Serve them with any static server:

```bash
npx serve . -p 3000
```

Then open:

| Example | URL | Description |
|---------|-----|-------------|
| **Counter** | `/examples/counter.html` | Increment/decrement with pause state |
| **Todo App** | `/examples/todo.html` | Full CRUD with filtering |
| **Auth Flow** | `/examples/auth.html` | Login/logout with simulated async |
| **Form Wizard** | `/examples/wizard.html` | Multi-step form with guards & validation |

Or open the index at [`/examples/`](examples/index.html) for links to all demos.

## Testing

Tests use Jest with jsdom:

```bash
npm test
```

Test files:

| File | Covers |
|------|--------|
| `tests/helpers.test.js` | `tagToProperty`, `getNestedValue`, `deepClone` |
| `tests/machine.test.js` | `createMachine` — transitions, actions, guards |
| `tests/appstate.test.js` | `AppState` — lifecycle, send, subscribe, DOM binding |
| `tests/webcomponents.test.js` | `registerModelElements` — custom element registration |
| `tests/integration.test.js` | End-to-end: bounded counter, auth, todo, wizard |

## Architecture

```
┌─────────────────────────────────────────────┐
│         UI Layer (HTML + Web Components)    │
│  <model-counter />  <span data-model="x">  │
└──────────────────┬──────────────────────────┘
                   │ onclick → app.send(event)
                   ▼
┌─────────────────────────────────────────────┐
│       Subscription Layer (AppState)         │
│  subscribe() → notify → _updateDataModels  │
└──────────────────┬──────────────────────────┘
                   │ transition(state, event)
                   ▼
┌─────────────────────────────────────────────┐
│        State Machine (createMachine)        │
│  states → transitions → guards → actions   │
└─────────────────────────────────────────────┘
```

**Data flows one way:** User action → Event → State machine → Subscribers → DOM update.

## Philosophy

- **Explicit over implicit** — see exactly what happens, no hidden re-renders
- **HTML is enough** — no JSX, no templates, no custom syntax
- **State machines prevent bugs** — impossible states are impossible
- **No build step** — ES modules in the browser, done
- **Standards first** — Web Components, not proprietary abstractions

## License

MIT
