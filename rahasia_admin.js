let scenes = [];
let network = null;
let focusedId = null;
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

    const container = document.getElementById('sidebar-scene-list');
    if (container && !container.innerHTML.trim()) {
        container.innerHTML = '<div class="flex-1 flex flex-col items-center justify-center text-slate-300 gap-2"><i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i><span class="text-[10px] font-bold uppercase tracking-widest">Memuat...</span></div>';
        if (window.lucide) lucide.createIcons();
    }

    try {
        const response = await fetch('/api/scenes', {
            headers: { 'x-user-role': sessionStorage.getItem('userRole') || '' }
        });
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
    container.innerHTML = scenes.map(s => {
        const isActive = s.id === focusedId;
        const imageUrl = s.image 
                         ? s.image 
                         : `https://placehold.co/100x100?text=360`;
        return `
        <button onclick="window.focusScene('${s.id}')" 
            class="scene-card flex-none w-[220px] md:w-full flex items-center gap-3 p-2.5 md:p-4 rounded-[1.5rem] md:rounded-[2rem] border transition-all text-left group md:mb-3 md:last:mb-0 min-w-0 ${isActive ? 'active bg-white border-indigo-600 shadow-xl' : 'bg-transparent border-transparent hover:bg-white/60 hover:border-slate-100'}">
            <div class="w-12 h-12 md:w-16 md:h-16 rounded-full md:rounded-[1.5rem] overflow-hidden bg-slate-100 shrink-0 border-2 border-white shadow-inner relative group-hover:scale-105 transition-transform">
                <img src="${imageUrl}" class="w-full h-full object-cover">
                ${isActive ? '<div class="absolute inset-0 bg-indigo-600/10 flex items-center justify-center"><div class="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div></div>' : ''}
            </div>
            <div class="flex-1 min-w-0 pr-4">
                <p class="text-[12px] md:text-[15px] font-extrabold text-slate-800 truncate leading-tight mb-1">${s.title}</p>
                <div class="hidden md:flex items-center gap-1.5">
                    <span class="text-[8px] md:text-[10px] font-black text-slate-400 truncate opacity-60 uppercase tracking-widest">${s.id}</span>
                </div>
            </div>
            <div class="hidden md:flex w-8 h-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 opacity-0 group-hover:opacity-100 transition-all text-indigo-400">
                <i data-lucide="arrow-right-circle" class="w-4.5 h-4.5"></i>
            </div>
        </button>
        `;
    }).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

window.focusScene = (id) => {
    focusedId = id;
    if (network) {
        network.focus(id, { scale: 1.2, animation: { duration: 1000, easingFunction: 'easeInOutQuad' } });
        network.selectNodes([id]);
        window.editScene(id);
    }
    updateSidebar();
};

window.zoomToFit = () => {
    if (network) network.fit({ animation: { duration: 1000, easingFunction: 'easeInOutQuad' } });
};

function initGraph() {
    const container = document.getElementById('vis-container');
    
    // Antigravity: Optimal Image Handling for Cloud URLs
    const nodesData = scenes.map(s => {
        let imageUrl = s.image || '';
        
        // Anti-404: Jika kosong, tampilkan placeholder agar tidak kosong/dot
        if (!imageUrl) {
            imageUrl = `https://placehold.co/200x200/4f46e5/ffffff?text=${encodeURIComponent(s.id)}`;
        }

        const nodeObj = {
            id: s.id,
            label: s.title,
            shape: imageUrl ? 'circularImage' : 'dot',
            color: { 
                border: '#4f46e5', 
                background: '#ffffff',
                highlight: { border: '#4f46e5', background: '#eef2ff' }
            },
            size: 30,
            borderWidth: 3
        };

        if (imageUrl) {
            nodeObj.image = imageUrl;
        }

        return nodeObj;
    });

    const nodes = new vis.DataSet(nodesData);

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
            font: { face: 'Inter', size: 12, color: '#444' } 
        },
        edges: { 
            width: 2, 
            smooth: { type: 'curvedCW', roundness: 0.2 },
            color: { inherit: 'from' }
        },
        physics: { 
            enabled: true,
            stabilization: {
                enabled: true,
                iterations: 1000,
                updateInterval: 50
            },
            barnesHut: { 
                gravitationalConstant: -2000, 
                centralGravity: 0.3, 
                springLength: 150 
            } 
        },
        interaction: { hover: true, tooltipDelay: 200 }
    };

    network = new vis.Network(container, data, options);

    // Antigravity: Matikan fisika setelah stabil agar tidak leg
    network.once("stabilizationIterationsDone", function () {
        network.setOptions({ physics: false });
        console.log('✅ Peta dikunci (Mode Performa)');
    });

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
    // Antigravity: Role Check for Delete Button
    const role = sessionStorage.getItem('userRole');
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
        if (role === 'superadmin') deleteBtn.classList.remove('hidden');
        else deleteBtn.classList.add('hidden');
    }

    document.getElementById('scene-id').disabled = true;
    document.getElementById('scene-title').value = s.title;
    document.getElementById('scene-desc').value = s.desc || '';
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
        const imageInput = document.getElementById('scene-image-file');

        // 1. UPLOAD GAMBAR KE SUPABASE (Jika ada file baru)
        if (imageInput && imageInput.files && imageInput.files[0]) {
            const originalFile = imageInput.files[0];
            
            // Kompresi Client-Side agar upload secepat kilat & tembus limit Vercel
            const compressedBlob = await new Promise((resolve) => {
                const img = new Image();
                img.src = URL.createObjectURL(originalFile);
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Standar 4K Panorama (4096 x 2048)
                    canvas.width = 4096; 
                    canvas.height = 2048;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
                };
            });

            const formData = new FormData();
            const compressedFile = new File([compressedBlob], `pano-${Date.now()}.webp`, { type: 'image/webp' });
            formData.append('image', compressedFile);

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
            let newId = document.getElementById('scene-id').value.trim();
            
            // Antigravity: Auto-generate ID if empty (helpful for quick creation)
            if (!newId) {
                newId = 'scene_' + Math.random().toString(36).substring(2, 9);
            }
            
            if (scenes.find(x => x.id === newId)) throw new Error('ID sudah digunakan!');
            
            scenes.push({
                id: newId,
                title: document.getElementById('scene-title').value || 'Tanpa Judul',
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
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role': sessionStorage.getItem('userRole') || ''
            },
            body: JSON.stringify(scenes)
        });

        if (!saveRes.ok) throw new Error('Gagal menyimpan data ke database');

        // Bersihkan cache IndexedDB agar data baru muncul
        if (typeof setCache === 'function') await setCache(scenes);

        loadScenes();
        window.closeForm();
        window.showToast('✅ Berhasil disimpan ke Cloud!');

    } catch (e) {
        console.error(e);
        window.showToast('❌ Error: ' + e.message, true);
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
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role': sessionStorage.getItem('userRole') || ''
            },
            body: JSON.stringify(scenes)
        });
        loadScenes();
        window.closeForm();
    } catch (e) { alert('Gagal menghapus!'); }
};

