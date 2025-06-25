const CART_KEY = 'furniture_rental_cart';

// Добавление в корзину
export function addToCart(product) {
  try {
    const cart = getCart();
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1
      });
    }

    saveCart(cart);
    showNotification(`${product.name} добавлен в корзину`);
  } catch (error) {
    console.error('Ошибка добавления в корзину:', error);
    showNotification('Ошибка при добавлении в корзину', 'error');
  }
}

// Получение корзины
export function getCart() {
  const cartJson = localStorage.getItem(CART_KEY);
  return cartJson ? JSON.parse(cartJson) : [];
}

// Сохранение корзины
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

// Обновление счетчика в шапке
function updateCartCount() {
  const cart = getCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartLink = document.querySelector('a[href="cart.html"]');

  if (cartLink) {
    cartLink.innerHTML = `Корзина ${count > 0 ? `(${count})` : ''}`;
  }
}

// Уведомления
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Инициализация на странице корзины
if (document.getElementById('cart-items')) {
  renderCart();
  setupCheckout();
}

function renderCart() {
  const cartContainer = document.getElementById('cart-items');
  const cart = getCart();

  if (cart.length === 0) {
    cartContainer.innerHTML = '<p class="empty-cart">Ваша корзина пуста</p>';
    return;
  }

  cartContainer.innerHTML = '';

  cart.forEach(item => {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';

    cartItem.innerHTML = `
      <img src="${item.image}" alt="${item.name}" width="60">
      <div class="item-details">
        <h3>${item.name}</h3>
        <p>${item.price} ₽/мес × ${item.quantity}</p>
      </div>
      <div class="item-actions">
        <button class="remove-item" data-id="${item.id}">Удалить</button>
      </div>
    `;

    cartContainer.appendChild(cartItem);
  });

  // Обработчики удаления
  document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', (e) => {
      const productId = e.target.dataset.id;
      removeFromCart(productId);
    });
  });
}

function removeFromCart(productId) {
  const cart = getCart().filter(item => item.id !== productId);
  saveCart(cart);
  renderCart();
}

function setupCheckout() {
  document.getElementById('checkout').addEventListener('click', () => {
    alert('Функция оформления заказа будет реализована позже');
  });
}

// Обновляем счетчик при загрузке
document.addEventListener('DOMContentLoaded', updateCartCount);