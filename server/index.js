// TCP Chat Server - handles multiple client connections and broadcasts messages
const fs = require('fs')
const net = require('net')
const path = require('path')

// Configuration
const PORT = Number(process.env.PORT) || 5000
const DEFAULT_LOG_FILE = path.join(__dirname, 'server.log')
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'supersecretpw'

function createChatServer(options = {}) {
  const logFile = options.logFile || DEFAULT_LOG_FILE
  const adminPassword = options.adminPassword || DEFAULT_ADMIN_PASSWORD
  const clients = new Map()
  let nextClientNumber = 1

  function logChat(message) {
    const logLine = `[${new Date().toISOString()}] ${message}\n`
    fs.appendFileSync(logFile, logLine)
  }

  function sendLine(socket, message) {
    if (!socket || socket.destroyed || !socket.writable) {
      return false
    }

    socket.write(`${message}\n`)
    return true
  }

  function findClientByName(username) {
    for (const client of clients.values()) {
      if (client.name === username) {
        return client
      }
    }

    return null
  }

  function getClientNames() {
    return Array.from(clients.values()).map((client) => client.name)
  }

  function getCommandArguments(trimmedLine, command) {
    if (trimmedLine === command) {
      return ''
    }

    if (trimmedLine.startsWith(`${command} `)) {
      return trimmedLine.slice(command.length).trimStart()
    }

    return null
  }

  function broadcast(message, excludedSocket = null) {
    for (const [socket] of clients) {
      if (socket === excludedSocket || socket.destroyed || !socket.writable) {
        continue
      }

      socket.write(`${message}\n`)
    }
  }

  function handleCommand(clientInfo, line) {
    const trimmedLine = line.trim()

    const whisperArguments = getCommandArguments(trimmedLine, '/w')
    if (whisperArguments !== null) {
      if (!whisperArguments) {
        const errorMessage = 'Error: /w requires a target username and a message.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} whisper failed: ${errorMessage}`)
        return true
      }

      const firstSpaceIndex = whisperArguments.indexOf(' ')

      if (firstSpaceIndex === -1) {
        const errorMessage = 'Error: /w requires a target username and a message.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} whisper failed: ${errorMessage}`)
        return true
      }

      const targetName = whisperArguments.slice(0, firstSpaceIndex).trim()
      const whisperMessage = whisperArguments.slice(firstSpaceIndex + 1).trim()

      if (!targetName || !whisperMessage) {
        const errorMessage = 'Error: /w requires a target username and a message.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} whisper failed: ${errorMessage}`)
        return true
      }

      if (targetName === clientInfo.name) {
        const errorMessage = 'Error: you cannot whisper to yourself.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} whisper failed: ${errorMessage}`)
        return true
      }

      const targetClient = findClientByName(targetName)

      if (!targetClient) {
        const errorMessage = `Error: username '${targetName}' is not connected.`
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} whisper failed: ${errorMessage}`)
        return true
      }

      const privateMessage = `[whisper from ${clientInfo.name}] ${whisperMessage}`
      sendLine(targetClient.socket, privateMessage)
      logChat(`${clientInfo.name} whispered to ${targetName}: ${whisperMessage}`)
      return true
    }

    const usernameArguments = getCommandArguments(trimmedLine, '/username')
    if (usernameArguments !== null) {
      if (!usernameArguments) {
        const errorMessage = 'Error: /username requires exactly one new username.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} username change failed: ${errorMessage}`)
        return true
      }

      const parts = trimmedLine.split(/\s+/)

      if (parts.length !== 2) {
        const errorMessage = 'Error: /username requires exactly one new username.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} username change failed: ${errorMessage}`)
        return true
      }

      const newName = parts[1].trim()

      if (!newName) {
        const errorMessage = 'Error: /username requires exactly one new username.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} username change failed: ${errorMessage}`)
        return true
      }

      if (newName === clientInfo.name) {
        const errorMessage = 'Error: the new username must be different from the current username.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} username change failed: ${errorMessage}`)
        return true
      }

      if (findClientByName(newName)) {
        const errorMessage = `Error: username '${newName}' is already in use.`
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} username change failed: ${errorMessage}`)
        return true
      }

      const oldName = clientInfo.name
      clientInfo.name = newName

      const broadcastMessage = `${oldName} is now known as ${newName}.`
      broadcast(broadcastMessage, clientInfo.socket)
      sendLine(clientInfo.socket, `Username changed successfully. You are now ${newName}.`)
      logChat(`${oldName} changed username to ${newName}`)
      return true
    }

    const kickArguments = getCommandArguments(trimmedLine, '/kick')
    if (kickArguments !== null) {
      if (!kickArguments) {
        const errorMessage = 'Error: /kick requires a username and the admin password.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} kick failed: ${errorMessage}`)
        return true
      }

      const parts = trimmedLine.split(/\s+/)

      if (parts.length !== 3) {
        const errorMessage = 'Error: /kick requires a username and the admin password.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} kick failed: ${errorMessage}`)
        return true
      }

      const targetName = parts[1].trim()
      const suppliedPassword = parts[2]

      if (!targetName) {
        const errorMessage = 'Error: /kick requires a username and the admin password.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} kick failed: ${errorMessage}`)
        return true
      }

      if (targetName === clientInfo.name) {
        const errorMessage = 'Error: you cannot kick yourself.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} kick failed: ${errorMessage}`)
        return true
      }

      if (suppliedPassword !== adminPassword) {
        const errorMessage = 'Error: incorrect admin password.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} kick failed: ${errorMessage}`)
        return true
      }

      const targetClient = findClientByName(targetName)

      if (!targetClient) {
        const errorMessage = `Error: username '${targetName}' is not connected.`
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} kick failed: ${errorMessage}`)
        return true
      }

      targetClient.disconnectNotice = `${targetClient.name} has been kicked from the chat.`
      sendLine(targetClient.socket, 'You have been kicked from the chat.')
      targetClient.socket.end()

      logChat(`${clientInfo.name} kicked ${targetName}`)
      return true
    }

    const clientListArguments = getCommandArguments(trimmedLine, '/clientlist')
    if (clientListArguments !== null) {
      if (clientListArguments) {
        const errorMessage = 'Error: /clientlist does not take any arguments.'
        sendLine(clientInfo.socket, errorMessage)
        logChat(`${clientInfo.name} client list failed: ${errorMessage}`)
        return true
      }

      const clientNames = getClientNames()
      const listMessage = clientNames.length > 0
        ? `Connected clients: ${clientNames.join(', ')}`
        : 'Connected clients: none'

      sendLine(clientInfo.socket, listMessage)
      logChat(`${clientInfo.name} requested client list: ${clientNames.join(', ') || 'none'}`)
      return true
    }

    return false
  }

  const server = net.createServer((socket) => {
    const clientId = `Client${nextClientNumber++}`
    const clientInfo = {
      id: clientId,
      name: clientId,
      socket,
      connected: true,
      disconnectNotice: `${clientId} has disconnected.`,
    }

    clients.set(socket, clientInfo)
    socket.setEncoding('utf8')
    let bufferedInput = ''

    socket.write(`Welcome, ${clientId}!\n`)

    const connectionMessage = `${clientId} has connected.`
    broadcast(connectionMessage, socket)
    logChat(connectionMessage)

    socket.on('data', (chunk) => {
      bufferedInput += chunk

      let newlineIndex = bufferedInput.indexOf('\n')
      while (newlineIndex !== -1) {
        const line = bufferedInput.slice(0, newlineIndex).replace(/\r$/, '').trim()
        bufferedInput = bufferedInput.slice(newlineIndex + 1)

        if (line) {
          if (!handleCommand(clientInfo, line)) {
            const message = `${clientInfo.name}: ${line}`
            broadcast(message, socket)
            logChat(message)
          }
        }

        newlineIndex = bufferedInput.indexOf('\n')
      }
    })

    const handleDisconnect = () => {
      if (!clientInfo.connected) {
        return
      }

      clientInfo.connected = false
      clients.delete(socket)

      const disconnectMessage = clientInfo.disconnectNotice || `${clientInfo.name} has disconnected.`
      broadcast(disconnectMessage, socket)
      logChat(disconnectMessage)
    }

    socket.on('close', handleDisconnect)
    socket.on('end', handleDisconnect)
    socket.on('error', handleDisconnect)
  })

  return server
}

function startServer() {
  const server = createChatServer()

  server.listen(PORT, () => {
    console.log(`Chat server listening on port ${PORT}`)
  })

  return server
}

if (require.main === module) {
  startServer()
}

module.exports = {
  createChatServer,
  startServer,
}