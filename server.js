import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import axios from 'axios';
import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import TelegramBot from 'node-telegram-bot-api';
import crypto from 'crypto';
import { resolve, join } from 'path';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { serve, setup } from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// Инициализация .env
dotenv.config();

// Получаем текущую директорию
const __dirname = resolve();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Инициализация базы данных
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'furniture_rental',
  password: process.env.DB_PASSWORD || 'securepassword',
  port: 5432,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000
});

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(compression());
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(join(__dirname, 'public')));

// Настройки CORS
const corsOptions = {
  origin: ['http://localhost:3000', 'https://вашсайт.ru'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};
app.use(cors(corsOptions));

// Rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Слишком много попыток входа'
});
app.use('/api/', loginLimiter);

// Swagger UI
const swaggerDocument = load(readFileSync(join(__dirname, 'swagger.yaml'), 'utf8'));
app.use('/api-docs', serve, setup(swaggerDocument));

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
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен отсутствует' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Сессия истекла' });
    }
    return res.status(401).json({ error: 'Неверный токен' });
  }
}

// Защита админ-панели
app.get('/admin.html', authenticate, (req, res) => {
  res.sendFile(join(__dirname, 'public/admin.html'));
});

// Login
app.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверные данные' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Неверные данные' });
    }

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '15m' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.json({ token });
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/'
  });
  res.json({ message: 'Вы успешно вышли' });
});

// Refresh token
app.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Токен отсутствует' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const newToken = jwt.sign({ username: decoded.username }, JWT_SECRET, { expiresIn: '15m' });

    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000
    });

    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: 'Ошибка обновления токена' });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения товаров:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/products', authenticate, async (req, res) => {
  try {
    const { name, description, price, image_url, category } = req.body;
    const result = await pool.query(
      'INSERT INTO products(name, description, price, image_url, category) VALUES($1, $2, $3, $4, $5) RETURNING *',
      [name, description, price, image_url, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка создания товара:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Orders
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM orders');
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения заказов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/orders', authenticate, async (req, res) => {
  const { items } = req.body;
  let total = 0;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      'INSERT INTO orders(status) VALUES($1) RETURNING id',
      ['new']
    );
    const orderId = orderRes.rows[0].id;

    for (const item of items) {
      const productRes = await client.query(
        'SELECT price FROM products WHERE id = $1',
        [item.product_id]
      );

      if (productRes.rows.length === 0) {
        throw new Error(`Товар ${item.product_id} не найден`);
      }

      const price = productRes.rows[0].price;
      const itemTotal = price * item.quantity;
      total += itemTotal;

      await client.query(
        'INSERT INTO order_items(order_id, product_id, quantity, price) VALUES($1, $2, $3, $4)',
        [orderId, item.product_id, item.quantity, price]
      );
    }

    await client.query(
      'UPDATE orders SET total = $1 WHERE id = $2',
      [total, orderId]
    );

    await client.query('COMMIT');
    res.status(201).json({ orderId, total });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка создания заказа:', error);
    res.status(500).json({ error: 'Ошибка создания заказа' });
  } finally {
    client.release();
  }
});

// Tinkoff Webhook
app.post('/tinkoff-webhook', async (req, res) => {
  try {
    const data = req.body;
    const signature = req.headers['x-authorization'];

    if (!verifyTinkoffSignature(data, signature)) {
      return res.status(401).json({ error: 'Недействительная подпись' });
    }

    if (data.Status === 'CONFIRMED') {
      const orderId = data.OrderId;
      await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', orderId]);

      if (bot) {
        await bot.sendMessage(chatId, `✅ Заказ #${orderId} успешно оплачен!`);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Ошибка webhook:', err);
    res.status(500).send('Ошибка сервера');
  }
});

function verifyTinkoffSignature(data, signature) {
  const fields = Object.keys(data)
    .filter(key => key !== 'Token')
    .sort()
    .map(key => data[key])
    .join('');

  const hmac = crypto.createHmac('sha256', process.env.TINKOFF_SECRET_KEY);
  hmac.update(fields);
  const digest = hmac.digest('hex');
  return digest === signature;
}

// Cookie consent
app.post('/api/cookies-consent', async (req, res) => {
  try {
    const { analyticsAllowed } = req.body;
    console.log(`Аналитика разрешена: ${analyticsAllowed}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка сохранения cookie-настроек:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Push subscription
app.post('/api/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    // Здесь логика сохранения подписки
    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Ошибка подписки:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Инициализация базы данных при запуске
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        username TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        image_url TEXT NOT NULL DEFAULT '/images/default-product.png',
        category TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        status TEXT NOT NULL,
        total DECIMAL(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        PRIMARY KEY (order_id, product_id)
      )
    `);

    const adminExists = await pool.query('SELECT 1 FROM admins WHERE username = $1', ['admin']);
    if (!adminExists.rows.length) {
      const hashedPass = await bcrypt.hash('admin123', 12);
      await pool.query('INSERT INTO admins(username, password) VALUES($1, $2)', ['admin', hashedPass]);
      console.log('Создан администратор по умолчанию: admin / admin123');
    }

    const productsExist = await pool.query('SELECT 1 FROM products LIMIT 1');
    if (!productsExist.rows.length) {
      await pool.query(`
        INSERT INTO products(name, description, price, image_url, category)
        VALUES
          ('Офисный стул', 'Удобный стул на колесиках', 2500, '/images/chair.jpg', 'chairs'),
          ('Офисный стол', 'Большой рабочий стол', 5000, '/images/table.jpg', 'tables')
      `);
      console.log('Добавлены тестовые товары');
    }
  } catch (err) {
    console.error('Ошибка инициализации БД:', err);
    throw err;
  }
}

// Запуск сервера
const server = app.listen(PORT, async () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);

  try {
    await initializeDatabase();
    console.log('База данных готова');
  } catch (err) {
    console.error('Ошибка при запуске сервера:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Получен SIGTERM. Завершение работы...');
  server.close(() => {
    pool.end();
    console.log('Сервер остановлен');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Получен SIGINT. Завершение работы...');
  server.close(() => {
    pool.end();
    console.log('Сервер остановлен');
    process.exit(0);
  });
});