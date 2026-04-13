import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import dotenv from 'dotenv';

// Muat variabel dari .env
dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Inisialisasi Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// API Endpoints
app.get('/api/scenes', async (req, res) => {
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            throw new Error("Kunci Supabase belum diisi di file .env lokal!");
        }
        const { data, error } = await supabase.from('virtual_tour').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('SERVER ERROR:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/scenes', async (req, res) => {
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            throw new Error("Kunci Supabase belum diisi di file .env lokal!");
        }
        const scenes = req.body;
        await supabase.from('virtual_tour').delete().neq('id', '_dummy_');
        const { error } = await supabase.from('virtual_tour').insert(scenes);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('SERVER ERROR:', e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).send('No file uploaded.');
        const file = req.file;
        const fileName = `${Date.now()}-local-${file.originalname.replace(/\.[^/.]+$/, "")}.jpg`;
        
        console.log('🖼️ Mengompres gambar lokal...');
        const compressedBuffer = await sharp(file.buffer)
            .resize(4096, 2048, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true })
            .toBuffer();

        const { data, error } = await supabase.storage
            .from('panoramas')
            .upload(fileName, compressedBuffer, { contentType: 'image/jpeg', upsert: true });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('panoramas').getPublicUrl(fileName);
        res.json({ filePath: publicUrl });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 API Server Lokal (Supabase) berjalan di http://localhost:${port}`);
});
