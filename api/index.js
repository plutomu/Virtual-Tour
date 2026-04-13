import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Inisialisasi Supabase secara aman (Hanya dipanggil saat dibutuhkan)
const getSupabase = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error("DATABASE_NOT_CONFIGURED: Kunci Supabase tidak ditemukan di Vercel Environment Variables.");
    }
    return createClient(url, key);
};

// GET Data Scenes
app.get('/api/scenes', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('virtual_tour').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('API Error:', e.message);
        res.status(500).json({ error: e.message, code: 'SUPABASE_ERROR' });
    }
});

// POST Data Scenes (Save All)
app.post('/api/scenes', async (req, res) => {
    try {
        const supabase = getSupabase();
        const scenes = req.body;
        // Hapus data lama dan masukkan yang baru (Sync)
        await supabase.from('virtual_tour').delete().neq('id', '_dummy_');
        const { error } = await supabase.from('virtual_tour').insert(scenes);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API Upload Langsung ke Supabase Storage (Tanpa Sharp agar Ringan)
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        const supabase = getSupabase();
        if (!req.file) return res.status(400).send('No file uploaded.');

        const file = req.file;
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

        // Langsung upload ke storage karena sudah dikompres di browser
        const { data, error } = await supabase.storage
            .from('panoramas')
            .upload(fileName, file.buffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('panoramas')
            .getPublicUrl(fileName);

        res.json({ filePath: publicUrl });
    } catch (e) {
        console.error('Upload Error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

export default app;
