const { Server } = require('socket.io');

const setupSocketIO = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // Default namespace
  io.on('connection', (socket) => {
    socket.onAny((eventName, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;

      // Transform the data: uppercase strings, reverse string values in objects
      const transform = (val) => {
        if (typeof val === 'string') return val.toUpperCase();
        if (typeof val === 'object' && val !== null) {
          const out = Array.isArray(val) ? [] : {};
          for (const [k, v] of Object.entries(val)) {
            out[k] = typeof v === 'string' ? v.split('').reverse().join('').toUpperCase() : v;
          }
          return out;
        }
        return val;
      };

      const transformed = args.map(transform);
      socket.emit(eventName, ...transformed);
      if (callback) {
        callback({ status: 'ok', eventName, data: transformed });
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
