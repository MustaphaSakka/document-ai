# Technical Notes

Learning notes on how the underlying technology works, kept separate from the project
documentation in the [parent directory](../README.md). They explain mechanisms, not how this
project uses them.

## [HTTP Server Concepts](http-server-concepts.md)

How Node.js HTTP servers work:

- The event-driven model, request handling flow and concurrency
- `IncomingMessage` and `ServerResponse`: properties, lifecycle, streaming
- Why HTTP servers are asynchronous, and what the event loop does with connections
- What `server.listen()` does: socket binding, the accept loop, `EADDRINUSE`
- Graceful shutdown, and testing a server on a dynamic port

`src/server.ts` is the concrete version of this material — read the notes for the "why", then
the source for this project's application of it.

## Adding to this directory

These notes are for concepts worth explaining at length. Keep the project's own usage in the
parent directory's documents, cross-reference them, and prefer showing the mechanism over
restating the API documentation.
