const BuildingMap = {
    // Layout definitions for each building
    layouts: {
        'scene3': {
            type: 'text-centered',
            label: 'RUANG<br>LAYANAN'
        },
        'scene5': {
            type: 'text-centered',
            label: '' // Blank for now
        },
        'scene6': {
            type: 'text-centered',
            label: 'GEDUNG<br>A'
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
                titleEl.style.display = 'none'; // Completely hide header
                const txt = document.createElement('div');
                txt.classList.add('map-text-centered');
                txt.innerHTML = layout.label;
                canvas.appendChild(txt);
            } else {
                titleEl.style.display = 'block';
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
