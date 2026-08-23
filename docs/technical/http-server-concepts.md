# HTTP Server Concepts

Complete explanation of how Node.js HTTP servers work, covering the fundamental concepts needed to understand and build web servers with Node.js.

## 1. How Node.js HTTP Servers Work

Node.js HTTP servers use an **event-driven, asynchronous architecture** that makes them highly efficient for handling many concurrent connections.

### Core Architecture

```typescript
import http from 'node:http';

const server = http.createServer((request, response) => {
  // Handle each incoming request
});

server.listen(3000);
```

### Key Components

#### **Event-Driven Model**
- **Single-threaded**: Node.js runs on a single thread using an event loop
- **Non-blocking I/O**: Operations that take time (network, file system) don't block the thread
- **Event loop**: Continuously monitors for events and triggers callbacks when events occur

#### **Request Handling Flow**
1. **Client connects** → TCP connection established
2. **HTTP request received** → Parsed into request object
3. **Callback invoked** → Your handler function processes the request
4. **Response sent** → Data written back to client
5. **Connection managed** → Keep-alive or closed based on HTTP version

#### **Concurrency Model**
```typescript
// This can handle hundreds of concurrent requests
const server = http.createServer((req, res) => {
  // Each request gets its own callback execution
  // No thread creation overhead
  // Non-blocking I/O means other requests aren't blocked
});
```

### Performance Characteristics

- **Scalable**: Handles thousands of concurrent connections efficiently
- **Memory efficient**: No thread per connection overhead
- **Fast**: Minimal latency due to event-driven architecture
- **I/O bound**: Excels at I/O operations (network, file system)

---

## 2. Request and Response Objects

Every HTTP request handled by Node.js provides two fundamental objects: `request` (IncomingMessage) and `response` (ServerResponse).

### The `request` Object (IncomingMessage)

Represents the **incoming HTTP request** from the client and contains all information about the request.

#### Key Properties

```typescript
interface IncomingMessage {
  // HTTP method
  method: string;           // "GET", "POST", "PUT", "DELETE", etc.

  // URL information
  url: string;             // Full URL path and query string
  headers: IncomingHttpHeaders;  // Request headers

  // Connection information
  socket: Socket;          // Underlying network socket
  connection: Socket;       // Alias for socket

  // Stream properties
  readable: boolean;       // Can read from this stream
  readableEnded: boolean;  // Stream has ended

  // HTTP version
  httpVersion: string;     // "1.1", "2.0", etc.

  // Trailers (headers sent after body)
  trailers: NodeJS.Dict<string>;
}
```

#### Practical Usage

```typescript
// Access request method
if (request.method === 'GET') {
  // Handle GET request
}

// Access URL path
if (request.url === '/health') {
  // Handle health check
}

// Parse query parameters
const url = new URL(request.url, `http://${request.headers.host}`);
const searchParams = url.searchParams;

// Access headers
const contentType = request.headers['content-type'];
const userAgent = request.headers['user-agent'];

// Read request body (for POST/PUT requests)
let body = '';
request.on('data', (chunk) => {
  body += chunk.toString();
});
request.on('end', () => {
  // Body is complete
  const data = JSON.parse(body);
});
```

#### Request Body as Stream

The request object is a **readable stream**, which means:

- **Chunked reading**: Data arrives in pieces
- **Memory efficient**: Doesn't load entire body into memory
- **Event-based**: Process data as it arrives

```typescript
request.on('data', (chunk) => {
  // Process each chunk of data
  console.log(`Received ${chunk.length} bytes`);
});

request.on('end', () => {
  // All data received
  console.log('Request body complete');
});
```

### The `response` Object (ServerResponse)

Represents the **outgoing HTTP response** to the client and controls what gets sent back.

#### Key Methods and Properties

```typescript
interface ServerResponse {
  // Status code
  statusCode: number;      // 200, 404, 500, etc.
  statusMessage: string;   // "OK", "Not Found", etc.

  // Headers
  setHeader(name: string, value: string): void;
  getHeader(name: string): string | undefined;
  removeHeader(name: string): void;
  headersSent: boolean;    // True if headers already sent

  // Body writing
  write(chunk: string | Buffer): boolean;
  end(data?: string | Buffer): void;

  // Connection control
  keepAlive: boolean;
  setTimeout(ms: number, callback?: () => void): void;

