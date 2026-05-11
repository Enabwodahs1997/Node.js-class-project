# Personal Notes

https://www.youtube.com/watch?v=32M1al-Y6Ag I used this video to help me with understanding things I struggled with throughout the course curriculum.

# InClassProjectNode29

A Node.js TCP chat server with multiple concurrent clients. Each client connects via TCP, receives a unique ID, and can send messages that are rebroadcast to all other connected clients. All chat events are logged to a file.

## Structure

- **client/** — Node.js CLI client that connects to the server, logs messages, and forwards stdin input
- **server/** — TCP chat server that manages connections, broadcasts messages, and logs all events

## Features

### Server (`server/index.js`)

- Assigns each connecting client a unique ID (Client1, Client2, etc.)
- Sends a welcome message to new clients
- Broadcasts join notifications when clients connect
- Rebroadcasts messages from clients to all other connected clients (excludes the sender)
- Broadcasts disconnect notifications when clients leave
- Logs all chat events (connections, messages, disconnections) to `server/chat.log` with timestamps
- Handles multiple concurrent TCP connections on port 5000

### Client (`client/index.cjs`)

- Connects to the chat server via TCP
- Logs `connected` to stdout when the connection is established
- Logs all messages received from the server to stdout
- Forwards each line of stdin input to the server
- Automatically reconnects if the connection drops
- Gracefully shuts down on Ctrl+C

## Quick Start

### Run Both Server and Client

From the project root:

```bash
npm install
npm run dev    # starts server on port 5000 and client in same terminal group
```

### Run Server Only

```bash
cd server
npm install
npm run dev
```

The server will start listening on port 5000. A `chat.log` file will be created in the `server/` directory.

### Run Client Only

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

The client will attempt to connect to `127.0.0.1:5000` and will automatically retry if the server is not available.

## Message Flow

1. Client connects to server on port 5000
2. Server assigns unique ID (e.g., Client1) and sends welcome message
3. Server broadcasts notification to other clients: "Client1 has connected."
4. When Client1 sends "Hi All!", server rebroadcasts to others as: "Client1: Hi All!"
5. When Client1 disconnects, server broadcasts: "Client1 has disconnected."
6. All events are logged to `server/chat.log` with ISO timestamps

## Environment Variables

### Client

- `CHAT_HOST` — Server hostname (default: `127.0.0.1`)
- `CHAT_PORT` — Server port (default: `5000`)
- `PORT` — Fallback port if `CHAT_PORT` is not set (default: `5000`)

### Server

- `PORT` — Server listening port (default: `5000`)

Example:

```bash
CHAT_HOST=192.168.1.100 CHAT_PORT=8000 npm run dev
```

## Logging

All chat events are written to `server/chat.log`:

- Client connections
- Chat messages (with sender ID)
- Client disconnections

Each log entry includes an ISO 8601 timestamp.

## Code Comments

Both `server/index.js` and `client/index.cjs` are thoroughly commented to explain:

- What each module and function does
- How the TCP protocol is handled
- Message buffering and line parsing
- Connection lifecycle and error handling

## Technical Details

- **Protocol:** Raw TCP with newline-delimited messages
- **Encoding:** UTF-8 for all data
- **Buffering:** Both server and client use buffered socket readers to handle partial lines from the network
- **Concurrency:** The Node.js event loop handles all concurrent client connections on the server
