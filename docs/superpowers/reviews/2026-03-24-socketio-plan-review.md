# Plan Review: Socket.IO Support Implementation

**Verdict: Issues Found**

**Reviewer**: Code Review Agent
**Date**: 2026-03-24

---

## What the plan does well

- Clear task ordering with correct dependency chain (mock server -> client -> schema -> parser -> IPC -> Redux -> UI -> routing -> converter -> E2E)
- Good test-first approach in Tasks 2 and 4 (write test, verify failure, implement, verify pass)
- Accurate line numbers for `packages/bruno-schema/src/collections/index.js` (line 550), `packages/bruno-electron/src/ipc/network/index.js` (line 36, 1985), `packages/bruno-electron/src/ipc/collection.js` (line 1015), and all `RequestTabPanel` references
- Code snippets match existing codebase patterns (EventEmitter, IPC channel naming, Redux slice structure)

---

## Critical Issues (must fix)

### C1: At least 14 files referencing `ws-request` are missing from the plan

The plan only covers a subset of places that check for request types. The following files also need `socketio-request` added but are NOT in the plan:

| File | Line(s) | What needs adding |
|------|---------|-------------------|
| `packages/bruno-electron/src/utils/constants.js:1` | `REQUEST_TYPES` array | Add `'socketio-request'` |
| `packages/bruno-app/src/utils/common/constants.js:1` | `REQUEST_TYPES` array | Add `'socketio-request'` |
| `packages/bruno-schema-types/src/collection/item.ts:12` | `ItemType` union | Add `'socketio-request'` |
| `packages/bruno-filestore/src/formats/bru/index.ts:28,37,83,130,364` | Bru format read/write | Add `socketio` case to switch, URL path mapping, and transform logic |
| `packages/bruno-electron/src/ipc/collection.js:1166` | Second type check array | Plan only covers line 1015, misses the second check at 1166 |
| `packages/bruno-electron/src/utils/collection.js:506` | Type mapping `ws: 'ws-request'` | Add `socketio: 'socketio-request'` |
| `packages/bruno-app/src/utils/collections/index.js:715,722,854,1101` | Multiple type checks | Need `socketio-request` in `isRequest()`, URL extraction, and type arrays |
| `packages/bruno-app/src/utils/collections/export.js:44,57,69` | Collection export | Handle socketio-request in export logic |
| `packages/bruno-app/src/utils/importers/common.js:100,138` | Import handling | Handle socketio-request type |
| `packages/bruno-app/src/utils/tabs/index.js:4` | `isRequest()` check | Add `'socketio-request'` to array |
| `packages/bruno-app/src/providers/ReduxStore/slices/tabs.js:52` | Tab creation logic | Add `'socketio-request'` alongside `'ws-request'` |
| `packages/bruno-app/src/providers/ReduxStore/slices/collections/actions.js:573` | Save request action | Handle socketio-request type |
| `packages/bruno-app/src/components/Sidebar/Collections/Collection/CollectionItem/RequestMethod/index.js:7,37` | Method badge display | Add socketio display logic |
| `packages/bruno-app/src/components/RunnerResults/RunConfigurationPanel/index.jsx:19` | Runner config | Handle socketio type |
| `packages/bruno-app/src/components/ShareCollection/index.js:33` | Share collection | Handle socketio type |

**Impact**: Without these changes, Socket.IO requests will fail to save, export, import, display in sidebar, or work in the runner. The feature would appear broken despite the core implementation being correct.

### C2: `bruno-filestore` package entirely missing from plan

The `packages/bruno-filestore/src/formats/bru/index.ts` file is responsible for reading `.bru` files from disk and converting them to internal format (and vice versa). It has 5 locations checking for `ws`/`ws-request` that need parallel `socketio`/`socketio-request` cases. Without this, `.bru` files with `type: socketio` will not load from the filesystem at all.

### C3: `bruno-cli` support missing

`packages/bruno-cli/src/utils/bru.js:67,110` handles Bru file parsing in the CLI. If Socket.IO requests should work in `bruno-cli` (even as a "not supported" message), this file needs updating. The spec does not explicitly exclude CLI support, so the plan should either add it or document it as out of scope.

---

## Important Issues (should fix)

### I1: `newSioRequest` action not defined in plan

Task 9 Step 2 mentions "Add the `newSioRequest` action handler (model after `newWsRequest` at line 151)" but this action is never actually created. Task 6 only adds `runSioRequestEvent` and `sioResponseReceived` reducers. A `newSioRequest` (or equivalent) action in `collections/actions.js` is needed to create new socketio-request items from the New Request modal.

### I2: Task 6 Step 3 is vague

"Find where `useWsEventListeners` is called" is not specific enough for a 2-5 minute step. The plan should provide the exact file path and line number.

### I3: SioClient test uses CommonJS `require` but implementation uses ESM `import`

Task 2 Step 2 test uses `const { SioClient } = require('../sio-client')` but Step 4 implementation uses `import/export` syntax. This will fail unless there is a build/transform step. Should be consistent.

### I4: Task 7 Step 3 creates `SioRequestPane` but never defines where

"Either create a dedicated `SioRequestPane` component or compose inline" is ambiguous. This should specify the exact file path and approach to match the pattern used in Task 9 which references `<SioRequestPane>`.

---

## Suggestions (nice to have)

### S1: Parallelization opportunity

Tasks 1 (mock server) and 3 (schema/types) are independent and could be done in parallel. The plan lists them sequentially.

### S2: Task 4 grammar line numbers may drift

The plan references lines 33, 35, 510, 1053 in `bruToJson.js`. If Task 3 modifies `index.js` first, these are fine, but an explicit note that line numbers are approximate would help.

### S3: Task 10 Step 2 is vague

"Find where `fromOpenCollectionWebsocketItem` is imported/called and add the socketio equivalent alongside it" -- should specify the exact file: `packages/bruno-converters/src/opencollection/items/index.ts:93`.

---

## Granularity Assessment

Most steps are well-sized (2-5 minutes). Task 5 Step 1 (Create IPC event handlers) is the largest at potentially 15-20 minutes since it involves writing a full handler file from scratch with 6 IPC channels + event bridge. Consider splitting into: (a) create file with connection handlers, (b) add emit/status handlers, (c) add event bridge.

## Testability Assessment

Tasks 1-4 have clear verification steps. Tasks 7-8 (UI components) lack testability criteria -- there are no visual or unit test verification steps. Consider adding "render the component in Storybook" or "verify the component renders without errors" checks.

---

## Summary

The plan has a solid structure and correct core architecture, but it misses **at least 14 integration points** across the codebase that check for `ws-request` and need parallel `socketio-request` handling. The most critical omission is the entire `bruno-filestore` package, without which `.bru` files cannot be loaded. These must be added before the plan can be approved.
