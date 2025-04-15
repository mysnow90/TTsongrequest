const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const tiktokUsername = "euniceaiii"; 

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Define a route for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to handle connection logic
function connectToTikTok() {
  const tiktokConnection = new WebcastPushConnection(tiktokUsername);

  tiktokConnection.connect().then(state => {
    console.log(`Connected to roomId: ${state.roomId}`);
  }).catch(err => {
    console.error("Connection failed:", err);
    // Retry connection after 5 seconds if initial connection fails
    setTimeout(connectToTikTok, 5000);
  });

  tiktokConnection.on('chat', data => {
    const comment = data.comment;
    const matches = comment.match(/#\[(.*?)\]/); // Matches #[Song Name]

    if (matches) {
      const song = matches[1];
      console.log(`Song Request: ${song}`);
      io.emit('song_request', { user: data.nickname, song });
    }
  });

  tiktokConnection.on('disconnected', () => {
    console.warn("Disconnected from TikTok Live. Attempting to reconnect in 5 seconds...");
    // Retry connection after 5 seconds
    setTimeout(connectToTikTok, 5000);
  });

  tiktokConnection.on('error', err => {
    console.error("An error occurred:", err);
  });
}

// Start the initial connection
connectToTikTok();

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
