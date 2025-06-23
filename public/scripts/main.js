document.addEventListener('DOMContentLoaded', () => {
    authFetch('/api/products')
        .then(res => res.json())
        .then(products => {
            const list = document.getElementById('product-list');
            const noProducts = document.getElementById('no-products');

            if (products.length === 0) {
                noProducts.classList.remove('hidden');
                return;
            }

            products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <img src="${product.image_url}" alt="${product.description}">
                    <h3>${product.name}</h3>
                    <p>${product.price} руб./мес</p>
                    <button onclick="addToCart(${JSON.stringify(product)})">Добавить в корзину</button>
                `;
                list.appendChild(card);
            });
        });

    window.addToCart = (product) => {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cart.push(product);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartDisplay();
    };

    function updateCartDisplay() {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        const list = document.getElementById('cart-items');
        list.innerHTML = '';
        cart.forEach((item, i) => {
            const li = document.createElement('li');
            li.textContent = `${item.name} — ${item.price} руб`;
            list.appendChild(li);
        });
    }

    window.checkout = () => {
        const cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (cart.length === 0) {
            alert('Корзина пуста');
            return;
        }

        authFetch('/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: cart })
        }).then(res => res.json())
         .then(data => {
             return authFetch('/create-tinkoff-payment', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ items: cart })
             });
         })
         .then(res => res.json())
         .then(session => {
             if (session.url) window.location.href = session.url;
         })
         .catch(err => {
             console.error(err);
             alert('Ошибка при оформлении заказа');
         });
    };
});

document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('gdpr-banner');
    const acceptBtn = document.getElementById('accept-cookies');
    const modal = document.getElementById('policy-modal');
    const showPolicyBtn = document.getElementById('show-policy');
    const closePolicyBtn = document.getElementById('close-policy');
    const savePolicyBtn = document.getElementById('save-policy');
    const analyticsConsent = document.getElementById('analytics-consent');

    const consentGiven = localStorage.getItem('cookieConsent') === 'true';
    const policyViewed = localStorage.getItem('policyViewed') === 'true';

    if (!consentGiven) {
        banner.style.display = 'block';
    }

    acceptBtn.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'true');
        banner.style.display = 'none';
        modal.style.display = 'flex';
    });

    showPolicyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
    });

    closePolicyBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        if (!policyViewed) {
            localStorage.setItem('policyViewed', 'true');
        }
    });

    savePolicyBtn.addEventListener('click', () => {
        const allowAnalytics = analyticsConsent.checked;
        localStorage.setItem('analyticsCookies', allowAnalytics ? 'true' : 'false');
        modal.style.display = 'none';
        localStorage.setItem('cookieConsent', 'true');
        alert('Настройки сохранены');
    });
});

function isAnalyticsAllowed() {
    return localStorage.getItem('analyticsCookies') === 'true';
}

// Пример использования:
if (isAnalyticsAllowed()) {
    // Запуск Google Analytics / Яндекс.Метрики
    console.log("Аналитика разрешена");
} else {
    console.log("Аналитика запрещена");
}

authFetch('/api/cookies-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        analyticsAllowed: isAnalyticsAllowed()
    })
});