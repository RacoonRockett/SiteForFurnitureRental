const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_jwt_secret_key';
const MONGO_URI = 'mongodb://localhost:27017/furniture_rental';

// Подключение к MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
console.log('MongoDB connected');

// Модель Order
const Order = mongoose.model('Order', {
  id: String,
  name: String,
  phone: String,
  comment: String,
  items: Array,
  total: Number,
  status: String,
  date: Date
});

// Модель Admin
const Admin = mongoose.model('Admin', {
  username: String,
  password: String
});

app.use(cors());
app.use(bodyParser.json());

// Авторизация админа
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const admin = await Admin.findOne({ username });

  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return res.status(401).json({ error: 'Неверные логин или пароль' });
  }

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token });
});

// Middleware проверки токена
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// API для получения заказов
app.get('/api/orders', authenticate, async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// Обновление статуса
app.post('/api/orders/:id/status', authenticate, async (req, res) => {
  const { status } = req.body;
  await Order.updateOne({ id: req.params.id }, { $set: { status } });
  res.json({ success: true });
});

// Отправка заказа
app.post('/order', async (req, res) => {
  const { name, phone, comment, items } = req.body;
  const orderId = Date.now().toString();

  const order = new Order({
    id: orderId,
    name,
    phone,
    comment,
    items,
    total: items.reduce((sum, item) => sum + parseInt(item.price), 0),
    status: 'новый',
    date: new Date()
  });

  await order.save();

  // Telegram
  const message = `
    📦 Новый заказ №${orderId}
    Имя: ${name}
    Телефон: ${phone}
    Комментарий: ${comment}

    Заказ:
    ${items.map(i => `${i.name} — ${i.price} ₽`).join('\n')}
    Итого: ${order.total} ₽
  `;

  await axios.post(`https://api.telegram.org/bot<ВАШ_ТОКЕН>/sendMessage`,  {
    chat_id: '<ВАШ_CHAT_ID>',
    text: message
  });

  res.json({ orderId });
});

// Оплата через Tinkoff
app.post('/create-tinkoff-payment', async (req, res) => {
  const { items } = req.body;

  const total = items.reduce((sum, item) => sum + parseInt(item.price), 0);
  const paymentId = Date.now().toString();

  // Здесь можно сохранить paymentId в БД, если нужно отслеживать оплаты

  const tinkoffData = {
    TerminalKey: "YOUR_TINKOFF_TERMINAL_KEY",
    Amount: total * 100, // сумма в копейках
    OrderId: paymentId,
    Description: "Аренда мебели",
    Data: {
      Email: "client@example.com"
    },
    Receipt: {
      Items: items.map(item => ({
        Name: item.name,
        Price: item.price * 100,
        Quantity: 1,
        Amount: item.price * 100,
        Tax: "none"
      })),
      TaxationSystem: 1,
      Email: "client@example.com"
    }
  };

  try {
    const response = await axios.post("https://securepay.tinkoff.ru/v2/Init",  tinkoffData);
    res.json({ url: response.data.PaymentURL });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Ошибка при создании платежа" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});