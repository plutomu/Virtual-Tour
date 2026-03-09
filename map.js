const BuildingMap = {
    // Layout definitions for each building
    layouts: {
        'scene3': {
            type: 'text-centered',
            label: 'RUANG<br>LAYANAN'
        },
        'scene5': {
            title: 'Gedung B',
            rooms: [
                { id: 'gedung-b-offices', label: 'Gedung B', top: '45px', left: '45px', width: '70px', height: '70px', active: true }
            ]
        },
        'scene6': {
            title: 'Gedung A',
            rooms: [
                { id: 'gedung-a-hall', label: 'Gedung A', top: '45px', left: '45px', width: '70px', height: '70px', active: true }
            ]
        }
    },

    update(sceneId) {
        const overlay = document.querySelector('.building-map-overlay');
        const canvas = document.querySelector('.map-canvas');
        const titleEl = document.querySelector('.map-header');
        
        if (!overlay || !canvas) return;

        const layout = this.layouts[sceneId];
        
        if (layout) {
            // Show the map
            overlay.style.display = 'block';
            setTimeout(() => overlay.classList.add('show'), 10);
            
            // Build the layout
            canvas.innerHTML = '';
            
            if (layout.type === 'text-centered') {
                titleEl.textContent = ''; // Hide header for text-only
                const txt = document.createElement('div');
                txt.classList.add('map-text-centered');
                txt.innerHTML = layout.label;
                canvas.appendChild(txt);
            } else {
                titleEl.textContent = layout.title;
                layout.rooms.forEach(room => {
                    const el = document.createElement('div');
                    el.classList.add('map-room');
                    if (room.active) el.classList.add('active');
                    
                    el.style.top = room.top;
                    el.style.left = room.left;
                    el.style.width = room.width;
                    el.style.height = room.height;
                    el.innerHTML = `<span>${room.label}</span>`;
                    
                    canvas.appendChild(el);
                });
            }
        } else {
            // Hide the map for external/unmapped scenes
            overlay.classList.remove('show');
            setTimeout(() => {
                if (!overlay.classList.contains('show')) {
                    overlay.style.display = 'none';
                }
            }, 400);
        }
    }
};

window.BuildingMap = BuildingMap;
