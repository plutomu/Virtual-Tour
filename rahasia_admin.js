let scenes = [];
let network = null;
let editingId = null;
let pickerViewer = null;
let quickPreviewViewer = null;

// Export functions to window because of type="module"
// Helper untuk IndexedDB
const dbName = "VirtualTourDB";
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

async function loadScenes() {
    // 1. Tampilkan dari IndexedDB agar Instan & Tangguh
    const cachedData = await getCache();
    if (cachedData) {
        scenes = cachedData;
        updateSidebar();
        initGraph();
        console.log('💎 Data dimuat instan dari IndexedDB');
    }

    try {
        const response = await fetch('/api/scenes');
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server error: ${response.status}`);
        }
        
        const freshScenes = await response.json();
        
        if (JSON.stringify(freshScenes) !== JSON.stringify(scenes)) {
            scenes = freshScenes;
            updateSidebar();
            initGraph();
            console.log('🔄 Data diperbarui dari server');
        }

        // 2. Simpan ke IndexedDB
        await setCache(freshScenes);

    } catch (e) {
        console.error('Failed to load scenes:', e);
    }
}
window.loadScenes = loadScenes;

function updateSidebar() {
    const container = document.getElementById('sidebar-scene-list');
    const counter = document.getElementById('scene-count');
    if (!container) return;

    counter.innerText = scenes.length;
    container.innerHTML = scenes.map(s => `
        <button onclick="window.focusScene('${s.id}')" class="flex-none lg:w-full flex items-center gap-3 p-3 lg:p-4 rounded-3xl bg-transparent border border-transparent hover:border-indigo-200 hover:bg-white lg:hover:bg-slate-50 transition-all text-left group w-64 lg:w-auto">
            <div class="w-14 h-14 lg:w-12 lg:h-12 rounded-2xl overflow-hidden bg-slate-200 shrink-0 border border-white lg:border-slate-200 shadow-sm">
                <img src="${s.image || 'https://placehold.co/100x100?text=360'}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 overflow-hidden">
                <p class="text-[13px] lg:text-[14px] font-black text-slate-800 truncate leading-tight">${s.title}</p>
                <p class="text-[10px] font-bold text-slate-400 truncate opacity-60 uppercase">${s.id}</p>
            </div>
            <i data-lucide="chevron-right" class="hidden lg:block w-4 h-4 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all"></i>
        </button>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

window.focusScene = (id) => {
    if (network) {
        network.focus(id, { scale: 1.2, animation: { duration: 1000, easingFunction: 'easeInOutQuad' } });
        network.selectNodes([id]);
        window.editScene(id);
    }
};

window.zoomToFit = () => {
    if (network) network.fit({ animation: { duration: 1000, easingFunction: 'easeInOutQuad' } });
};

function initGraph() {
    const container = document.getElementById('vis-container');
    const nodes = new vis.DataSet(scenes.map(s => ({
        id: s.id,
        label: s.title,
        shape: s.image ? 'circularImage' : 'dot',
        image: s.image || '',
        color: { border: '#4f46e5', background: '#fff' }
    })));

    // Meredesain Garis Node (Dinamis & Smooth)
    const edges = [];
    scenes.forEach(s => {
        const conns = s.connections || {};
        Object.entries(conns).forEach(([dir, c]) => {
            const labelsMap = { 'forward': 'Depan', 'back': 'Belakang', 'left': 'Kiri', 'right': 'Kanan' };
            edges.push({ 
                from: s.id, 
                to: c.target, 
                label: labelsMap[dir] || dir,
                arrows: 'to', 
                color: { color: '#818cf8', opacity: 0.6 },
                width: 1.5,
                smooth: { type: 'curvedCW', roundness: 0.15 },
                font: { align: 'top', size: 8, face: 'Outfit', color: '#6366f1', strokeWidth: 0 }
            });
        });
    });

    const data = { nodes, edges: new vis.DataSet(edges) };
    const options = {
        nodes: { 
            size: 30, 
            borderWidth: 4, 
            font: { face: 'Outfit', size: 12, color: '#475569' } 
        },
        edges: { width: 2, smooth: { type: 'curvedCW', roundness: 0.2 } },
        physics: { enabled: true, barnesHut: { gravitationalConstant: -2000, centralGravity: 0.3, springLength: 150 } },
        interaction: { hover: true, tooltipDelay: 200 }
    };

    network = new vis.Network(container, data, options);

    // Logika Trigger Edit (Instan & Akurat untuk Desktop & Mobile)
    const handleNodeSelection = (params) => {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            // Zoom sedikit untuk feedback visual
            network.focus(nodeId, { scale: 1.1, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
            
            // Langsung panggil modal edit
            setTimeout(() => window.editScene(nodeId), 50);
        }
    };

    network.on('click', handleNodeSelection);
    network.on('selectNode', handleNodeSelection);
    network.on('hold', handleNodeSelection); // Tambahan untuk touch yang lebih lama sedikit
}

window.showNewSceneForm = () => {
    editingId = null;
    document.getElementById('form-title').innerText = 'Tambah Ruangan Baru';
    document.getElementById('scene-id').value = '';
    document.getElementById('scene-title').value = '';
    document.getElementById('scene-desc').value = '';
    document.getElementById('scene-image-path').value = '';
    document.getElementById('upload-preview').classList.add('hidden');
    document.getElementById('upload-placeholder').classList.remove('hidden');
    
    document.getElementById('connection-manager').innerHTML = '';
    document.getElementById('facility-list').innerHTML = '';
    
    document.getElementById('modal-backdrop').classList.remove('hidden');
    document.getElementById('scene-form-modal').classList.remove('translate-x-full');
};

window.editScene = (id) => {
    const s = scenes.find(x => x.id === id);
    if (!s) return;
    editingId = id;

    document.getElementById('form-title').innerText = 'Edit Ruangan';
    document.getElementById('scene-id').value = s.id;
    document.getElementById('scene-id').disabled = true;
    document.getElementById('scene-title').value = s.title;
    document.getElementById('scene-desc').value = s.desc || '';
    
    // Antigravity: Status is now always active, so no need to set checkbox
    // document.getElementById('scene-active').checked = !s.disabled;
    document.getElementById('scene-image-path').value = s.image;

    const preview = document.getElementById('upload-preview');
    const placeholder = document.getElementById('upload-placeholder');
    if (s.image) {
        preview.src = s.image;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
    }

    renderConnectionList(s);
    renderFacilityList(s);
    
    document.getElementById('modal-backdrop').classList.remove('hidden');
    document.getElementById('scene-form-modal').classList.remove('translate-x-full');
};

window.closeForm = () => {
    document.getElementById('scene-form-modal').classList.add('translate-x-full');
    document.getElementById('modal-backdrop').classList.add('hidden');
    window.hidePicker();
};

window.saveScene = async function() {
    const btn = document.querySelector('button[onclick="window.saveScene()"]');
    const originalHTML = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="animate-spin" data-lucide="loader-2"></i>';
        if (window.lucide) lucide.createIcons();

        let imagePath = document.getElementById('scene-image-path').value;
        const imageInput = document.getElementById('scene-image-input');

        // 1. UPLOAD GAMBAR KE SUPABASE (Jika ada file baru)
        if (imageInput.files && imageInput.files[0]) {
            const formData = new FormData();
            formData.append('image', imageInput.files[0]);

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!uploadRes.ok) {
                const err = await uploadRes.json().catch(() => ({}));
                throw new Error(err.error || 'Gagal mengunggah foto 360');
            }

            const uploadData = await uploadRes.json();
            imagePath = uploadData.filePath;
        }

        // 2. SIAPKAN DATA RUANGAN
        if (!editingId) {
            const newId = document.getElementById('scene-id').value.trim();
            if (!newId) throw new Error('ID Ruangan wajib diisi!');
            if (scenes.find(x => x.id === newId)) throw new Error('ID sudah digunakan!');
            
            scenes.push({
                id: newId,
                title: document.getElementById('scene-title').value,
                desc: document.getElementById('scene-desc').value,
                image: imagePath,
                disabled: false,
                connections: {},
                facilities: []
            });
        } else {
            const s = scenes.find(x => x.id === editingId);
            if (s) {
                s.title = document.getElementById('scene-title').value;
                s.desc = document.getElementById('scene-desc').value;
                s.image = imagePath;
            }
        }

        // 3. SIMPAN KE DATABASE (POST ke /api/scenes)
        const saveRes = await fetch('/api/scenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenes)
        });

        if (!saveRes.ok) throw new Error('Gagal menyimpan data ke database');

        // Bersihkan cache IndexedDB agar data baru muncul
        if (typeof setCache === 'function') await setCache(scenes);

        loadScenes();
        window.closeForm();
        alert('✅ Berhasil disimpan ke Cloud!');

    } catch (e) {
        console.error(e);
        alert('❌ Error: ' + e.message);
    } finally {
        btn.innerHTML = originalHTML;
        if (window.lucide) lucide.createIcons();
    }
};

