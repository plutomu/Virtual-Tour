/* ─── Scene definitions ─── */
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
    nodeMap: {
        'scene1': 'node-halaman',
        'scene2': 'node-masuk',
        'scene3': 'node-pelayanan',
        'scene5': 'node-pelayanan', // Highlighting through Pelayanan now
        'scene6': 'node-pelayanan'
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
            left:  { target: 'scene5', label: 'Ke Gedung B', yaw: -100, pitch: -15 },
            right: { target: 'scene6', label: 'Ke Gedung A', yaw: -60, pitch: -15 }
        }
    },
    scene5: {
        title: 'Area Gedung B',
        desc: 'Sisi kiri kompleks gedung.',
        image: 'assets/pintu_masuk/pintu_masuk.jpg',
        initialYaw: 90,
        connections: {
            right: { target: 'scene3', label: 'Kembali ke Layanan', yaw: 90, pitch: -10 }
        }
    },
    scene6: {
        title: 'Area Gedung A',
        desc: 'Area Gedung A yang memanjang.',
        image: 'assets/gedung_a/gedung_a.jpg',
        initialYaw: -90,
        connections: {
            left: { target: 'scene3', label: 'Kembali ke Layanan', yaw: -90, pitch: -10 }
        }
    }
};

/* ─── State ─── */
let current  = 'scene1';
let visited  = new Set(['scene1']);
let viewer   = null;

/* ─── Preload Buffer ─── */
const imageCache = {};

function preloadImages() {
    Object.values(scenes).forEach(s => {
        if (!imageCache[s.image]) {
            const img = new Image();
            img.src = s.image;
            imageCache[s.image] = img;
        }
    });
}

/* ─── Init ─── */
function init() {
    preloadImages();
    
    // Recovery state from localStorage
    const savedScene = localStorage.getItem('vt_last_scene');
    const savedVisited = localStorage.getItem('vt_visited');

    if (savedScene && scenes[savedScene]) {
        current = savedScene;
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
    const flash = document.getElementById('flash');
    if (flash) flash.style.opacity = '1';
    hideText();

    setTimeout(() => {
        current = id;
        visited.add(id);
        
        // Save state for persistence on refresh
        localStorage.setItem('vt_last_scene', id);
        localStorage.setItem('vt_visited', JSON.stringify(Array.from(visited)));
        
        loadScene(id);
    }, 280); // Wait for flash transition to peak
}

/* ─── Load scene ─── */
function loadScene(id) {
    const s = scenes[id];
    if (!s) return;

    // Destructive re-initialization is more robust for large/complex transitions
    const container = document.getElementById('panorama');
    if (container) {
        container.innerHTML = ''; // Force clear any stuck Pannellum state
    }

    try {
        viewer = pannellum.viewer('panorama', {
            type: 'equirectangular',
            panorama: s.image,
            autoLoad: true,
            showControls: false,
            yaw: s.initialYaw || 0,
            pitch: s.initialPitch || 0,
            hotSpots: getHotspots(id)
        });


        viewer.on('load', () => {
            const flash = document.getElementById('flash');
            if (flash) flash.style.opacity = '0';
            showText();
        });

        // Set an emergency timeout if 'load' event doesn't fire fast enough
        setTimeout(() => {
            const flash = document.getElementById('flash');
            if (flash && flash.style.opacity === '1') {
                flash.style.opacity = '0';
            }
        }, 3000);

    } catch (e) {
        console.error('Pannellum Load Error:', e);
        const flash = document.getElementById('flash');
        if (flash) flash.style.opacity = '0';
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

        spots.push({
            pitch: hPitch,
            yaw: hYaw,
            cssClass: 'custom-path',
            createTooltipFunc: hotspotElement,
            createTooltipArgs: c.label,
            clickHandlerFunc: (evt, args) => changeScene(args),
            clickHandlerArgs: c.target
        });
    });
    return spots;
}

// Custom DOM element for hotspots (Normal Arrow)
function hotspotElement(hotSpotDiv, args) {
    hotSpotDiv.classList.add('custom-path');
    
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
