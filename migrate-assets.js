import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const BUCKET_NAME = 'panoramas';

// Tentukan folder assets lokal Anda
const assetsDir = path.join(process.cwd(), 'public', 'assets');

async function migrate() {
    console.log('🚀 Memulai migrasi gambar ke Supabase Storage...');
    
    if (!fs.existsSync(assetsDir)) {
        console.error('❌ Folder assets tidak ditemukan.');
        return;
    }

    // Fungsi untuk mencari file secara rekursif (termasuk di dalam folder uploads)
    const getAllFiles = (dirPath, arrayOfFiles) => {
        const files = fs.readdirSync(dirPath);
        arrayOfFiles = arrayOfFiles || [];
        files.forEach(file => {
            if (fs.statSync(dirPath + "/" + file).isDirectory()) {
                arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
            } else if (file.match(/\.(jpg|jpeg|png|webp)$/i)) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        });
        return arrayOfFiles;
    };

    const allFiles = getAllFiles(assetsDir);
    
    if (allFiles.length === 0) {
        console.log('ℹ️ Tidak ada gambar baru yang perlu dimigrasi.');
    }

    for (const filePath of allFiles) {
        const file = path.basename(filePath);
        const fileBuffer = fs.readFileSync(filePath);
        
        console.log(`📤 Mengunggah: ${file}...`);
        const { error } = await supabase.storage.from(BUCKET_NAME).upload(file, fileBuffer, {
            contentType: 'image/jpeg',
            upsert: true
        });

        if (error) {
            console.error(`❌ Gagal mengunggah ${file}: ${error.message}`);
        } else {
            console.log(`✅ Berhasil: ${file}`);
        }
    }
    
    // Hapus total folder assets setelah semua selesai
    console.log('\n🧹 Melakukan pembersihan total folder...');
    try {
        fs.rmSync(assetsDir, { recursive: true, force: true });
        console.log('🗑️ Folder assets telah dihapus sepenuhnya.');
    } catch (err) {
        console.error('⚠️ Gagal menghapus folder assets:', err.message);
    }
    
    console.log('\n✨ Migrasi & Pembersihan Selesai! Sekarang proyek Anda 100% cloud-ready.');
}

migrate();
