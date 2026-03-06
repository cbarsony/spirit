# Spirit Architecture

## Layer Diagram

```
┌─────────────────────────────────────────────┐
│         UI Layer (HTML + Web Components)     │
│  - Vanilla HTML structure                   │
│  - Custom elements for components           │
│  - No framework syntax                      │
└──────────────────┬──────────────────────────┘
                   │ data-model binding
                   │ onclick handlers
                   ▼
┌─────────────────────────────────────────────┐
│        Subscription Layer (AppState)        │
│  - Notifies subscribers of state changes    │
│  - Automatically updates data-model elements│
│  - Bridges state machine and DOM            │
└──────────────────┬──────────────────────────┘
                   │ subscribe()
                   │ notify()
                   ▼
┌─────────────────────────────────────────────┐
│        State Machine Layer (XState)         │
│  - Defines states, transitions, context     │
│  - Prevents impossible states               │
│  - Handles complex application flows        │
└─────────────────────────────────────────────┘
```

### Why This Works

1. **Each layer is independent**
   - Can understand each layer separately
   - Can test each layer independently
   - Can replace each layer if needed

2. **Clear data flow (one-way)**
   - State Machine → State changes
   - Subscriptions → Notifications sent
   - DOM updates → UI reflects state
   - User action → Event sent to state machine

3. **Minimal abstraction**
   - No virtual DOM
   - No JSX
   - No template syntax
   - Just HTML, JS, and XState

4. **Developer experience**
   - See exactly what's happening
   - Minimal "magic"
   - Easy to debug
   - Natural progression: HTML → JS → State Machine

---

## Architectural Decisions

### Decision 1: One-Way Data Binding (Not Two-Way)

**Chosen: One-way (State → DOM)**

**Reasoning:**
- Mirrors traditional web architecture (client requests, server responds)
- Easier to reason about (single source of truth)
- Prevents circular updates
- Cleaner debugging

**Analogy:**
- Server cannot push to client without request
- Similarly, DOM should not auto-update model
- Must explicitly send event to update state

**Example:**

```html
<!-- User action sends event -->
<button onclick="appState.send('INCREMENT')">+1</button>

<!-- State updates -->
<!-- DOM reflects new state -->
<model-counter />
```

---

### Decision 2: XState as Core State Machine

**Chosen: XState for state machines**

**Why:**
- Industry standard (Stately.ai backing)
- Explicit state definitions prevent impossible states
- Rich features (guards, invocations, parallel states)
- Active community and maintenance
- Mature and battle-tested

**What XState provides:**

```javascript
const machine = createMachine({
  initial: 'idle',
  states: {
    idle: { on: { START: 'running' } },
    running: { on: { STOP: 'idle' } }
  }
})
```

