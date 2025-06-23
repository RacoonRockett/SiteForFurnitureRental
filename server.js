const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const axios = require('axios');
const YAML = require('yamljs');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'furniture_rental',
  password: process.env.DB_PASSWORD || 'securepassword',
  port: 5432
});

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Слишком много попыток входа'
});

// Swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = YAML.load('./swagger.yaml');
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Telegram bot
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
let bot;
if (botToken && chatId) {
  bot = new TelegramBot(botToken);
} else {
  console.warn('Telegram bot token или chat ID не установлены.');
}

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Неавторизован' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Сессия истекла' });
  }
}

// Login
app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Неверные данные' });
  }
  const user = result.rows[0];
  if (!await bcrypt.compare(password, user.password)) {
    return res.status(401).json({ error: 'Неверные данные' });
  }
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '15m' });
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 1000 * 60 * 15
  });
  res.json({ token });
});

// Refresh token
app.post('/refresh', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const newToken = jwt.sign({ username: decoded.username }, JWT_SECRET, { expiresIn: '15m' });
    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 15
    });
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: 'Сессия истекла' });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  const result = await pool.query('SELECT * FROM products');
  res.json(result.rows);
});

app.post('/api/products', authenticate, async (req, res) => {
  const { name, description, price, image_url, category } = req.body;
  const result = await pool.query(
    'INSERT INTO products(name, description, price, image_url, category) VALUES($1, $2, $3, $4, $5) RETURNING *',
    [name, description, price, image_url, category]
  );
  res.status(201).json(result.rows[0]);
});

// Orders
app.get('/api/orders', authenticate, async (req, res) => {
  const result = await pool.query('SELECT * FROM orders');
  res.json(result.rows);
});

app.post('/api/orders', authenticate, async (req, res) => {
  const { items } = req.body;
  let total = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      const productRes = await client.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
      if (productRes.rows.length === 0) {
        throw new Error(`Товар ${item.product_id} не найден`);
      }
      const price = productRes.rows[0].price;
      await client.query(
        'INSERT INTO order_items(order_id, product_id, quantity, price) VALUES(DEFAULT, $1, $2, $3)',
        [item.product_id, item.quantity, price]
      );
      total += price * item.quantity;
    }
    const orderRes = await client.query(
      'INSERT INTO orders(total) VALUES($1) RETURNING id',
      [total]
    );
    const orderId = orderRes.rows[0].id;
    await client.query('COMMIT');
    res.status(201).json({ orderId, total });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Ошибка создания заказа' });
  } finally {
    client.release();
  }
});

// Tinkoff Webhook
app.post('/tinkoff-webhook', async (req, res) => {
  const data = req.body;
  const signature = req.headers['x-authorization'];
  if (!verifyTinkoffSignature(data, signature)) {
    return res.status(401).json({ error: 'Недействительная подпись' });
  }
  if (data.Status === 'CONFIRMED') {
    const orderId = data.OrderId;
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', orderId]);
    if (bot) {
      bot.sendMessage(chatId, `✅ Заказ #${orderId} успешно оплачен!`).catch(console.error);
    }
  }
  res.sendStatus(200);
});

function verifyTinkoffSignature(data, signature) {
  const hmac = crypto.createHmac('sha256', process.env.TINKOFF_SECRET_KEY);
  hmac.update(JSON.stringify(data));
  const digest = hmac.digest('hex');
  return digest === signature;
}

// Cookie consent
app.post('/api/cookies-consent', async (req, res) => {
  const { analyticsAllowed } = req.body;
  console.log(`Аналитика разрешена: ${analyticsAllowed}`);
  res.json({ success: true });
});

// Push subscription
app.post('/api/subscribe', async (req, res) => {
  const subscription = req.body;
  // Сохранение подписки в БД
  res.status(201).json({ success: true });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT
      )
    `);
    const defaultUser = 'admin';
    const defaultPass = 'admin123';
    const hashedPass = await bcrypt.hash(defaultPass, 10);
    await pool.query('INSERT INTO admins(username, password) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM admins)', [defaultUser, hashedPass]);
    console.log(`Добавлен администратор: ${defaultUser} / ${defaultPass}`);
  } catch (err) {
    console.error('Ошибка при инициализации БД:', err.message);
  }
});