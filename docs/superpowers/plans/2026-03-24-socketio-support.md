# Socket.IO Request Type Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Socket.IO as a new request type in Bruno so users can test Socket.IO servers alongside HTTP, WebSocket, and gRPC endpoints.

**Architecture:** Full parallel implementation mirroring the existing WebSocket (`ws`) architecture. New `socketio-request` item type with its own client, IPC handlers, UI components, schema types, Bru lang blocks, and tests. Uses `socket.io-client` v4 for connections and `socket.io` v4 for the test mock server.

**Tech Stack:** socket.io-client ^4.x, socket.io ^4.x (dev), React, Redux Toolkit, Electron IPC, Ohm.js (Bru lang), Playwright (E2E)

**Spec:** `docs/superpowers/specs/2026-03-24-socketio-support-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/bruno-requests/src/sio/sio-client.js` | Socket.IO connection client (connect, emit, disconnect, event capture) |
| `packages/bruno-schema/src/collections/socketioRequestSchema.js` | Yup validation schema for socketio requests |
| `packages/bruno-schema-types/src/requests/socketio.ts` | TypeScript type definitions |
| `packages/bruno-electron/src/ipc/network/sio-event-handlers.js` | Electron IPC handlers for socketio |
| `packages/bruno-app/src/utils/network/sio-event-listeners.js` | React hook for IPC event listeners |
| `packages/bruno-app/src/components/RequestPane/SioQueryUrl/index.js` | URL + namespace input + connect button |
| `packages/bruno-app/src/components/RequestPane/SioBody/index.js` | Event list editor |
| `packages/bruno-app/src/components/ResponsePane/SioResponsePane/index.js` | Response event list display |
| `packages/bruno-converters/src/opencollection/items/socketio.ts` | OpenCollection format converter |
| `packages/bruno-tests/src/sio/index.js` | Mock Socket.IO server for E2E tests |
| `tests/socketio/connection.spec.ts` | E2E connection tests |
| `tests/socketio/events.spec.ts` | E2E event emit/receive tests |
| `tests/socketio/persistence.spec.ts` | E2E save/reopen tests |
| `tests/socketio/fixtures/collection/sio-test-request.bru` | Test fixture .bru file |

### New Files
| File | Responsibility |
|------|---------------|
| `packages/bruno-app/src/components/RequestPane/SioRequestPane/index.js` | Socket.IO request pane wrapper (tabs: Body, Auth, Headers, Script, etc.) |

### Modified Files
| File | Change |
|------|--------|
| `packages/bruno-requests/package.json` | Add `socket.io-client` dependency |
| `packages/bruno-requests/src/index.ts` | Export `SioClient` |
| `packages/bruno-schema/src/collections/index.js:550` | Add `socketio-request` to item type oneOf + request schema when clause |
| `packages/bruno-schema-types/src/collection/item.ts:12` | Add `'socketio-request'` to `ItemType` union |
| `packages/bruno-lang/v2/src/bruToJson.js:33-35` | Add `socketio` grammar rule + `bodysocketio` body rule + handlers |
| `packages/bruno-lang/v2/src/jsonToBru.js:17,97-119` | Add `socketio` serialization block |
| `packages/bruno-filestore/src/formats/bru/index.ts:28,37,83,130,364` | Add `socketio` case to switch, URL path mapping, transform logic |
| `packages/bruno-electron/src/ipc/network/index.js:36,1985` | Import + register `registerSioEventHandlers` |
| `packages/bruno-electron/src/ipc/collection.js:29,1015,1102,1166` | Import sioClient, add to type check arrays, call closeForCollection |
| `packages/bruno-electron/src/utils/constants.js:1` | Add `'socketio-request'` to `REQUEST_TYPES` array |
| `packages/bruno-electron/src/utils/collection.js:506` | Add `socketio: 'socketio-request'` to type mapping |
| `packages/bruno-app/src/components/RequestTabPanel/index.js:219,305,312,334` | Add `socketio-request` routing for query URL, request pane, response pane |
| `packages/bruno-app/src/components/Sidebar/NewRequest/index.js:101,382-389,505` | Add Socket.IO radio button option |
| `packages/bruno-app/src/components/Sidebar/Collections/Collection/CollectionItem/RequestMethod/index.js:7,37` | Add socketio method badge display |
| `packages/bruno-app/src/components/RunnerResults/RunConfigurationPanel/index.jsx:19` | Handle socketio type |
| `packages/bruno-app/src/components/ShareCollection/index.js:33` | Handle socketio type |
| `packages/bruno-app/src/providers/ReduxStore/slices/collections/index.js` | Add `runSioRequestEvent` + `sioResponseReceived` reducers |
| `packages/bruno-app/src/providers/ReduxStore/slices/collections/actions.js:573` | Add `newSioRequest` action + save request socketio-request handling |
| `packages/bruno-app/src/providers/ReduxStore/slices/tabs.js:52` | Add `'socketio-request'` to tab creation logic |
| `packages/bruno-app/src/utils/common/constants.js:1` | Add `'socketio-request'` to `REQUEST_TYPES` array |
| `packages/bruno-app/src/utils/collections/index.js:715,722,854,1101` | Add `socketio-request` to `isRequest()`, URL extraction, type arrays |
| `packages/bruno-app/src/utils/collections/export.js:44,57,69` | Handle socketio-request in export logic |
| `packages/bruno-app/src/utils/tabs/index.js:4` | Add `'socketio-request'` to `isRequest()` array |
| `packages/bruno-converters/src/opencollection/items/index.ts:93` | Register socketio converter |
| `packages/bruno-tests/package.json` | Add `socket.io` dependency |
| `packages/bruno-tests/src/index.js:11,71` | Import + mount sioRouter |