  // HTTP version
  httpVersion: string;
}
```

#### Response Lifecycle

```typescript
// 1. Set status code
response.statusCode = 200;

// 2. Set headers (must be before write/end)
response.setHeader('Content-Type', 'application/json');
response.setHeader('Cache-Control', 'no-cache');

// 3. Write body (optional, can skip if ending with data)
response.write('{"message": "Hello"}');

// 4. End response (required)
response.end();
```

#### Practical Usage

```typescript
// JSON response
response.statusCode = 200;
response.setHeader('Content-Type', 'application/json');
response.end(JSON.stringify({ status: 'ok' }));

// HTML response
response.statusCode = 200;
response.setHeader('Content-Type', 'text/html');
response.end('<h1>Hello World</h1>');

// File download
response.statusCode = 200;
response.setHeader('Content-Type', 'application/pdf');
response.setHeader('Content-Disposition', 'attachment; filename="doc.pdf"');

// Error response
response.statusCode = 404;
response.setHeader('Content-Type', 'application/json');
response.end(JSON.stringify({ error: 'Not Found' }));

// Redirect
response.statusCode = 301;
response.setHeader('Location', '/new-url');
response.end();
```

#### Response as Stream

The response object is a **writable stream**:

```typescript
// Streaming large files
const fileStream = fs.createReadStream('large-file.pdf');
fileStream.pipe(response);

// Manual streaming
response.write('Part 1');
response.write('Part 2');
response.end('Part 3');
```

### Request-Response Pair Characteristics

#### **One-to-One Relationship**
- Each request gets exactly one response
- Response must be completed (ended) for each request
- Multiple responses per request are not allowed

#### **Immutable Headers After Send**
```typescript
response.setHeader('Content-Type', 'text/html');
response.write('Hello');  // Headers are now sent

// This won't work - headers already sent
response.setHeader('Cache-Control', 'no-cache');  // Ignored
```

#### **Connection Reuse (Keep-Alive)**
- Modern HTTP reuses connections for multiple requests
- Node.js handles this automatically
- Response doesn't necessarily close the connection

---

## 3. Why HTTP Servers are Asynchronous

HTTP servers in Node.js are inherently asynchronous due to the nature of network operations and the design philosophy of Node.js.

### The Asynchronous Nature of HTTP

#### **HTTP is Request-Response Protocol**
```
Client                    Server
  |                         |
  |--- HTTP Request ------->|
  |                         |  [Processing time]
  |                         |  [Database queries]
  |                         |  [File I/O]
  |                         |  [API calls]
  |<-- HTTP Response -------|
```

During the processing time, the server shouldn't be blocked from handling other requests.

### Why Asynchronous Architecture Matters

#### **1. Non-Blocking I/O Operations**
```typescript
// Asynchronous - doesn't block other requests
const server = http.createServer(async (req, res) => {
  const data = await fs.readFile('large-file.txt');  // Non-blocking
  res.end(data);
});

// Synchronous - blocks entire server
const server = http.createServer((req, res) => {
  const data = fs.readFileSync('large-file.txt');  // BLOCKING!
  res.end(data);
});
```

#### **2. Concurrent Request Handling**
```typescript
// Asynchronous - handles many requests simultaneously
const server = http.createServer(async (req, res) => {
  const result1 = await database.query('SELECT * FROM users');
  const result2 = await externalAPI.getData();
  res.end(JSON.stringify({ result1, result2 }));
});

// While this request waits for database/API, other requests can be processed
```

#### **3. Scalability Without Threads**
```typescript
// Traditional approach (thread-per-request):
// - Each request gets a thread
// - High memory overhead (stack per thread)
// - Context switching overhead
// - Limited by thread pool size

// Node.js approach (async/event-driven):
// - Single thread handles many requests
// - Low memory overhead
// - No context switching
// - Scales to thousands of concurrent connections
```

### Event Loop and HTTP Servers

#### **How the Event Loop Processes HTTP**
```typescript
const server = http.createServer((req, res) => {
  // This callback runs when a request event occurs
  // Other requests can be processed while this one waits for I/O
  setTimeout(() => {
    res.end('Delayed response');
  }, 1000);
});

server.listen(3000);

// Event loop:
// 1. Wait for events (incoming requests, timers, I/O completion)
// 2. Process events one at a time
// 3. Never block - always return to event loop
// 4. Handle next event
```

#### **Practical Example of Async Benefits**
```typescript
// Scenario: Server handles 100 concurrent requests
// Each request needs to:
// - Read file from disk (50ms)
// - Query database (100ms)
// - Call external API (200ms)

