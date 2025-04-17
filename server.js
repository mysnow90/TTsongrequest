const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// TikTok usernames
const tiktokUsername1 = "euniceaiii";
const tiktokUsername2 = "nxuan0702";

// File paths for each TikToker's song requests
const songRequestsFile1 = path.join(__dirname, 'songRequests1.json');
const songRequestsFile2 = path.join(__dirname, 'songRequests2.json');

// Ensure JSON files exist
if (!fs.existsSync(songRequestsFile1)) {
  fs.writeFileSync(songRequestsFile1, JSON.stringify([]));
}
if (!fs.existsSync(songRequestsFile2)) {
  fs.writeFileSync(songRequestsFile2, JSON.stringify([]));
}

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve page for each TikToker
app.get('/euniceaiii', (req, res) => {
  res.sendFile(path.join(__dirname, 'euniceaiii.html'));
});

app.get('/nxuan0702', (req, res) => {
  res.sendFile(path.join(__dirname, 'nxuan0702.html'));
});

// Handle clearing the song request lists
app.post('/clear-requests', (req, res) => {
  fs.writeFile(songRequestsFile1, JSON.stringify([], null, 2), (err) => {
    if (err) {
      console.error('Error clearing song requests:', err);
      return res.status(500).json({ success: false, message: 'Failed to clear song requests.' });
    }
    io.emit('clear_song_requests');
    res.json({ success: true });
  });
});

// Handle WebSocket connections
io.on('connection', socket => {
  fs.readFile(songRequestsFile1, 'utf8', (err, data) => {
    if (!err) {
      try {
        const songRequests = JSON.parse(data);
        socket.emit('existing_song_requests', songRequests);
      } catch (parseError) {
        console.error("Error parsing songRequests1.json:", parseError);
      }
    }
  });

  // Additional code for handling the second TikToker's requests
  fs.readFile(songRequestsFile2, 'utf8', (err, data) => {
    if (!err) {
      try {
        const songRequests = JSON.parse(data);
        socket.emit('existing_song_requests_2', songRequests);
      } catch (parseError) {
        console.error("Error parsing songRequests2.json:", parseError);
      }
    }
  });
});

// Connect to TikTok live
function connectToTikTok(username, file) {
  const tiktokConnection = new WebcastPushConnection(username);

  tiktokConnection.connect().then(state => {
    console.log(`Connected to roomId: ${state.roomId}`);
  }).catch(err => {
    console.error("Connection failed:", err);
    setTimeout(() => connectToTikTok(username, file), 5000);
  });

  tiktokConnection.on('chat', data => {
    const comment = data.comment;
    const user = data.nickname;
    
    io.emit('chat_message', { user, message: comment });

    const matches = comment.match(/#(\S+)/g);
    if (matches) {
      matches.forEach(match => {
        const song = match.substring(1);
        const newRequest = { 
          user, 
          song, 
          time: new Date().toLocaleTimeString() 
        };
        console.log(`Song Request: ${song}`);

        fs.readFile(file, 'utf8', (err, fileData) => {
          let songRequests = [];
          if (!err) {
            try {
              songRequests = JSON.parse(fileData);
            } catch (parseErr) {
              console.error('Error parsing file:', parseErr);
            }
          }

          songRequests.push(newRequest);

          fs.writeFile(file, JSON.stringify(songRequests, null, 2), writeErr => {
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
    setTimeout(() => connectToTikTok(username, file), 5000);
  });

  tiktokConnection.on('error', err => {
    console.error("Error:", err);
  });
}

// Connect both TikTokers
connectToTikTok(tiktokUsername1, songRequestsFile1);
connectToTikTok(tiktokUsername2, songRequestsFile2);

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
