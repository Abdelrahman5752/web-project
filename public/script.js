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
  document.querySelectorAll(".eye").forEach((eye) => eye.classList.add("closed"));
}
function openEyes() {
  document.querySelectorAll(".eye").forEach((eye) => eye.classList.remove("closed"));
}

// ===== Dark / Light Mode =====
window.onload = function () {
  const mode = localStorage.getItem("mode");
  const btn = document.getElementById("modeBtn");
  if (mode === "dark") {
    document.body.classList.add("dark");
    if (btn) btn.innerHTML = "☀️";
  } else {
    if (btn) btn.innerHTML = "🌙";
  }
};

function toggleMode() {
  document.body.classList.toggle("dark");
  const btn = document.getElementById("modeBtn");
  if (document.body.classList.contains("dark")) {
    if (btn) btn.innerHTML = "☀️";
    localStorage.setItem("mode", "dark");
  } else {
    if (btn) btn.innerHTML = "🌙";
    localStorage.setItem("mode", "light");
  }
}

// ===== Hide Loader =====
window.addEventListener("load", function () {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
});

// ===== Cloud Bot Movement =====
const bot = document.querySelector(".cloud-bot");
if (bot) {
  const botEyes = document.querySelectorAll(".cloud-bot .bot-eye");
  const maxX = window.innerWidth - 100;
  const maxY = window.innerHeight - 150;
  function moveBotRandom() {
    const x = Math.random() * maxX;
    const y = Math.random() * maxY;
    const rotation = (Math.random() * 20) - 10;
    bot.style.left = `${x}px`;
    bot.style.bottom = `${y}px`;
    bot.style.transform = `rotate(${rotation}deg)`;
  }
  setInterval(moveBotRandom, 2500);
  document.addEventListener("mousemove", (e) => {
    botEyes.forEach((eye) => {
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
}

// ===== SIDE MENU =====
function openSideMenu() {
  document.getElementById("sideMenu").classList.add("open");
}
function closeSideMenu() {
  document.getElementById("sideMenu").classList.remove("open");
}
// Close when clicking overlay
document.addEventListener("click", function (e) {
  const menu = document.getElementById("sideMenu");
  const hamburger = document.querySelector(".hamburger-btn");
  if (menu && menu.classList.contains("open") && !menu.contains(e.target) && e.target !== hamburger) {
    closeSideMenu();
  }
});

// ===== SLIDESHOW =====
let slideIndex = 0;
function showSlides() {
  const slides = document.querySelectorAll(".slide");
  if (!slides.length) return;
  slides.forEach(s => s.classList.remove("active"));
  slideIndex = (slideIndex + 1) % slides.length;
  slides[slideIndex].classList.add("active");
  setTimeout(showSlides, 3500);
}
document.addEventListener("DOMContentLoaded", () => {
  const slides = document.querySelectorAll(".slide");
  if (slides.length) {
    slides[0].classList.add("active");
    setTimeout(showSlides, 3500);
  }
});
function changeSlide(dir) {
  const slides = document.querySelectorAll(".slide");
  if (!slides.length) return;
  slides.forEach(s => s.classList.remove("active"));
  slideIndex = (slideIndex + dir + slides.length) % slides.length;
  slides[slideIndex].classList.add("active");
}
