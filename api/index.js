import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

let supabaseInstance = null;
const getSupabase = () => {
    if (supabaseInstance) return supabaseInstance;

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error("DATABASE_NOT_CONFIGURED: Kunci Supabase tidak ditemukan.");
    }
    supabaseInstance = createClient(url, key);
    return supabaseInstance;
};

// GET Data Scenes
app.get('/api/scenes', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('virtual_tour').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        
        // Map database fields to frontend fields
        const mappedData = (data || []).map(s => ({
            id: s.id,
            title: s.name || s.title || 'Untitled',
            image: s.panorama || s.image || '',
            connections: s.links || s.connections || {},
            desc: s.desc || ''
        }));
        
        res.json(mappedData);
    } catch (e) {
        console.error('API Error:', e.message);
        res.status(500).json({ error: e.message, code: 'SUPABASE_ERROR' });
    }
});

// Authentication Endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const supabase = getSupabase();
        
        // Cek di database Supabase
        const { data: user, error } = await supabase
            .from('virtual_tour_users')
            .select('*')
            .eq('username', username)
            .eq('password', password)
            .single();

        if (user) {
            return res.json({ 
                success: true, 
                user: { username: user.username, role: user.role } 
            });
        }

        // Fallback ke .env untuk inisiasi pertama kali jika tabel kosong
        const superUser = process.env.SUPERADMIN_USERNAME || 'superadmin';
        const superPass = process.env.SUPERADMIN_PASSWORD || 'super123';
        
        if (username === superUser && password === superPass) {
            return res.json({ 
                success: true, 
                user: { username: superUser, role: 'superadmin' } 
            });
        }

        res.status(401).json({ success: false, error: 'Username atau password salah!' });
    } catch (e) {
        // Jika tabel belum ada, fallback ke hardcoded untuk memudahkan setup
        const superUser = process.env.SUPERADMIN_USERNAME || 'superadmin';
        const superPass = process.env.SUPERADMIN_PASSWORD || 'super123';
        
        if (username === superUser && password === superPass) {
            return res.json({ 
                success: true, 
                user: { username: superUser, role: 'superadmin' } 
            });
        }
        res.status(401).json({ success: false, error: 'Auth Error: ' + e.message });
    }
});

// GET All Users (Superadmin only)
app.get('/api/users', async (req, res) => {
    const role = req.headers['x-user-role'];
    if (role !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('virtual_tour_users').select('username, role');
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST Add/Update User (Superadmin only)
app.post('/api/users', async (req, res) => {
    const role = req.headers['x-user-role'];
    if (role !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const supabase = getSupabase();
        const { username, password, role: userRole } = req.body;
        
        const userData = { username, role: userRole };
        if (password) {
            userData.password = password;
        }
        
        const { error } = await supabase.from('virtual_tour_users').upsert(userData, { onConflict: 'username' });

        if (error) {
            console.error('Supabase Error (Add User):', error);
            throw error;
        }
        res.json({ success: true });
    } catch (e) {
        console.error('Backend Error (Add User):', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DELETE User (Superadmin only)
app.delete('/api/users/:username', async (req, res) => {
    const role = req.headers['x-user-role'];
    if (role !== 'superadmin') return res.status(403).json({ error: 'Unauthorized' });

    try {
        const supabase = getSupabase();
        const { error } = await supabase.from('virtual_tour_users').delete().eq('username', req.params.username);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST Data Scenes (Save All)
app.post('/api/scenes', async (req, res) => {
    // Basic protection: check for role in header (simulated)
    const role = req.headers['x-user-role'];
    if (!role) return res.status(403).json({ error: 'Unauthorized' });

    try {
        const supabase = getSupabase();
        const scenes = req.body;
        
        // Map frontend fields to database fields
        const mappedScenes = scenes.map(s => ({
            id: s.id,
            title: s.title,
            image: s.image,
            connections: s.connections || {},
            desc: s.desc || ''
        }));

        // Hapus data lama dan masukkan yang baru (Sync)
        await supabase.from('virtual_tour').delete().neq('id', '_dummy_');
        const { error } = await supabase.from('virtual_tour').insert(mappedScenes);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT Data Scenes (Update specific tasks could be here)
app.put('/api/scenes', async (req, res) => {
    const role = req.headers['x-user-role'];
    if (role !== 'superadmin') return res.status(403).json({ error: 'Hanya Superadmin yang bisa menghapus!' });

    try {
        const supabase = getSupabase();
        const scenes = req.body;
        
        // Map frontend fields to database fields
        const mappedScenes = scenes.map(s => ({
            id: s.id,
            title: s.title,
            image: s.image,
            connections: s.connections || {},
            desc: s.desc || ''
        }));

        await supabase.from('virtual_tour').delete().neq('id', '_dummy_');
        const { error } = await supabase.from('virtual_tour').insert(mappedScenes);
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
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;

        // Langsung upload ke storage karena sudah dikompres di browser
        const { data, error } = await supabase.storage
            .from('panoramas')
            .upload(fileName, file.buffer, {
                contentType: 'image/webp',
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

if (process.env.NODE_ENV !== 'production' && import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('api/index.js')) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        console.log(`🚀 Local Server running at http://localhost:${port}`);
    });
}

export default app;
