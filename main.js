const nodeMap = {
    'scene1': 'node-halaman',
    'scene2': 'node-masuk',
    'scene3': 'node-pelayanan',
    'scene5': 'node-pelayanan',
    'scene6': 'node-pelayanan'
};

let scenes = {};
let current  = 'scene1';
let visited  = new Set(['scene1']);
let viewer   = null;

/* ─── Cache Busting Check ─── */
async function checkVersion() {
    try {
        const response = await fetch('/version.json?t=' + Date.now());
        if (!response.ok) return;
        const serverVersion = await response.json();
        const localTimestamp = localStorage.getItem('vt_app_timestamp');

        if (localTimestamp && localTimestamp !== serverVersion.timestamp.toString()) {
            console.log(`🚀 New build detected (${serverVersion.date}). Clearing cache...`);
            const db = await openDB();
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).clear();
        }
        
        localStorage.setItem('vt_app_timestamp', serverVersion.timestamp);
    } catch (e) {
        console.error("Version check failed:", e);
    }
}
async function clearAllCache() {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    location.reload();
}
window.clearAppCache = clearAllCache;

/* ─── IndexedDB Helpers ─── */
const dbName = "VirtualTourVisitorDB";
const storeName = "scenesCache";

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => e.target.result.createObjectStore(storeName);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getCache() {
    try {
        const db = await openDB();
        return new Promise((resolve) => {
            const request = db.transaction(storeName).objectStore(storeName).get("latest");
            request.onsuccess = () => resolve(request.result);
        });
    } catch (e) { return null; }
}

async function setCache(data) {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(data, "latest");
    } catch (e) { console.error("DB Save Error", e); }
}

async function fetchScenes() {
    try {
        const response = await fetch('/api/scenes?' + Date.now());
        if (!response.ok) throw new Error('Backend server is not responding');
        const data = await response.json();
        
        const freshScenes = data.reduce((acc, scene) => {
            acc[scene.id] = scene;
            return acc;
        }, {});

        const changed = JSON.stringify(freshScenes) !== JSON.stringify(scenes);
        scenes = freshScenes;
        await setCache(freshScenes);

        if (changed) {
            console.log('🔄 Data tour diperbarui dari cloud');
            if (viewer) {
                const s = scenes[current];
                if (s) {
                    document.getElementById('room-title').textContent = s.title;
                    document.getElementById('room-desc').textContent = s.desc || "";
                    renderFacilities(s.facilities);
                }
            }
        }

    } catch (e) {
        console.error('Failed to fetch scenes:', e);
        // Fallback ke cache lokal jika server tidak merespon
        const cachedData = await getCache();
        if (cachedData) {
            scenes = cachedData;
            console.log('💎 Data tour dimuat dari cache lokal (offline)');
        } else {
            const flash = document.getElementById('flash');
            if (flash) {
                flash.style.opacity = '1';
                flash.innerHTML = `
                    <div style="color: white; text-align: center; padding: 20px;">
                        <p>Mungkin Server Belum Jalan.</p>
                        <p style="font-size: 12px; opacity: 0.7;">Pastikan Anda menjalankan "npm start" di terminal.</p>
                        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; cursor: pointer;">Coba Lagi</button>
                    </div>
                `;
            }
        }
    }
}


/* ─── Smart Preload Buffer ─── */
const imageCache = {};

function preloadAdjacentScenes(sceneId) {
    const s = scenes[sceneId];
    if (!s || !s.connections) return;

    Object.values(s.connections || {}).forEach(conn => {
        const target = scenes[conn.target];
        if (target && target.image && !imageCache[target.image]) {
            const img = new Image();
            img.src = target.image;
            imageCache[target.image] = img;
        }
    });
}

