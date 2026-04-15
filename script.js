// ===== Pupils follow mouse =====
const pupils = document.querySelectorAll(".pupil");

document.addEventListener("mousemove", (e) => {
  pupils.forEach((pupil) => {
    const rect = pupil.parentElement.getBoundingClientRect();

    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    pupil.style.transform = `translate(${x / 10}px, ${y / 10}px)`;
  });
});


// ===== Eyes open/close =====
function closeEyes() {
  document.querySelectorAll(".eye").forEach((eye) => {
    eye.classList.add("closed");
  });
}

function openEyes() {
  document.querySelectorAll(".eye").forEach((eye) => {
    eye.classList.remove("closed");
  });
}


// ===== Dark / Light Mode on Load =====
window.onload = function () {
  const mode = localStorage.getItem("mode");
  const btn = document.getElementById("modeBtn");

  if (mode === "dark") {
    document.body.classList.add("dark");
    btn.innerHTML = "☀️";
  } else {
    btn.innerHTML = "🌙";
  }
};


// ===== Toggle Dark Mode =====
function toggleMode() {
  document.body.classList.toggle("dark");

  const btn = document.getElementById("modeBtn");

  if (document.body.classList.contains("dark")) {
    btn.innerHTML = "☀️";
    localStorage.setItem("mode", "dark");
  } else {
    btn.innerHTML = "🌙";
    localStorage.setItem("mode", "light");
  }
}


// ===== Hide Loader =====
window.addEventListener("load", function () {
  const loader = document.getElementById("loader");
  if (loader) {
    loader.style.display = "none";
  }
});


// ===== Cloud Bot Movement =====
const bot = document.querySelector(".cloud-bot");
const eyes = document.querySelectorAll(".cloud-bot .bot-eye");

const maxX = window.innerWidth - 100;
const maxY = window.innerHeight - 150;

// Move bot randomly
function moveBotRandom() {
  const x = Math.random() * maxX;
  const y = Math.random() * maxY;
  const rotation = (Math.random() * 20) - 10;

  bot.style.left = `${x}px`;
  bot.style.bottom = `${y}px`;
  bot.style.transform = `rotate(${rotation}deg)`;
}

setInterval(moveBotRandom, 2500);

// Eyes follow mouse
document.addEventListener("mousemove", (e) => {
  eyes.forEach((eye) => {
    const rect = eye.getBoundingClientRect();

    const eyeX = rect.left + rect.width / 2;
    const eyeY = rect.top + rect.height / 2;

    const dx = e.clientX - eyeX;
    const dy = e.clientY - eyeY;

    const angle = Math.atan2(dy, dx);
    const distance = Math.min(5, Math.hypot(dx, dy) / 15);

    eye.style.transform = `translate(${distance * Math.cos(angle)}px, ${distance * Math.sin(angle)}px)`;
  });
});
