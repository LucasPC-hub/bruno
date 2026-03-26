# Socket.IO Support -- Final Code Review

## Strengths

- **Comprehensive scope**: All 12 commits cover the full stack (client, IPC, Redux, UI, parser, schema, converter, E2E tests).
- **Consistent architecture**: Mirrors the existing WebSocket pattern across layers (SioClient, sio-event-handlers, sio-event-listeners, Redux reducers).
- **Proper cleanup**: `closeForCollection` is called on collection removal (collection.js:1107-1109), and `disconnectAll` exists for app shutdown.
- **Good UI/UX**: Virtualized message list, connection status indicators, reconnect-on-URL-change, and event-based body editor are well-designed.
- **Schema and type coverage**: Yup schema, TypeScript types, and Bru lang grammar all updated in sync.

---

## CRITICAL Issues (must fix before merge)

### C1. `startConnection` API mismatch between SioClient and IPC handler

**SioClient** signature (sio-client.js:11):
```
startConnection(uid, collectionUid, options = {})
```

**IPC handler** call (sio-event-handlers.js:357-364):
```js
await sioClient.startConnection({
  request: preparedRequest,
  collection,
  options: { timeout: settings.timeout, sslOptions }
});
```

The handler passes a single object; the client expects three positional arguments. This means `uid` receives the whole object, `collectionUid` is `undefined`, and `options` is `{}`. **Connections will never work.**

**Fix**: Either change the IPC handler call to:
```js
await sioClient.startConnection(preparedRequest.uid, collection.uid, {
  url: preparedRequest.url, headers: preparedRequest.headers, sslOptions, ...
});
```
Or refactor SioClient.startConnection to accept a single config object.

### C2. `emitEvent` argument order mismatch

**SioClient** signature (sio-client.js:66):
```
emitEvent(uid, eventName, data, withAck = false)
```

**IPC handler** call (sio-event-handlers.js:397):
```js
sioClient.emitEvent(requestId, collectionUid, eventName, data)
```

The handler passes `collectionUid` as the second arg, which the client interprets as `eventName`. The actual `eventName` becomes `data`, and `data` becomes `withAck`. **All emitted events will have the wrong event name and payload.**

**Fix**: Remove `collectionUid` from the call since SioClient derives it from activeConnections:
```js
sioClient.emitEvent(requestId, eventName, data);
```

### C3. `queueEvent` method does not exist

**IPC handler** call (sio-event-handlers.js:328):
```js
sioClient.queueEvent(preparedRequest.uid, collection.uid, evt.eventName, evt.content);
```

SioClient has no `queueEvent` method. The built-in queuing in `emitEvent` handles pre-connection buffering automatically. **This will throw a runtime error.**

**Fix**: Replace with `sioClient.emitEvent(preparedRequest.uid, evt.eventName, evt.content)` (which queues internally if not connected).

### C4. SioClient constructor ignores `sendEvent` argument

**IPC handler** (sio-event-handlers.js:287):
```js
sioClient = new SioClient(sendEvent);
```

**SioClient constructor** (sio-client.js:5):
```js
constructor() { super(); ... }
```

The `sendEvent` callback is silently discarded. The IPC handler compensates via the `sioClient.on(...)` event forwarding pattern (lines 300-304), so events do reach the renderer. However, this differs from WsClient which stores the callback. **Not a runtime break** because the EventEmitter forwarding works, but the constructor call is misleading and should either accept the arg or the caller should not pass it.

---

## IMPORTANT Issues (should fix)

### I1. Field naming inconsistency for Socket.IO event name

Three different field names are used for the event name across layers:
- **UI (SioBody)**: `eventName`
- **Bru lang parser (bruToJson)**: `event`
- **Schema (socketioRequestSchema)**: `name`
- **Type definition (socketio.ts)**: `name`

This means data flows will silently lose the event name as it crosses boundaries. For example, the parser outputs `{ event: "..." }` but the UI reads `eventName`, and the schema validates `name`.

**Fix**: Unify on a single field name across all layers (recommend `name` to match the schema, since it already parallels the WS message schema).

### I2. Namespace value is local state only (never dispatched to Redux)

In SioQueryUrl (line 218), the namespace input updates `namespaceValue` via `useState` but never dispatches to Redux or is included in the request body. The `handleConnect` sends the full item to the IPC handler, but the namespace from the input is not merged in.

**Fix**: Dispatch namespace changes to Redux (e.g., via `updateRequestBody` or a new reducer), so it persists and is available to the IPC handler.

### I3. Body schema uses `name` but body content parser uses `event`

The `bodysocketio` parser in bruToJson.js (line 1083) outputs:
```js
{ event: messageEvent, type: messageType, content: messageContent }
```

But the Yup schema for socketio body items expects `name`:
```js
Yup.object({ name: Yup.string().nullable(), type: ..., content: ... })
```

This means parsed `.bru` files will fail schema validation for the event name field.

---

## MINOR Issues (nice to have)

### M1. Hardcoded 2-second reconnect delay
SioQueryUrl line 98-100 uses `setTimeout(() => handleConnect(), 2000)`. This is a magic number with no guarantee the disconnect completed. Consider awaiting disconnect completion or using a shorter/configurable delay.

### M2. Missing `displayName` on forwardRef component
SioBody line 76 creates a `forwardRef` component (`TypeIcon`) without a `displayName`, which will show as "Anonymous" in React DevTools.

### M3. SioMessageItem reads `message.event` and `message.payload` but Redux stores `eventName` and `data`
The Redux reducer `sioResponseReceived` stores `{ eventName, data }` but SioMessageItem reads `message.event` and `message.payload`. These field names don't match -- messages will display without event names or payloads.

### M4. `body:socketio` content serialization uses triple-quotes without escaping
jsonToBru line 653 writes content as `'''\n  ${event.content}\n  '''`. If the content itself contains `'''`, this will break parsing.

### M5. `socket.io-client` dependency not verified in package.json
Confirm `socket.io-client` is listed in `bruno-requests/package.json` dependencies.

---

## Integration Gaps

1. **CLI support**: `bruno-cli/src/utils/bru.js` does not appear to have been updated for `socketio` block parsing. CLI users will not be able to run Socket.IO requests.
2. **Collection runner**: `RunConfigurationPanel` was updated (line count in diff), but the actual runner execution logic for socketio-request type should be verified.
3. **Transient/scratch requests**: The scratch-request flow should be tested with socketio-request type.

---

## Overall Verdict

**Not ready for merge.** The implementation is architecturally sound and well-structured, closely following the established WebSocket patterns. However, there are 3-4 critical API mismatches between the SioClient library and the IPC handler that will cause **all Socket.IO connections and event emissions to fail at runtime**. The field naming inconsistency across layers (C1-C3, I1, I3, M3) suggests the client library and the IPC handler were developed in isolation without integration testing.

**Recommended next steps:**
1. Fix C1-C3 (API signature mismatches) -- these are showstoppers.
2. Unify field naming (I1/I3/M3) across all layers.
3. Wire up namespace dispatch (I2).
4. Run the E2E tests against the mock server to verify the fixes.
