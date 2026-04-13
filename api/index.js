import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// PENGAMAN: Fungsi untuk inisialisasi Supabase secara aman
const getSupabase = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error("Kunci SUPABASE_URL atau SUPABASE_ANON_KEY tidak ditemukan di Environment Variables Vercel!");
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
        res.status(500).json({ error: e.message });
    }
});

// POST Data Scenes
app.post('/api/scenes', async (req, res) => {
    try {
        const supabase = getSupabase();
        const scenes = req.body;
        await supabase.from('virtual_tour').delete().neq('id', '_dummy_');
        const { error } = await supabase.from('virtual_tour').insert(scenes);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API Upload ke Supabase Storage (Kuat & Tahan Crash)
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        const supabase = getSupabase();
        if (!req.file) return res.status(400).send('No file uploaded.');

        const file = req.file;
        const fileName = `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}.jpg`;
        
        // Kompresi via Sharp
        const compressedBuffer = await sharp(file.buffer)
            .resize(4096, 2048, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toBuffer();

        const { data, error } = await supabase.storage
            .from('panoramas')
            .upload(fileName, compressedBuffer, {
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
