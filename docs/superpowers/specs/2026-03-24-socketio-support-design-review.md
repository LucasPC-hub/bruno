# Design Review: Socket.IO Request Type Support

**Reviewer**: Senior Code Reviewer
**Date**: 2026-03-24
**Verdict**: **Issues Found** -- 6 items to address before implementation

---

## What Was Done Well

- The parallel-to-WebSocket approach is sound and consistent with how Bruno added gRPC/WS.
- File layout mirrors existing WS structure correctly (client, IPC handlers, event listeners, UI components, converters).
- Event-based architecture using `onAny()` is the right choice for Socket.IO.
- The decision to use `http://`/`https://` URLs (not `ws://`) correctly reflects Socket.IO's transport model.
- Test infrastructure section (mock server + E2E) is well thought out.

---

## Issues

### Critical (must fix)

**1. Item type naming mismatch with schema convention.**
The existing schema at `packages/bruno-schema/src/collections/index.js:550` uses the pattern `<protocol>-request` for item types: `http-request`, `graphql-request`, `grpc-request`, `ws-request`. The spec uses `type: socketio` in the Bru meta block but never explicitly defines the internal item type string. It must be `socketio-request` (matching the `*-request` convention) and this must be called out in the spec. The Yup `oneOf` array and the nested `when` chain in the schema both need updating.

**2. Missing `connections-changed` event.**
The WS implementation emits `main:ws:connections-changed` (with `type: 'added'|'removed'|'cleared'` and `activeConnectionIds`) whenever connections are added/removed. This event is critical for the frontend to track active connections across tabs. The spec's event list (Section 2) omits this -- it only lists `connecting`, `connected`, `message`, `error`, `disconnected`, `ack`. A `main:sio:connections-changed` event must be added.

**3. Missing `closeForCollection` method.**
The WS client has a `closeForCollection(collectionUid)` method used by `packages/bruno-electron/src/ipc/collection.js` to clean up all connections when a collection is closed. The spec's `SioClient` class only defines `disconnect()` (single connection). Without `closeForCollection`, closing a collection with active Socket.IO connections will leak resources.

### Important (should fix)

**4. Missing message queue / emit-on-connect pattern.**
The WS client has `messageQueues` and a `queueMessage` / `#flushQueue` pattern -- messages can be queued before the connection is open and auto-sent on connect. The spec says "No message queue needed -- Socket.IO handles reconnection buffering internally." This is partially true for reconnection, but Socket.IO does **not** buffer emits before the initial connection is established (`socket.emit()` before `connect` event will be silently dropped unless `socket.connected` is true). The spec should either (a) queue events until `connect` fires, or (b) explicitly document that `emitEvent` will throw/warn if called before connection is established.

**5. IPC channel naming inconsistency.**
The spec defines `renderer:sio:start-connection` but existing WS uses `renderer:ws:start-connection` (also `renderer:ws:queue-message`, `renderer:ws:send-message`, `renderer:ws:close-connection`, `renderer:ws:is-connection-active`, `renderer:ws:get-active-connections`). The spec is missing equivalents for:
- `renderer:sio:get-active-connections`
- `renderer:sio:is-connection-active`

Both are used by the frontend for state management. Add them.

**6. Redux slice integration not specified.**
The WS event listener uses specific Redux actions (`wsResponseReceived`, `runWsRequestEvent`) and updates collection slice state. The spec mentions "extending existing response/request slice patterns" but does not define the actual action names, reducer cases, or state shape within the collections slice. An implementer needs to know: (a) what new actions to create (e.g., `sioResponseReceived`), (b) where in the item state the SIO response data lives, and (c) how `draft` vs committed request state works for Socket.IO items (the WS implementation uses `item.draft?.request?.body?.ws`).

---

## Suggestions (nice to have)

- Consider documenting the `socket.io-client` transport fallback behavior (WebSocket -> polling) and whether Bruno should force WebSocket-only transport via `{ transports: ['websocket'] }` option, or expose it as a user config.
- The Bru lang parser section (Section 6) is thin -- it should reference which parser file(s) to modify and the grammar structure, since the existing parser has no WS references visible in `packages/bruno-lang/src/`.
- Consider adding a `renderer:sio:emit-event` equivalent of `renderer:ws:queue-message` for consistency -- the WS flow separates queuing from sending, which allows pre-connection setup.
