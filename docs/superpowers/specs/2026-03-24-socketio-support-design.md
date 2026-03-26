# Socket.IO Request Type Support for Bruno

**Date**: 2026-03-24
**Status**: Draft

## Overview

Add Socket.IO as a new request type in Bruno, enabling users to test Socket.IO servers the same way they test HTTP, WebSocket, and gRPC endpoints. Follows a full parallel implementation approach — Socket.IO gets its own client, IPC handlers, UI components, schema types, and Bru lang format, mirroring the existing WebSocket architecture.

## Decisions

- **Scope**: Intermediate feature set — connect to namespaces, emit events, listen for events, acknowledgements, auth tokens, custom headers
- **Protocol version**: Socket.IO v3/v4 only (via `socket.io-client` ^4.x)
- **Event model**: Multiple events per request (list of events to emit, like WS message list). Incoming events captured implicitly via `onAny()`.
- **Request type**: New `socketio-request` item type (following Bruno's `*-request` naming convention in the schema validator), fully separate from `ws`
- **Implementation strategy**: Full parallel to WebSocket — no shared abstractions, no refactoring of existing WS code

## 1. Schema & Bru Lang Format

### Schema Types

New file: `packages/bruno-schema-types/src/requests/socketio.ts`

```ts
interface SocketIOEvent {
  name: string;        // event name (e.g. "chat:message")
  content?: string;    // payload (JSON string, raw text)
  type?: string;       // json | text
}

interface SocketIORequestBody {
  mode: 'socketio';
  socketio?: SocketIOEvent[];
}

interface SocketIORequest {
  url: string;
  namespace?: string;         // e.g. "/chat" (defaults to "/")
  auth?: Record<string, any>; // Socket.IO auth payload
  headers?: Record<string, string>;
  body: SocketIORequestBody;
  script?: { req?: string; res?: string };
  vars?: { req?: any[]; res?: any[] };
  assertions?: any[];
  tests?: string;
  docs?: string;
}
```

### Bru File Format

```bru
meta {
  name: chat-test
  type: socketio
  seq: 1
}

socketio {
  url: http://localhost:3000
  namespace: /chat
  auth: inherit
}

body:socketio {
  event: chat:message
  type: json
  content: '''
  {"text": "hello", "room": "general"}
  '''
}

body:socketio {
  event: user:typing
  type: json
  content: '''
  {"typing": true}
  '''
}
```

Socket.IO uses `http://` / `https://` URLs (not `ws://`) since it starts with an HTTP handshake. Each `body:socketio` block represents one event to emit, with an `event` field instead of WS's `name`.

## 2. Client & Request Execution

New file: `packages/bruno-requests/src/sio/sio-client.js`

Mirrors `ws-client.js` structure:

### SioClient Class

- `startConnection(url, options)` — creates a `socket.io-client` `io()` connection with namespace, auth, headers, and SSL options
- `emitEvent(eventName, data, withAck?)` — emits an event, optionally waits for acknowledgement callback
- `disconnect()` — closes the connection
- `connectionStatus()` — returns `connecting` / `connected` / `disconnected`
- `closeForCollection(collectionUid)` — closes all active Socket.IO connections belonging to a collection (called when collection is closed, prevents connection leaks — mirrors WS's `closeForCollection()` called from `packages/bruno-electron/src/ipc/collection.js`)

### State Management

- `activeConnections` Map keyed by request UID (same pattern as WS)
- **Pre-connect emit queue**: `socket.io-client` silently drops emits before the initial `connect` event fires. SioClient must queue events submitted before connection is established and flush them on `connect`. This mirrors the `messageQueues` pattern in WsClient.

### Events Emitted (IPC bridge)

- `main:sio:connecting` — connection attempt started
- `main:sio:connected` — handshake complete
- `main:sio:message` — incoming event received (includes event name + data)
- `main:sio:error` — connection or protocol error
- `main:sio:disconnected` — connection closed (includes reason)
- `main:sio:ack` — acknowledgement received for an emitted event
- `main:sio:connections-changed` — active connections map changed (connect/disconnect) — required for frontend connection tracking

### Incoming Event Handling

Uses `socket.onAny((eventName, ...args) => ...)` to capture all incoming events without requiring users to pre-declare listeners.

### New Dependency

`socket.io-client` (^4.x) added to `packages/bruno-requests/package.json`.

## 3. Electron IPC Handlers

New file: `packages/bruno-electron/src/ipc/network/sio-event-handlers.js`

Mirrors `ws-event-handlers.js`:

### Functions

- `prepareSioRequest()` — interpolates variables, merges headers/auth from collection/folder inheritance (same pattern as `prepareWsRequest`)

### IPC Channels

- `renderer:sio:start-connection` — creates SioClient, connects, optionally emits initial events if `connectOnly` is false
- `renderer:sio:emit-event` — emits a named event on active connection
- `renderer:sio:disconnect` — closes connection
- `renderer:sio:connection-status` — returns current status
- `renderer:sio:get-active-connections` — returns list of active Socket.IO connection UIDs (used by frontend to restore state on reload)
- `renderer:sio:is-connection-active` — checks if a specific connection is active (used by UI to render connect/disconnect button state)

### Event Bridge

Relays SioClient events back to renderer via `window.webContents.send()` using the same `sendEvent()` pattern as WS.

## 4. Redux & Event Listeners

New file: `packages/bruno-app/src/utils/network/sio-event-listeners.js`

Mirrors `ws-event-listeners.js`:

### Subscriptions

- `main:sio:connecting`, `main:sio:connected`, `main:sio:message`, `main:sio:error`, `main:sio:disconnected`, `main:sio:ack`, `main:sio:connections-changed`
- Dispatches Redux actions (see below)
- Connection status polling at 2s intervals (same as WS)

### Redux Actions & Reducer Cases

Actions to add to the collections slice (mirroring WS pattern):

- `sioResponseReceived({ itemUid, data })` — appends incoming event to the item's response message log
- `runSioRequestEvent({ itemUid, eventType, data })` — handles connection lifecycle events (connecting, connected, disconnected, error)
- `sioConnectionStatusChanged({ itemUid, status })` — updates connection status in item state

Reducer state per item (nested under `item.sioResponse`):

```ts
{
  messages: Array<{
    type: 'incoming' | 'outgoing' | 'info';
    eventName: string;       // "chat:message", "connect", "error", etc.
    data: any;               // event payload
    ack?: any;               // ack response if applicable
    timestamp: number;
  }>;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  headers: Record<string, string>;
}
```

## 5. UI Components

### Request Pane

- **`SioQueryUrl/`** — URL input + namespace input + Connect/Disconnect button. Uses `http://`/`https://` URL scheme.
- **`SioBody/`** — List of events to emit. Each item has:
  - Event name field (text input)
  - Type selector (json / text)
  - Content editor (CodeEditor, same as WS)
  - Delete button
  - "Add Event" button at bottom
- **Auth tab** — reuses existing auth components (inherit, bearer, custom, etc.)

### Response Pane (`SioResponsePane/`)

- **Events tab** — virtualized list (Virtuoso, same as WS) showing all incoming/outgoing events. Each row: direction icon, event name as tag/badge, payload preview, timestamp. Expandable for full payload view.
- **Headers tab** — displays connection headers
- **Timeline tab** — connection lifecycle events (connecting, connected, disconnected, errors)

### New Request Menu

Add "Socket.IO Request" option alongside HTTP, GraphQL, WebSocket, gRPC.

## 6. Bru Lang Parser

Updates to `packages/bruno-lang/` to support:

- `meta { type: socketio }` recognition
- `socketio { ... }` block parsing (url, namespace, auth)
- `body:socketio { ... }` block parsing (event, type, content)
- Serialization back to `.bru` format

## 7. Converters

New file: `packages/bruno-converters/src/opencollection/items/socketio.ts`

Handles conversion of OpenCollection Socket.IO format to Bruno internal format, mirroring the existing `websocket.ts` converter.

## 8. Test Infrastructure

### Mock Server

New file: `packages/bruno-tests/src/sio/index.js`

- Uses `socket.io` (server, ^4.x) as dev dependency
- Namespace support (`/test`, `/chat`)
- Echoes events back, responds to specific test events
- Auth validation (rejects if token missing)
- Ack support (responds to events that request acknowledgement)

### E2E Tests

New directory: `tests/socketio/`

- `connection.spec.ts` — connect, verify status, disconnect
- `events.spec.ts` — emit events, verify received events in response pane
- `persistence.spec.ts` — save/reopen Socket.IO request, verify fields preserved
- `variable-interpolation/` — variables in URL, namespace, event payloads

## Files to Create

| File | Package | Purpose |
|------|---------|---------|
| `src/requests/socketio.ts` | bruno-schema-types | Type definitions |
| `src/sio/sio-client.js` | bruno-requests | Socket.IO client executor |
| `src/ipc/network/sio-event-handlers.js` | bruno-electron | IPC handlers |
| `src/utils/network/sio-event-listeners.js` | bruno-app | Redux event bridge |
| `src/components/RequestPane/SioQueryUrl/` | bruno-app | URL + namespace input |
| `src/components/RequestPane/SioBody/` | bruno-app | Event list editor |
| `src/components/ResponsePane/SioResponsePane/` | bruno-app | Response display |
| `src/opencollection/items/socketio.ts` | bruno-converters | Format converter |
| `src/sio/index.js` | bruno-tests | Mock Socket.IO server |
| `tests/socketio/` | root | E2E Playwright tests |

## Files to Modify

- `packages/bruno-requests/package.json` — add `socket.io-client` dependency
- `packages/bruno-tests/package.json` — add `socket.io` (server) dev dependency
- `packages/bruno-lang/` — parser additions for `socketio` blocks
- `packages/bruno-app/` — New Request menu, request pane routing, response pane routing
- `packages/bruno-electron/` — register new IPC handlers
- `packages/bruno-schema/` — add `socketio-request` to valid request types in Yup `oneOf` validator
- `packages/bruno-electron/src/ipc/collection.js` — call `sioClient.closeForCollection()` on collection close