window.addFacility = () => {
    window.openCustomPrompt("Tambah Fasilitas", (label) => {
        const s = scenes.find(x => x.id === editingId);
        if (!s.facilities) s.facilities = [];
        s.facilities.push({ label, yaw: 0, pitch: 0 });
        renderFacilityList(s);
    });
};

window.openCustomPrompt = (title, onConfirm) => {
    const modal = document.getElementById('custom-prompt-modal');
    const content = document.getElementById('custom-prompt-content');
    const input = document.getElementById('custom-prompt-input');
    const btn = document.getElementById('custom-prompt-confirm');
    const titleEl = document.getElementById('prompt-modal-title');

    if (!modal) return;

    titleEl.innerText = title;
    input.value = "";
    modal.classList.remove('hidden');
    
    // Set confirm callback
    btn.onclick = () => {
        const val = input.value.trim();
        if (val) {
            onConfirm(val);
            window.closeCustomPrompt();
        }
    };

    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
        input.focus();
    }, 10);
};

window.closeCustomPrompt = () => {
    const modal = document.getElementById('custom-prompt-modal');
    const content = document.getElementById('custom-prompt-content');
    if (!modal) return;

    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
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
            document.getElementById('scene-image-path').value = input.files[0].name;
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
    
    const container = document.getElementById('preview-panorama');
    
    // Mode Coming Soon jika gambar tidak ada
    const isComingSoon = !s.image;

    if (isComingSoon) {
        if (container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center w-full h-full bg-[#050510] relative overflow-hidden">
                    <div class="absolute inset-0 bg-cover bg-center scale-110 blur-sm opacity-30" style="background-image: url('https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&q=80&w=2000')"></div>
                    <div class="absolute inset-0 bg-gradient-to-b from-indigo-900/40 via-black/80 to-black"></div>
                    <div class="relative z-10 flex flex-col items-center p-8 text-center">
                        <div class="bg-black/40 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <div class="w-20 h-20 bg-indigo-600/20 rounded-[2rem] border border-indigo-500/30 flex items-center justify-center mb-6 mx-auto animate-pulse">
                                <i data-lucide="camera-off" class="w-8 h-8 text-indigo-400"></i>
                            </div>
                            <h2 class="text-white text-3xl font-black uppercase tracking-[0.3em] mb-4">Coming Soon</h2>
                            <p class="text-indigo-200/60 text-[10px] font-black uppercase tracking-[0.2em] max-w-xs leading-loose mx-auto">Ruangan ini sedang dalam pengerjaan teknis.</p>
                        </div>
                    </div>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
        }
        return;
    }

    // Jika ada foto, tampilkan Spinner sebentar
    if (container) {
        container.innerHTML = `
            <div class="spinner-container">
                <div class="spinner"></div>
                <p class="loading-text" style="font-size: 8px">Memuat Preview...</p>
            </div>
        `;
    }
    
    const h = [];
    Object.entries(s.connections || {}).forEach(([dir, c]) => {
        const targetData = scenes.find(x => x.id === c.target);
        
        // Hotspot disembunyikan jika ruangan target masih coming soon
        const targetIsSoon = !targetData || !targetData.image;
        if (targetIsSoon) return;

        h.push({
            pitch: c.pitch, yaw: c.yaw, 
            createTooltipFunc: renderH, 
            createTooltipArgs: c.label,
            clickHandlerFunc: (e, arg) => window.previewChangeScene(arg), 
            clickHandlerArgs: c.target, 
            cssClass: 'custom-path'
        });
    });

    (s.facilities || []).forEach(f => h.push({
        pitch: f.pitch, yaw: f.yaw, createTooltipFunc: renderF, createTooltipArgs: f.label, cssClass: 'custom-facility'
    }));

    quickPreviewViewer = pannellum.viewer('preview-panorama', { 
        type: 'equirectangular', 
        panorama: s.image, 
        autoLoad: true, 
        showControls: false,
        hotSpots: h 
    });
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


window.showToast = (msg, isError = false) => {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    const toastIconBg = document.getElementById('toast-icon-bg');
    
    toastMsg.innerText = msg;
    
    // Warna Merah jika Error
    if (isError) {
        toastIconBg.classList.remove('bg-emerald-500', 'shadow-[0_0_15px_rgba(16,185,129,0.4)]');
        toastIconBg.classList.add('bg-rose-500', 'shadow-[0_0_15px_rgba(244,63,94,0.4)]');
    } else {
        toastIconBg.classList.remove('bg-rose-500', 'shadow-[0_0_15px_rgba(244,63,94,0.4)]');
        toastIconBg.classList.add('bg-emerald-500', 'shadow-[0_0_15px_rgba(16,185,129,0.4)]');
    }

    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4', 'scale-95');
    toast.classList.add('opacity-100', 'translate-y-0', 'scale-100');
    
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    }, 3000);
};

