const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const usersRouter = require('./users');

app.use(cors());

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });

  socket.on('chat message', (msg) => {
    console.log('Received message from client:', msg);
    // Выводим сообщение в консоль
    console.log('Message from client:', msg);
    // Отправляем сообщение всем клиентам, включая отправителя
    io.emit('chat message', msg);
  });

});

app.use(express.json());
app.use('/users', usersRouter);


server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