- ✅ Defines valid states
- ✅ Defines valid transitions
- ✅ Prevents impossible states (can't go from idle to idle on START)
- ✅ Manages context (data)

**Alternative considered: Custom state machine**
- ❌ Would reinvent the wheel
- ❌ Less features
- ❌ No community support

---

### Decision 3: Web Components for Semantic Elements

**Chosen: Custom elements (`model-counter`, `model-status`, etc.)**

**Why:**
- Standard web API (not proprietary)
- Progressive enhancement (works with vanilla HTML)
- Encapsulation (CSS scoping, DOM scoping)
- Future-proof (part of web standards)

**How it works:**

```html
<model-counter />
```

Auto-magically:
1. Tag name `model-counter` extracted
2. Property name derived: `counter`
3. Element subscribes to state changes
4. Updates `textContent` when `state.context.counter` changes

**Alternative considered: Pure data attributes**

```html
<div data-model="counter"></div>
```

This works but:
- Less semantic (just a div)
- Cannot encapsulate custom styling
- Convention-based (element name tells you intent)

---

### Decision 4: AppState Class — The Bridge

**Chosen: AppState class that wraps XState and manages subscriptions**

**Responsibilities:**

```javascript
class AppState {
  // Initialize XState machine
  constructor(machineDefinition) { }
  
  // Start subscriptions and DOM binding
  start() { }
  
  // Send events to state machine
  send(event) { }
  
  // Manual subscriptions for custom logic
  subscribe(callback) { }
  
  // Internal: update all data-model elements
  _updateDataModels() { }
  
  // Internal: notify all subscribers
  _notifySubscribers() { }
}
```

**Why this layer exists:**
- XState doesn't know about HTML/DOM
- Subscriptions don't know about XState
- AppState bridges them seamlessly

**Data flow:**

```
User clicks button
    ↓
appState.send('EVENT')
    ↓
XState machine transitions
    ↓
AppState._notifySubscribers()
    ↓
Custom subscriptions called
AppState._updateDataModels()
    ↓
DOM updated
```

---

### Decision 5: Two Binding Patterns

**Pattern A: Semantic Elements (Convention)**

```html
<model-counter />      <!-- Auto-maps to counter property -->
<model-user-name />    <!-- Auto-maps to userName property -->
<model-is-loading />   <!-- Auto-maps to isLoading property -->
```

**Pattern B: Explicit Attributes (Flexibility)**

```html
<div data-model="counter" />
<p data-model="userName" />
<span data-model="isLoading" />
```

**Both work because:**
- `registerModelElements()` creates `model-*` elements automatically
- `_updateDataModels()` finds and updates `[data-model]` elements
- Developers can use whichever feels right

---

### Decision 6: No Build Step Required

**Chosen: ES modules only (no transpilation)**

**Why:**
- Aligns with "vanilla HTML/JS" philosophy
- Works directly in modern browsers
- Faster development (no build step)
- Simpler mental model
- Easier to debug (actual source code runs)

**Example usage:**

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { createAppState } from 'https://cdn.example.com/spirit.js'
    
    window.appState = createAppState({...})
    appState.start()
  </script>
</head>
<body>
  <model-counter />
  <button onclick="appState.send('INCREMENT')">+1</button>
</body>
</html>
```

**Trade-off:**
- Must use modern browser features (ES6+)
- No IE11 support (acceptable in 2026)
- No TypeScript compilation (can add optionally later)

---

### Decision 7: Explicit > Implicit

**Philosophy: Verbose but clear over magical**

**Example — updating DOM:**

React approach (implicit):

```jsx
function Counter() {
  const [count, setCount] = useState(0)
  return <div>{count}</div>
}
// Magic: How does React know to re-render? How does JSX become HTML?
```

Spirit approach (explicit):

```javascript
appState.subscribe(state => {
  document.querySelector('[data-model="counter"]').textContent = 
    state.context.counter
})
```

**Why explicit is better for Spirit:**
- ✅ Easier to understand for beginners
- ✅ Clear what's happening
- ✅ Fewer surprises
- ✅ Better for learning fundamentals
- ✅ Easier to debug

---

## Core Architecture

### The State Machine Core

```javascript
const appMachine = createMachine({
  id: 'app',
  initial: 'home',
  context: {
    counter: 0,
    userName: 'Guest',
    isLoading: false
  },
  states: {
    home: {
      on: {
        INCREMENT: {
          actions: (ctx) => { ctx.counter++ }
        },
        GOTO_LOGIN: 'login'
      }
    },
    login: {
      on: {
        SUBMIT: 'authenticating',
        CANCEL: 'home'
      }
    },
    authenticating: {
      on: {
        SUCCESS: {
          target: 'authenticated',
          actions: (ctx) => { ctx.userName = 'John' }
        },
        ERROR: 'login'
      }
    },
    authenticated: {
      on: {
        LOGOUT: 'home'
      }
    }
  }
})
```

**Key points:**
- **States:** `home`, `login`, `authenticating`, `authenticated`
- **Context:** `counter`, `userName`, `isLoading`
- **Transitions:** `INCREMENT` goes from home to itself with action
- **Actions:** Modify context

**Impossible states prevented:**
- Cannot be in `authenticating` and `home` simultaneously
- Cannot `LOGOUT` while in `login` state
- Context always reflects valid state

---

### The Subscription Layer

```javascript
class AppState {
  constructor(machineDefinition) {
    this.machine = createMachine(machineDefinition)
    this.service = interpret(this.machine)
    this.subscribers = new Set()
    this.currentState = null
  }
  
  start() {
    // Subscribe to XState changes
    this.service.subscribe(state => {
      this.currentState = state
      
      // Notify all subscribers
      this._notifySubscribers()
      
      // Update data-model elements
      this._updateDataModels()
    })
    
    this.service.start()
  }
  
  send(event) {
    this.service.send(event)
  }
  
  subscribe(callback) {
    this.subscribers.add(callback)
    // Call immediately with current state
    if (this.currentState) callback(this.currentState)
    return () => this.subscribers.delete(callback)
  }
  
  _notifySubscribers() {
    this.subscribers.forEach(cb => {
      try {
        cb(this.currentState)
      } catch (err) {
        console.error('Error in subscriber:', err)
      }
    })
  }
  
  _updateDataModels() {
    document.querySelectorAll('[data-model]').forEach(el => {
      const prop = el.getAttribute('data-model')
      const value = this.currentState.context[prop]
      
      if (value !== undefined && el.textContent !== String(value)) {
        el.textContent = value
      }
    })
  }
}
```

**Key responsibilities:**
- Wraps XState service
- Manages subscriptions
- Auto-updates `data-model` elements
- Bridges state machine and DOM

---

### The HTML Layer

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; }
    .counter { font-size: 24px; }
  </style>
</head>
<body>
  <!-- Semantic element -->
  <h1>Count: <model-counter class="counter" /></h1>
  
  <!-- Explicit binding -->
  <p>User: <span data-model="userName"></span></p>
  
  <!-- Events trigger state changes -->
  <button onclick="appState.send('INCREMENT')">+1</button>
  <button onclick="appState.send('DECREMENT')">-1</button>
  <button onclick="appState.send('GOTO_LOGIN')">Login</button>
  
  <script type="module">
    import { createAppState, registerModelElements } from './spirit.js'
    
    // Create state machine
    window.appState = createAppState({
      initial: 'home',
      context: { counter: 0, userName: 'Guest' },
      states: {
        home: {
          on: {
            INCREMENT: { actions: (ctx) => { ctx.counter++ } },
            DECREMENT: { actions: (ctx) => { ctx.counter-- } },
            GOTO_LOGIN: 'login'
          }
        },
        login: {
          on: { BACK: 'home' }
        }
      }
    })
    
    // Auto-register semantic elements
    registerModelElements(appState)
    
    // Start the state machine
    appState.start()
    
    // Custom subscriptions for complex logic
    appState.subscribe(state => {
      if (state.matches('authenticating')) {
        document.body.classList.add('loading')
      } else {
        document.body.classList.remove('loading')
      }
    })
  </script>
</body>
</html>
```

**Key points:**
- HTML is vanilla (no custom syntax)
- Events are simple `onclick` attributes
- State displays via semantic elements or data attributes
- Custom subscriptions for complex logic

---

## Data Flow Visualization

### Simple Counter Example

```
┌────────────────────────────────────────────────────────┐
│ HTML: <button onclick="appState.send('INCREMENT')">+1  │
└────────────────────┬───────────────────────────────────┘
                     │ User clicks button
                     ▼
┌────────────────────────────────────────────────────────┐
│ AppState.send('INCREMENT')                             │
└────────────────────┬───────────────────────────────────┘
                     │ Event sent to service
                     ▼
┌────────────────────────────────────────────────────────┐
│ XState Machine: home state processes INCREMENT         │
│ Action: (ctx) => { ctx.counter++ }                     │
└────────────────────┬───────────────────────────────────┘
                     │ State updated (counter: 1)
                     ▼
┌────────────────────────────────────────────────────────┐
│ AppState._notifySubscribers()                          │
│ - Calls all subscriptions with new state               │
└────────────────────┬───────────────────────────────────┘
                     │ Subscriptions called
                     ▼
┌────────────────────────────────────────────────────────┐
│ AppState._updateDataModels()                           │
│ - Updates <model-counter /> and [data-model="counter"] │
└────────────────────┬───────────────────────────────────┘
                     │ DOM updated
                     ▼
┌────────────────────────────────────────────────────────┐
│ HTML: <model-counter>1</model-counter>                 │
└────────────────────────────────────────────────────────┘
```

### Complex App with Conditionals

```
User Action (button click)
    ↓
appState.send('EVENT')
    ↓
State Machine transition
    ↓
AppState._notifySubscribers()
    ├─ Subscription 1: Update UI classes based on state
    ├─ Subscription 2: Show/hide loading indicator
    ├─ Subscription 3: Custom business logic
    └─ AppState._updateDataModels()
       └─ Update all [data-model] elements
    ↓
DOM reflects new state
```

---

## Design Patterns Used

### 1. Observer Pattern (Subscriptions)

```javascript
appState.subscribe(callback)  // Observer registers

// When state changes:
appState._notifySubscribers()  // All observers called
```

Allows multiple listeners to react to state changes independently.

### 2. State Pattern (XState)

```javascript
const state = {
  home: { on: { LOGIN: 'authenticating' } },
  authenticating: { on: { SUCCESS: 'authenticated' } }
}
```

Explicit states prevent invalid transitions.

### 3. Facade Pattern (AppState)

```javascript
// XState is complex, AppState simplifies it:
appState.send('EVENT')      // Simple interface
appState.subscribe(cb)      // Easy subscription
appState.start()            // One-line initialization
```

### 4. Convention over Configuration (`model-*` elements)

```html
<model-counter />  <!-- Convention: name maps to property -->
<!-- Instead of: -->
<div data-bind="counter" data-format="text" />
```

### 5. Dependency Injection

```javascript
appState.subscribe(state => {
  // State injected as parameter
  console.log(state.context.counter)
})
```

---

## Comparison with Similar Projects

### vs Redux + React

| Aspect | Redux+React | Spirit |
|---|---|---|
| State Machine | No (just reducers) | Yes (XState) |
| Vanilla HTML | No | Yes |
| Build Step | Yes | No |
| Learning Curve | Steep | Gentle |
| Bundle Size | 40KB+ | ~30KB |
| One-way flow | Yes | Yes |
| Framework | Full | Library only |

### vs Vue.js

| Aspect | Vue | Spirit |
|---|---|---|
| Reactivity | Automatic | Explicit subscriptions |
| Statecharts | No | Yes |
| Build Step | Optional | No |
| Learning Curve | Medium | Low |
| Framework | Yes | No (library) |
| HTML Syntax | Custom | Vanilla |

### vs Alpine.js

| Aspect | Alpine | Spirit |
|---|---|---|
| Size | 13KB | ~30KB (mostly XState) |
| Statecharts | No | Yes |
| Custom Syntax | Yes (`x-data`, `@click`) | No (vanilla HTML) |
| Scalability | Limited | Medium-High |
| Learning Curve | Very Low | Low |
| Web Components | No support | Full support |

### vs XState Alone

| Aspect | XState | Spirit |
|---|---|---|
| HTML Binding | No (manual) | Yes (automatic) |
| DOM Updates | Manual subscribe | Auto + subscribe |
| Learning Curve | Steep | Gentle |
| Web Components | Not integrated | Fully integrated |
| DOM Example | None | Many |

---

## Use Cases

### Ideal For

- **Simple to medium complexity apps**
  - Todo lists
  - Shopping carts
  - Multi-page apps with navigation
  - Form wizards
  - Authentication flows
  - Dashboard apps

- **Web component authors**
  - Building reusable components
  - With clear state management
  - Encapsulated styling

- **Developers who prefer vanilla HTML/JS**
  - Minimal abstractions
  - Understanding every line
  - Learning fundamentals

- **Learning statecharts**
  - Practical examples
  - Real-world patterns
  - Without framework overhead

- **Legacy HTML5 upgrade**
  - Adding interactivity to static sites
  - Gradual enhancement
  - No build step required

### Not Ideal For

- ❌ Large complex enterprise apps (might need Redux for data state)
- ❌ Real-time collaborative apps (would need server sync layer)
- ❌ Developers wanting maximum DX (React has better tooling)
- ❌ Projects requiring IE support
- ❌ Apps with millions of state updates/second

---

## Future Extensions (Not in Phase 1)

### Middleware System

```javascript
appState.use(middleware)

// Log all transitions
const logMiddleware = (state, event) => {
  console.log(`${state.value} + ${event.type}`)
}
```

### Async Actions

```javascript
const machine = createMachine({
  states: {
    loading: {
      invoke: {
        src: async () => fetch('/api/data'),
        onDone: { target: 'loaded' },
        onError: { target: 'error' }
      }
    }
  }
})
```

### State Persistence

```javascript
appState.persistTo('localStorage')
appState.restoreFrom('localStorage')
```

### DevTools Integration

```javascript
appState.connectDevTools()
// Visualize state machine
// Send events from UI
// Time-travel debugging
```

### TypeScript Support

```typescript
interface Context {
  counter: number
  userName: string
}

type Event = 
  | { type: 'INCREMENT' }
  | { type: 'SET_NAME'; name: string }

const machine = createMachine<Context, Event>({...})
```

---

## Philosophy Summary

Spirit is for developers who believe:

- **Simplicity beats cleverness**
  - Explicit code is better than magic
  - Easy to understand > clever abstractions

- **HTML is great**
  - Don't abstract it away unnecessarily
  - Vanilla HTML + JS is valid approach

- **State machines matter**
  - Explicit states prevent bugs
  - Impossible states should be impossible

- **Low-level is fine**
  - Vanilla JS is not outdated
  - Understanding fundamentals matters

- **One-way is right**
  - Clear data flow prevents bugs
  - Single source of truth

- **Learning > frameworks**
  - Understanding fundamentals matters most
  - Frameworks should teach, not hide

- **Standards > proprietary**
  - Web components are the future
  - Use native APIs when possible

- **No build step = faster**
  - ES modules are enough
  - Development loop matters

---

## The Spirit Manifesto

Spirit believes that web applications don't need to be complex.

You can build sophisticated, maintainable apps with:

- **Vanilla HTML** (no custom syntax)
- **Vanilla JavaScript** (no compilation)
- **Explicit state machines** (no guessing)
- **Simple subscriptions** (no magic)

Spirit is the anti-framework framework.

Not because frameworks are bad, but because sometimes you don't need all their features.

Spirit is for the developers who understand that sometimes, the simplest solution is the best one.

> **In essence: Spirit = XState + HTML + Subscriptions + Web Components**
>
> A lightweight, explicit, vanilla-first approach to state management that brings React's reactivity and XState's statecharts to HTML without the framework overhead.
