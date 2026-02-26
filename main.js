/* ─── Scene definitions — Teras is the junction ─── */
const scenes = {
    scene1: {
        title: 'Halaman Depan',
        desc: 'Tampak luar gedung dari sisi jalan utama.',
        video: 'WhatsApp Video 2026-02-26 at 10.33.50.mp4',
        connections: {
            forward: { target: 'scene2', label: 'Pintu Utama' }
        }
    },
    scene2: {
        title: 'Pintu Utama',
        desc: 'Akses masuk utama ke dalam gedung.',
        video: 'WhatsApp Video 2026-02-26 at 10.47.57.mp4',
        connections: {
            back:    { target: 'scene1', label: 'Halaman Depan' },
            forward: { target: 'scene3', label: 'Ruang Layanan' }
        }
    },
    scene3: {
        title: 'Ruang Layanan Publik',
        desc: 'Area layanan utama gedung.',
        video: 'WhatsApp Video 2026-02-26 at 10.47.59.mp4',
        connections: {
            back:    { target: 'scene2', label: 'Pintu Utama' },
            forward: { target: 'scene4', label: 'Pintu Masuk Utama' }
        }
    },
    scene4: {
        title: 'Pintu Masuk Utama',
        desc: 'Pintu masuk utama gedung. Dari sini Anda dapat menuju ke kiri atau ke kanan.',
        video: 'WhatsApp Video 2026-02-26 at 10.47.59 (1).mp4',
        connections: {
            back:  { target: 'scene3', label: 'Ruang Layanan' },
            left:  { target: 'scene5', label: 'Area Kiri' },
            right: { target: 'scene6', label: 'Area Kanan' }
        }
    },
    scene5: {
        title: 'Area Kiri',
        desc: 'Area di sisi kiri teras.',
        video: 'WhatsApp Video 2026-02-26 at 14.21.20.mp4',
        connections: {
            right: { target: 'scene4', label: 'Kembali ke Pintu Masuk' }
        }
    },
    scene6: {
        title: 'Area Kanan',
        desc: 'Area di sisi kanan teras.',
        video: 'WhatsApp Video 2026-02-26 at 11.21.52.mp4',
        connections: {
            left: { target: 'scene4', label: 'Kembali ke Pintu Masuk' }
        }
    }
};

/* Segments marked "traveled" per active scene */
const segmentRules = {
    'seg-1-2': ['scene2','scene3','scene4','scene5','scene6'],
    'seg-2-3': ['scene3','scene4','scene5','scene6'],
    'seg-3-4': ['scene4','scene5','scene6'],
    'seg-4-5': ['scene5'],
    'seg-4-6': ['scene6'],
};

/* Minimal SVG paths for each direction */
const chevrons = {
    forward: '<polyline points="8,16 24,6 40,16"/>',
    back:    '<polyline points="8,8 24,18 40,8"/>',
    left:    '<polyline points="18,8 8,24 18,40"/>',
    right:   '<polyline points="30,8 40,24 30,40"/>',
};

/* ─── State ─── */
let current  = 'scene1';
let visited  = new Set(['scene1']);

/* ─── Init ─── */
function init() {
    loadScene('scene1');
    requestAnimationFrame(() => showText());
}

/* ─── Change scene ─── */
function changeScene(id) {
    if (id === current) return;
    const flash = document.getElementById('flash');
    flash.style.opacity = '1';
    hideText();

    setTimeout(() => {
        current = id;
        visited.add(id);
        loadScene(id);
        flash.style.opacity = '0';
        setTimeout(showText, 280);
    }, 280);
}

/* ─── Load scene ─── */
function loadScene(id) {
    const s = scenes[id];
    const vid = document.getElementById('video');

    vid.src = s.video;
    vid.load();
    vid.play();
    vid.classList.remove('entering');
    void vid.offsetWidth;
    vid.classList.add('entering');

    document.getElementById('room-title').textContent  = s.title;
    document.getElementById('room-desc').textContent   = s.desc;
    const roomLabel = document.getElementById('minimap-room');
    if (roomLabel) roomLabel.textContent = s.title;

    renderArrows(id);
    updateMap(id);
    preloadNextVideos(id);
}

/* ─── Street View arrows ─── */
function renderArrows(id) {
    const wrap = document.getElementById('nav-arrows');
    wrap.innerHTML = '';
    const conn = scenes[id].connections;

    Object.entries(conn).forEach(([dir, c]) => {
        const btn = document.createElement('button');
        btn.className = `nav-arrow nav-${dir}`;
        btn.title = c.label;
        btn.innerHTML = `
            <div class="arrow-btn-inner">
                <svg viewBox="0 0 48 48">${chevrons[dir]}</svg>
            </div>
            <span class="arrow-tag">${c.label}</span>
        `;
        btn.onclick = () => changeScene(c.target);
        wrap.appendChild(btn);
    });
}

/* ─── Preload Next Videos (Performance Optimization for Hosting) ─── */
const preloadedVideos = new Set();

function preloadNextVideos(activeId) {
    const conn = scenes[activeId].connections;
    
    // Looping over all possible next directions
    Object.values(conn).forEach(c => {
        const nextScene = scenes[c.target];
        if (nextScene && !preloadedVideos.has(nextScene.video)) {
            // Create a link tag to force the browser to preload the video file
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'video';
            link.href = nextScene.video;
            document.head.appendChild(link);
            
            // Mark as preloaded so we don't insert duplicate tags
            preloadedVideos.add(nextScene.video);
        }
    });
}

/* ─── Update minimap ─── */
function updateMap(activeId) {
    /* nodes */
    Object.keys(scenes).forEach(id => {
        const el = document.getElementById('node-' + id);
        if (!el) return;
        el.classList.remove('active', 'visited');
        if (id === activeId)       el.classList.add('active');
        else if (visited.has(id))  el.classList.add('visited');
    });

    /* segments */
    Object.entries(segmentRules).forEach(([segId, activeScenes]) => {
        const el = document.getElementById(segId);
        if (!el) return;
        el.classList.remove('traveled');
        if (activeScenes.includes(activeId)) el.classList.add('traveled');
    });
}

/* ─── Text visibility ─── */
function showText() {
    document.getElementById('room-title').classList.add('show');
    document.getElementById('room-desc').classList.add('show');
}
function hideText() {
    document.getElementById('room-title').classList.remove('show');
    document.getElementById('room-desc').classList.remove('show');
}

/* ─── Toggle map (circle ↔ expanded) ─── */
function toggleMap() {
    const map  = document.getElementById('routemap');
    const hint = document.getElementById('toggle-hint');
    const isOpen = map.classList.toggle('open');
    if (hint) hint.textContent = isOpen ? '−' : '+';
}

/* ─── Keyboard ─── */
document.addEventListener('keydown', e => {
    const conn = scenes[current]?.connections;
    if (!conn) return;
    const map = { ArrowUp:'forward', ArrowDown:'back', ArrowLeft:'left', ArrowRight:'right' };
    const dir = map[e.key];
    if (dir && conn[dir]) changeScene(conn[dir].target);
});

window.onload = init;
