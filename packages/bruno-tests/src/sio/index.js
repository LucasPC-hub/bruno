const { Server } = require('socket.io');

const setupSocketIO = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // Default namespace
  io.on('connection', (socket) => {
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
