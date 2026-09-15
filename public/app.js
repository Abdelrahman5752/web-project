// The server owns identity, product prices and order records.
localStorage.removeItem('users');
localStorage.removeItem('loggedInUser');
localStorage.removeItem('cart');
let activeUser = null;
let products = [];
let basket = [];
let submittingOrder = false;
try { basket = JSON.parse(sessionStorage.getItem('basket-v1') || '[]'); } catch { basket = []; }
if (!Array.isArray(basket)) basket = [];
basket = basket.filter(i => i && Number.isInteger(i.product_id) && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 20);
const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
async function api(route, body) {
  const response = await fetch('/api/' + route, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
  return data;
}
function showMessage(id, text, type = 'success') {
  let box = document.getElementById(id);
  if (!box) {
    box = document.createElement('p'); box.id = id;
    (document.querySelector('form') || document.querySelector('main') || document.body).append(box);
  }
  box.setAttribute('role', type === 'error' ? 'alert' : 'status');
  box.textContent = text;
  box.className = 'msg-box ' + type;
}
async function submitAccount(event, route) {
  event.preventDefault();
  const button = event.target.querySelector('button[type=submit]');
  if (button.disabled) return;
  const password = document.getElementById(route === 'login' ? 'loginPassword' : 'password').value;
  if (route === 'register' && password !== document.getElementById('confirm').value) return showMessage('account-msg', 'Passwords do not match.', 'error');
  const body = { email: document.getElementById(route === 'login' ? 'loginEmail' : 'email').value, password };
  if (route === 'register') body.name = document.getElementById('name').value;
  button.disabled = true;
  try {
    await api(route, body);
    location.href = 'index.html';
  } catch (error) { showMessage('account-msg', error.message, 'error'); }
  finally { button.disabled = false; }
}
function loginUser(event) { return submitAccount(event, 'login'); }
function registerUser(event) { return submitAccount(event, 'register'); }
async function logoutUser() {
  try { await api('logout', {}); sessionStorage.removeItem('basket-v1'); sessionStorage.removeItem('order-key'); location.href = 'login.html'; }
  catch (error) { showMessage('session-msg', error.message, 'error'); }
}
function renderIdentity() {
  document.querySelectorAll('.login-nav-link').forEach(el => el.hidden = !!activeUser);
  document.querySelectorAll('.user-display').forEach(el => {
    el.replaceChildren();
    if (!activeUser) { el.style.display = 'none'; return; }
    el.style.display = 'inline';
    el.append(document.createTextNode(activeUser.name + ' '));
    const orders = document.createElement('a'); orders.href = 'orders.html'; orders.textContent = 'My orders';
    const logout = document.createElement('button'); logout.type = 'button'; logout.textContent = 'Log out'; logout.onclick = logoutUser;
    el.append(orders, document.createTextNode(' '), logout);
  });
}
function persistBasket() {
  sessionStorage.setItem('basket-v1', JSON.stringify(basket));
  sessionStorage.removeItem('order-key');
  updateCartBadge();
}
function updateCartBadge() {
  const total = basket.reduce((sum,i) => sum + i.quantity, 0);
  document.querySelectorAll('.cart-badge').forEach(el => { el.textContent = total; el.style.display = total ? 'inline-block' : 'none'; });
}
function addToCart(productId) {
  if (submittingOrder) return;
  const product = products.find(p => p.id === productId);
  if (!product) return;
  const item = basket.find(i => i.product_id === productId);
  if (item?.quantity >= 20) return showMessage('cart-msg', 'Maximum 20 units per product.', 'error');
  if (item) item.quantity++; else basket.push({ product_id: productId, quantity: 1 });
  persistBasket(); renderCart();
  showMessage('cart-msg', product.name + ' added to cart.');
}
function removeFromCart(productId) {
  if (submittingOrder) return;
  basket = basket.filter(i => i.product_id !== productId); persistBasket(); renderCart();
}
function renderProducts() {
  const grid = document.querySelector('.products-grid');
  if (!grid) return;
  grid.replaceChildren();
  products.forEach(product => {
    const card = document.createElement('div'); card.className = 'product-card';
    const icon = document.createElement('div'); icon.className = 'product-icon'; icon.textContent = product.icon;
    const title = document.createElement('h4'); title.textContent = product.name;
    const price = document.createElement('div'); price.className = 'price'; price.textContent = money(product.price_cents);
    const button = document.createElement('button'); button.textContent = 'Add to cart'; button.onclick = () => addToCart(product.id);
    card.append(icon,title,price,button); grid.append(card);
  });
}
function openCart() { document.getElementById('cartModal')?.classList.add('open'); renderCart(); }
function closeCart() { document.getElementById('cartModal')?.classList.remove('open'); }
function renderCart() {
  const list = document.getElementById('cart-items');
  if (!list) return;
  list.replaceChildren();
  let total = 0;
  basket.forEach(item => {
    const product = products.find(p => p.id === item.product_id);
    if (!product) return;
    total += product.price_cents * item.quantity;
    const row = document.createElement('div'); row.className = 'cart-item';
    const text = document.createElement('span'); text.textContent = `${product.name} × ${item.quantity} — ${money(product.price_cents * item.quantity)}`;
    const button = document.createElement('button'); button.className = 'remove-btn'; button.textContent = 'Remove'; button.disabled = submittingOrder; button.onclick = () => removeFromCart(product.id);
    row.append(text,button); list.append(row);
  });
  if (!basket.length) list.textContent = 'Your cart is empty.';
  document.getElementById('cart-total').textContent = 'Total: ' + money(total);
}
async function checkout() {
  if (submittingOrder) return;
  if (!basket.length) return showMessage('checkout-msg', 'Your cart is empty.', 'error');
  if (!activeUser) return showMessage('checkout-msg', 'Please sign in before placing an order. Your cart will stay in this tab.', 'error');
  submittingOrder = true;
  const button = document.querySelector('.checkout-btn'); button.disabled = true;
  renderCart();
  // Reuse this key after a lost response to prevent duplicate order creation.
  let key = sessionStorage.getItem('order-key');
  if (!key) { key = crypto.randomUUID(); sessionStorage.setItem('order-key',key); }
  try {
    const { order } = await api('orders', { request_key: key, items: basket });
    basket = []; persistBasket(); renderCart(); closeCart();
    showMessage('cart-msg', `Order #${order.id} saved — ${money(order.total_cents)}. No payment has been collected. View it in My orders.`);
  } catch (error) { showMessage('checkout-msg', error.message, 'error'); }
  finally { submittingOrder = false; button.disabled = false; renderCart(); }
}
async function submitContact(event) {
  event.preventDefault();
  const form = event.target, button = form.querySelector('button[type=submit]');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const result = await api('contact', Object.fromEntries(new FormData(form)));
    showMessage('contact-msg', result.message); form.reset();
  } catch (error) { showMessage('contact-msg', error.message, 'error'); }
  finally { button.disabled = false; }
}
async function loadOrders() {
  const container = document.getElementById('orders-list');
  if (!container) return;
  if (!activeUser) {
    container.textContent = 'Please sign in to view your orders. ';
    const link = document.createElement('a'); link.href = 'login.html'; link.textContent = 'Sign in'; container.append(link); return;
  }
  const { orders } = await api('orders');
  container.replaceChildren();
  if (!orders.length) container.textContent = 'No orders yet. Explore the Tech Store to get started.';
  orders.forEach(order => {
    const card = document.createElement('article'); card.className = 'order-card';
    const title = document.createElement('h2'); title.textContent = `Order #${order.id} · ${money(order.total_cents)}`;
    const status = document.createElement('p'); status.textContent = `${order.created_at} UTC · Awaiting payment — no payment collected`;
    const list = document.createElement('ul');
    order.items.forEach(item => { const li = document.createElement('li'); li.textContent = `${item.name} × ${item.quantity} — ${money(item.price_cents * item.quantity)}`; list.append(li); });
    card.append(title,status,list); container.append(card);
  });
}
document.addEventListener('DOMContentLoaded', async () => {
  updateCartBadge();
  try { activeUser = (await api('me')).user; renderIdentity(); await loadOrders(); }
  catch (error) { showMessage('session-msg', error.message, 'error'); }
  if (document.querySelector('.products-grid')) {
    try {
      products = (await api('products')).products;
      basket = basket.filter(i => products.some(p => p.id === i.product_id));
      renderProducts(); updateCartBadge(); renderCart();
    } catch { showMessage('cart-msg', 'Products could not load. Please refresh and try again.', 'error'); }
  }
});
