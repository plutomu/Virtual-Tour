import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// Path ke db.json - Di Vercel ini dibaca sebagai file statis
const dbPath = path.resolve(process.cwd(), 'db.json');

// GET Data Scenes
app.get('/api/scenes', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        res.json(data.scenes || []);
    } catch (e) {
        res.status(500).json({ error: "Gagal membaca database", message: e.message });
    }
});

// POST Data Scenes (Perhatian: Ini tidak akan tersimpan permanen di Vercel!)
app.post('/api/scenes', (req, res) => {
    // Di Vercel (Serverless), penulisan ke file db.json berhasil di memori, 
    // tapi akan hilang setelah beberapa saat karena Vercel me-reset server.
    // Disarankan menggunakan Database (MongoDB/Supabase) untuk simpan permanen.
    res.json({ 
        success: true, 
        message: "Data diterima, namun Vercel membutuhkan Database Online untuk simpan permanen." 
    });
});

export default app;
