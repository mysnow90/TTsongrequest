const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const tiktokUsername = "euniceaiii"; // Your TikTok username
const songRequestsFile = path.join(__dirname, 'songRequests.json');

// Ensure the JSON file exists
if (!fs.existsSync(songRequestsFile)) {
  fs.writeFileSync(songRequestsFile, JSON.stringify([]));
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Clear song request list
app.post('/clear-requests', (req, res) => {
  fs.writeFile(songRequestsFile, JSON.stringify([], null, 2), (err) => {
    if (err) {
      console.error('Error clearing song requests:', err);
      return res.status(500).json({ success: false, message: 'Failed to clear song requests.' });
    }
    io.emit('clear_song_requests');
    res.json({ success: true });
  });
});

// Send existing song requests to new connections
io.on('connection', socket => {
  fs.readFile(songRequestsFile, 'utf8', (err, data) => {
    if (!err) {
      try {
        const songRequests = JSON.parse(data);
        socket.emit('existing_song_requests', songRequests);
      } catch (parseError) {
        console.error("Error parsing songRequests.json:", parseError);
      }
    }
  });
});

// Connect to TikTok Live
function connectToTikTok() {
  const tiktokConnection = new WebcastPushConnection(tiktokUsername);

  tiktokConnection.connect().then(state => {
    console.log(`Connected to roomId: ${state.roomId}`);
  }).catch(err => {
    console.error("Connection failed:", err);
    setTimeout(connectToTikTok, 5000);
  });

  tiktokConnection.on('chat', data => {
    const comment = data.comment;
    const user = data.nickname;

    io.emit('chat_message', { user, message: comment });

    // Match # + optional spaces + song name
    const matches = comment.match(/#\s*(.+)/g);
    if (matches) {
      matches.forEach(match => {
        const song = match.replace(/^#\s*/, '').trim(); // remove # and spaces

        const now = new Date();
        const timeString = now.toLocaleString('en-US', {
          timeZone: 'Asia/Singapore',
          hour12: false,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        const newRequest = { 
          user, 
          song, 
          time: timeString, 
          timestamp: now.getTime() // <-- Save raw timestamp for "time ago" 
        };
        console.log(`Song Request: ${song}`);

        fs.readFile(songRequestsFile, 'utf8', (err, fileData) => {
          let songRequests = [];
          if (!err) {
            try {
              songRequests = JSON.parse(fileData);
            } catch (parseErr) {
              console.error('Error parsing file:', parseErr);
            }
          }

          songRequests.push(newRequest);

          fs.writeFile(songRequestsFile, JSON.stringify(songRequests, null, 2), writeErr => {
            if (writeErr) {
              console.error('Error writing to file:', writeErr);
            }
          });
        });

        io.emit('song_request', newRequest);
      });
    }
  });

  tiktokConnection.on('disconnected', () => {
    console.warn("Disconnected from TikTok Live. Reconnecting in 5s...");
    setTimeout(connectToTikTok, 5000);
  });

  tiktokConnection.on('error', err => {
    console.error("Error:", err);
  });
}

connectToTikTok();

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
