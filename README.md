# immer `lodash.isEmpty` draft regression — minimal reproduction

Since **immer 11.1.9**, reading `constructor` / `__proto__` on a draft returns a
wrapper `Proxy` whose `prototype` read returns a fake value. Because a function's
`prototype` is a non-configurable, non-writable data property, this violates a
Proxy invariant and throws:

```
TypeError: 'get' on proxy: property 'prototype' is a read-only and
non-configurable data property on the proxy target but the proxy did not return
its actual value (expected '#<Object>' but got '[object Object]')
```

The most common trigger is **`lodash.isEmpty()` on a draft inside a Redux Toolkit
reducer** (lodash reads `value.constructor.prototype`).

## Versions

| Package | Version |
| --- | --- |
| immer | `11.1.11` (first bad: `11.1.9`; `11.1.8` works) |
| @reduxjs/toolkit | `2.12.0` |
| lodash | `4.17.21` |
| Node | `v24.18.0` |

## Reproduce

```bash
npm install
npm run repro
```

Expected (broken) output:

```
immer version: 11.1.11
TypeError: 'get' on proxy: property 'prototype' is a read-only and non-configurable ...
    at isPrototype (.../lodash/lodash.js:6444:54)
    at lodash.isEmpty (.../lodash/lodash.js:11560:11)
```

### `repro.js` — real-world path (RTK + lodash)

```js
const {configureStore, createSlice} = require('@reduxjs/toolkit');
const _ = require('lodash');

const slice = createSlice({
  name: 'demo',
  initialState: {settings: {options: {}}},
  reducers: {
    setOptions(state, action) {
      _.isEmpty(state.settings.options); // throws on immer >= 11.1.9
      state.settings.options = action.payload;
    },
  },
});

const store = configureStore({reducer: {demo: slice.reducer}});
store.dispatch(slice.actions.setOptions({items: [{id: 1}]})); // TypeError
```

### `probe.js` — full blast radius (immer only)

`npm run probe` shows the wider fallout of the same change (dependency-free):

| Behavior | 11.1.8 | 11.1.9+ |
| --- | --- | --- |
| `lodash.isEmpty(draft)` | works | **throws `TypeError`** |
| `draft.constructor.prototype` (read) | works | **throws `TypeError`** |
| `produce({constructor: 'x'}, d => d.constructor)` | works | **throws `TypeError`** |
| `draft.constructor === Object` | `true` | `false` |
| `'constructor' in draft` | `true` | `false` |
| `draft.prototype = 42` (own data key) | persisted | **silently dropped** |

## Confirm the boundary

```bash
npm i immer@11.1.8 && npm run repro   # OK
npm i immer@11.1.9 && npm run repro   # TypeError
```

## Cause & fix

Introduced by immer commit
[`48fc378`](https://github.com/immerjs/immer/commit/48fc378), which added
`get` / `has` / `set` traps for `constructor` / `__proto__` in
`src/core/proxy.ts`. On a draft, `draft.constructor` **is** the real `Object` and
`draft.constructor.prototype` **is** the real `Object.prototype`, so
`draft.constructor.prototype.x = 1` is plain-JS `Object.prototype` mutation that
immer is not a vector for and cannot intercept without breaking `constructor`
identity. The traps therefore add no protection beyond immer's pre-existing
`setPrototypeOf` trap and patch-layer guards — while crashing common ecosystem
code.

Proposed fix (all 3688 immer tests pass) — removes the traps and replaces the
added tests with honest ones:
<https://github.com/immerjs/immer/compare/main...jonatankruszewski:immer:jony-demo>
