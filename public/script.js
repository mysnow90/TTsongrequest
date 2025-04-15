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

socket.on('song_request', (data) => {
  const li = document.createElement('li');
  li.textContent = `${data.user}: ${data.song}`;
  list.appendChild(li);
});