window.onload = () => {
    // Check session
    const username = sessionStorage.getItem('userName');
    const role = sessionStorage.getItem('userRole');

    if (username && role) {
        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) loginOverlay.classList.add('hidden');
        
        const desktopName = document.getElementById('current-user-name');
        if (desktopName) desktopName.innerText = username;
        
        const roleBadge = document.getElementById('current-user-role');
        if (roleBadge) {
            roleBadge.innerText = role;
            if (role === 'superadmin') {
                roleBadge.classList.replace('bg-slate-100', 'bg-indigo-600');
                roleBadge.classList.replace('text-slate-400', 'text-white');
            } else {
                roleBadge.classList.replace('bg-slate-100', 'bg-slate-200');
                roleBadge.classList.replace('text-slate-400', 'text-slate-600');
            }
        }

        // Populate User Info (Mobile)
        const mobileName = document.getElementById('mobile-user-name');
        if (mobileName) mobileName.innerText = username;
        const mobileRole = document.getElementById('mobile-user-role');
        if (mobileRole) mobileRole.innerText = role;
        const mobileInitial = document.getElementById('mobile-user-initial');
        if (mobileInitial) mobileInitial.innerText = username.charAt(0).toUpperCase();

        if (role === 'superadmin') {
            const mBtn = document.getElementById('manage-users-btn');
            const mmBtn = document.getElementById('mobile-manage-users-btn');
            const mDiv = document.getElementById('manage-users-divider');
            if (mBtn) mBtn.classList.remove('hidden');
            if (mmBtn) mmBtn.classList.remove('hidden');
            if (mDiv) mDiv.classList.remove('hidden');
            
            const deleteBtn = document.getElementById('delete-btn');
            if (deleteBtn) deleteBtn.classList.remove('hidden');
        } else {
            const mBtn = document.getElementById('manage-users-btn');
            const mmBtn = document.getElementById('mobile-manage-users-btn');
            if (mBtn) mBtn.classList.add('hidden');
            if (mmBtn) mmBtn.classList.add('hidden');
            
            const deleteBtn = document.getElementById('delete-btn');
            if (deleteBtn) deleteBtn.classList.add('hidden');
        }
        loadScenes();
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
};

