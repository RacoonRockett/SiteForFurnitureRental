document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const formData = {
    username: e.target.username.value,
    password: e.target.password.value
  };

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      credentials: 'include'
    });

    if (response.ok) {
      window.location.href = '/admin.html';
    } else {
      const error = await response.json();
      alert(error.error || 'Ошибка входа');
    }
  } catch (err) {
    console.error('Ошибка:', err);
    alert('Сервер недоступен');
  }
});