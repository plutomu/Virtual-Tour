/* ─── State ─── */
const nodeMap = {
    'scene1': 'node-halaman',
    'scene2': 'node-masuk',
    'scene3': 'node-pelayanan',
    'scene5': 'node-pelayanan',
    'scene6': 'node-pelayanan'
};

const scenes = {
    scene1: {
        title: 'Halaman Depan',
        desc: 'Tampak luar gedung dari sisi jalan utama.',
        image: 'assets/halaman/halaman.jpg',
        initialYaw: 0,
        connections: {
            forward: { target: 'scene2', label: 'Pintu Masuk', yaw: 0, pitch: -10 }
        }
    },
    scene2: {
        title: 'Pintu Masuk Utama',
        desc: 'Akses utama menuju Ruang Layanan.',
        image: 'assets/pintu_masuk/pintu_masuk.jpg',
        initialYaw: 0,
        connections: {
            back:    { target: 'scene1', label: 'Halaman Depan', yaw: 180, pitch: -10 },
            forward: { target: 'scene3', label: 'Masuk ke Layanan', yaw: 0, pitch: -10 }
        }
    },
    scene3: {
        title: 'Ruang Layanan Publik',
        desc: 'Area layanan utama masyarakat. Akses ke Gedung A & B.',
        image: 'assets/layanan/layanan.jpg',
        initialYaw: 0,
        connections: {
            back:  { target: 'scene2', label: 'Kembali ke Depan', yaw: 90, pitch: -10 },
            left:  { target: 'scene5', label: 'Ke Gedung B (Coming Soon)', yaw: -100, pitch: -15 },
            right: { target: 'scene6', label: 'Ke Gedung A', yaw: -60, pitch: -15 }
        }
    },
    scene5: {
        title: 'Area Gedung B',
        desc: 'Gedung dalam pengembangan.',
        disabled: true
    },
    scene6: {
        title: 'Area Gedung A',
        desc: 'Area Gedung A yang memanjang.',
        image: 'assets/gedung_a/gedung_a.jpg',
        initialYaw: -90,
        connections: {
            back: { target: 'scene3', label: 'Kembali ke Layanan', yaw: -5, pitch: -10 },
            left: { target: 'scene_c', label: 'Ke Gedung C (Coming Soon)', yaw: -170, pitch: -5 }
        }
    },
    scene_c: {
        title: 'Area Gedung C',
        desc: 'Gedung dalam pengembangan.',
        disabled: true
    },
    scene_mushola: {
        title: 'Mushola',
        desc: 'Area ibadah dalam pengembangan.',
        disabled: true
    }
};

let current  = 'scene1';
let visited  = new Set(['scene1']);
let viewer   = null;

/* ─── Preload Buffer ─── */
const imageCache = {};

function preloadImages() {
    Object.values(scenes).forEach(s => {
        // Fix: check if s is a valid scene object with an image asset
        if (s && s.image && !imageCache[s.image]) {
            const img = new Image();
            img.src = s.image;
            imageCache[s.image] = img;
        }
    });
}

/* ─── Init ─── */
function init() {
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

    preloadImages();
    
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
}

/* ─── Change scene ─── */
function changeScene(id) {
    if (id === current || !scenes[id]) return;
    
    // Check if the scene actually has a valid image file assigned
    const targetScene = scenes[id];
    if (!targetScene.image || targetScene.image.includes('placeholder')) {
        console.warn(`Scene ${id} skipped: No image asset found.`);
        return; // Do nothing if file is missing
    }

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
    }, 280); // Wait for flash transition to peak
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
        flash.innerHTML = ''; // Reset error messages or other content
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
            if (flash && flash.innerHTML === '') {
                flash.style.opacity = '0';
                showText();
            }
        });

        // Set an emergency timeout if 'load' event doesn't fire fast enough
        setTimeout(() => {
            const flash = document.getElementById('flash');
            if (flash && flash.style.opacity === '1' && flash.innerHTML === '') {
                flash.style.opacity = '0';
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
    hotSpotDiv.appendChild(node);

    // Label tooltip - relying on style.css for positioning
    const tooltip = document.createElement('span');
    tooltip.innerHTML = args;
    hotSpotDiv.appendChild(tooltip);
}

/* ─── Text visibility ─── */
function showText() {
    const t = document.getElementById('room-title');
    const d = document.getElementById('room-desc');
    if (t) t.classList.add('show');
    if (d) d.classList.add('show');
}
function hideText() {
    const t = document.getElementById('room-title');
    const d = document.getElementById('room-desc');
    if (t) t.classList.remove('show');
    if (d) d.classList.remove('show');
}

/* ─── Keyboard ─── */
document.addEventListener('keydown', e => {
    const conn = scenes[current]?.connections;
    if (!conn) return;
    const keyMap = { ArrowUp:'forward', ArrowDown:'back', ArrowLeft:'left', ArrowRight:'right' };
    const dir = keyMap[e.key];
    if (dir && conn[dir]) changeScene(conn[dir].target);
});

window.onload = init;
window.changeScene = changeScene; // Ensure accessible globally