**Out of scope:** `packages/bruno-cli` — Socket.IO requires persistent connections which don't fit the CLI's run-and-exit model. CLI will skip `socketio-request` items gracefully (same as it does for unsupported types).

---

## Task 1: Mock Socket.IO Test Server

**Files:**
- Create: `packages/bruno-tests/src/sio/index.js`
- Modify: `packages/bruno-tests/package.json`
- Modify: `packages/bruno-tests/src/index.js`

- [ ] **Step 1: Add `socket.io` dependency**

```bash
cd /home/lucasp/temp/bruno/packages/bruno-tests && npm install socket.io@^4
```

- [ ] **Step 2: Create the mock Socket.IO server**

Create `packages/bruno-tests/src/sio/index.js`:

```javascript
const { Server } = require('socket.io');

const setupSocketIO = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // Default namespace
  io.on('connection', (socket) => {
    // Echo any event back with the same event name
    socket.onAny((eventName, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      socket.emit(eventName, ...args);
      if (callback) {
        callback({ status: 'ok', eventName, data: args });
      }
    });

    socket.on('headers', () => {
      socket.emit('headers', socket.handshake.headers);
    });

    socket.on('query', () => {
      socket.emit('query', socket.handshake.query);
    });

    socket.on('disconnect', () => {});
  });

  // /chat namespace with auth
  const chatNs = io.of('/chat');
  chatNs.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    next();
  });

  chatNs.on('connection', (socket) => {
    socket.onAny((eventName, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      socket.emit(eventName, ...args);
      if (callback) {
        callback({ status: 'ok', eventName, data: args });
      }
    });
  });

  return io;
};

module.exports = setupSocketIO;
```

- [ ] **Step 3: Mount in test server**

Modify `packages/bruno-tests/src/index.js`:
- Add import: `const setupSocketIO = require('./sio');`
- After `server.on('upgrade', wsRouter);` (line 71), add: `setupSocketIO(server);`

- [ ] **Step 4: Verify the test server starts**

```bash
cd /home/lucasp/temp/bruno/packages/bruno-tests && node -e "
const http = require('http');
const setupSocketIO = require('./src/sio');
const server = http.createServer();
const io = setupSocketIO(server);
server.listen(0, () => {
  console.log('Socket.IO server started on port', server.address().port);
  server.close();
  process.exit(0);
});
"
```

Expected: prints port number and exits cleanly.

- [ ] **Step 5: Commit**

```bash
git add packages/bruno-tests/src/sio/index.js packages/bruno-tests/package.json packages/bruno-tests/src/index.js
git commit -m "feat: add mock Socket.IO server for testing"
```

---

## Task 2: Socket.IO Client (`sio-client.js`)

**Files:**
- Modify: `packages/bruno-requests/package.json`
- Create: `packages/bruno-requests/src/sio/sio-client.js`
- Modify: `packages/bruno-requests/src/index.ts`

- [ ] **Step 1: Add `socket.io-client` dependency**

```bash
cd /home/lucasp/temp/bruno/packages/bruno-requests && npm install socket.io-client@^4
```

- [ ] **Step 2: Write a basic integration test**

Create `packages/bruno-requests/src/sio/__tests__/sio-client.test.js`.

Note: `bruno-requests` uses ESM (`import/export`) but Jest is configured with Babel transforms, so tests use `import` syntax:

