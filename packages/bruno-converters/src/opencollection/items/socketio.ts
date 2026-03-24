import { uuid } from '../../common/index.js';
import {
  fromOpenCollectionHeaders,
  fromOpenCollectionAuth,
  fromOpenCollectionScripts,
  fromOpenCollectionVariables,
  fromOpenCollectionActions
} from '../common';
import type {
  Auth,
  BrunoItem,
  BrunoKeyValue,
  BrunoSocketIORequestBody,
  BrunoSocketIOEvent
} from '../types';

interface SocketIORequestInfo {
  name?: string;
  type?: string;
  seq?: number;
  tags?: string[];
}

interface SocketIOEventSingle {
  type?: string;
  data?: string;
}

interface SocketIOEventVariant {
  title?: string;
  event?: SocketIOEventSingle;
}

interface SocketIORequestDetails {
  url?: string;
  namespace?: string;
  headers?: unknown;
  auth?: unknown;
  events?: SocketIOEventSingle | SocketIOEventVariant[];
}

interface SocketIORequestRuntime {
  scripts?: unknown;
  variables?: unknown;
  actions?: unknown;
}

interface SocketIOOCRequest {
  info?: SocketIORequestInfo;
  socketio?: SocketIORequestDetails;
  runtime?: SocketIORequestRuntime;
  docs?: string;
}

export const fromOpenCollectionSocketioItem = (item: SocketIOOCRequest): BrunoItem => {
  const info = item.info || {};
  const socketio = item.socketio || {};
  const runtime = item.runtime || {};

  const events: BrunoSocketIOEvent[] = [];

  if (socketio.events) {
    if (Array.isArray(socketio.events)) {
      socketio.events.forEach((e, index) => {
        const variant = e as SocketIOEventVariant;
        if (variant.title !== undefined || variant.event !== undefined) {
          events.push({
            name: variant.title || `event ${index + 1}`,
            type: variant.event?.type || 'json',
            content: variant.event?.data || ''
          });
        } else {
          const single = e as SocketIOEventSingle;
          events.push({
            name: `event ${index + 1}`,
            type: single.type || 'json',
            content: single.data || ''
          });
        }
      });
    } else {
      const e = socketio.events as SocketIOEventSingle;
      events.push({
        name: 'event 1',
        type: e.type || 'json',
        content: e.data || ''
      });
    }
  }

  const scripts = fromOpenCollectionScripts(runtime.scripts);
  const variables = fromOpenCollectionVariables(runtime.variables);
  const postResponseVars = fromOpenCollectionActions(
    (runtime as { actions?: Parameters<typeof fromOpenCollectionActions>[0] }).actions
  );

  const socketioBody: BrunoSocketIORequestBody = {
    mode: 'socketio',
    socketio: events
  };

  const brunoItem: BrunoItem = {
    uid: uuid(),
    type: 'socketio-request',
    name: info.name || 'Untitled Request',
    seq: info.seq || 1,
    request: {
      url: socketio.url || '',
      headers: fromOpenCollectionHeaders(socketio.headers as BrunoKeyValue[]),
      body: socketioBody as unknown as never,
      auth: fromOpenCollectionAuth(socketio.auth as Auth),
      script: scripts?.script,
      vars: {
        req: variables.req,
        res: postResponseVars
      },
      tests: scripts?.tests,
      docs: item.docs || ''
    }
  };

  if (info.tags?.length) {
    brunoItem.tags = info.tags;
  }

  return brunoItem;
};
