const express = require('express');
const http = require('http');
const path = require('path'); // <-- ADD THIS
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const tiktokUsername = "smngx__";

// 🔽 Serve static files from "public" folder
app.use(express.static('public'));

// 🔽 Add route for root to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ⏺ TikTok connection
const tiktokConnection = new WebcastPushConnection(tiktokUsername);

// ⏺ Connect to TikTok Live
tiktokConnection.connect().then(state => {
    console.log(`Connected to roomId: ${state.roomId}`);
}).catch(err => {
    console.error("Connection failed:", err);
});

// ⏺ Listen for song requests with #[Song Name]
tiktokConnection.on('chat', data => {
    const comment = data.comment;
    const matches = comment.match(/#\[(.*?)\]/); // Matches #[Song Name]

    if (matches) {
        const song = matches[1];
        console.log(`Song Request: ${song}`);
        io.emit('song_request', { user: data.nickname, song });
    }
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
