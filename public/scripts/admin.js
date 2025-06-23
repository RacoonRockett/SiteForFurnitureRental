document.getElementById('add-product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  const name = document.getElementById('name').value;
  const description = document.getElementById('description').value;
  const price = document.getElementById('price').value;
  const imageUrl = document.getElementById('image_url').value;
  const category = document.getElementById('category').value;

  const response = await fetch('/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ name, description, price, imageUrl, category })
  });

  if (response.ok) {
    alert('Товар добавлен');
  } else {
    alert('Ошибка добавления товара');
  }
});