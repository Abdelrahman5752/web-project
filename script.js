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

// ===== LOGIN with Authentication =====
function loginUser(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  const user = users.find(u => u.email === email && u.password === password);

  if (user) {
    localStorage.setItem("loggedInUser", JSON.stringify(user));
    showMessage("login-msg", "✅ Login successful! Redirecting...", "success");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
  } else {
    showMessage("login-msg", "❌ Invalid email or password.", "error");
  }
}

// ===== REGISTER =====
function registerUser(event) {
  event.preventDefault();
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirm = document.getElementById("confirm").value.trim();

  if (password !== confirm) {
    showMessage("reg-msg", "❌ Passwords do not match.", "error");
    return;
  }
  if (password.length < 6) {
    showMessage("reg-msg", "❌ Password must be at least 6 characters.", "error");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users") || "[]");
  if (users.find(u => u.email === email)) {
    showMessage("reg-msg", "❌ Email already registered.", "error");
    return;
  }

  users.push({ name, email, password });
  localStorage.setItem("users", JSON.stringify(users));
  showMessage("reg-msg", "✅ Account created! Redirecting to login...", "success");
  setTimeout(() => {
    window.location.href = "login.html";
  }, 1500);
}

// ===== Show Message Helper =====
function showMessage(id, text, type) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    const form = document.querySelector("form");
    if (form) form.appendChild(el);
  }
  el.textContent = text;
  el.className = "msg-box " + type;
  setTimeout(() => { el.textContent = ""; el.className = ""; }, 4000);
}

// ===== Navbar: show logged-in user & logout =====
function updateNavUser() {
  const user = JSON.parse(localStorage.getItem("loggedInUser") || "null");
  const loginLinks = document.querySelectorAll(".login-nav-link");
  const userDisplay = document.querySelectorAll(".user-display");

  if (user) {
    loginLinks.forEach(l => l.style.display = "none");
    userDisplay.forEach(d => {
      d.style.display = "inline";
      d.innerHTML = `👤 ${user.name} <a href="#" onclick="logoutUser()" style="color:#f66;margin-left:8px;font-size:13px;">(Logout)</a>`;
    });
  }
}

function logoutUser() {
  localStorage.removeItem("loggedInUser");
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", updateNavUser);

// ===== CART SYSTEM =====
let cart = JSON.parse(localStorage.getItem("cart") || "[]");

function getCart() {
  return JSON.parse(localStorage.getItem("cart") || "[]");
}
function saveCart(c) {
  localStorage.setItem("cart", JSON.stringify(c));
}

function addToCart(name, price) {
  const cart = getCart();
  const existing = cart.find(i => i.name === name);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ name, price, qty: 1 });
  }
  saveCart(cart);
  updateCartBadge();
  showMessage("cart-msg", `🛒 "${name}" added to cart!`, "success");
}

function removeFromCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
  renderCart();
  updateCartBadge();
}

function updateCartBadge() {
  const cart = getCart();
  const total = cart.reduce((sum, i) => sum + i.qty, 0);
  document.querySelectorAll(".cart-badge").forEach(b => {
    b.textContent = total;
    b.style.display = total > 0 ? "inline-block" : "none";
  });
}

function openCart() {
  document.getElementById("cartModal").classList.add("open");
  renderCart();
}
function closeCart() {
  document.getElementById("cartModal").classList.remove("open");
}

function renderCart() {
  const cart = getCart();
  const list = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  if (!list) return;

  if (cart.length === 0) {
    list.innerHTML = "<p style='text-align:center;color:#aaa;'>Your cart is empty.</p>";
    if (totalEl) totalEl.textContent = "Total: $0.00";
    return;
  }

  list.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <span>${item.name}</span>
      <span>x${item.qty}</span>
      <span>$${(item.price * item.qty).toFixed(2)}</span>
      <button onclick="removeFromCart(${i})" class="remove-btn">✕</button>
    </div>
  `).join("");

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (totalEl) totalEl.textContent = `Total: $${total.toFixed(2)}`;
}

function checkout() {
  const cart = getCart();
  if (cart.length === 0) {
    showMessage("checkout-msg", "❌ Your cart is empty!", "error");
    return;
  }
  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  saveCart([]);
  updateCartBadge();
  closeCart();
  showMessage("cart-msg", `✅ Order placed! Total paid: $${total.toFixed(2)}`, "success");
  setTimeout(() => renderCart(), 300);
}

document.addEventListener("DOMContentLoaded", updateCartBadge);

// ===== CONTACT FORM =====
function submitContact(event) {
  event.preventDefault();
  showMessage("contact-msg", "✅ Message sent successfully! We'll get back to you soon.", "success");
  event.target.reset();
}

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
