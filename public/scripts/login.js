document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    try {
        const res = await authFetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!res.ok) {
            const data = await res.json();
            errorMessage.textContent = data.error || 'Ошибка входа';
            return;
        }

        const data = await res.json();
        localStorage.setItem('token', data.token);
        window.location.href = '/admin.html';

    } catch (err) {
        console.error(err);
        errorMessage.textContent = 'Не удалось подключиться к серверу';
    }
});