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
      console.error('Error clearing songRequests1.json:', err);
      return res.status(500).json({ success: false, message: 'Failed to clear song requests.' });
    }
    fs.writeFile(songRequestsFile2, JSON.stringify([], null, 2), (err2) => {
      if (err2) {
        console.error('Error clearing songRequests2.json:', err2);
        return res.status(500).json({ success: false, message: 'Failed to clear song requests 2.' });
      }
      io.emit('clear_song_requests');
      res.json({ success: true });
    });
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

// Helper: get Malaysia Time
function getMalaysiaTimeString() {
  const now = new Date();
  const malaysiaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // +8 hours
  return malaysiaTime.toISOString().
