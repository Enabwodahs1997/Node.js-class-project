const assert = require('assert')
const fs = require('fs')
const net = require('net')
const os = require('os')
const path = require('path')
const test = require('node:test')

const { createChatServer } = require('./index.js')

function waitFor(condition, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()

    function check() {
      try {
        const value = condition()
        if (value) {
          resolve(value)
          return
        }
      } catch (error) {
        reject(error)
        return
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Timed out waiting for condition.'))
        return
      }

      setTimeout(check, 10)
    }

    check()
  })
}

function createSocketClient(port) {
  const socket = net.createConnection({ host: '127.0.0.1', port })
  socket.setEncoding('utf8')

  const state = {
    socket,
    lines: [],
    closed: false,
  }

  let bufferedInput = ''

  socket.on('data', (chunk) => {
    bufferedInput += chunk

    let newlineIndex = bufferedInput.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = bufferedInput.slice(0, newlineIndex).replace(/\r$/, '')
      bufferedInput = bufferedInput.slice(newlineIndex + 1)

      if (line) {
        state.lines.push(line)
      }

      newlineIndex = bufferedInput.indexOf('\n')
    }
  })

  socket.on('close', () => {
    state.closed = true
  })

  return state
}

async function connectClient(port) {
  const client = createSocketClient(port)
  await waitFor(() => client.lines.some((line) => line.startsWith('Welcome, ')))
  return client
}

function sendLine(client, line) {
  client.socket.write(`${line}\n`)
}

function flushLines(client) {
  const lines = client.lines.slice()
  client.lines.length = 0
  return lines
}

function createServerFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-server-test-'))
  const logFile = path.join(tempDir, 'server.log')
  const server = createChatServer({
    logFile,
    adminPassword: 'test-admin-pw',
  })

  return { tempDir, logFile, server }
}

test('whisper sends a private message only to the target client', async (t) => {
  const fixture = createServerFixture()
  await new Promise((resolve) => fixture.server.listen(0, resolve))
  t.after(() => fixture.server.close())

  const port = fixture.server.address().port
  const client1 = await connectClient(port)
  const client2 = await connectClient(port)

  flushLines(client1)
  flushLines(client2)

  sendLine(client1, '/w Client2 hello there')

  await waitFor(() => client2.lines.some((line) => line === '[whisper from Client1] hello there'))

  assert.deepStrictEqual(flushLines(client2), ['[whisper from Client1] hello there'])
  assert.deepStrictEqual(flushLines(client1), [])

  client1.socket.end()
  client2.socket.end()
})

test('username updates broadcast the rename and confirm the sender', async (t) => {
  const fixture = createServerFixture()
  await new Promise((resolve) => fixture.server.listen(0, resolve))
  t.after(() => fixture.server.close())

  const port = fixture.server.address().port
  const client1 = await connectClient(port)
  const client2 = await connectClient(port)

  flushLines(client1)
  flushLines(client2)

  sendLine(client1, '/username alice')

  await waitFor(() => client1.lines.includes('Username changed successfully. You are now alice.'))
  await waitFor(() => client2.lines.includes('Client1 is now known as alice.'))

  assert.ok(client1.lines.includes('Username changed successfully. You are now alice.'))
  assert.ok(client2.lines.includes('Client1 is now known as alice.'))

  flushLines(client1)
  flushLines(client2)

  sendLine(client1, '/clientlist')
  await waitFor(() => client1.lines.includes('Connected clients: alice, Client2'))
  assert.ok(client1.lines.includes('Connected clients: alice, Client2'))

  client1.socket.end()
  client2.socket.end()
})

test('kick removes the target and notifies remaining clients', async (t) => {
  const fixture = createServerFixture()
  await new Promise((resolve) => fixture.server.listen(0, resolve))
  t.after(() => fixture.server.close())

  const port = fixture.server.address().port
  const admin = await connectClient(port)
  const target = await connectClient(port)

  flushLines(admin)
  flushLines(target)

  sendLine(admin, '/kick Client2 test-admin-pw')

  await waitFor(() => target.lines.includes('You have been kicked from the chat.'))
  await waitFor(() => target.closed)
  await waitFor(() => admin.lines.includes('Client2 has been kicked from the chat.'))

  assert.ok(target.lines.includes('You have been kicked from the chat.'))
  assert.ok(admin.lines.includes('Client2 has been kicked from the chat.'))

  admin.socket.end()
})

test('client list returns all connected usernames', async (t) => {
  const fixture = createServerFixture()
  await new Promise((resolve) => fixture.server.listen(0, resolve))
  t.after(() => fixture.server.close())

  const port = fixture.server.address().port
  const client1 = await connectClient(port)
  const client2 = await connectClient(port)

  flushLines(client1)
  flushLines(client2)

  sendLine(client1, '/clientlist')

  await waitFor(() => client1.lines.includes('Connected clients: Client1, Client2'))
  assert.ok(client1.lines.includes('Connected clients: Client1, Client2'))

  client1.socket.end()
  client2.socket.end()
})