window.deleteScene = async () => {
    if (!editingId) return;
    if (!confirm('Hapus ruangan ini secara permanen?')) return;
    
    scenes = scenes.filter(x => x.id !== editingId);
    try {
        await fetch('/api/scenes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenes)
        });
        loadScenes();
        window.closeForm();
    } catch (e) { alert('Gagal menghapus!'); }
};

window.addFacility = () => {
    const s = scenes.find(x => x.id === editingId);
    if (!s) return;
    const label = prompt('Nama Fasilitas:', 'Meja');
    if (!label) return;
    if (!s.facilities) s.facilities = [];
    s.facilities.push({ label, yaw: 0, pitch: 0 });
    renderFacilityList(s);
};

function renderFacilityList(s) {
    const list = document.getElementById('facility-list');
    if (!list) return;
    list.innerHTML = (s.facilities || []).map((f, i) => `
        <div class="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl group">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <i data-lucide="info" class="w-4 h-4"></i>
                </div>
                <span class="text-xs font-bold text-slate-700">${f.label}</span>
            </div>
            <div class="flex gap-1 group-hover:opacity-100 opacity-60 transition-opacity">
                <button onclick="window.startVisualConnect('${s.id}', 'facility', ${i})" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-500 rounded-lg">
                    <i data-lucide="map-pin" class="w-4 h-4"></i>
                </button>
                <button onclick="window.removeFacility(${i})" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-lg">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join('');
    if (window.lucide) window.lucide.createIcons();
}

window.removeFacility = (index) => {
    const s = scenes.find(x => x.id === editingId);
    if (s && s.facilities) {
        s.facilities.splice(index, 1);
        renderFacilityList(s);
    }
};

function renderConnectionList(scene) {
    const list = document.getElementById('connection-manager');
    if (!list) return;
    const conns = scene.connections || {};
    const labelMap = { 'forward': 'Depan', 'back': 'Belakang', 'left': 'Kiri', 'right': 'Kanan' };

    list.innerHTML = `
        <div class="mt-8 border-t border-slate-100 pt-6">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Routes & Navigation</h4>
            <div class="space-y-2">
                ${Object.entries(conns).map(([dir, c]) => `
                    <div class="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                        <div class="flex items-center gap-3">
                            <span class="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase text-center min-w-[50px]">${labelMap[dir.toLowerCase()] || dir}</span>
                            <span class="text-xs font-bold text-slate-600 truncate max-w-[100px]">${c.label}</span>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick="window.startVisualConnect('${scene.id}', '${dir}')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"><i data-lucide="map-pin" class="w-4 h-4"></i></button>
                            <button onclick="window.removeConnection('${scene.id}', '${dir}')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="mt-4 w-full border-2 border-dashed border-slate-200 text-slate-400 font-bold py-4 rounded-3xl text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all" onclick="window.startVisualConnect('${scene.id}')">
                + Link New Scene
            </button>
        </div>
    `;
    if (window.lucide) window.lucide.createIcons();
}

window.removeConnection = (id, dir) => {
    const s = scenes.find(x => x.id === id);
    if (s && s.connections[dir]) {
        delete s.connections[dir];
        renderConnectionList(s);
    }
};

let pickingType = 'connection';
let pickingDir = '';
let pickingIdx = -1;
let pickingYaw = 0;
let pickingPitch = 0;

window.startVisualConnect = (id, typeOrDir, idx) => {
    const s = scenes.find(x => x.id === id);
    if (!s) return;
    
    // Default coords (di tengah jika belum ada)
    pickingYaw = 0;
    pickingPitch = 0;

    if (idx !== undefined) {
        pickingType = 'facility';
        pickingIdx = idx;
        const f = s.facilities[idx];
        if (f) { pickingYaw = f.yaw || 0; pickingPitch = f.pitch || 0; }
    } else {
        pickingType = 'connection';
        pickingDir = typeOrDir || prompt('Arah (Depan, Belakang, Kiri, Kanan)?', 'forward').toLowerCase();
        if (!pickingDir) return;
        
        if (!s.connections) s.connections = {};
        if (!s.connections[pickingDir]) {
            const list = scenes.map(x => x.id).join(', ');
            const target = prompt(`Target ID (${list}):`);
            if (!target) return;
            s.connections[pickingDir] = { target, label: target, pitch: 0, yaw: 0 };
        } else {
            const c = s.connections[pickingDir];
            pickingYaw = c.yaw || 0;
            pickingPitch = c.pitch || 0;
        }
    }

    const tool = document.getElementById('hotspot-picker-tool');
    tool.classList.remove('hidden');
    tool.innerHTML = `
        <div class="flex justify-between items-center mb-3">
            <span class="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                Penentuan Lokasi Titik
            </span>
            <button onclick="window.hidePicker()" class="text-slate-400 hover:text-rose-500"><i data-lucide="x-circle" class="w-4 h-4"></i></button>
        </div>
        <div class="relative w-full h-64 bg-slate-100 rounded-3xl overflow-hidden mb-4 border border-slate-200 shadow-inner group">
            <div id="picker-panorama" class="w-full h-full"></div>
            
            <!-- Bidikan Tengah (Guide Only) -->
            <div id="picker-guide" class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 transition-opacity group-hover:opacity-50">
                <div class="w-10 h-10 flex items-center justify-center">
                    <div class="absolute w-px h-6 bg-slate-400"></div>
                    <div class="absolute w-6 h-px bg-slate-400"></div>
                </div>
            </div>

            <!-- Pesan Bantuan (Hanya muncul jika belum diklik) -->
            <div id="click-hint" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div class="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-4 py-2 rounded-full uppercase tracking-tighter animate-bounce">
                    Klik di mana saja pada foto
                </div>
            </div>

            <div class="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200 shadow-sm pointer-events-none">
                <p class="text-[9px] font-bold text-slate-500 uppercase">Mode: ${pickingType === 'facility' ? 'Fasilitas' : 'Rute'}</p>
            </div>
        </div>
        <button onclick="window.confirmPicker()" class="w-full py-4 bg-indigo-600 hover:bg-black text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-100">Simpan Posisi Titik</button>
    `;

    if (pickerViewer) pickerViewer.destroy();
    
    // Inisialisasi viewer
    pickerViewer = pannellum.viewer('picker-panorama', { 
        type: 'equirectangular', 
        panorama: s.image, 
        autoLoad: true, 
        showControls: false,
        yaw: pickingYaw,
        pitch: pickingPitch,
        hotSpots: (pickingYaw !== 0 || pickingPitch !== 0) ? [{
            id: 'temp-marker',
            pitch: pickingPitch,
            yaw: pickingYaw,
            cssClass: 'picker-red-dot'
        }] : []
    });

    // Sembunyikan pesan bantuan jika titik sudah ada
    if (pickingYaw !== 0 || pickingPitch !== 0) {
        const hint = document.getElementById('click-hint');
        if (hint) hint.classList.add('hidden');
    }

    pickerViewer.on('mousedown', (event) => {
        const coords = pickerViewer.mouseEventToCoords(event);
        pickingPitch = coords[0];
        pickingYaw = coords[1];
        
        // Sembunyikan bantuan & guide setelah klik pertama
        const hint = document.getElementById('click-hint');
        const guide = document.getElementById('picker-guide');
        if (hint) hint.classList.add('hidden');
        if (guide) guide.classList.add('opacity-0');
        
        pickerViewer.removeHotSpot('temp-marker');
        pickerViewer.addHotSpot({
            id: 'temp-marker',
            pitch: pickingPitch,
            yaw: pickingYaw,
            cssClass: 'picker-red-dot'
        });
    });

    if (window.lucide) window.lucide.createIcons();
};

window.confirmPicker = () => {
    const s = scenes.find(x => x.id === editingId);
    if (pickingType === 'connection') {
        s.connections[pickingDir].yaw = pickingYaw;
        s.connections[pickingDir].pitch = pickingPitch;
        renderConnectionList(s);
    } else {
        s.facilities[pickingIdx].yaw = pickingYaw;
        s.facilities[pickingIdx].pitch = pickingPitch;
        renderFacilityList(s);
    }
    window.hidePicker();
};

window.hidePicker = () => {
    if (pickerViewer) pickerViewer.destroy();
    document.getElementById('hotspot-picker-tool').classList.add('hidden');
};

/* Image Preview & Conversion */
window.previewImage = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('upload-preview');
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            document.getElementById('upload-placeholder').classList.add('hidden');
            
            // Simpan path simulasi (asumsi server akan handle upload sesungguhnya)
            document.getElementById('scene-image-path').value = 'assets/' + input.files[0].name;
        };
        reader.readAsDataURL(input.files[0]);
    }
};

