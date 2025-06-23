const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

require('dotenv').config();

// === Конфигурация ===
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'JWT_SECRET';

// === База данных ===
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: 'localhost',
    database: process.env.DB_NAME || 'furniture_rental',
    password: process.env.DB_PASSWORD || 'securepassword',
    port: 5432,
});

// === Middleware ===
const allowedOrigins = ['http://localhost:3000'];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', true);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(YAML.load('./swagger.yaml')));

// === REFRESH ТОКЕН ===
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
            maxAge: 1000 * 60 * 15 // 15 минут
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Ошибка refresh:', err);
        res.status(401).json({ error: 'Сессия истекла' });
    }
});

// === Telegram бот ===
const TelegramBot = require('node-telegram-bot-api');
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot;
if (botToken && chatId) {
    bot = new TelegramBot(botToken);
} else {
    console.warn('Telegram bot token или chat ID не установлены.');
}

// === Мидлварь для аутентификации ===
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// === Роуты ===

// === Авторизация ===
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }

        const admin = result.rows[0];
        const validPassword = await bcrypt.compare(password, admin.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }

        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });

        // Установка токена в HttpOnly и Secure cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Только по HTTPS
            sameSite: 'strict',
            maxAge: 1000 * 60 * 60, // 1 час
        });

        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при авторизации' });
    }
});

// === Товары ===
app.get('/api/products', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении товаров' });
    }
});

// === Добавление товара ===
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'public/images');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

app.post('/api/products', authenticate, upload.single('image'), async (req, res) => {
    const { name, description, price, category } = req.body;
    const imageUrl = `/images/${req.file.filename}`;

    try {
        await pool.query(
            'INSERT INTO products (name, description, price, image_url, category) VALUES ($1, $2, $3, $4, $5)',
            [name, description, price, imageUrl, category]
        );
        res.status(201).json({ message: 'Товар добавлен' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при добавлении товара' });
    }
});

// === Удаление товара ===
app.delete('/api/products/:id', authenticate, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING image_url', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const imagePath = path.join(__dirname, 'public', result.rows[0].image_url);
        fs.unlink(imagePath, () => {}); // удалить изображение

        res.json({ message: 'Товар удален' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при удалении товара' });
    }
});

// === Заказы ===
app.post('/order', async (req, res) => {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Некорректные товары' });
    }

    try {
        const total = items.reduce((sum, item) => sum + parseFloat(item.price), 0);
        const orderResult = await pool.query(
            'INSERT INTO orders (total, status, created_at) VALUES ($1, $2, NOW()) RETURNING id',
            [total, 'new']
        );

        const orderId = orderResult.rows[0].id;

        for (const item of items) {
            await pool.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.id, item.quantity || 1, item.price]
            );
        }

        // Отправка уведомления в Telegram
        if (bot) {
            const message = `📦 Новый заказ #${orderId}\nСумма: ${total} руб.\n\nТовары:\n` +
                items.map(i => `- ${i.name}, ${i.price} × ${i.quantity}`).join('\n');
            bot.sendMessage(chatId, message).catch(console.error);
        }

        res.json({ orderId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при создании заказа' });
    }
});

// === Создание платежа через Тинькофф ===
app.post('/create-tinkoff-payment', async (req, res) => {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Некорректные товары' });
    }

    const total = items.reduce((sum, item) => sum + parseFloat(item.price), 0);

    const tinkoffData = {
        TerminalKey: process.env.TINKOFF_TERMINAL_KEY,
        Amount: Math.round(total * 100),
        OrderId: Date.now(),
        Description: 'Оплата заказа мебели',
        Data: {
            Email: 'customer@example.com'
        }
    };

    try {
        const response = await axios.post("https://securepay.tinkoff.ru/v2/Init",  tinkoffData);
        res.json({ url: response.data.PaymentURL });
    } catch (error) {
        console.error('Ошибка при создании платежа:', error.message);
        res.status(500).json({ error: 'Ошибка при создании платежа' });
    }
});

// === Webhook от Тинькофф ===
app.post('/tinkoff-webhook', async (req, res) => {
    const data = req.body;

    if (data.Status === 'CONFIRMED') {
        const orderId = data.OrderId;
        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['paid', orderId]);

        if (bot) {
            bot.sendMessage(chatId, `✅ Заказ #${orderId} успешно оплачен!`).catch(console.error);
        }
    }

    res.sendStatus(200);
});

// === Получение всех заказов ===
app.get('/api/orders', authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении заказов' });
    }
});

// === Обслуживание HTML ===
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'success.html'));
});

app.get('/cancel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cancel.html'));
});

// === Запуск сервера ===
app.listen(PORT, async () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);

    // Инициализация таблиц
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
                price INTEGER NOT NULL,
                image_url TEXT NOT NULL,
                category TEXT
            )
        `);
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

        // Добавление тестового администратора
        const defaultUser = 'admin';
        const defaultPass = 'admin123';
        const result = await pool.query('SELECT * FROM admins WHERE username = $1', [defaultUser]);
        if (result.rows.length === 0) {
            const hashedPass = await bcrypt.hash(defaultPass, 10);
            await pool.query('INSERT INTO admins (username, password) VALUES ($1, $2)', [defaultUser, hashedPass]);
            console.log(`Добавлен администратор: ${defaultUser} / ${defaultPass}`);
        }
    } catch (err) {
        console.error('Ошибка при инициализации БД:', err);
    }
});

app.post('/api/cookies-consent', async (req, res) => {
    const { analyticsAllowed } = req.body;

    // Сохраняй в базу данных, если нужно
    console.log(`Аналитика разрешена: ${analyticsAllowed}`);

    res.json({ success: true });
});