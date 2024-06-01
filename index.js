const express = require('express');
const https = require('https');
const WebSocket = require('ws');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = "https://njznfalivirfsoamylaw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qem5mYWxpdmlyZnNvYW15bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI5MjQ1NjEsImV4cCI6MjAyODUwMDU2MX0.Qnr0mEK2n9K9PIKF2dz8VjHGEEueZjDNKddiNqMnXR8";
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = 3000;
const app = express();

// Конфигурация SSL
const options = {
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem')
};

const server = https.createServer(options, app);
const wss = new WebSocket.Server({ server });
const usersRouter = require('./users');

app.use(cors());
app.use(express.json());
app.use('/users', usersRouter);

const clients = new Map();
const rooms = new Map();

wss.on('connection', function connection(ws) {
  console.log('A user connected');

  ws.on('message', async function incoming(message) {
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
    } catch (error) {
      console.error("Invalid JSON received:", message);
      ws.send(JSON.stringify({ error: "Invalid JSON format" }));
      return;
    }

    if (parsedMessage.type === 'register') {
      const { userId, roomId } = parsedMessage;
      clients.set(userId, ws);
      ws.userId = userId;

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId).add(ws);

      ws.send(JSON.stringify({ message: "User registered", userId: userId }));
    } else if (parsedMessage.type === 'message') {
      const { id, sender_id, recepient_id, room_id, message_text, timestamp } = parsedMessage;
      const { data, error } = await supabase
        .from('chat_message')
        .insert([{ id, sender_id, recepient_id, room_id, message_text, timestamp }]);

      if (error) {
        console.error('Error saving message:', error);
        return;
      }

      if (rooms.has(room_id)) {
        rooms.get(room_id).forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(parsedMessage));
          }
        });
      }
    }
  });

  ws.on('close', () => {
    console.log('A user disconnected');
    if (ws.userId) {
      clients.delete(ws.userId);
      rooms.forEach((clients, roomId) => {
        if (clients.has(ws)) {
          clients.delete(ws);
          if (clients.size === 0) {
            rooms.delete(roomId);
          }
        }
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
