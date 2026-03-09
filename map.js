const BuildingMap = {
    // Layout definitions for each building
    layouts: {
        'scene3': {
            title: 'Ruang Layanan',
            rooms: [
                { id: 'layanan-node', label: 'Ruang Layanan', top: '45px', left: '45px', width: '110px', height: '50px', active: true }
            ]
        },
        'scene5': {
            title: 'Layout Gedung B',
            rooms: [
                { id: 'gedung-b-offices', label: 'Offices B', top: '20px', left: '20px', width: '160px', height: '100px', active: true }
            ]
        },
        'scene6': {
            title: 'Layout Gedung A',
            rooms: [
                { id: 'gedung-a-hall', label: 'Hall A', top: '15px', left: '20px', width: '160px', height: '110px', active: true }
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
            titleEl.textContent = layout.title;
            canvas.innerHTML = '';
            
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
