import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Fungsi untuk ambil client Supabase (aman dari crash)
const getSupabase = () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key || url.includes('Isi_dengan')) {
        throw new Error("Kunci Supabase belum diisi atau masih berupa teks contoh di file .env!");
    }
    return createClient(url, key);
};

// API Endpoints
app.get('/api/scenes', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('virtual_tour').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('❌ SERVER ERROR:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/scenes', async (req, res) => {
    try {
        const supabase = getSupabase();
        const scenes = req.body;
        await supabase.from('virtual_tour').delete().neq('id', '_dummy_');
        const { error } = await supabase.from('virtual_tour').insert(scenes);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('❌ SERVER ERROR:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        const supabase = getSupabase();
        if (!req.file) return res.status(400).send('No file uploaded.');
        const file = req.file;
        const fileName = `${Date.now()}-local-${file.originalname.replace(/\.[^/.]+$/, "")}.webp`;
        
        const compressedBuffer = await sharp(file.buffer)
            .resize(4096, 2048, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85, effort: 6 }) // WebP lebih efisien & tajam daripada JPEG
            .toBuffer();

        const { data, error } = await supabase.storage
            .from('panoramas')
            .upload(fileName, compressedBuffer, { contentType: 'image/webp', upsert: true });

        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('panoramas').getPublicUrl(fileName);
        res.json({ filePath: publicUrl });
    } catch (e) {
        console.error('❌ SERVER ERROR:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Server Admin berjalan di http://localhost:${port}`);
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.warn('⚠️ Peringatan: File .env belum dikonfigurasi dengan benar!');
    }
});
