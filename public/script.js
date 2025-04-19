// ❄️ Snow Effect
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

  setTimeout(() => snowflake.remove(), 8000);
}

setInterval(createSnowflake, 100);

// 🎵 点歌功能
const socket = io();
const list = document.getElementById('requests');

socket.on('song_request_euniceaiii', (data) => {
  const li = document.createElement('li');
  const time = data.time || new Date().toLocaleTimeString();
  li.textContent = `[${time}] ${data.user}: ${data.song}`;
  list.appendChild(li);
  window.scrollTo(0, document.body.scrollHeight);
});

// 🎁 礼物动画展示
const giftArea = document.getElementById('gift-area');

function updateGift(gift) {
  const giftElement = document.createElement('div');
  giftElement.classList.add('gift');
  giftElement.textContent = `${gift.user} 送来了 ${gift.giftName || gift.gift}`;
  giftArea.appendChild(giftElement);
  setTimeout(() => giftElement.remove(), 1300);
}

// 🏆 排名处理（带 top 3 样式）
const rankingList = document.getElementById('ranking-list');
let rankings = {};

function updateRanking(gift) {
  const value = gift.value || gift.count || gift.giftCount || 1;

  if (!rankings[gift.user]) {
    rankings[gift.user] = 0;
  }
  rankings[gift.user] += value;

  // 排序并重建排行榜
  const sorted = Object.entries(rankings).sort((a, b) => b[1] - a[1]);
  rankingList.innerHTML = '';

  sorted.forEach(([user, total], index) => {
    const rankingDiv = document.createElement('div');
    rankingDiv.classList.add('ranking');
    rankingDiv.textContent = `${user}: ${total}`;

    // Top 3 特效
    if (index === 0) rankingDiv.classList.add('top-1');
    else if (index === 1) rankingDiv.classList.add('top-2');
    else if (index === 2) rankingDiv.classList.add('top-3');

    rankingList.appendChild(rankingDiv);

    // 动画：rank-up
    setTimeout(() => rankingDiv.classList.add('rank-up'), 100);
    setTimeout(() => rankingDiv.classList.remove('rank-up'), 1000);
  });
}

// 🎧 接收礼物事件
socket.on('gift_received_euniceaiii', (gift) => {
  updateGift(gift);
  updateRanking(gift);
});

// 🔘 清空点歌按钮
document.getElementById('clearSongListButton').addEventListener('click', () => {
  if (confirm('确定要清空点歌列表吗？')) {
    fetch('/clear-requests-euniceaiii', { method: 'POST' })
      .then(res => res.json())
      .then(result => {
        if (result.success) {
          list.innerHTML = '';
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

// 🔘 清空礼物按钮
document.getElementById('clearGiftsButton').addEventListener('click', () => {
  giftArea.innerHTML = '';
});

// 🔘 清空排行榜按钮
document.getElementById('clearRankingsButton').addEventListener('click', () => {
  rankings = {};
  rankingList.innerHTML = '';
});
