// TCP Chat Client - connects to server, logs messages, and forwards stdin input
const net = require('net')        // Node TCP networking module
const readline = require('readline')  // For reading stdin user input

// Configuration
const HOST = process.env.CHAT_HOST || '127.0.0.1'  // Server host (default localhost)
const PORT = Number(process.env.CHAT_PORT) || Number(process.env.PORT) || 5000  // Server port

// Connection state
let socket = null                 // TCP socket connection to server
let shouldReconnect = true        // Flag to attempt reconnection on disconnect
let isConnected = false           // Track current connection status
let bufferedInput = ''            // Buffer for incomplete lines from server
const pendingMessages = []        // Queue of messages to send when connected

// Set up stdin reader to capture user keyboard input
const stdinInput = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,  // Support both Unix and Windows line endings
})

// Flush any queued messages that were pending during disconnect
function sendPendingMessages() {
  // Only send if socket is ready and connected
  if (!socket || !socket.writable || !isConnected) {
    return
  }

  // Send all queued messages
  while (pendingMessages.length > 0) {
    const message = pendingMessages.shift()  // Remove from front of queue
    socket.write(`${message}\n`)            // Send to server
  }
}

// Establish connection to the chat server
function connect() {
  socket = net.createConnection({ host: HOST, port: PORT })
  socket.setEncoding('utf8')      // Decode incoming data as UTF-8 strings
  bufferedInput = ''              // Reset buffer for new connection

  // Handle successful connection to server
  socket.on('connect', () => {
    isConnected = true            // Mark as connected
    console.log('connected')      // Log connection status to stdout
    sendPendingMessages()         // Send any messages that were queued
  })

  // Handle incoming messages from the server
  socket.on('data', (chunk) => {
    bufferedInput += chunk  // Append new data to buffer

    // Process all complete lines in the buffer
    let newlineIndex = bufferedInput.indexOf('\n')
    while (newlineIndex !== -1) {
      // Extract line and remove carriage return
      const line = bufferedInput.slice(0, newlineIndex).replace(/\r$/, '')
      bufferedInput = bufferedInput.slice(newlineIndex + 1)  // Remove from buffer

      // Log the line to stdout (shows server messages)
      if (line) {
        console.log(line)
      }

      newlineIndex = bufferedInput.indexOf('\n')  // Check for next line
    }
  })

  // Handle connection errors (errors also trigger close event)
  socket.on('error', () => {
    // Connection errors are handled by the close event so the client can retry.
  })

  // Handle socket close (normal disconnect or error)
  socket.on('close', () => {
    isConnected = false  // Mark as disconnected

    // Automatically reconnect if not shutting down
    if (shouldReconnect) {
      setTimeout(connect, 1000)  // Retry after 1 second
    }
  })
}

// Handle user input from keyboard (stdin)
stdinInput.on('line', (line) => {
  // If connected, immediately forward the line to server
  if (socket && socket.writable && isConnected) {
    socket.write(`${line}\n`)
    return
  }

  // If not connected, queue the message for later
  pendingMessages.push(line)
})

// Handle graceful shutdown on Ctrl+C
process.on('SIGINT', () => {
  shouldReconnect = false       // Disable auto-reconnect
  stdinInput.close()            // Close stdin reader

  if (socket) {
    socket.end()                // Close connection to server
  }

  process.exit(0)               // Exit the process
})

// Start the initial connection to the server
connect()