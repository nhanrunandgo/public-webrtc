// server.js
const http = require('http');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Map();

wss.on('connection', (ws) => {
  const clientId = uuidv4();
  let clientName = null;

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.type) {
        case 'join': {
          clientName = msg.name.trim();
          clients.set(clientId, { ws, name: clientName });

          // Gửi init cho client mới
          const peers = Array.from(clients.entries())
            .filter(([id]) => id !== clientId)
            .map(([id, info]) => ({ id, name: info.name }));

          ws.send(JSON.stringify({
            type: 'init',
            id: clientId,
            name: clientName,
            peers
          }));

          // Thông báo new-peer cho các client cũ
          clients.forEach((client, id) => {
            if (id !== clientId) {
              client.ws.send(JSON.stringify({
                type: 'new-peer',
                id: clientId,
                name: clientName
              }));
            }
          });
          break;
        }

        case 'offer':
        case 'answer':
        case 'candidate': {
          const target = clients.get(msg.to);
          if (target) {
            target.ws.send(JSON.stringify({ ...msg, from: clientId }));
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (!clients.has(clientId)) return;
    
    const { name } = clients.get(clientId);
    clients.delete(clientId);

    // Broadcast peer-left
    const leftMsg = JSON.stringify({
      type: 'peer-left',
      id: clientId,
      name
    });

    clients.forEach(client => client.ws.send(leftMsg));
  });
});

server.listen(3000, () => console.log('Signaling listening on :3000'));