import type { Item as BrunoItem } from '@usebruno/schema-types/collection/item';
import type { SocketIORequest as BrunoSocketIORequest } from '@usebruno/schema-types/requests/socketio';
import { toBrunoAuth } from '../common/auth';
import { toBrunoHttpHeaders } from '../common/headers';
import { toBrunoVariables } from '../common/variables';
import { toBrunoScripts } from '../common/scripts';
import { uuid, ensureString } from '../../../utils';

interface SocketIOEventSingle {
  type?: string;
  data?: string;
}

interface SocketIOEventVariant {
  title?: string;
  event?: SocketIOEventSingle;
}

interface SocketIOOCRequest {
  info?: {
    name?: string;
    type?: string;
    seq?: number;
    tags?: string[];
  };
  socketio?: {
    url?: string;
    namespace?: string;
    headers?: unknown;
    auth?: unknown;
    events?: SocketIOEventSingle | SocketIOEventVariant[];
  };
  runtime?: {
    scripts?: unknown;
    variables?: unknown;
    actions?: unknown;
  };
  docs?: string;
}

const parseSocketioRequest = (ocRequest: SocketIOOCRequest): BrunoItem => {
  const info = ocRequest.info;
  const socketio = ocRequest.socketio;
  const runtime = ocRequest.runtime;

  const brunoRequest: BrunoSocketIORequest = {
    url: ensureString(socketio?.url),
    headers: toBrunoHttpHeaders(socketio?.headers) || [],
    auth: toBrunoAuth(socketio?.auth),
    body: {
      mode: 'socketio',
      socketio: []
    },
    script: {
      req: null,
      res: null
    },
    vars: {
      req: [],
      res: []
    },
    assertions: [],
    tests: null,
    docs: null
  };

  // events
  if (socketio?.events) {
    if (Array.isArray(socketio.events)) {
      brunoRequest.body.socketio = socketio.events.map((e, index) => {
        const variant = e as SocketIOEventVariant;
        if (variant.title !== undefined || variant.event !== undefined) {
          return {
            name: variant.title || `event ${index + 1}`,
            type: variant.event?.type || 'json',
            content: ensureString(variant.event?.data)
          };
        }
        const single = e as SocketIOEventSingle;
        return {
          name: `event ${index + 1}`,
          type: single.type || 'json',
          content: ensureString(single.data)
        };
      });
    } else {
      const e = socketio.events as SocketIOEventSingle;
      const eventData = ensureString(e.data);
      if (eventData.trim().length) {
        brunoRequest.body.socketio = [{
          name: 'event 1',
          type: e.type || 'json',
          content: eventData
        }];
      }
    }
  }

  // scripts
  const scripts = toBrunoScripts(runtime?.scripts);
  if (scripts?.script && brunoRequest.script) {
    if (scripts.script.req) {
      brunoRequest.script.req = scripts.script.req;
    }
    if (scripts.script.res) {
      brunoRequest.script.res = scripts.script.res;
    }
  }
  if (scripts?.tests) {
    brunoRequest.tests = scripts.tests;
  }

  // variables
  const variables = toBrunoVariables(runtime?.variables);
  brunoRequest.vars = variables;

  // docs
  if (ocRequest.docs) {
    brunoRequest.docs = ocRequest.docs;
  }

  // bruno item
  const brunoItem: BrunoItem = {
    uid: uuid(),
    type: 'socketio-request',
    seq: info?.seq || 1,
    name: ensureString(info?.name, 'Untitled Request'),
    tags: info?.tags || [],
    request: brunoRequest,
    fileContent: null,
    root: null,
    items: [],
    examples: [],
    filename: null,
    pathname: null
  };

  return brunoItem;
};

export default parseSocketioRequest;
