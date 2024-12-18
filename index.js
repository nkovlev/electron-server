
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://njznfalivirfsoamylaw.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qem5mYWxpdmlyZnNvYW15bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI5MjQ1NjEsImV4cCI6MjAyODUwMDU2MX0.Qnr0mEK2n9K9PIKF2dz8VjHGEEueZjDNKddiNqMnXR8";
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const usersRouter = require('./users');

app.use(cors());
app.use(express.json());
app.use('/users', usersRouter);

const clients = new Map();

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
      const { userId } = parsedMessage;
      clients.set(userId, ws);
      ws.userId = userId;
      console.log(`User registered: ${userId}`);

      ws.send(JSON.stringify({ message: "User registered", userId: userId }));
    } else if (parsedMessage.type === 'message') {
      const { id, sender_id, recepient_id, room_id, message_text, timestamp } = parsedMessage;

      // Сохраняем сообщение в базу данных
      const { data, error } = await supabase
        .from('chat_message')
        .insert([
          { id, sender_id, recepient_id, room_id, message_text, timestamp }
        ]);

      if (error) {
        console.error('Error saving message:', error);
        return;
      }

      // Отправляем сообщение конкретному получателю
      const client = clients.get(recepient_id);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(parsedMessage));
        console.log(`Сообщение отправлено пользователю ${recepient_id}`);
      } else {
        console.log(`Пользователь ${recepient_id} не в сети. Сообщение сохранено.`);
      }
    }
  });

  ws.on('close', () => {
    console.log('A user disconnected');
    if (ws.userId) {
      clients.delete(ws.userId); // Удаляем клиента из списка клиентов
      console.log(`User disconnected: ${ws.userId}`);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
