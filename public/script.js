// Snow Effect
const snowContainer = document.createElement('div');
snowContainer.classList.add('snow');
document.body.appendChild(snowContainer);

function createSnowflake() {
  const snowflake = document.createElement('div');
  snowflake.classList.add('snowflake');
  snowflake.textContent = '❄';
  snowflake.style.left = `${Math.random() * 100}vw`;
  snowflake.style.animationDuration = `${Math.random() * 3 + 2}s`;
  snowflake.style.animationDelay = `${Math.random() * 5}s`;
  snowflake.style.fontSize = `${Math.random() * 10 + 10}px`;
  snowContainer.appendChild(snowflake);

  setTimeout(() => {
    snowflake.remove();
  }, 8000);
}

setInterval(createSnowflake, 100);

// Song Request Handling
const socket = io();
const list = document.getElementById('requests');

// Handle Song Request (from server)
socket.on('song_request_euniceaiii', (data) => {
  const li = document.createElement('li');
  const time = data.time || new Date().toLocaleTimeString();
  li.textContent = `[${time}] ${data.user}: ${data.song}`;
  list.appendChild(li);
  window.scrollTo(0, document.body.scrollHeight); // Auto-scroll
});

// Handle Gift Animation
const giftArea = document.getElementById('gift-area');

function updateGift(gift) {
  const giftElement = document.createElement('div');
  giftElement.classList.add('gift');
  giftElement.textContent = `${gift.user} 送来了 ${gift.giftName}`;
  giftArea.appendChild(giftElement);
  setTimeout(() => giftElement.remove(), 1500); // Remove after animation
}

// Handle Ranking Updates
const rankingList = document.getElementById('ranking-list');
let rankings = {};

function updateRanking(gift) {
  if (!rankings[gift.user]) {
    rankings[gift.user] = 0;
  }
  rankings[gift.user] += gift.value;

  const rankingDiv = document.createElement('div');
  rankingDiv.classList.add('ranking');
  rankingDiv.textContent = `${gift.user}: ${rankings[gift.user]}`;
  rankingList.appendChild(rankingDiv);
  setTimeout(() => rankingDiv.classList.add('rank-up'), 100); // Animate ranking change

  setTimeout(() => rankingDiv.classList.remove('rank-up'), 1000); // Reset animation
}

// Receive Gift Event
socket.on('gift_received_euniceaiii', (gift) => {
  updateGift(gift);
  updateRanking(gift);
});

// Clear Song List Button
document.getElementById('clearSongListButton').addEventListener('click', () => {
  if (confirm('确定要清空点歌列表吗？')) {
    fetch('/clear-requests-euniceaiii', { method: 'POST' })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          list.innerHTML = ''; // Clear list
          alert('点歌列表已清空！');
        } else {
          alert('清空失败，请检查服务器！');
        }
      })
      .catch(err => {
        console.error('Error:', err);
        alert('网络错误，清空失败！');
      });
  }
});

// Clear Gifts Button
document.getElementById('clearGiftsButton').addEventListener('click', () => {
  giftArea.innerHTML = ''; // Clear gift display
});

// Clear Rankings Button
document.getElementById('clearRankingsButton').addEventListener('click', () => {
  rankings = {}; // Reset rankings
  rankingList.innerHTML = ''; // Clear ranking display
});
