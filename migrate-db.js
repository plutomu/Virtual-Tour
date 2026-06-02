import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function migrateData() {
    console.log('📦 Memulai migrasi data (Nodes) ke Supabase...');

    try {
        const rawData = fs.readFileSync('./db.json', 'utf8');
        const data = JSON.parse(rawData);
        const scenes = data.scenes;

        console.log(`🔍 Ditemukan ${scenes.length} ruangan di db.json.`);

        // Bersihkan data lama di Supabase (Opsional - agar tidak duplikat)
        await supabase.from('virtual_tour').delete().neq('id', '_dummy_');

        // Format data agar sesuai dengan struktur tabel Supabase
        const formattedScenes = scenes.map(s => ({
            id: s.id,
            title: s.title,
            desc: s.desc || '',
            image: s.image || '',
            disabled: s.disabled || false,
            connections: s.connections || {},
            facilities: s.facilities || []
        }));

        const { error } = await supabase.from('virtual_tour').insert(formattedScenes);

        if (error) throw error;

        console.log('✅ Berhasil! Semua "Nodes" dan rute Anda sudah kembali ke Supabase.');
        console.log('Sekarang silakan refresh dashboard admin Anda.');

    } catch (err) {
        console.error('❌ Gagal memindahkan data:', err.message);
    }
}

migrateData();
