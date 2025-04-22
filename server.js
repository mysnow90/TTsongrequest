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
const tiktokUsername2 = "n.xuan0702";

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

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/euniceaiii', (req, res) => {
  res.sendFile(path.join(__dirname, 'euniceaiii.html'));
});

app.get('/nxuan0702', (req, res) => {
  res.sendFile(path.join(__dirname, 'nxuan0702.html'));
});

// Handle WebSocket connections
io.on('connection', socket => {
  console.log('A user connected.');

  socket.on('request_existing', (who) => {
    if (who === 'euniceaiii') {
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
    } else if (who === 'nxuan0702') {
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
    }
  });
});

// Function to connect to TikTok Live
function connectToTikTok(username, file, socketEventName) {
  const tiktokConnection = new WebcastPushConnection(username);

  tiktokConnection.connect().then(state => {
    console.log(`Connected to roomId: ${state.roomId} (${username})`);
  }).catch(err => {
    console.error(`Connection failed for ${username}:`, err);
    setTimeout(() => connectToTikTok(username, file, socketEventName), 5000);
  });

  tiktokConnection.on('chat', data => {
    const comment = data.comment;
    const user = data.nickname;

    io.emit('chat_message', { user, message: comment });

    // Match #songname or ＃songname including space after
    const matches = comment.match(/[＃#][^＃#]+/g);
    if (matches) {
      matches.forEach(match => {
        const song = match.substring(1).trim(); // remove # and trim

        const newRequest = {
          user,
          song,
          time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour12: false }).replace(',', '')
        };

        console.log(`[${username}] Song Request: ${song}`);

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

        io.emit(socketEventName, newRequest);
      });
    }
  });

  tiktokConnection.on('disconnected', () => {
    console.warn(`Disconnected from ${username}. Reconnecting in 5s...`);
    setTimeout(() => connectToTikTok(username, file, socketEventName), 5000);
  });

  tiktokConnection.on('error', err => {
    console.error(`Error from ${username}:`, err);
  });
}

// Connect both TikTokers separately
connectToTikTok(tiktokUsername1, songRequestsFile1, 'song_request_euniceaiii');
connectToTikTok(tiktokUsername2, songRequestsFile2, 'song_request_nxuan0702');

// Clear song requests for euniceaiii
app.post('/clear-requests-euniceaiii', (req, res) => {
  fs.writeFile(songRequestsFile1, JSON.stringify([]), (err) => {
    if (err) {
      console.error('Error clearing song requests for euniceaiii:', err);
      return res.status(500).json({ success: false, message: 'Failed to clear song requests' });
    }
    res.json({ success: true });
  });
});

// Clear song requests for nxuan0702
app.post('/clear-requests-nxuan0702', (req, res) => {
  fs.writeFile(songRequestsFile2, JSON.stringify([]), (err) => {
    if (err) {
      console.error('Error clearing song requests for nxuan0702:', err);
      return res.status(500).json({ success: false, message: 'Failed to clear song requests' });
    }
    res.json({ success: true });
  });
});

// Start server
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
