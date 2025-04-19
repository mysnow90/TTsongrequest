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
const tiktokUsername2 = "n.xuan0702"; // 精灵's username

// File paths for each TikToker
const songRequestsFile1 = path.join(__dirname, 'songRequests1.json');
const songRequestsFile2 = path.join(__dirname, 'songRequests2.json');
const giftRecordsFile1 = path.join(__dirname, 'giftRecords1.json');
const giftRecordsFile2 = path.join(__dirname, 'giftRecords2.json');

// Ensure JSON files exist
const ensureFile = (filePath) => {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify([]));
};
[ songRequestsFile1, songRequestsFile2, giftRecordsFile1, giftRecordsFile2 ].forEach(ensureFile);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/euniceaiii', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/euniceaiii.html'));
});
app.get('/nxuan0702', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/nxuan0702.html'));
});

// WebSocket connection
io.on('connection', socket => {
  console.log('A user connected.');

  socket.on('request_existing', (who) => {
    if (who === 'euniceaiii') {
      fs.readFile(songRequestsFile1, 'utf8', (err, data) => {
        if (!err) {
          try {
            socket.emit('existing_song_requests', JSON.parse(data));
          } catch (e) { console.error("Error parsing songRequests1:", e); }
        }
      });
      fs.readFile(giftRecordsFile1, 'utf8', (err, data) => {
        if (!err) {
          try {
            socket.emit('gift_ranking', JSON.parse(data));
          } catch (e) { console.error("Error parsing giftRecords1:", e); }
        }
      });
    } else if (who === 'n.xuan0702') {
      fs.readFile(songRequestsFile2, 'utf8', (err, data) => {
        if (!err) {
          try {
            socket.emit('existing_song_requests_2', JSON.parse(data));
          } catch (e) { console.error("Error parsing songRequests2:", e); }
        }
      });
      fs.readFile(giftRecordsFile2, 'utf8', (err, data) => {
        if (!err) {
          try {
            socket.emit('gift_ranking_2', JSON.parse(data));
          } catch (e) { console.error("Error parsing giftRecords2:", e); }
        }
      });
    }
  });
});

// Function to connect and listen to TikTok
function connectToTikTok(username, songFile, giftFile, socketEventName, socketGiftEventName) {
  const tiktokConnection = new WebcastPushConnection(username);

  tiktokConnection.connect().then(state => {
    console.log(`Connected to roomId: ${state.roomId} (${username})`);
  }).catch(err => {
    console.error(`Connection failed for ${username}:`, err);
    setTimeout(() => connectToTikTok(username, songFile, giftFile, socketEventName, socketGiftEventName), 60000);
  });

  tiktokConnection.on('chat', data => {
    const comment = data.comment;
    const user = data.nickname;

    io.emit('chat_message', { user, message: comment });

    const matches = comment.match(/[＃#][^＃#]+/g);
    if (matches) {
      matches.forEach(match => {
        const song = match.substring(1).trim();
        const newRequest = {
          user,
          song,
          time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur', hour12: false }).replace(',', '')
        };

        console.log(`[${username}] Song Request: ${song}`);

        fs.readFile(songFile, 'utf8', (err, fileData) => {
          let songRequests = [];
          if (!err) {
            try { songRequests = JSON.parse(fileData); } catch (e) { console.error('Parse error:', e); }
          }
          songRequests.push(newRequest);
          fs.writeFile(songFile, JSON.stringify(songRequests, null, 2), err => {
            if (err) console.error('Error writing song file:', err);
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
    const diamondCount = data.diamondCount || 0;
    const totalDiamonds = giftCount * diamondCount;

    const newGiftDetail = {
      gift: giftName,
      count: giftCount,
      diamonds: totalDiamonds
    };

    console.log(`[${username}] Gift: ${giftName} from ${user} x${giftCount} (${totalDiamonds} coins)`);

    fs.readFile(giftFile, 'utf8', (err, fileData) => {
      let giftRecords = [];
      if (!err) {
        try { giftRecords = JSON.parse(fileData); } catch (e) { console.error('Gift file parse error:', e); }
      }

      let existingUser = giftRecords.find(entry => entry.user === user);
      if (existingUser) {
        existingUser.totalDiamonds += totalDiamonds;
        let existingGift = existingUser.gifts.find(g => g.gift === giftName);
        if (existingGift) {
          existingGift.count += giftCount;
          existingGift.diamonds += totalDiamonds;
        } else {
          existingUser.gifts.push(newGiftDetail);
        }
      } else {
        giftRecords.push({
          user,
          totalDiamonds: totalDiamonds,
          gifts: [newGiftDetail]
        });
      }

      giftRecords.sort((a, b) => b.totalDiamonds - a.totalDiamonds);

      fs.writeFile(giftFile, JSON.stringify(giftRecords, null, 2), err => {
        if (err) console.error('Error writing gift file:', err);
      });
    });

    io.emit(socketGiftEventName, { user, giftName, giftCount, totalDiamonds });
  });

  tiktokConnection.on('disconnected', () => {
    console.warn(`Disconnected from ${username}. Reconnecting in 60s...`);
    setTimeout(() => connectToTikTok(username, songFile, giftFile, socketEventName, socketGiftEventName), 60000);
  });

  tiktokConnection.on('error', err => {
    console.error(`Error from ${username}:`, err);
  });
}

// Connect both streamers
connectToTikTok(tiktokUsername1, songRequestsFile1, giftRecordsFile1, 'song_request_euniceaiii', 'gift_ranking');
connectToTikTok(tiktokUsername2, songRequestsFile2, giftRecordsFile2, 'song_request_nxuan0702', 'gift_ranking_2');

// Clear APIs
app.post('/clear-requests-euniceaiii', (req, res) => {
  fs.writeFile(songRequestsFile1, JSON.stringify([]), err => {
    if (err) return res.status(500).json({ success: false });
    io.emit('clear_song_requests_euniceaiii');
    res.json({ success: true });
  });
});

app.post('/clear-gifts-euniceaiii', (req, res) => {
  fs.writeFile(giftRecordsFile1, JSON.stringify([]), err => {
    if (err) return res.status(500).json({ success: false });
    io.emit('clear_gift_ranking');
    res.json({ success: true });
  });
});

app.post('/clear-requests-nxuan0702', (req, res) => {
  fs.writeFile(songRequestsFile2, JSON.stringify([]), err => {
    if (err) return res.status(500).json({ success: false });
    io.emit('clear_song_requests_nxuan0702');
    res.json({ success: true });
  });
});

app.post('/clear-gifts-nxuan0702', (req, res) => {
  fs.writeFile(giftRecordsFile2, JSON.stringify([]), err => {
    if (err) return res.status(500).json({ success: false });
    io.emit('clear_gift_ranking_2');
    res.json({ success: true });
  });
});

// Start server
server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
