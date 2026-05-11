// TCP Chat Server - handles multiple client connections and broadcasts messages
const fs = require('fs')          // File system - for logging chat messages
const net = require('net')        // Node TCP networking module
const path = require('path')      // Path utilities - for log file location

// Configuration
const PORT = Number(process.env.PORT) || 5000  // Chat server port (default 5000)
const LOG_FILE = path.join(__dirname, 'chat.log')  // Path to chat log file

// Client tracking
const clients = new Map()         // Map to store connected client sockets
let nextClientNumber = 1          // Counter for unique client IDs (Client1, Client2, etc)

// Append a timestamped message to the chat log file
function logChat(message) {
  const logLine = `[${new Date().toISOString()}] ${message}\n`
  fs.appendFileSync(LOG_FILE, logLine)  // Write to file synchronously
}

// Send a message to all connected clients except the specified one
// This prevents clients from receiving their own messages
function broadcast(message, excludedSocket = null) {
  for (const [socket] of clients) {
    // Skip the sender, closed sockets, and non-writable sockets
    if (socket === excludedSocket || socket.destroyed || !socket.writable) {
      continue
    }

    socket.write(`${message}\n`)  // Send message followed by newline
  }
}

// Create TCP server that handles new client connections
const server = net.createServer((socket) => {
  // Generate unique ID for this client
  const clientId = `Client${nextClientNumber++}`
  const clientInfo = {
    id: clientId,
    socket,
    connected: true,
  }

  // Store this client in the clients map
  clients.set(socket, clientInfo)
  socket.setEncoding('utf8')        // Decode incoming data as UTF-8 strings
  let bufferedInput = ''            // Buffer for incomplete lines

  // Send welcome message to the new client
  socket.write(`Welcome, ${clientId}!\n`)

  // Notify all other clients about the new connection
  const connectionMessage = `${clientId} has connected.`
  broadcast(connectionMessage, socket)  // Exclude this socket (don't send to self)
  logChat(connectionMessage)            // Record the connection in chat.log

  // Handle incoming messages from this client
  socket.on('data', (chunk) => {
    bufferedInput += chunk  // Append new data to buffer

    // Process all complete lines in the buffer (lines end with \n)
    let newlineIndex = bufferedInput.indexOf('\n')
    while (newlineIndex !== -1) {
      // Extract the line, remove carriage return and whitespace
      const line = bufferedInput.slice(0, newlineIndex).replace(/\r$/, '').trim()
      bufferedInput = bufferedInput.slice(newlineIndex + 1)  // Remove processed line from buffer

      // If line has content, rebroadcast it to all other clients
      if (line) {
        const message = `${clientId}: ${line}`  // Prefix message with client ID
        broadcast(message, socket)             // Send to all except this client
        logChat(message)                       // Log the message
      }

      newlineIndex = bufferedInput.indexOf('\n')  // Check for next complete line
    }
  })

  // Handle client disconnect (close, end, or error events)
  const handleDisconnect = () => {
    // Only process once (prevent duplicate disconnect handling)
    if (!clientInfo.connected) {
      return
    }

    clientInfo.connected = false    // Mark as disconnected
    clients.delete(socket)          // Remove from active clients map

    // Notify all remaining clients about the disconnection
    const disconnectMessage = `${clientId} has disconnected.`
    broadcast(disconnectMessage, socket)  // Send disconnect notification
    logChat(disconnectMessage)            // Log the disconnection
  }

  // Attach disconnect handlers to various socket events
  socket.on('close', handleDisconnect)     // Socket closed (normal or abnormal)
  socket.on('end', handleDisconnect)       // Socket end-of-stream reached
  socket.on('error', () => {
    handleDisconnect()                      // Error occurred on socket
  })
})

// Start the TCP server and begin accepting client connections
server.listen(PORT, () => {
  console.log(`Chat server listening on port ${PORT}`)
})