window.processLogin = async () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const btn = document.querySelector('button[onclick="window.processLogin()"]');
    const errorDiv = document.getElementById('login-error');

    btn.disabled = true;
    btn.innerText = "Authenticating...";
    errorDiv.classList.add('hidden');

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });

        const data = await res.json();
        if (data.success) {
            sessionStorage.setItem('userName', data.user.username);
            sessionStorage.setItem('userRole', data.user.role);
            location.reload(); // Refresh to apply UI changes
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        errorDiv.innerText = e.message;
        errorDiv.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = "Log In System";
    }
};

window.processLogout = () => {
    sessionStorage.clear();
    location.reload();
};

window.togglePasswordVisibility = () => {
    const passInput = document.getElementById('login-pass');
    const icon = document.getElementById('pw-icon');
    
    if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        passInput.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
};

window.toggleUserPasswordVisibility = () => {
    const passInput = document.getElementById('user-password');
    const icon = document.getElementById('user-pw-icon');
    if (passInput.type === 'password') {
        passInput.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        passInput.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
};

// USER MANAGEMENT CRUD
window.showUserManagement = async () => {
    document.getElementById('user-management-modal').classList.remove('hidden');
    window.renderUserList();
};

window.closeUserManagement = () => {
    document.getElementById('user-management-modal').classList.add('hidden');
};

window.renderUserList = async function() {
    const container = document.getElementById('user-list-container');
    container.innerHTML = '<p class="text-[10px] animate-pulse">Memuat data...</p>';

    try {
        const res = await fetch('/api/users', {
            headers: { 'x-user-role': sessionStorage.getItem('userRole') }
        });
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Gagal mengambil data user');
        }

        const users = data;
        const badge = document.getElementById('user-count-badge');
        if (badge) badge.innerText = `${users.length} TOTAL`;

        container.innerHTML = users.map(u => `
            <div class="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <i data-lucide="${u.role === 'superadmin' ? 'shield-check' : 'user'}" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <p class="text-[11px] font-bold text-slate-700">${u.username}</p>
                        <p class="text-[8px] font-black text-indigo-500 uppercase tracking-widest">${u.role}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick='window.editUser(${JSON.stringify(u).replace(/'/g, "&apos;")})' class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-indigo-50 transition-all" title="Edit User">
                        <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                    </button>
                    ${u.username !== sessionStorage.getItem('userName') ? `
                    <button onclick="window.deleteUser('${u.username}')" class="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition-all" title="Hapus User">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        container.innerHTML = `
            <div class="p-6 text-center">
                <div class="w-10 h-10 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i data-lucide="alert-circle" class="w-5 h-5"></i>
                </div>
                <p class="text-xs font-bold text-slate-700">Gagal Memuat User</p>
                <p class="text-[10px] text-slate-400 mt-1">${e.message}</p>
                <button onclick="window.renderUserList()" class="mt-4 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">Coba Lagi</button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }
}

window.editUser = (user) => {
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-username').disabled = true; // Username PK, tidak bisa diubah
    document.getElementById('user-password').value = ''; // Kosongkan password agar user isi jika ingin ganti
    document.getElementById('user-role').value = user.role;
    
    document.getElementById('user-form-title').innerText = 'Edit User';
    document.getElementById('user-form-icon').setAttribute('data-lucide', 'user-cog');
    document.getElementById('btn-save-user').innerText = 'Update Akun';
    document.getElementById('btn-cancel-edit-user').classList.remove('hidden');
    
    if (window.lucide) lucide.createIcons();
};

window.resetUserForm = () => {
    document.getElementById('user-username').value = '';
    document.getElementById('user-username').disabled = false;
    document.getElementById('user-password').value = '';
    document.getElementById('user-role').value = 'admin';
    
    document.getElementById('user-form-title').innerText = 'Tambah User Baru';
    document.getElementById('user-form-icon').setAttribute('data-lucide', 'user-plus');
    document.getElementById('btn-save-user').innerText = 'Simpan Akun';
    document.getElementById('btn-cancel-edit-user').classList.add('hidden');
    
    if (window.lucide) lucide.createIcons();
};

window.saveUser = async () => {
    const username = document.getElementById('user-username').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    if (!username) return alert('Username wajib diisi!');
    // Jika password kosong saat edit, berarti tidak ganti password.
    // Tapi jika tambah baru, wajib diisi.
    const isEdit = document.getElementById('user-username').disabled;
    if (!isEdit && !password) return alert('Password wajib diisi!');

    try {
        const body = { username, role };
        if (password) body.password = password;

        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-user-role': sessionStorage.getItem('userRole')
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            window.showToast(isEdit ? 'Akun berhasil diperbarui!' : 'Akun berhasil dibuat!');
            window.resetUserForm();
            window.renderUserList();
        } else {
            const data = await res.json();
            throw new Error(data.error || 'Gagal menyimpan user');
        }
    } catch (e) { 
        window.showToast('Gagal: ' + e.message, true);
    }
};

window.deleteUser = async (uname) => {
    if (!confirm(`Hapus user ${uname}?`)) return;

    try {
        const res = await fetch(`/api/users/${uname}`, {
            method: 'DELETE',
            headers: { 'x-user-role': sessionStorage.getItem('userRole') }
        });

        if (res.ok) {
            window.showToast('User berhasil dihapus!');
            window.renderUserList();
        } else {
            const data = await res.json();
            throw new Error(data.error || 'Gagal menghapus user');
        }
    } catch (e) { 
        window.showToast('Gagal: ' + e.message, true);
    }
};
