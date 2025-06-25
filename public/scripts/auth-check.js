// Проверяем статус авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('/api/check-auth', {
      credentials: 'include'
    });

    if (response.ok) {
      // Показываем кнопки для авторизованных пользователей
      document.getElementById('login-nav-item').classList.add('hidden');
      document.getElementById('admin-nav-item').classList.remove('hidden');
      document.getElementById('logout-nav-item').classList.remove('hidden');

      // Обработчик выхода
      document.getElementById('logout-link').addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/';
      });
    }
  } catch (err) {
    console.error('Ошибка проверки авторизации:', err);
  }
});