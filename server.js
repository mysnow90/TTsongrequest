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

// File paths for each TikToker's song requests and gift records
const songRequestsFile1 = path.join(__dirname, 'songRequests1.json');
const songRequestsFile2 = path.join(__dirname, 'songRequests2.json');
const giftRecordsFile1 = path.join(__dirname, 'giftRecords1.json');
const giftRecordsFile2 = path.join(__dirname, 'giftRecords2.json');

// Ensure JSON files exist
if (!fs.existsSync(songRequestsFile1)) {
  fs.writeFileSync(songRequestsFile1, JSON.stringify([]));
}
if (!fs.existsSync(songRequestsFile2)) {
  fs.writeFileSync(songRequestsFile2, JSON.stringify([]));
}
if (!fs.existsSync(giftRecordsFile1)) {
  fs.writeFileSync(giftRecordsFile1, JSON.stringify([]));
}
if (!fs.existsSync(giftRecordsFile2)) {
  fs.writeFileSync(giftRecordsFile2, JSON.stringify([]));
}

// Middleware to serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/euniceaiii', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/euniceaiii.html'));
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
      fs.readFile(giftRecordsFile1, 'utf8', (err, data) => {
        if (!err) {
          try {
            const giftRecords = JSON.parse(data);
            socket.emit('gift_ranking', giftRecords);
          } catch (parseError) {
            console.error("Error parsing giftRecords1.json:", parseError);
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
      fs.readFile(giftRecordsFile2, 'utf8', (err, data) => {
        if (!err) {
          try {
            const giftRecords = JSON.parse(data);
            socket.emit('gift_ranking_2', giftRecords);
          } catch (parseError) {
            console.error("Error parsing giftRecords2.json:", parseError);
          }
        }
      });
    }
  });

  // Function to connect to TikTok Live
  function connectToTikTok(username, songFile, giftFile, socketEventName, socketGiftEventName) {
    const tiktokConnection = new WebcastPushConnection(username);

    tiktokConnection.connect().then(state => {
      console.log(`Connected to roomId: ${state.roomId} (${username})`);
    }).catch(err => {
      console.error(`Connection failed for ${username}:`, err);
      setTimeout(() => connectToTikTok(username, songFile, giftFile, socketEventName, socketGiftEventName), 5000);
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

          fs.readFile(songFile, 'utf8', (err, fileData) => {
            let songRequests = [];
            if (!err) {
              try {
                songRequests = JSON.parse(fileData);
              } catch (parseErr) {
                console.error('Error parsing file:', parseErr);
              }
            }

            songRequests.push(newRequest);

            fs.writeFile(songFile, JSON.stringify(songRequests, null, 2), writeErr => {
              if (writeErr) {
                console.error('Error writing to file:', writeErr);
              }
            });
          });

          io.emit(socketEventName, newRequest);
        });
      }
    });

    tiktokConnection.on('gift', data => {
      const user = data.nickname;
      const giftName = data.giftName;
      const giftCount = data.giftCount;

      const newGift = { user, gift: giftName, count: giftCount };

      console.log(`[${username}] Gift: ${giftName} from ${user} x${giftCount}`);

      // Update gift records in the file
      fs.readFile(giftFile, 'utf8', (err, fileData) => {
        let giftRecords = [];
        if (!err) {
          try {
            giftRecords = JSON.parse(fileData);
          } catch (parseErr) {
            console.error('Error parsing gift file:', parseErr);
          }
        }

        const existingUser = giftRecords.find(entry => entry.user === user);
        if (existingUser) {
          existingUser.count += giftCount; // Increase the existing count
        } else {
          giftRecords.push(newGift);
        }

        giftRecords.sort((a, b) => b.count - a.count); // Sort by count descending

        fs.writeFile(giftFile, JSON.stringify(giftRecords, null, 2), writeErr => {
          if (writeErr) {
            console.error('Error writing to gift file:', writeErr);
          }
        });
      });

      io.emit(socketGiftEventName, newGift);
    });

    tiktokConnection.on('disconnected', () => {
      console.warn(`Disconnected from ${username}. Reconnecting in 5s...`);
      setTimeout(() => connectToTikTok(username, songFile, giftFile, socketEventName, socketGiftEventName), 5000);
    });

    tiktokConnection.on('error', err => {
      console.error(`Error from ${username}:`, err);
    });
  }

  // Connect both TikTokers separately
  connectToTikTok(tiktokUsername1, songRequestsFile1, giftRecordsFile1, 'song_request_euniceaiii', 'gift_ranking');
  connectToTikTok(tiktokUsername2, songRequestsFile2, giftRecordsFile2, 'song_request_nxuan0702', 'gift_ranking_2');

  // Clear song requests and gift records
  app.post('/clear-requests-euniceaiii', (req, res) => {
    fs.writeFile(songRequestsFile1, JSON.stringify([]), err => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error clearing song requests.' });
      }
      io.emit('clear_song_requests_euniceaiii');
      res.json({ success: true });
    });
  });

  app.post('/clear-gifts-euniceaiii', (req, res) => {
    fs.writeFile(giftRecordsFile1, JSON.stringify([]), err => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error clearing gift records.' });
      }
      io.emit('clear_gift_ranking');
      res.json({ success: true });
    });
  });

});

// Start server
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