/* ─── Init ─── */
async function init() {
    await checkVersion(); // Pastikan versi terbaru
    await fetchScenes();
    // Check for Pannellum library availability
    if (typeof pannellum === 'undefined') {
        const flash = document.getElementById('flash');
        if (flash) {
            flash.style.opacity = '1';
            flash.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px;">
                    <p>Gagal mengunduh mesin Virtual Tour (Pannellum).</p>
                    <p style="font-size: 12px; opacity: 0.7;">Periksa koneksi internet Anda atau coba muat ulang.</p>
                    <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; cursor: pointer;">Muat Ulang</button>
                </div>
            `;
        }
        return;
    }


    // Recovery state from localStorage
    const savedScene = localStorage.getItem('vt_last_scene');
    const savedVisited = localStorage.getItem('vt_visited');

    // Fix: ensure the saved scene is actually visitable (has an image)
    if (savedScene && scenes[savedScene] && scenes[savedScene].image) {
        current = savedScene;
    } else {
        current = 'scene1'; // Fallback to entrance if saved scene is invalid
    }
    
    if (savedVisited) {
        try {
            visited = new Set(JSON.parse(savedVisited));
        } catch(e) { visited = new Set(['scene1']); }
    }

    loadScene(current);
    setTimeout(() => showText(), 500);

    // Auto-refresh data setiap 15 detik agar update admin langsung muncul
    setInterval(() => fetchScenes(), 15000);
}

/* ─── Change scene ─── */
function changeScene(id) {
    // Jalankan efek zoom dash (zoom in + blur)
    const pano = document.getElementById('panorama');
    if (pano) pano.classList.add('zoom-dash');
    
    const flash = document.getElementById('flash');
    if (flash) flash.style.opacity = '1';
    hideText();

    setTimeout(() => {
        current = id;
        visited.add(id);
        
        // Save state for persistence on refresh
        localStorage.setItem('vt_last_scene', id);
        localStorage.setItem('vt_visited', JSON.stringify(Array.from(visited)));
        
        // Reset orientation on scene change so target scene defaults work
        localStorage.removeItem('vt_last_yaw');
        localStorage.removeItem('vt_last_pitch');
        
        loadScene(id);
    }, 450); // Menyesuaikan dengan durasi transisi CSS (0.5s)
}

/* ─── Load scene ─── */
function loadScene(id) {
    const s = scenes[id];
    if (!s) return;

    // Destructive re-initialization is more robust for large/complex transitions
    const container = document.getElementById('panorama');
    const flash = document.getElementById('flash');
    if (container) {
        container.innerHTML = ''; // Force clear
    }
    if (flash) {
        // Hanya tampilkan flash hitam tanpa teks/spinner
        flash.style.opacity = '1';
        flash.innerHTML = ''; 
    }

    // Antigravity: Cek apakah foto kosong (Coming Soon Mode)
    const isComingSoon = !s.image;

    if (isComingSoon) {
        if (viewer) viewer.destroy();
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center w-full h-full bg-[#050510] relative overflow-hidden">
                <!-- Advanced Background Layer -->
            <div class="absolute inset-0 flex items-center justify-center bg-slate-50">
                <div class="absolute inset-0 bg-white/20 backdrop-blur-3xl"></div>
                <div class="relative z-10 p-10 lg:p-16 bg-white border border-slate-200 shadow-[0_20px_80px_rgba(0,0,0,0.08)] rounded-[3rem] text-center max-w-sm lg:max-w-md transform transition-all duration-700 hover:scale-[1.02]">
                    <div class="w-20 h-20 lg:w-24 lg:h-24 bg-indigo-600/5 rounded-[2rem] flex items-center justify-center mx-auto mb-8 border border-indigo-600/10">
                        <i data-lucide="camera-off" class="w-10 h-10 lg:w-12 lg:h-12 text-indigo-600 opacity-80"></i>
                    </div>
                    <h2 class="text-3xl lg:text-4xl font-black text-slate-900 mb-4 tracking-tighter">Coming Soon</h2>
                    <p class="text-slate-500 font-bold text-sm lg:text-base leading-relaxed mb-8 px-4 opacity-70">
                        Ruangan ini sedang dalam tahap pengambilan foto 360°. Segera kembali untuk melihat hasilnya.
                    </p>
                    <div class="inline-flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-400 rounded-full border border-slate-100">
                        <div class="w-2 h-2 bg-slate-300 rounded-full animate-pulse"></div>
                        <span class="text-[10px] font-black uppercase tracking-[0.2em]">Seksi Dokumentasi</span>
                    </div>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
        
        // Tetap tampilkan info bar
        document.getElementById('room-title').innerText = s.title;
        document.getElementById('room-desc').innerText = "Ruangan ini akan segera dapat diakses publik.";
        
        if (flash) {
            flash.style.opacity = '0';
            flash.innerHTML = '';
        }
        return;
    }

    // Recovery orientation from localStorage
    const savedYaw = localStorage.getItem('vt_last_yaw');
    const savedPitch = localStorage.getItem('vt_last_pitch');

    try {
        viewer = pannellum.viewer('panorama', {
            type: 'equirectangular',
            panorama: s.image,
            autoLoad: true,
            showControls: false,
            yaw: (savedYaw !== null) ? parseFloat(savedYaw) : (s.initialYaw || 0),
            pitch: (savedPitch !== null) ? parseFloat(savedPitch) : (s.initialPitch || 0),
            hotSpots: getHotspots(id)
        });

        // Save orientation whenever it changes
        viewer.on('viewchange', () => {
            localStorage.setItem('vt_last_yaw', viewer.getYaw());
            localStorage.setItem('vt_last_pitch', viewer.getPitch());
        });


        viewer.on('load', () => {
            const flash = document.getElementById('flash');
            const pano = document.getElementById('panorama');
            
            if (flash) {
                flash.style.opacity = '0';
                setTimeout(() => { if(flash.style.opacity === '0') flash.innerHTML = ''; }, 500);
            }

            // Jalankan animasi 'Resolve' (zoom out + hapus blur)
            if (pano) {
                pano.classList.remove('zoom-dash'); // Bersihkan sisa zoom sebelumnya
                pano.classList.add('zoom-enter');   // Start from a bit zoomed out/blurred
                
                // Force reset after short delay
                setTimeout(() => {
                    pano.classList.remove('zoom-enter');
                }, 50);
            }

            showText();
            if (window.lucide) lucide.createIcons();
        });

        // Set an emergency timeout if 'load' event doesn't fire fast enough
        setTimeout(() => {
            const flash = document.getElementById('flash');
            if (flash && flash.style.opacity === '1') {
                flash.style.opacity = '0';
                setTimeout(() => { if(flash.style.opacity === '0') flash.innerHTML = ''; }, 500);
            }
        }, 5000); // 5 seconds for slow panoramas

    } catch (e) {
        console.error('Pannellum Load Error:', e);
        const flash = document.getElementById('flash');
        if (flash) {
            flash.style.opacity = '1';
            flash.innerHTML = `
                <div style="color: white; text-align: center; padding: 20px;">
                    <p>Gagal memuat panorama.</p>
                    <p style="font-size: 12px; opacity: 0.7;">Pastikan Anda menggunakan web server (Localhost) dan aset gambar tersedia.</p>
                    <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; cursor: pointer;">Muat Ulang</button>
                </div>
            `;
        }
    }

    document.getElementById('room-title').textContent = s.title;
    document.getElementById('room-desc').textContent = s.desc;
    renderFacilities(s.facilities);

    // Smart Preload: Hanya ambil gambar di ruangan terdekat
    preloadAdjacentScenes(id);

    // Trigger per-building map update
    if (window.BuildingMap) window.BuildingMap.update(id);
}

function getHotspots(sceneId) {
    const sceneData = scenes[sceneId];
    if (!sceneData) return [];
    const spots = [];

    Object.entries(sceneData.connections).forEach(([dir, c]) => {
        let hYaw = 0, hPitch = -25; // Lower pitch to stay on the ground
        if (dir === 'forward') hYaw = 0;
        else if (dir === 'back') hYaw = 180;
        else if (dir === 'left') hYaw = -90;
        else if (dir === 'right') hYaw = 90;

        if (c.yaw !== undefined) hYaw = c.yaw;
        if (c.pitch !== undefined) hPitch = c.pitch;

        const targetData = scenes[c.target];
        
        // Custom Hotspot Style based on design
        const isComingSoon = !targetData || !targetData.image;
        
        // Antigravity: Hilangkan tanda panah jika tujuannya belum siap (Coming Soon)
        if (isComingSoon) return;

        const isDisabled = targetData && targetData.disabled;

        spots.push({
            pitch: hPitch,
            yaw: hYaw,
            cssClass: isDisabled ? 'disabled-path' : 'custom-path',
            createTooltipFunc: hotspotElement,
            createTooltipArgs: c.label,
            clickHandlerFunc: isDisabled ? null : (evt, args) => changeScene(args),
            clickHandlerArgs: c.target
        });
    });

    return spots;
}

// Custom DOM element for hotspots (Normal Arrow)
function hotspotElement(hotSpotDiv, args) {
    // We let Pannellum handle the cssClass (custom-path or disabled-path)
    
    // Add the circular house/arrow node
    const node = document.createElement('div');
    node.classList.add('custom-path-node');
    node.style.cursor = 'pointer';
    
    // Find the current target from the parent or context (Pannellum passes args as the tooltip text)
    // In our case, we'll rely on the handler passed by Pannellum or direct hack
    hotSpotDiv.appendChild(node);

    // Label tooltip
    const tooltip = document.createElement('span');
    tooltip.innerHTML = args;
    tooltip.style.cursor = 'pointer';
    hotSpotDiv.appendChild(tooltip);
}

function renderFacilities(facilities) {
    const container = document.getElementById('room-facilities');
    if (!container) return;
    if (!facilities || facilities.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    container.style.display = 'flex';
    container.innerHTML = facilities.map(f => `
        <span class="facility-tag">${f.label}</span>
    `).join('');
}

/* ─── Text visibility ─── */
function showText() {
    const t = document.getElementById('room-title');
    const d = document.getElementById('room-desc');
    const f = document.getElementById('room-facilities');
    if (t) t.classList.add('show');
    if (d) d.classList.add('show');
    if (f) f.classList.add('show');
}
function hideText() {
    const t = document.getElementById('room-title');
    const d = document.getElementById('room-desc');
    const f = document.getElementById('room-facilities');
    if (t) t.classList.remove('show');
    if (d) d.classList.remove('show');
    if (f) f.classList.remove('show');
}

/* ─── Keyboard & Shortcuts ─── */
let secretBuffer = "";
document.addEventListener('keydown', e => {
    // Hidden shortcut: type '99' to go to admin
    secretBuffer += e.key;
    if (secretBuffer.endsWith('99')) {
        window.location.href = '/99';
    }
    if (secretBuffer.length > 5) secretBuffer = secretBuffer.substring(1);

    const conn = scenes[current]?.connections;
    if (!conn) return;
    const keyMap = { ArrowUp:'forward', ArrowDown:'back', ArrowLeft:'left', ArrowRight:'right' };
    const dir = keyMap[e.key];
    if (dir && conn[dir]) changeScene(conn[dir].target);
});

window.resetToHome = () => {
    localStorage.removeItem('vt_last_scene');
    changeScene('scene1');
};

window.onload = init;
window.changeScene = changeScene; // Ensure accessible globally
