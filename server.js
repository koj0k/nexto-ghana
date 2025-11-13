const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;  // Render uses PORT env
const JWT_SECRET = 'nexto_super_secret_key_2025';

// Middleware - FIXED FOR RENDER (IMAGES NOW WORK 100%)
app.use(express.json());
app.use(express.static('.'));                    // Serve all files from root
app.use('/images', express.static('images'));    // Direct access to images folder
app.use(express.static('public'));               // Extra safety

// MongoDB Connect – uses Render env var
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://Nexto:FCjqg5HUNqpNHJDm@nexto.cphxna8.mongodb.net/?retryWrites=true&w=majority')
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.log('DB Error:', err));

// Order Schema
const orderSchema = new mongoose.Schema({
  id: { type: String, unique: true, default: () => Math.random().toString(36).substr(2, 9) },
  customerName: String,
  orderDetails: String,
  deliveryAddress: String,
  phone: String,
  restaurant: String,
  cartTotal: { type: Number, default: 0 },
  status: { 
    type: String, 
    default: 'pending', 
    enum: ['pending', 'in-progress', 'delivered', 'cancelled'] 
  },
  createdAt: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// Email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'amfoowusukelvin@gmail.com',
    pass: 'htnn dvug nlzh yihj'
  }
});

// Submit Order
app.post('/api/orders', async (req, res) => {
  try {
    const { name, details, address, phone, restaurant, cartTotal = 0 } = req.body;

    const newOrder = new Order({
      customerName: name,
      orderDetails: details,
      deliveryAddress: address,
      phone,
      restaurant,
      cartTotal: cartTotal + 7,
      status: 'pending'
    });
    await newOrder.save();

    const mailOptions = {
      from: 'amfoowusukelvin@gmail.com',
      to: 'amfoowusukelvin@gmail.com',
      subject: `NEW ORDER #${newOrder.id} - GH₵${(cartTotal + 7).toFixed(2)}`,
      html: `
        <h2 style="color:#0ea5e9;">NEW ORDER!</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Items:</strong> ${details.replace(/\|/g, '<br>')}</p>
        <p><strong>Address:</strong> ${address}</p>
        <p><strong>Total:</strong> GH₵${(cartTotal + 7).toFixed(2)}</p>
        <p><strong>ID:</strong> #${newOrder.id}</p>
        <hr>
        <small>${new Date().toLocaleString('en-GH')}</small>
        <br><br>
        <a href="https://nexto-ghana.onrender.com/admin" style="background:#0ea5e9;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">Open Admin</a>
      `
    };
    transporter.sendMail(mailOptions).catch(err => console.log('Email failed:', err));

    res.json({ success: true, id: newOrder.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'nexto2025') {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.admin) return next();
  } catch (err) { }
  res.status(401).json({ error: 'Unauthorized' });
};

// Admin Page
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// GET ALL ORDERS + EARNINGS ONLY ON DELIVERED
app.get('/api/admin/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    
    const stats = {
      totalOrders: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      inProgress: orders.filter(o => o.status === 'in-progress').length,
      delivered: deliveredOrders.length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      earnings: deliveredOrders.length * 2,
      deliveryEarnings: deliveredOrders.length * 5
    };

    res.json({ orders, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Status
app.put('/api/orders/:id', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'in-progress', 'delivered', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const updated = await Order.findOneAndUpdate(
      { id: req.params.id },
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Home
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Start server
app.listen(PORT, () => {
  console.log(`NEXTO IS LIVE → https://nexto-ghana.onrender.com`);
  console.log(`Admin → https://nexto-ghana.onrender.com/admin`);
  console.log(`Password: nexto2025`);
});
