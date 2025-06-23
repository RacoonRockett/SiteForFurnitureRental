document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('cookieConsentModal');
    const checkbox = document.getElementById('cookieConsentCheckbox');
    const button = document.getElementById('acceptCookieBtn');

    // Проверяем, есть ли уже согласие
    const consentGiven = localStorage.getItem('cookieConsent') === 'true';

    if (!consentGiven) {
        modal.style.display = 'flex';
    }

    checkbox.addEventListener('change', () => {
        button.disabled = !checkbox.checked;
    });

    button.addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'true');
        modal.style.display = 'none';
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const cookieBanner = document.getElementById('cookieConsentModal');
    const settingsBtn = document.getElementById('cookieSettingsBtn');

    if (!localStorage.getItem('cookieConsent')) {
        cookieBanner.style.display = 'flex';
    }

    if (!settingsBtn) return;

    settingsBtn.addEventListener('click', () => {
        document.getElementById('cookieSettingsModal').style.display = 'flex';
    });
});

async function authFetch(url, options = {}) {
    const token = getAuthToken();

    // Добавляем заголовок авторизации
    const headers = {
        ...(options.headers || {}),
        'Authorization': token ? `Bearer ${token}` : ''
    };

    // Если это POST/PUT и не multipart/form-data — указываем JSON
    if ((options.method === 'POST' || options.method === 'PUT') && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            alert('Сессия истекла. Пожалуйста, войдите снова.');
            logoutUser();
            return null;
        }

        return response;
    } catch (error) {
        console.error('Ошибка сети:', error);
        alert('Не удалось подключиться к серверу');
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');
    const loginSection = document.getElementById('login-section');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const res = await authFetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.token);
            loginSection.style.display = 'none';
            adminPanel.style.display = 'block';
            loadOrders();
        } else {
            alert('Неверный логин или пароль');
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const [user, pass] = Array.from(e.target.querySelectorAll('input')).map(i => i.value);

        const res = await authFetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        if (res.ok) {
            document.getElementById('admin-panel').classList.remove('hidden');
            loadOrders();
        } else {
            alert('Неверный логин или пароль');
        }
    });

    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const file = formData.get('image');
        const form = new FormData();
        form.append('image', file);
        form.append('name', formData.get('name'));
        form.append('description', formData.get('description'));
        form.append('price', formData.get('price'));
        form.append('category', formData.get('category'));

        const obj = {};
        form.forEach((value, key) => {
            if (key !== 'image') obj[key] = value;
        });

        const res = await authFetch('/api/products', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + getAuthToken()
            },
            body: form
        });

        if (res.ok) {
            alert('Товар добавлен');
            e.target.reset();
        } else {
            alert('Ошибка при добавлении товара');
        }
    });
});

async function loadOrders() {
    try {
        const res = await authFetch('/api/orders', {
            headers: { 'Authorization': 'Bearer ' + getAuthToken() }
        });
        const orders = await res.json();
        const list = document.getElementById('orders-list');
        list.innerHTML = '';
        orders.forEach(order => {
            const li = document.createElement('li');
            li.textContent = `Заказ #${order.id}, сумма: ${order.total} руб, статус: ${order.status}`;
            list.appendChild(li);
        });
    } catch (err) {
        console.error(err);
        alert('Ошибка загрузки заказов');
    }
}

function getAuthToken() {
    // Сначала пробуем получить токен из localStorage
    let token = localStorage.getItem('token');

    // Если нет — проверяем, может быть, он хранится в cookies
    if (!token) {
        const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('token='))
            ?.split('=')[1];

        token = cookieToken || null;
    }

    // Дополнительно проверяем, не истёк ли токен (если это JWT)
    if (token && isTokenExpired(token)) {
        console.warn('Токен истёк');
        logoutUser(); // Очистка данных и перенаправление
        return null;
    }

    return token;
}

// Функция проверки истечения срока токена (работает только с JWT)
function isTokenExpired(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiry = payload.exp * 1000; // в миллисекундах
        return Date.now() >= expiry;
    } catch (e) {
        console.error('Неверный формат токена', e);
        return true; // считаем его недействительным
    }
}

// Выход пользователя
function logoutUser() {
    localStorage.removeItem('token');
    document.cookie = 'token=; Max-Age=0; path=/'; // удаление куки
    alert('Сессия истекла. Пожалуйста, войдите снова.');
    window.location.href = '/login.html'; // перенаправление на страницу входа
}