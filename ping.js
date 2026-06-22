import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Verifikasi cron secret dari Vercel
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
        
        if (!url || !key) {
            throw new Error('DATABASE_NOT_CONFIGURED');
        }

        const supabase = createClient(url, key);
        
        // Lakukan query ringan agar DB tetap aktif
        const { error } = await supabase.from('virtual_tour').select('id').limit(1);
        if (error) throw error;
        
        res.json({ 
            status: 'ok', 
            message: 'Database is active', 
            timestamp: new Date().toISOString() 
        });
    } catch (e) {
        console.error('Ping Error:', e.message);
        res.status(500).json({ status: 'error', message: e.message });
    }
}