/* Preview Logic */
window.openQuickPreview = () => {
    const s = scenes.find(x => x.id === (editingId || scenes[0]?.id));
    if (!s) return;
    document.getElementById('quick-preview-modal').classList.remove('hidden');
    window.previewChangeScene(s.id);
};

window.previewChangeScene = (id) => {
    const s = scenes.find(x => x.id === id);
    if (!s) return;
    
    // Antigravity: Populate Text Overlay
    document.getElementById('preview-title').innerText = s.title || 'Untitled';
    document.getElementById('preview-desc').innerText = s.desc || '';
    document.getElementById('preview-org').innerText = 'DINAS TENAGA KERJA PROV. JATENG';

    // Antigravity: Populate Facilities
    const facContainer = document.getElementById('preview-facilities');
    if (facContainer) {
        facContainer.innerHTML = (s.facilities || []).map(f => `
            <div class="px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                <span class="text-[10px] font-black text-white uppercase tracking-wider">${f.label}</span>
            </div>
        `).join('');
    }

    if (quickPreviewViewer) quickPreviewViewer.destroy();
    
    const h = [];
    Object.entries(s.connections || {}).forEach(([dir, c]) => h.push({
        pitch: c.pitch, yaw: c.yaw, createTooltipFunc: renderH, createTooltipArgs: c.label,
        clickHandlerFunc: (e, arg) => window.previewChangeScene(arg), clickHandlerArgs: c.target, cssClass: 'custom-path'
    }));
    (s.facilities || []).forEach(f => h.push({
        pitch: f.pitch, yaw: f.yaw, createTooltipFunc: renderF, createTooltipArgs: f.label, cssClass: 'custom-facility'
    }));

    quickPreviewViewer = pannellum.viewer('preview-panorama', { type: 'equirectangular', panorama: s.image, autoLoad: true, hotSpots: h });
};

function renderH(d, a) { d.innerHTML = `<div class="custom-path-node"></div><span>${a}</span>`; }
function renderF(d, a) { d.innerHTML = `<div class="custom-facility-node"></div><span>${a}</span>`; }

window.closeQuickPreview = () => {
    document.getElementById('quick-preview-modal').classList.add('hidden');
    if (quickPreviewViewer) quickPreviewViewer.destroy();
};

window.filterScenes = (query) => {
    const q = query.toLowerCase();
    const cards = document.querySelectorAll('#sidebar-scene-list > div');
    cards.forEach(card => {
        const title = card.querySelector('h4')?.innerText.toLowerCase() || '';
        if (title.includes(q)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

window.onload = () => {
    loadScenes();
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};
