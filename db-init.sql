-- Удаляем таблицы если они существуют
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS admins;

-- Создаем таблицу администраторов
CREATE TABLE admins (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL
);

-- Создаем таблицу товаров с UNIQUE ограничением для name
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,  -- Добавляем UNIQUE constraint
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT NOT NULL DEFAULT '/images/default-product.png',
  category TEXT
);

-- Добавляем администратора (пароль: admin123)
INSERT INTO admins(username, password) 
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MQDq5phQ5SoQO5A3APpB7eXKQj2qWKu');

-- Добавляем тестовые товары
INSERT INTO products(name, description, price, image_url, category)
VALUES 
  ('Офисный стул', 'Удобный стул на колесиках', 2500, '/images/chair.jpg', 'chairs'),
  ('Офисный стол', 'Большой рабочий стол', 5000, '/images/table.jpg', 'tables');

-- Для PostgreSQL 9.5+ можно использовать ON CONFLICT DO NOTHING
-- INSERT INTO products(name, description, price, image_url, category)
-- VALUES 
--   ('Офисный стул', 'Удобный стул на колесиках', 2500, '/images/chair.jpg', 'chairs'),
--   ('Офисный стол', 'Большой рабочи