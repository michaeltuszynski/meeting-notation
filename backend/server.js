const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : false
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('audio:chunk', async (audioData) => {
    console.log('Received audio chunk:', audioData.length);
    
    // TODO: Send to Deepgram
    // TODO: Extract terms with GPT-4
    // TODO: Fetch knowledge with Tavily
    
    socket.emit('transcript:update', {
      text: 'Processing...',
      timestamp: Date.now()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
