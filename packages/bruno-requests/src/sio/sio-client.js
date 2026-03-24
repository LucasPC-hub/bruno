import { io as ioClient } from 'socket.io-client';
import { EventEmitter } from 'events';

export class SioClient extends EventEmitter {
  constructor() {
    super();
    this.activeConnections = new Map();
    this.eventQueues = new Map();
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
