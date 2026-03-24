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
