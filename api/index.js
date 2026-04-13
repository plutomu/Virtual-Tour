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

// Inisialisasi Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// GET Data Scenes
app.get('/api/scenes', async (req, res) => {
    try {
        const { data, error } = await supabase.from('virtual_tour').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST Data Scenes
app.post('/api/scenes', async (req, res) => {
    try {
        const scenes = req.body;
        await supabase.from('virtual_tour').delete().neq('id', '_dummy_');
        const { error } = await supabase.from('virtual_tour').insert(scenes);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API Upload ke Supabase Storage (Dengan Kompresi Otomatis)
app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No file uploaded.');

        const file = req.file;
        const fileName = `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}.jpg`;
        
        // KOMPRESI GAMBAR via Sharp
        console.log('🖼️ Mengompres gambar...');
        const compressedBuffer = await sharp(file.buffer)
            .resize(4096, 2048, { fit: 'inside', withoutEnlargement: true }) // Ukuran standar panorama tinggi
            .jpeg({ quality: 80, progressive: true }) // Kompres ke 80% kualitas
            .toBuffer();

        // Upload ke bucket bernama 'panoramas'
        const { data, error } = await supabase.storage
            .from('panoramas')
            .upload(fileName, compressedBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) throw error;

        // Ambil URL Publik
        const { data: { publicUrl } } = supabase.storage
            .from('panoramas')
            .getPublicUrl(fileName);

        res.json({ filePath: publicUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default app;

export default app;
