document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  setupLanguageSwitch();
  setupCookieBanner();
  registerServiceWorker();
  setupPushNotifications();
});

async function loadProducts() {
  const response = await fetch('/api/products');
  const products = await response.json();

  const productList = document.getElementById('product-list');
  productList.innerHTML = '';

  products.forEach(product => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${product.image_url}" alt="${product.name}" width="100"/>
      <div>
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p>Цена: ${product.price.toLocaleString()} ₽</p>
        <button onclick="addToCart(${product.id})">Купить</button>
      </div>
    `;
    productList.appendChild(card);
  });
}

function addToCart(productId) {
  // Логика добавления в корзину
}

// Многоязычность
let lang = 'ru';
const translations = {
  ru: JSON.parse(localStorage.getItem('lang_ru') || '{}'),
  en: JSON.parse(localStorage.getItem('lang_en') || '{}')
};

function setupLanguageSwitch() {
  // Поддержка URL вида /en/, /ru/
  const path = window.location.pathname.split('/').filter(Boolean)[0];
  if (['en', 'ru'].includes(path)) {
    lang = path;
  }
}

function localize(textKey) {
  return translations[lang]?.[textKey] || textKey;
}

function setupCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('accept-cookies');
  const declineBtn = document.getElementById('decline-cookies');

  if (!localStorage.getItem('cookiesAccepted')) {
    banner.classList.remove('hidden');
    document.getElementById('cookie-text').textContent = localize('accept_cookies');
  }

  acceptBtn.onclick = () => {
    localStorage.setItem('cookiesAccepted', 'true');
    localStorage.setItem('analyticsAllowed', 'true');
    banner.classList.add('hidden');
    sendConsentToServer(true);
  };

  declineBtn.onclick = () => {
    localStorage.setItem('cookiesAccepted', 'false');
    localStorage.setItem('analyticsAllowed', 'false');
    banner.classList.add('hidden');
    sendConsentToServer(false);
  };
}

function sendConsentToServer(analyticsAllowed) {
  fetch('/api/cookies-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ analyticsAllowed })
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      console.log('Service Worker зарегистрирован:', registration);
    }).catch(error => {
      console.log('Ошибка регистрации Service Worker:', error);
    });
  }
}

function setupPushNotifications() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        navigator.serviceWorker.ready.then(registration => {
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.VAPID_PUBLIC_KEY)
          }).then(subscription => {
            fetch('/api/subscribe', {
              method: 'POST',
              body: JSON.stringify(subscription),
              headers: { 'Content-Type': 'application/json' }
            });
          });
        });
      }
    });
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}