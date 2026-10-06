const http = require('http');
const app = require('./app');

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// An async handler rejection that escapes Express would otherwise take the
// whole process down on modern Node. Log it and keep serving.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

const shutdown = (signal) => {
  console.log(`${signal} received, closing server...`);
  server.close(() => process.exit(0));
  // Force-exit if in-flight requests hang past the grace period
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
