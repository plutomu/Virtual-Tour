import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BUCKET_NAME = 'panoramas';
const assetsDir = path.resolve(process.cwd(), 'public/assets');

async function migrate() {
    console.log('🚀 Memulai migrasi gambar ke Supabase Storage...');
    console.log('📂 Memeriksa folder:', assetsDir);
    
    if (!fs.existsSync(assetsDir)) {
        console.error('❌ Folder assets tidak ditemukan.');
        return;
    }

    const allFiles = [];
    const walk = (dir) => {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath);
            } else if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
                allFiles.push(fullPath);
            }
        });
    };

    walk(assetsDir);
    
    console.log(`🔍 Ditemukan ${allFiles.length} gambar untuk dimigrasi.`);
    
    if (allFiles.length === 0) {
        console.log('ℹ️ Tidak ada gambar ditemukan. Periksa kembali lokasi folder assets Anda.');
        return;
    }

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        
        console.log(`📤 Mengunggah: ${fileName}...`);
        
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileBuffer, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (error) {
            console.error(`❌ Gagal mengunggah ${fileName}:`, error.message);
        } else {
            console.log(`✅ Berhasil: ${fileName}`);
        }
    }
    
    console.log('\n🧹 Melakukan pembersihan total folder assets...');
    try {
        fs.rmSync(assetsDir, { recursive: true, force: true });
        console.log('🗑️ Folder assets telah dihapus sepenuhnya.');
    } catch (err) {
        console.error('⚠️ Gagal menghapus folder assets:', err.message);
    }
    
    console.log('\n✨ Migrasi Selesai! Coba cek Bucket Supabase Anda sekarang.');
}

migrate().catch(err => console.error('❌ Terjadi error sistem:', err.message));
