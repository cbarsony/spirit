# Spirit - Development Plan

## Project Overview

Spirit is a lightweight state management library that combines XState statecharts with vanilla HTML/JS and Web Components. It provides one-way data binding and event handling without the overhead of traditional frameworks.

## Core Philosophy

- **Explicit over Implicit**: Clear, understandable code without magic
- **Low-level & Vanilla**: Works with standard HTML, CSS, and JavaScript
- **No Build Steps Required**: Works directly in browsers via ES modules
- **Single Responsibility**: State machines handle logic, subscriptions handle notifications, HTML handles structure

## Architecture

### Three-Layer Design

1. **State Machine Layer (XState)**
   - Manages application state using statecharts
   - Defines states, transitions, and context
   - Prevents impossible states

2. **Subscription Layer**
   - AppState class manages subscriptions
   - Notifies listeners when state changes
   - Handles DOM binding automation

3. **UI Layer (HTML/Web Components)**
   - Vanilla HTML with semantic bindings
   - Custom elements (`<model-*>`) for semantic rendering
   - Data attributes (`data-model`) for explicit binding

### Data Flow