```javascript
import { SioClient } from '../sio-client';
import { Server } from 'socket.io';
import http from 'http';

let httpServer, io, sioClient;

beforeEach((done) => {
  httpServer = http.createServer();
  io = new Server(httpServer);
  io.on('connection', (socket) => {
    socket.onAny((event, ...args) => {
      const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
      socket.emit(event, ...args);
      if (cb) cb({ status: 'ok' });
    });
  });
  httpServer.listen(0, done);
  sioClient = new SioClient();
});

afterEach((done) => {
  sioClient.disconnectAll();
  io.close();
  httpServer.close(done);
});

describe('SioClient', () => {
  test('connects and receives events', (done) => {
    const port = httpServer.address().port;
    const uid = 'test-req-1';
    const collectionUid = 'test-col-1';

    sioClient.on('main:sio:connected', (reqId) => {
      expect(reqId).toBe(uid);
      expect(sioClient.connectionStatus(uid)).toBe('connected');

      sioClient.on('main:sio:message', (reqId2, colId, eventData) => {
        expect(eventData.eventName).toBe('echo');
        expect(eventData.data).toEqual(['hello']);
        done();
      });

      sioClient.emitEvent(uid, 'echo', 'hello');
    });

    sioClient.startConnection(uid, collectionUid, {
      url: `http://localhost:${port}`,
    });
  });

  test('reports disconnected status for unknown uid', () => {
    expect(sioClient.connectionStatus('unknown')).toBe('disconnected');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd /home/lucasp/temp/bruno/packages/bruno-requests && npx jest src/sio/__tests__/sio-client.test.js --no-cache
```

Expected: FAIL — `SioClient` module not found.

- [ ] **Step 4: Implement `SioClient`**

Create `packages/bruno-requests/src/sio/sio-client.js`:

```javascript
import { io as ioClient } from 'socket.io-client';
import { EventEmitter } from 'events';

export class SioClient extends EventEmitter {
  constructor() {
    super();
    this.activeConnections = new Map(); // uid -> socket
    this.eventQueues = new Map();       // uid -> [{eventName, data, withAck}]
  }

  startConnection(uid, collectionUid, options = {}) {
    if (this.activeConnections.has(uid)) {
      this.disconnect(uid);
    }

    const { url, namespace = '/', auth, headers = {}, sslOptions = {} } = options;
    const fullUrl = namespace !== '/' ? `${url}${namespace}` : url;

    this.emit('main:sio:connecting', uid, collectionUid, {});

    const socket = ioClient(fullUrl, {
      auth: auth || undefined,
      extraHeaders: headers,
      rejectUnauthorized: sslOptions.rejectUnauthorized !== false,
      ca: sslOptions.ca || undefined,
      transports: ['websocket', 'polling'],
      reconnection: false,
    });

    this.activeConnections.set(uid, { socket, collectionUid });
    this._emitConnectionsChanged();

    socket.on('connect', () => {
      this.emit('main:sio:connected', uid, collectionUid, {});
      this._flushQueue(uid);
    });

    socket.onAny((eventName, ...args) => {
      this.emit('main:sio:message', uid, collectionUid, {
        eventName,
        data: args.length === 1 ? args[0] : args,
        timestamp: Date.now(),
      });
    });

    socket.on('connect_error', (err) => {
      this.emit('main:sio:error', uid, collectionUid, {
        message: err.message,
        timestamp: Date.now(),
      });
    });

    socket.on('disconnect', (reason) => {
      this.emit('main:sio:disconnected', uid, collectionUid, {
        reason,
        timestamp: Date.now(),
      });
      this.activeConnections.delete(uid);
      this.eventQueues.delete(uid);
      this._emitConnectionsChanged();
    });

    return socket;
  }

  emitEvent(uid, eventName, data, withAck = false) {
    const entry = this.activeConnections.get(uid);
    if (!entry) return;

    const { socket, collectionUid } = entry;

    if (!socket.connected) {
      // Queue for when connection is established
      if (!this.eventQueues.has(uid)) {
        this.eventQueues.set(uid, []);
      }
      this.eventQueues.get(uid).push({ eventName, data, withAck });
      return;
    }

    this._doEmit(uid, collectionUid, socket, eventName, data, withAck);
  }

  _doEmit(uid, collectionUid, socket, eventName, data, withAck) {
    const parsedData = this._parseData(data);

    if (withAck) {
      socket.emit(eventName, parsedData, (ackData) => {
        this.emit('main:sio:ack', uid, collectionUid, {
          eventName,
          ackData,
          timestamp: Date.now(),
        });
      });
    } else {
      socket.emit(eventName, parsedData);
    }
  }

  _parseData(data) {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }
    return data;
  }

  _flushQueue(uid) {
    const queue = this.eventQueues.get(uid);
    if (!queue || queue.length === 0) return;

    const entry = this.activeConnections.get(uid);
    if (!entry) return;

    const { socket, collectionUid } = entry;
    for (const { eventName, data, withAck } of queue) {
      this._doEmit(uid, collectionUid, socket, eventName, data, withAck);
    }
    this.eventQueues.delete(uid);
  }

  disconnect(uid) {
    const entry = this.activeConnections.get(uid);
    if (entry) {
      entry.socket.disconnect();
      this.activeConnections.delete(uid);
      this.eventQueues.delete(uid);
      this._emitConnectionsChanged();
    }
  }

  disconnectAll() {
    for (const [uid] of this.activeConnections) {
      this.disconnect(uid);
    }
  }

  closeForCollection(collectionUid) {
    for (const [uid, entry] of this.activeConnections) {
      if (entry.collectionUid === collectionUid) {
        this.disconnect(uid);
      }
    }
  }

  connectionStatus(uid) {
    const entry = this.activeConnections.get(uid);
    if (!entry) return 'disconnected';
    if (entry.socket.connected) return 'connected';
    return 'connecting';
  }

  getActiveConnections() {
    return Array.from(this.activeConnections.keys());
  }

  isConnectionActive(uid) {
    return this.activeConnections.has(uid);
  }

  _emitConnectionsChanged() {
    this.emit('main:sio:connections-changed', {
      connections: this.getActiveConnections(),
    });
  }
}
```

- [ ] **Step 5: Export from index**

Add to `packages/bruno-requests/src/index.ts` (after line 3):

```typescript
export { SioClient } from './sio/sio-client';
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /home/lucasp/temp/bruno/packages/bruno-requests && npx jest src/sio/__tests__/sio-client.test.js --no-cache
```

Expected: PASS — both tests green.

- [ ] **Step 7: Commit**

```bash
git add packages/bruno-requests/src/sio/ packages/bruno-requests/package.json packages/bruno-requests/src/index.ts
git commit -m "feat: add SioClient for Socket.IO connections"
```

---

## Task 3: Schema & Type Definitions

**Files:**
- Create: `packages/bruno-schema/src/collections/socketioRequestSchema.js`
- Create: `packages/bruno-schema-types/src/requests/socketio.ts`
- Modify: `packages/bruno-schema/src/collections/index.js`
- Modify: `packages/bruno-schema-types/src/collection/item.ts:12`

- [ ] **Step 1: Create the Yup validation schema**

Create `packages/bruno-schema/src/collections/socketioRequestSchema.js`.

Model it after the existing `wsRequestSchema` in the same directory. It should validate:
- `url` (string, required)
- `namespace` (string, optional, defaults to "/")
- `auth` (mixed)
- `headers` (array of {name, value, enabled})
- `body` with `mode: 'socketio'` and `socketio` array of `{name, content, type}`

- [ ] **Step 2: Create TypeScript types**

Create `packages/bruno-schema-types/src/requests/socketio.ts`:

```typescript
export interface SocketIOEvent {
  name: string;
  content?: string;
  type?: string;
}

export interface SocketIORequestBody {
  mode: 'socketio';
  socketio?: SocketIOEvent[];
}

export interface SocketIORequest {
  url: string;
  namespace?: string;
  auth?: Record<string, any>;
  headers?: Array<{ name: string; value: string; enabled: boolean }>;
  body: SocketIORequestBody;
  script?: { req?: string; res?: string };
  vars?: { req?: any[]; res?: any[] };
  assertions?: any[];
  tests?: string;
  docs?: string;
}
```

- [ ] **Step 3: Register in the item schema**

Modify `packages/bruno-schema/src/collections/index.js`:

At line 550, add `'socketio-request'` to the oneOf array:
```javascript
type: Yup.string().oneOf(['http-request', 'graphql-request', 'folder', 'js', 'grpc-request', 'ws-request', 'socketio-request']).required('type is required'),
```

In the `request` when chain (lines 554-564), add a `socketio-request` case:
```javascript
request: Yup.mixed().when('type', {
  is: (type) => type === 'grpc-request',
  then: grpcRequestSchema.required('...'),
  otherwise: Yup.mixed().when('type', {
    is: (type) => type === 'ws-request',
    then: wsRequestSchema.required('...'),
    otherwise: Yup.mixed().when('type', {
      is: (type) => type === 'socketio-request',
      then: socketioRequestSchema.required('request is required when item-type is socketio-request'),
      otherwise: requestSchema.when('type', {
        is: (type) => ['http-request', 'graphql-request'].includes(type),
        then: (schema) => schema.required('...')
      })
    })
  })
}),
```

- [ ] **Step 4: Add to `ItemType` union**

Modify `packages/bruno-schema-types/src/collection/item.ts` at line 12. Add `'socketio-request'` to the `ItemType` union type.

- [ ] **Step 5: Run existing schema tests to verify no regressions**

```bash
cd /home/lucasp/temp/bruno/packages/bruno-schema && npm test
```

Expected: All existing tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/bruno-schema/src/collections/socketioRequestSchema.js packages/bruno-schema-types/src/requests/socketio.ts packages/bruno-schema/src/collections/index.js packages/bruno-schema-types/src/collection/item.ts
git commit -m "feat: add socketio-request schema and type definitions"
```

---

## Task 4: Bru Lang Parser & Serializer

**Files:**
- Modify: `packages/bruno-lang/v2/src/bruToJson.js`
- Modify: `packages/bruno-lang/v2/src/jsonToBru.js`

- [ ] **Step 1: Write a parser test**

Add a test in the bruno-lang test directory for parsing a `.bru` file with `socketio` blocks. The test should verify that:
```bru
meta {
  name: sio-test
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
  {"text": "hello"}
  '''
}
```
Parses into the expected JSON structure with `socketio.url`, `socketio.namespace`, and body entries.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/lucasp/temp/bruno/packages/bruno-lang && npm test
```

Expected: New test FAILS — `socketio` not recognized by grammar.

- [ ] **Step 3: Add `socketio` to the Ohm grammar**

Modify `packages/bruno-lang/v2/src/bruToJson.js`:

At line 33, add `socketio` to `BruFile`:
```
BruFile = (meta | http | grpc | ws | socketio | query | params | headers | ...)*
```

At line 35, add `bodysocketio` to `bodies`:
```
bodies = bodyjson | bodytext | ... | bodygrpc | bodyws | bodysocketio
```

Add grammar rules (near the `ws` and `bodyws` rules):
```
socketio = "socketio" st* "{" nl (pairdata)* "}"
bodysocketio = "body:socketio" st* "{" nl (pairdata | textblock)* "}"
```

- [ ] **Step 4: Add semantic handlers**

In the semantics section, add handler near line 510 (after the `ws` handler):
```javascript
socketio(_1, dictionary) {
  return {
    socketio: mapPairListToKeyValPair(dictionary.ast)
  };
},
```

Add `bodysocketio` handler near line 1053 (after `bodyws`):
```javascript
bodysocketio(_1, dictionary) {
  return {
    body: {
      socketio: concatArrays(dictionary.ast)
    }
  };
},
```

- [ ] **Step 5: Add serializer support**

Modify `packages/bruno-lang/v2/src/jsonToBru.js`:

At line 17, add `socketio` to the destructuring:
```javascript
const { meta, http, grpc, ws, socketio, params, ... } = json;
```

After the `ws` serialization block (around line 119), add:
```javascript
if (socketio && socketio.url) {
  bru += `socketio {
  url: ${socketio.url}`;

  if (socketio.namespace && socketio.namespace.length) {
    bru += `\n  namespace: ${socketio.namespace}`;
  }

  if (socketio.auth && socketio.auth.length) {
    bru += `\n  auth: ${socketio.auth}`;
  }

  bru += `\n}\n\n`;
}
```

Add body serialization (after the `body:ws` block):
```javascript
if (body && body.socketio && body.socketio.length) {
  for (const event of body.socketio) {
    bru += `body:socketio {\n`;
    if (event.event) bru += `  event: ${event.event}\n`;
    if (event.type) bru += `  type: ${event.type}\n`;
    if (event.content) bru += `  content: '''\n  ${event.content}\n  '''\n`;
    bru += `}\n\n`;
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd /home/lucasp/temp/bruno/packages/bruno-lang && npm test
```

Expected: All tests PASS including the new socketio test.

- [ ] **Step 7: Commit**

```bash
git add packages/bruno-lang/v2/src/bruToJson.js packages/bruno-lang/v2/src/jsonToBru.js
git commit -m "feat: add socketio block parsing and serialization to Bru lang"
```

---

## Task 5: Electron IPC Handlers

**Files:**
- Create: `packages/bruno-electron/src/ipc/network/sio-event-handlers.js`
- Modify: `packages/bruno-electron/src/ipc/network/index.js`
- Modify: `packages/bruno-electron/src/ipc/collection.js`

- [ ] **Step 1: Create IPC event handlers**

Create `packages/bruno-electron/src/ipc/network/sio-event-handlers.js`.

Model it exactly after `ws-event-handlers.js` but using `SioClient` instead of `WsClient`. Key elements:

- Import `SioClient` from `@usebruno/requests`
- Create singleton `const sioClient = new SioClient();`
- `prepareSioRequest()` — identical pattern to `prepareWsRequest()`: interpolate vars, merge headers/auth/scripts from collection/folder tree
- `registerSioEventHandlers(mainWindow)`:
  - `renderer:sio:start-connection` — creates connection via `sioClient.startConnection()`, queues initial events
  - `renderer:sio:emit-event` — calls `sioClient.emitEvent()`
  - `renderer:sio:disconnect` — calls `sioClient.disconnect()`
  - `renderer:sio:connection-status` — returns `sioClient.connectionStatus()`
  - `renderer:sio:get-active-connections` — returns `sioClient.getActiveConnections()`
  - `renderer:sio:is-connection-active` — returns `sioClient.isConnectionActive()`
- Event bridge: `sioClient.on('main:sio:*')` → `mainWindow.webContents.send()`
- Export `{ registerSioEventHandlers, sioClient }`

- [ ] **Step 2: Register handlers in network index**

Modify `packages/bruno-electron/src/ipc/network/index.js`:

At line 36 area, add import:
```javascript
const { registerSioEventHandlers } = require('./sio-event-handlers');
```

At line 1985 area (after `registerWsEventHandlers(mainWindow);`), add:
```javascript
registerSioEventHandlers(mainWindow);
```

- [ ] **Step 3: Add collection close cleanup**

Modify `packages/bruno-electron/src/ipc/collection.js`:

At line 29 area, add import:
```javascript
const { sioClient } = require('../ipc/network/sio-event-handlers');
```

At line 1015, add `'socketio-request'` to the type check array:
```javascript
} else if (['http-request', 'graphql-request', 'grpc-request', 'ws-request', 'socketio-request'].includes(type)) {
```

At line 1166, there is a **second** type check array — add `'socketio-request'` there too.

At line 1102 area (after the wsClient close block), add:
```javascript
if (sioClient) {
  sioClient.closeForCollection(collectionUid);
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/bruno-electron/src/ipc/network/sio-event-handlers.js packages/bruno-electron/src/ipc/network/index.js packages/bruno-electron/src/ipc/collection.js
git commit -m "feat: add Socket.IO IPC handlers and collection cleanup"
```

---

## Task 6: Redux State & Event Listeners

**Files:**
- Modify: `packages/bruno-app/src/providers/ReduxStore/slices/collections/index.js`
- Create: `packages/bruno-app/src/utils/network/sio-event-listeners.js`

- [ ] **Step 1: Add Redux reducers**

Modify `packages/bruno-app/src/providers/ReduxStore/slices/collections/index.js`:

Add two new reducers, modeled after `runWsRequestEvent` (line 3342) and `wsResponseReceived` (line 3379):

`runSioRequestEvent`: handles connection lifecycle events for socketio items. Switch on `eventType`:
- `'connecting'` — set `item.sioResponse.connectionStatus = 'connecting'`
- `'connected'` — set `item.sioResponse.connectionStatus = 'connected'`
- `'disconnected'` — set `item.sioResponse.connectionStatus = 'disconnected'`
- `'error'` — push error info message to `item.sioResponse.messages`

`sioResponseReceived`: appends incoming events to `item.sioResponse.messages` array with `{type, eventName, data, timestamp}`.

Export both from the slice.

- [ ] **Step 2: Create event listeners hook**

Create `packages/bruno-app/src/utils/network/sio-event-listeners.js`:

```javascript
import { useEffect } from 'react';
import { sioResponseReceived, runSioRequestEvent } from 'providers/ReduxStore/slices/collections/index';
import { useDispatch } from 'react-redux';
import { isElectron } from 'utils/common/platform';
import { updateActiveConnectionsInStore } from 'providers/ReduxStore/slices/collections/actions';

const useSioEventListeners = () => {
  const { ipcRenderer } = window;
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isElectron()) {
      return () => {};
    }

    const removeConnectingListener = ipcRenderer.on('main:sio:connecting', (requestId, collectionUid, eventData) => {
      dispatch(runSioRequestEvent({
        eventType: 'connecting',
        itemUid: requestId,
        collectionUid,
        eventData
      }));
    });

    const removeConnectedListener = ipcRenderer.on('main:sio:connected', (requestId, collectionUid, eventData) => {
      dispatch(runSioRequestEvent({
        eventType: 'connected',
        itemUid: requestId,
        collectionUid,
        eventData
      }));
    });

    const removeMessageListener = ipcRenderer.on('main:sio:message', (requestId, collectionUid, eventData) => {
      dispatch(sioResponseReceived({
        itemUid: requestId,
        collectionUid,
        eventType: 'message',
        eventData
      }));
    });

    const removeErrorListener = ipcRenderer.on('main:sio:error', (requestId, collectionUid, eventData) => {
      dispatch(runSioRequestEvent({
        eventType: 'error',
        itemUid: requestId,
        collectionUid,
        eventData
      }));
    });

    const removeDisconnectedListener = ipcRenderer.on('main:sio:disconnected', (requestId, collectionUid, eventData) => {
      dispatch(runSioRequestEvent({
        eventType: 'disconnected',
        itemUid: requestId,
        collectionUid,
        eventData
      }));
    });

    const removeAckListener = ipcRenderer.on('main:sio:ack', (requestId, collectionUid, eventData) => {
      dispatch(sioResponseReceived({
        itemUid: requestId,
        collectionUid,
        eventType: 'ack',
        eventData
      }));
    });

    const removeConnectionsChangedListener = ipcRenderer.on('main:sio:connections-changed', (data) => {
      dispatch(updateActiveConnectionsInStore(data));
    });

    return () => {
      removeConnectingListener();
      removeConnectedListener();
      removeMessageListener();
      removeErrorListener();
      removeDisconnectedListener();
      removeAckListener();
      removeConnectionsChangedListener();
    };
  }, [isElectron]);
};

export default useSioEventListeners;
```

- [ ] **Step 3: Wire the hook into the app**

In `packages/bruno-app/src/pages/Bruno/index.js`:
- Add import at line 20: `import useSioEventListeners from 'utils/network/sio-event-listeners';`
- Add call at line 88 (after `useWsEventListeners();`): `useSioEventListeners();`

- [ ] **Step 3b: Create `newSioRequest` action**

In `packages/bruno-app/src/providers/ReduxStore/slices/collections/actions.js`:
- Model after `newWsRequest` (search for it in the file)
- Create `newSioRequest` that creates a new item with `type: 'socketio-request'`, `body: { mode: 'socketio', socketio: [] }`, and default namespace `'/'`
- Export the action

- [ ] **Step 4: Commit**

```bash
git add packages/bruno-app/src/providers/ReduxStore/slices/collections/index.js packages/bruno-app/src/utils/network/sio-event-listeners.js
git commit -m "feat: add Socket.IO Redux reducers and event listeners"
```

---

## Task 7: UI Components — Request Pane

**Files:**
- Create: `packages/bruno-app/src/components/RequestPane/SioQueryUrl/index.js`
- Create: `packages/bruno-app/src/components/RequestPane/SioBody/index.js`

- [ ] **Step 1: Create `SioQueryUrl` component**

Model after `packages/bruno-app/src/components/RequestPane/WsQueryUrl/`.

Key differences from WsQueryUrl:
- URL input uses `http://`/`https://` placeholder (not `ws://`)
- Add a namespace input field (text input, placeholder: `/`)
- Connect/Disconnect button sends `renderer:sio:start-connection` / `renderer:sio:disconnect` via IPC
- Connection status display (connecting/connected/disconnected)

- [ ] **Step 2: Create `SioBody` component**

Model after `packages/bruno-app/src/components/RequestPane/WsBody/`.

Key differences from WsBody:
- Each item in the list has an **event name** text input (required)
- Type selector: `json` / `text`
- Content editor (reuse CodeEditor)
- "Add Event" button at the bottom
- Delete button per event
- Dispatches `updateRequestBody` with mode `'socketio'`

- [ ] **Step 3: Create `SioRequestPane` wrapper**

Create `packages/bruno-app/src/components/RequestPane/SioRequestPane/index.js`.

Model after `WSRequestPane` (find it via the import in `RequestTabPanel/index.js`). It should render the same tab structure (Body, Auth, Headers, Script, Vars, Assert, Tests, Docs) but using `SioBody` for the body tab and adding a namespace field.

- [ ] **Step 4: Commit**

```bash
git add packages/bruno-app/src/components/RequestPane/SioQueryUrl/ packages/bruno-app/src/components/RequestPane/SioBody/
git commit -m "feat: add Socket.IO request pane UI components"
```

---

## Task 8: UI Components — Response Pane

**Files:**
- Create: `packages/bruno-app/src/components/ResponsePane/SioResponsePane/index.js`

- [ ] **Step 1: Create `SioResponsePane`**

Model after `packages/bruno-app/src/components/ResponsePane/WsResponsePane/`.

Key differences:
- Message list entries show **event name** as a tag/badge alongside the direction icon
- Each entry: direction icon (incoming/outgoing), event name badge, payload preview, timestamp
- Expandable rows for full payload view
- Use Virtuoso for virtualized list (same as WS)
- Tabs: Events, Headers, Timeline

- [ ] **Step 2: Commit**

```bash
git add packages/bruno-app/src/components/ResponsePane/SioResponsePane/
git commit -m "feat: add Socket.IO response pane UI component"
```

---

## Task 9: Integrate into App Routing

**Files:**
- Modify: `packages/bruno-app/src/components/RequestTabPanel/index.js`
- Modify: `packages/bruno-app/src/components/Sidebar/NewRequest/index.js`
- Modify: `packages/bruno-app/src/components/RequestTabs/RequestTab/index.js`
- Modify: `packages/bruno-app/src/components/ResponsePane/Timeline/index.js`

- [ ] **Step 1: Add to RequestTabPanel routing**

Modify `packages/bruno-app/src/components/RequestTabPanel/index.js`:

At line 219, add:
```javascript
const isSioRequest = item?.type === 'socketio-request';
```

In `renderQueryUrl()` (line 301), add before the default return:
```javascript
if (isSioRequest) {
  return <SioQueryUrl item={item} collection={collection} handleRun={handleRun} />;
}
```

In `renderRequestPane()` (line 311), add case:
```javascript
case 'socketio-request':
  return <SioRequestPane item={item} collection={collection} handleRun={handleRun} />;
```

In `renderResponsePane()` (line 334), add case:
```javascript
case 'socketio-request':
  return <SioResponsePane item={item} collection={collection} response={item.response} />;
```

Add URL validation (after line 283):
```javascript
if (isSioRequest && !request.url) {
  toast.error('Please enter a valid Socket.IO URL');
  return;
}
```

Add imports at the top for the new components.

- [ ] **Step 2: Add to New Request modal**

Modify `packages/bruno-app/src/components/Sidebar/NewRequest/index.js`:

At line 101 area, add case for `socketio-request` in the request type logic.

After the WebSocket radio button (line 389), add:
```jsx
<input
  type="radio"
  id="socketio-request"
  name="requestType"
  value="socketio-request"
  checked={formik.values.requestType === 'socketio-request'}
  onChange={formik.handleChange}
  data-testid="socketio-request"
/>
<label htmlFor="socketio-request" className="ml-1 cursor-pointer select-none">
  Socket.IO
</label>
```

At line 505, add `'socketio-request'` to the array that hides HTTP method selector:
```javascript
{!['grpc-request', 'ws-request', 'socketio-request'].includes(formik.values.requestType) ? (
```

Add the `newSioRequest` action handler (model after `newWsRequest` at line 151).

- [ ] **Step 3: Update auxiliary components**

In `packages/bruno-app/src/components/RequestTabs/RequestTab/index.js` (line 59), add:
```javascript
const isSIO = item?.type === 'socketio-request';
```

In `packages/bruno-app/src/components/ResponsePane/Timeline/index.js` (line 49), add `socketio-request`:
```javascript
const isGrpcRequest = item.type === 'grpc-request' || item.type === 'ws-request' || item.type === 'socketio-request';
```

- [ ] **Step 4: Commit**

```bash
git add packages/bruno-app/src/components/RequestTabPanel/index.js packages/bruno-app/src/components/Sidebar/NewRequest/index.js packages/bruno-app/src/components/RequestTabs/RequestTab/index.js packages/bruno-app/src/components/ResponsePane/Timeline/index.js
git commit -m "feat: integrate Socket.IO into app routing and new request menu"
```

---

## Task 10: Filestore, Constants & Utility Integration

This task covers all the codebase-wide integration points where `ws-request` is referenced and `socketio-request` must be added alongside it.

**Files:**
- Modify: `packages/bruno-filestore/src/formats/bru/index.ts:28,37,83,130,364`
- Modify: `packages/bruno-electron/src/utils/constants.js:1`
- Modify: `packages/bruno-electron/src/utils/collection.js:506`
- Modify: `packages/bruno-app/src/utils/common/constants.js:1`
- Modify: `packages/bruno-app/src/utils/collections/index.js:715,722,854,1101`
- Modify: `packages/bruno-app/src/utils/collections/export.js:44,57,69`
- Modify: `packages/bruno-app/src/utils/tabs/index.js:4`
- Modify: `packages/bruno-app/src/providers/ReduxStore/slices/tabs.js:52`
- Modify: `packages/bruno-app/src/components/Sidebar/Collections/Collection/CollectionItem/RequestMethod/index.js:7,37`
- Modify: `packages/bruno-app/src/components/RunnerResults/RunConfigurationPanel/index.jsx:19`
- Modify: `packages/bruno-app/src/components/ShareCollection/index.js:33`

- [ ] **Step 1: Update filestore Bru format handling**

Modify `packages/bruno-filestore/src/formats/bru/index.ts`. At each location where `ws` or `ws-request` is handled (lines 28, 37, 83, 130, 364), add parallel `socketio`/`socketio-request` handling:
- Add `socketio` case to the type switch that maps bru `meta.type` to item type
- Add URL path mapping for socketio (extract URL from `socketio` block, not `http` or `ws`)
- Add transform logic for socketio request body format

- [ ] **Step 2: Update constants**

In `packages/bruno-electron/src/utils/constants.js` — add `'socketio-request'` to the `REQUEST_TYPES` array.

In `packages/bruno-app/src/utils/common/constants.js` — add `'socketio-request'` to the `REQUEST_TYPES` array.

In `packages/bruno-electron/src/utils/collection.js` at line 506 — add `socketio: 'socketio-request'` to the type mapping object.

- [ ] **Step 3: Update utility functions**

In `packages/bruno-app/src/utils/collections/index.js`:
- At lines 715, 722 — add `'socketio-request'` to any `isRequest()` checks or type arrays
- At line 854 — add socketio URL extraction logic
- At line 1101 — add `'socketio-request'` to type arrays

In `packages/bruno-app/src/utils/collections/export.js` at lines 44, 57, 69 — handle `socketio-request` in export logic.

In `packages/bruno-app/src/utils/tabs/index.js` at line 4 — add `'socketio-request'` to the `isRequest()` array.

In `packages/bruno-app/src/providers/ReduxStore/slices/tabs.js` at line 52 — add `'socketio-request'` alongside `'ws-request'` in tab creation logic.

- [ ] **Step 4: Update auxiliary UI components**

In `packages/bruno-app/src/components/Sidebar/Collections/Collection/CollectionItem/RequestMethod/index.js` at lines 7 and 37 — add `isSIO: item.type === 'socketio-request'` and render a "SIO" method badge.

In `packages/bruno-app/src/components/RunnerResults/RunConfigurationPanel/index.jsx` at line 19 — add socketio type handling.

In `packages/bruno-app/src/components/ShareCollection/index.js` at line 33 — add socketio type handling.

- [ ] **Step 5: Verify no TypeScript/lint errors**

```bash
cd /home/lucasp/temp/bruno && npm run build --workspace=packages/bruno-filestore
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/bruno-filestore/ packages/bruno-electron/src/utils/ packages/bruno-app/src/utils/ packages/bruno-app/src/providers/ReduxStore/slices/tabs.js packages/bruno-app/src/components/Sidebar/Collections/Collection/CollectionItem/RequestMethod/ packages/bruno-app/src/components/RunnerResults/ packages/bruno-app/src/components/ShareCollection/
git commit -m "feat: add socketio-request to all type checks, constants, and utilities"
```

---

## Task 11: OpenCollection Converter

**Files:**
- Create: `packages/bruno-converters/src/opencollection/items/socketio.ts`

- [ ] **Step 1: Create the converter**

Model after `packages/bruno-converters/src/opencollection/items/websocket.ts`.

Create `socketio.ts` that converts OpenCollection Socket.IO format to Bruno internal format:
- Sets `type: 'socketio-request'`
- Maps events to `body.mode: 'socketio'` with event array
- Handles auth, headers, scripts

- [ ] **Step 2: Register in the converter index**

Modify `packages/bruno-converters/src/opencollection/items/index.ts` at line 93. Add the socketio converter import and call alongside the existing `fromOpenCollectionWebsocketItem`.

- [ ] **Step 3: Commit**

```bash
git add packages/bruno-converters/src/opencollection/items/socketio.ts
git commit -m "feat: add Socket.IO OpenCollection converter"
```

---

## Task 12: E2E Tests

**Files:**
- Create: `tests/socketio/connection.spec.ts`
- Create: `tests/socketio/events.spec.ts`
- Create: `tests/socketio/persistence.spec.ts`
- Create: `tests/socketio/fixtures/collection/sio-test-request.bru`

- [ ] **Step 1: Create test fixture**

Create `tests/socketio/fixtures/collection/sio-test-request.bru`:

```bru
meta {
  name: sio-test-request
  type: socketio
  seq: 1
}

socketio {
  url: http://localhost:8081
  namespace: /
  auth: inherit
}

body:socketio {
  event: echo
  type: json
  content: '''
  {"message": "hello"}
  '''
}
```

- [ ] **Step 2: Write connection E2E test**

Create `tests/socketio/connection.spec.ts`. Model after `tests/websockets/connection.spec.ts`:
- Open Bruno, load collection with Socket.IO request
- Click connect, verify status changes to connected
- Click disconnect, verify status changes to disconnected

- [ ] **Step 3: Write events E2E test**

Create `tests/socketio/events.spec.ts`:
- Connect to Socket.IO server
- Emit an event from the event list
- Verify the echoed event appears in the response pane with correct event name

- [ ] **Step 4: Write persistence E2E test**

Create `tests/socketio/persistence.spec.ts`. Model after `tests/websockets/persistence.spec.ts`:
- Create a new Socket.IO request
- Set URL, namespace, add events
- Save, close, reopen
- Verify all fields are preserved

- [ ] **Step 5: Run E2E tests**

```bash
cd /home/lucasp/temp/bruno && npx playwright test tests/socketio/
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/socketio/
git commit -m "feat: add Socket.IO E2E tests"
```

---

## Task 13: Final Integration Verification

- [ ] **Step 1: Run all unit tests**

```bash
cd /home/lucasp/temp/bruno && npm test
```

Expected: All tests PASS, no regressions.

- [ ] **Step 2: Run all E2E tests**

```bash
cd /home/lucasp/temp/bruno && npx playwright test
```

Expected: All tests PASS including new socketio tests.

- [ ] **Step 3: Manual smoke test**

Start the app, create a new Socket.IO request, connect to the test server, emit events, verify response pane shows incoming events correctly.

- [ ] **Step 4: Final commit**

If any integration fixes were needed, commit them:
```bash
git commit -m "fix: Socket.IO integration fixes"
```