// Synchronous approach:
// Total time = 100 requests × (50ms + 100ms + 200ms) = 35 seconds
// Server blocks on each operation

// Asynchronous approach:
// Total time ≈ max(50ms, 100ms, 200ms) = 200ms
// All requests processed concurrently
```

### Async/Await in HTTP Servers

#### **Modern Pattern**
```typescript
const server = http.createServer(async (request, response) => {
  try {
    // Can await async operations without blocking
    const data = await readFileAsync('data.json');
    const processed = await processDataAsync(data);
    const result = await database.insert(processed);

    response.statusCode = 200;
    response.end(JSON.stringify(result));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
});
```

#### **Benefits of Async/Await**
- **Readable**: Looks like synchronous code
- **Error handling**: Try/catch blocks work naturally
- **Sequential async operations**: Easy to chain
- **Non-blocking**: Still doesn't block other requests

### Performance Implications

#### **Throughput Comparison**
```typescript
// Synchronous server: ~1000 requests/second
const syncServer = http.createServer((req, res) => {
  const data = fs.readFileSync('data.json');
  res.end(data);
});

// Asynchronous server: ~10000+ requests/second
const asyncServer = http.createServer(async (req, res) => {
  const data = await fs.promises.readFile('data.json');
  res.end(data);
});
```

#### **Memory Efficiency**
- **Synchronous**: Each blocked request holds memory (stack, state)
- **Asynchronous**: Minimal memory per request (just callback context)

---

## 4. How server.listen() Works

The `server.listen()` method is what transforms an HTTP server from a defined object into a running service that can accept network connections.

### What listen() Actually Does

#### **1. Socket Creation and Binding**
```typescript
server.listen(3000);
```

**Behind the scenes:**
1. **Create TCP socket**: Opens a socket for network communication
2. **Bind to port**: Associates the socket with port 3000
3. **Listen state**: Puts socket in passive listening mode
4. **Register with event loop**: Socket becomes an event source

#### **2. Network Binding Process**
```typescript
// Port-specific binding
server.listen(3000);                    // Bind to port 3000 on all interfaces

// Interface-specific binding
server.listen(3000, '127.0.0.1');       // Bind only to localhost

// Custom hostname
server.listen(3000, '0.0.0.0');         // Bind to all available interfaces
```

#### **3. Callback Execution**
```typescript
server.listen(3000, () => {
  console.log('Server is ready!');
});

// The callback fires when:
// - Socket is successfully created
// - Port is bound
// - Server is ready to accept connections
```

### Server Lifecycle

#### **Creation vs. Listening**
```typescript
// Step 1: Create server (not listening yet)
const server = http.createServer((req, res) => {
  res.end('Hello');
});

console.log('Server created but not listening');
// Server object exists but won't accept connections

// Step 2: Start listening
server.listen(3000, () => {
  console.log('Server is now listening');
  // Server can now accept and process connections
});
```

#### **Connection Acceptance Loop**
```
Server is listening
     |
     v
Wait for TCP connection
     |
     v
Connection received → Create request → Invoke callback → Send response
     |
     v
Wait for next connection (loop continues)
```

### Advanced listen() Options

#### **Port Selection**
```typescript
// Specific port
server.listen(3000);

// Random available port (useful for testing)
server.listen(0, () => {
  const port = server.address().port;
  console.log(`Listening on random port: ${port}`);
});
```

#### **Binding Options**
```typescript
// Bind to specific IP
server.listen(3000, '192.168.1.100');

// Bind to all interfaces
server.listen(3000, '0.0.0.0');

// Bind to localhost only
server.listen(3000, '127.0.0.1');
```

#### **Full Configuration**
```typescript
server.listen({
  port: 3000,
  host: '0.0.0.0',
  backlog: 511,        // Connection queue length
  exclusive: false,    // Prevent port sharing
  path: null,          // Unix socket path (alternative to port)
}, () => {
  console.log('Server configured and listening');
});
```

### What Happens During listen()

#### **1. Operating System Interaction**
```
Node.js Application
      |
      v
server.listen(3000)
      |
      v
Operating System
      |
      v
1. Create socket() system call
2. bind() to port 3000
3. listen() - mark as passive socket
4. Ready for accept() calls
```

#### **2. Error Scenarios**
```typescript
// Port already in use
server.listen(3000);
// Error: EADDRINUSE - Port already in use

// Permission denied (ports < 1024 require root/admin)
server.listen(80);
// Error: EACCES - Permission denied

// Address already in use
server.listen(3000, '127.0.0.1');
// Error: EADDRINUSE - Address already in use
```

### Connection Handling After listen()

#### **Accept Loop**
```typescript
server.listen(3000);

// Internally, Node.js runs an accept loop:
while (server.listening) {
  const connection = await acceptConnection();
  processConnection(connection);
}
```

#### **Connection Queue**
```typescript
server.listen(3000, null, 511);  // backlog = 511
// This many connections can queue while processing others
```

### Graceful Shutdown

#### **Stopping the Server**
```typescript
const server = http.createServer(handler);
server.listen(3000);

// To stop the server
server.close(() => {
  console.log('Server stopped');
});

// Important: close() doesn't terminate existing connections
// It just stops accepting new ones
```

#### **Graceful Shutdown Pattern**
```typescript
let connections = 0;

server.on('connection', (socket) => {
  connections++;
  socket.on('close', () => {
    connections--;
  });
});

function gracefulShutdown() {
  server.close(() => {
    console.log('Server stopped accepting connections');

    // Wait for existing connections to finish
    const checkInterval = setInterval(() => {
      if (connections === 0) {
        clearInterval(checkInterval);
        console.log('All connections closed, exiting');
        process.exit(0);
      }
    }, 100);
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

### Server Address Information

#### **Getting Server Address**
```typescript
server.listen(3000, '0.0.0.0', () => {
  const address = server.address();

  if (typeof address === 'string') {
    console.log(`Unix socket: ${address}`);
  } else {
    console.log(`Port: ${address.port}`);
    console.log(`Address: ${address.address}`);
    console.log(`Family: ${address.family}`);  // IPv4 or IPv6
  }
});
```

### Testing with listen()

#### **Dynamic Port Allocation**
```typescript
// For testing, use random available port
const server = http.createServer(handler);
server.listen(0, () => {
  const port = server.address().port;
  console.log(`Testing on port: ${port}`);

  // Now you can test against http://localhost:${port}
});
```

### Summary

The `server.listen()` method is the bridge between:
- **Server definition**: The HTTP server object
- **Network reality**: Actual network connections and data flow

It handles the complex operating system interactions needed to:
1. Create network sockets
2. Bind to ports and interfaces  
3. Listen for incoming connections
4. Integrate with Node.js event loop
5. Provide callbacks for readiness

Understanding `listen()` is crucial because it's the moment when your HTTP server goes from being a defined object to being a running service that can handle real network traffic.

---

## Additional Concepts

### HTTP Methods and Status Codes

```typescript
// Handling different HTTP methods
const server = http.createServer((req, res) => {
  switch (req.method) {
    case 'GET':
      // Retrieve data
      res.statusCode = 200;
      break;
    case 'POST':
      // Create data
      res.statusCode = 201;
      break;
    case 'PUT':
      // Update data
      res.statusCode = 200;
      break;
    case 'DELETE':
      // Delete data
      res.statusCode = 204;
      break;
    default:
      // Method not allowed
      res.statusCode = 405;
      break;
  }
  res.end();
});
```

### HTTP Headers

```typescript
// Request headers (read from client)
const userAgent = req.headers['user-agent'];
const contentType = req.headers['content-type'];
const authorization = req.headers['authorization'];

// Response headers (send to client)
res.setHeader('Content-Type', 'application/json');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Set-Cookie', 'sessionId=abc123');
```

### Error Handling

```typescript
const server = http.createServer(async (req, res) => {
  try {
    // Your server logic
    const data = await someAsyncOperation();
    res.statusCode = 200;
    res.end(data);
  } catch (error) {
    console.error('Request error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }));
  }
});
```

### Streaming Data

```typescript
const server = http.createServer((req, res) => {
  // Stream large files without loading into memory
  const fileStream = fs.createReadStream('large-file.pdf');

  res.setHeader('Content-Type', 'application/pdf');

  fileStream.pipe(res);

  fileStream.on('error', (error) => {
    console.error('File error:', error);
    res.statusCode = 500;
    res.end('File not found');
  });
});
```

This comprehensive understanding of HTTP server concepts provides the foundation for building robust, scalable web applications with Node.js while leveraging its unique event-driven, asynchronous architecture.
