# Spirit - Architecture & Design Background

## Problem Statement

### The Gap in Modern Frontend Development

Web development has evolved through several paradigms:

1. **Server-side rendering (2000s)** - Server controls everything, HTML is templated
2. **Client-side MVC (2010s)** - Apps moved to browser, frameworks like Angular emerged
3. **Component-based (2010s-2020s)** - React, Vue brought declarative components
4. **Modern state management (2020s+)** - Explicit state machines (XState, Solid)

**The Gap**: Developers who prefer low-level, vanilla HTML/JS have no good solution for:
- Synchronizing state across multiple DOM elements
- Managing complex application flows
- Avoiding manual DOM updates when state changes

### Current Solutions & Their Problems

**Redux + React**
- ✅ Predictable state updates
- ❌ Tied to React (virtual DOM overhead)
- ❌ Requires build step (Babel, bundlers)
- ❌ Just a template (no opinionated state structure)
- ❌ Monolithic state tree (app state mixed with data state)

**Vue.js**
- ✅ Reactivity built-in
- ✅ Simple syntax
- ❌ Still a framework abstraction
- ❌ Learning curve for developers new to it
- ❌ Limited control over reactivity semantics

**Alpine.js**
- ✅ Minimal (13KB)
- ✅ No build step
- ✅ Works with vanilla HTML
- ❌ Limited to simple cases (no statecharts)
- ❌ Custom DSL (x-data, @click, x-if)
- ❌ Doesn't separate app state from data state

**Vanilla HTML/JS**
- ✅ Maximum control
- ✅ No dependencies
- ✅ Fastest (no framework overhead)
- ❌ Manual DOM synchronization (error-prone)
- ❌ No structure for complex state
- ❌ Hard to scale

## The Spirit Solution

### Core Insight: Layered Separation

Spirit separates concerns into three independent layers:
