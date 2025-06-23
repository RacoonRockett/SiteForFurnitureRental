-- Создание таблицы администраторов
CREATE TABLE IF NOT EXISTS admins (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL
);

-- Создание таблицы товаров
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    category TEXT
);

-- Создание таблицы заказов
await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        total INTEGER NOT NULL,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT NOW()
    )
`);
await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price INTEGER NOT NULL
    )
`);