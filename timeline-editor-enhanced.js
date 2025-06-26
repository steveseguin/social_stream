// Enhanced Timeline Animation Editor
class TimelineEditor {
    constructor() {
        this.canvas = document.getElementById('animationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.timelineCanvas = document.getElementById('timelineCanvas');
        this.timelineCtx = this.timelineCanvas.getContext('2d');
        
        // History for undo/redo
        this.history = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Animation state
        this.animation = {
            duration: 5000,
            fps: 60,
            currentTime: 0,
            playing: false,
            loop: true,
            onionSkinning: false,
            onionSkinFrames: 3,
            onionSkinOpacity: 0.2
        };
        
        // Objects and layers
        this.objects = [];
        this.selectedObject = null;
        this.selectedLayer = 0;
        this.layers = [{ name: 'Layer 1', visible: true, locked: false }];
        
        // Selection and editing
        this.selection = {
            objects: [],
            keyframes: [],
            box: null
        };
        
        this.selectedProperty = 'x';
        this.copiedData = null;
        
        // Interaction states
        this.isDragging = false;
        this.isRotating = false;
        this.isScaling = false;
        this.isPanning = false;
        this.isDrawingPath = false;
        this.dragOffset = { x: 0, y: 0 };
        this.canvasOffset = { x: 0, y: 0 };
        this.zoom = 1;
        
        // Path editing
        this.currentPath = [];
        this.pathEditMode = false;
        this.selectedPathPoint = null;
        this.selectedControlPoint = null;
        
        // Grid and snapping
        this.grid = {
            enabled: true,
            size: 20,
            snap: true,
            snapThreshold: 10
        };
        
        this.guides = {
            horizontal: [],
            vertical: [],
            enabled: true,
            snap: true
        };
        
        // Performance
        this.frameSkip = 0;
        this.lastFrameTime = 0;
        this.targetFPS = 60;
        
        // Audio
        this.audio = {
            file: null,
            buffer: null,
            waveform: null,
            duration: 0
        };
        
        // Bezier controls
        this.bezierControl1 = { x: 0.25, y: 0.1 };
        this.bezierControl2 = { x: 0.25, y: 1 };
        
        // Initialize
        this.init();
        this.createDefaultObject();
        this.saveState();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupBezierEditor();
        this.setupLayersPanel();
        this.setupAudioControls();
        this.loadPresets();
        this.animate();
    }
    
    createDefaultObject() {
        const obj = {
            id: this.generateId(),
            name: 'Object 1',
            type: 'rectangle',
            layer: 0,
            properties: {
                x: 200,
                y: 200,
                width: 100,
                height: 100,
                rotation: 0,
                scale: 1,
                scaleX: 1,
                scaleY: 1,
                opacity: 1,
                fillColor: '#4a9eff',
                strokeColor: '#ffffff',
                strokeWidth: 2,
                blur: 0,
                shadowX: 0,
                shadowY: 0,
                shadowBlur: 0,
                shadowColor: '#000000',
                shadowOpacity: 0.5,
                cornerRadius: 0
            },
            keyframes: {},
            visible: true,
            locked: false,
            path: null
        };
        
        // Initialize keyframes for all properties
        Object.keys(obj.properties).forEach(prop => {
            obj.keyframes[prop] = [
                { time: 0, value: obj.properties[prop] },
                { time: this.animation.duration, value: obj.properties[prop] }
            ];
        });
        
        this.objects.push(obj);
        this.selectedObject = obj;
    }
    
    generateId() {
        return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            
            this.canvas.width = rect.width - 40;
            this.canvas.height = rect.height - 240;
            this.canvas.style.left = '20px';
            this.canvas.style.top = '20px';
            
            const timelineWrapper = this.timelineCanvas.parentElement;
            const timelineRect = timelineWrapper.getBoundingClientRect();
            this.timelineCanvas.width = timelineRect.width;
            this.timelineCanvas.height = timelineRect.height;
            
            this.render();
            this.renderTimeline();
        };
        
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
        
        // Enable better canvas rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }
    
    setupKeyboardShortcuts() {
        const shortcuts = {
            'z': { ctrl: true, action: () => this.undo() },
            'y': { ctrl: true, action: () => this.redo() },
            'Z': { ctrl: true, shift: true, action: () => this.redo() },
            'c': { ctrl: true, action: () => this.copy() },
            'v': { ctrl: true, action: () => this.paste() },
            'x': { ctrl: true, action: () => this.cut() },
            'd': { ctrl: true, action: () => this.duplicate() },
            'a': { ctrl: true, action: () => this.selectAll() },
            'Delete': { action: () => this.deleteSelected() },
            'Backspace': { action: () => this.deleteSelected() },
            ' ': { action: () => this.togglePlayback(), preventDefault: true },
            'ArrowLeft': { action: () => this.previousFrame() },
            'ArrowRight': { action: () => this.nextFrame() },
            'ArrowUp': { action: () => this.previousKeyframe() },
            'ArrowDown': { action: () => this.nextKeyframe() },
            'Home': { action: () => this.goToStart() },
            'End': { action: () => this.goToEnd() },
            'g': { action: () => this.toggleGrid() },
            'o': { action: () => this.toggleOnionSkin() },
            's': { ctrl: true, action: () => this.saveAnimation(), preventDefault: true },
            'n': { ctrl: true, action: () => this.newAnimation() },
            'l': { ctrl: true, action: () => this.loadAnimation() },
            'k': { action: () => this.addKeyframe() },
            'r': { action: () => this.setTool('rotate') },
            's': { action: () => this.setTool('scale') },
            'v': { action: () => this.setTool('select') },
            'p': { action: () => this.setTool('pen') },
            '+': { action: () => this.zoomIn() },
            '-': { action: () => this.zoomOut() },
            '0': { action: () => this.resetZoom() }
        };
        
        document.addEventListener('keydown', (e) => {
            const key = e.key;
            const shortcut = shortcuts[key];
            
            if (!shortcut) return;
            
            const ctrlRequired = shortcut.ctrl || false;
            const shiftRequired = shortcut.shift || false;
            
            if (ctrlRequired !== (e.ctrlKey || e.metaKey)) return;
            if (shiftRequired !== e.shiftKey) return;
            
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (shortcut.preventDefault) {
                e.preventDefault();
            }
            
            shortcut.action();
        });
    }
    
    setupLayersPanel() {
        // This would be implemented in the HTML, but here's the structure
        const layersHTML = `
            <div class="layers-panel">
                <div class="layers-header">
                    <h3>Layers</h3>
                    <button onclick="editor.addLayer()">+</button>
                </div>
                <div class="layers-list" id="layersList"></div>
            </div>
        `;
        // Add to sidebar in actual implementation
    }
    
    setupAudioControls() {
        // Audio upload input
        const audioInput = document.createElement('input');
        audioInput.type = 'file';
        audioInput.accept = 'audio/*';
        audioInput.style.display = 'none';
        audioInput.id = 'audioInput';
        
        audioInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadAudioFile(file);
            }
        });
        
        document.body.appendChild(audioInput);
    }
    
    // Undo/Redo System
    saveState() {
        const state = {
            objects: JSON.parse(JSON.stringify(this.objects)),
            layers: JSON.parse(JSON.stringify(this.layers)),
            animation: JSON.parse(JSON.stringify(this.animation))
        };
        
        // Remove states after current index
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // Add new state
        this.history.push(state);
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.updateUndoRedoButtons();
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }
    
    restoreState(state) {
        this.objects = JSON.parse(JSON.stringify(state.objects));
        this.layers = JSON.parse(JSON.stringify(state.layers));
        this.animation = JSON.parse(JSON.stringify(state.animation));
        
        // Restore object references
        if (this.selectedObject) {
            this.selectedObject = this.objects.find(obj => obj.id === this.selectedObject.id);
        }
        
        this.render();
        this.renderTimeline();
        this.updateLayersPanel();
        this.updateUndoRedoButtons();
    }
    
    updateUndoRedoButtons() {
        // Update UI buttons state
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
    
    // Enhanced Rendering with Onion Skinning
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context state
        ctx.save();
        
        // Apply zoom and pan
        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.canvas.width / 2 + this.canvasOffset.x, -this.canvas.height / 2 + this.canvasOffset.y);
        
        // Draw grid
        if (this.grid.enabled) {
            this.drawGrid();
        }
        
        // Draw guides
        if (this.guides.enabled) {
            this.drawGuides();
        }
        
        // Draw onion skin frames
        if (this.animation.onionSkinning && !this.animation.playing) {
            this.drawOnionSkin();
        }
        
        // Draw objects by layer
        this.layers.forEach((layer, layerIndex) => {
            if (!layer.visible) return;
            
            const layerObjects = this.objects.filter(obj => obj.layer === layerIndex && obj.visible);
            
            layerObjects.forEach(obj => {
                this.drawObject(obj, this.animation.currentTime);
            });
        });
        
        // Draw selection
        if (this.selection.box) {
            this.drawSelectionBox();
        }
        
        // Draw selected object handles
        if (this.selectedObject && !this.selectedObject.locked) {
            this.drawObjectHandles(this.selectedObject);
        }
        
        // Draw path editing handles
        if (this.pathEditMode && this.selectedObject && this.selectedObject.path) {
            this.drawPathHandles(this.selectedObject.path);
        }
        
        // Restore context
        ctx.restore();
        
        // Draw UI overlays (not affected by zoom/pan)
        this.drawStats();
    }
    
    drawOnionSkin() {
        const frameInterval = 1000 / this.animation.fps;
        
        for (let i = 1; i <= this.animation.onionSkinFrames; i++) {
            // Previous frames
            const prevTime = this.animation.currentTime - (i * frameInterval);
            if (prevTime >= 0) {
                this.ctx.save();
                this.ctx.globalAlpha = this.animation.onionSkinOpacity * (1 - i / (this.animation.onionSkinFrames + 1));
                this.ctx.fillStyle = '#ff0000';
                
                this.objects.forEach(obj => {
                    if (obj.visible) {
                        this.drawObject(obj, prevTime, true);
                    }
                });
                
                this.ctx.restore();
            }
            
            // Future frames
            const nextTime = this.animation.currentTime + (i * frameInterval);
            if (nextTime <= this.animation.duration) {
                this.ctx.save();
                this.ctx.globalAlpha = this.animation.onionSkinOpacity * (1 - i / (this.animation.onionSkinFrames + 1));
                this.ctx.fillStyle = '#0000ff';
                
                this.objects.forEach(obj => {
                    if (obj.visible) {
                        this.drawObject(obj, nextTime, true);
                    }
                });
                
                this.ctx.restore();
            }
        }
    }
    
    drawObject(obj, time, isOnionSkin = false) {
        const props = this.getInterpolatedProperties(obj, time);
        
        this.ctx.save();
        
        // Apply transformations
        this.ctx.translate(props.x, props.y);
        this.ctx.rotate(props.rotation * Math.PI / 180);
        this.ctx.scale(props.scaleX * props.scale, props.scaleY * props.scale);
        this.ctx.globalAlpha = props.opacity;
        
        // Apply effects
        if (props.blur > 0) {
            this.ctx.filter = `blur(${props.blur}px)`;
        }
        
        // Shadow
        if (props.shadowBlur > 0 || props.shadowX !== 0 || props.shadowY !== 0) {
            this.ctx.shadowColor = this.hexToRgba(props.shadowColor, props.shadowOpacity);
            this.ctx.shadowBlur = props.shadowBlur;
            this.ctx.shadowOffsetX = props.shadowX;
            this.ctx.shadowOffsetY = props.shadowY;
        }
        
        // Set styles
        if (!isOnionSkin) {
            this.ctx.fillStyle = props.fillColor;
            this.ctx.strokeStyle = props.strokeColor;
        }
        this.ctx.lineWidth = props.strokeWidth;
        
        // Draw shape
        switch (obj.type) {
            case 'rectangle':
                if (props.cornerRadius > 0) {
                    this.drawRoundedRect(-props.width/2, -props.height/2, props.width, props.height, props.cornerRadius);
                } else {
                    this.ctx.fillRect(-props.width/2, -props.height/2, props.width, props.height);
                    if (props.strokeWidth > 0) {
                        this.ctx.strokeRect(-props.width/2, -props.height/2, props.width, props.height);
                    }
                }
                break;
                
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc(0, 0, props.width/2, 0, Math.PI * 2);
                this.ctx.fill();
                if (props.strokeWidth > 0) this.ctx.stroke();
                break;
                
            case 'triangle':
                this.ctx.beginPath();
                this.ctx.moveTo(0, -props.height/2);
                this.ctx.lineTo(-props.width/2, props.height/2);
                this.ctx.lineTo(props.width/2, props.height/2);
                this.ctx.closePath();
                this.ctx.fill();
                if (props.strokeWidth > 0) this.ctx.stroke();
                break;
                
            case 'star':
                this.drawStar(0, 0, 5, props.width/2, props.width/4);
                this.ctx.fill();
                if (props.strokeWidth > 0) this.ctx.stroke();
                break;
                
            case 'path':
                if (obj.path && obj.path.length > 0) {
                    this.drawPath(obj.path);
                    if (!obj.path.closed) {
                        if (props.strokeWidth > 0) this.ctx.stroke();
                    } else {
                        this.ctx.fill();
                        if (props.strokeWidth > 0) this.ctx.stroke();
                    }
                }
                break;
                
            case 'text':
                this.ctx.font = `${props.fontSize || 24}px ${props.fontFamily || 'Arial'}`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(obj.text || 'Text', 0, 0);
                if (props.strokeWidth > 0) {
                    this.ctx.strokeText(obj.text || 'Text', 0, 0);
                }
                break;
        }
        
        this.ctx.restore();
    }
    
    drawRoundedRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
        if (this.ctx.lineWidth > 0) this.ctx.stroke();
    }
    
    drawPath(path) {
        if (path.length === 0) return;
        
        this.ctx.beginPath();
        
        path.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                if (point.type === 'bezier') {
                    this.ctx.bezierCurveTo(
                        point.cp1x, point.cp1y,
                        point.cp2x, point.cp2y,
                        point.x, point.y
                    );
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            }
        });
        
        if (path.closed) {
            this.ctx.closePath();
        }
    }
    
    drawObjectHandles(obj) {
        const props = this.getInterpolatedProperties(obj, this.animation.currentTime);
        
        this.ctx.save();
        this.ctx.translate(props.x, props.y);
        this.ctx.rotate(props.rotation * Math.PI / 180);
        this.ctx.scale(props.scaleX * props.scale, props.scaleY * props.scale);
        
        // Bounding box
        this.ctx.strokeStyle = '#4a9eff';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(-props.width/2, -props.height/2, props.width, props.height);
        this.ctx.setLineDash([]);
        
        // Handles
        const handleSize = 8 / this.zoom;
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#4a9eff';
        this.ctx.lineWidth = 2 / this.zoom;
        
        // Corner handles for scaling
        const handles = [
            { x: -props.width/2, y: -props.height/2 }, // top-left
            { x: props.width/2, y: -props.height/2 },  // top-right
            { x: props.width/2, y: props.height/2 },   // bottom-right
            { x: -props.width/2, y: props.height/2 }   // bottom-left
        ];
        
        handles.forEach(handle => {
            this.ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
            this.ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
        });
        
        // Rotation handle
        this.ctx.beginPath();
        this.ctx.moveTo(0, -props.height/2);
        this.ctx.lineTo(0, -props.height/2 - 30 / this.zoom);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(0, -props.height/2 - 30 / this.zoom, handleSize/2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    drawPathHandles(path) {
        const handleSize = 6 / this.zoom;
        
        path.forEach((point, index) => {
            // Draw point
            this.ctx.fillStyle = this.selectedPathPoint === index ? '#ff6b6b' : '#4a9eff';
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2 / this.zoom;
            
            this.ctx.beginPath();
            this.ctx.arc(point.x, point.y, handleSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw bezier control points
            if (point.type === 'bezier') {
                // Control point 1
                this.ctx.strokeStyle = '#4a9eff';
                this.ctx.beginPath();
                this.ctx.moveTo(point.x, point.y);
                this.ctx.lineTo(point.cp1x, point.cp1y);
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#fff';
                this.ctx.beginPath();
                this.ctx.arc(point.cp1x, point.cp1y, handleSize * 0.8, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                
                // Control point 2
                if (index > 0) {
                    const prevPoint = path[index - 1];
                    this.ctx.beginPath();
                    this.ctx.moveTo(prevPoint.x, prevPoint.y);
                    this.ctx.lineTo(point.cp2x, point.cp2y);
                    this.ctx.stroke();
                    
                    this.ctx.beginPath();
                    this.ctx.arc(point.cp2x, point.cp2y, handleSize * 0.8, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.stroke();
                }
            }
        });
    }
    
    drawStats() {
        const stats = [
            `FPS: ${Math.round(1000 / (Date.now() - this.lastFrameTime))}`,
            `Objects: ${this.objects.length}`,
            `Time: ${this.formatTime(this.animation.currentTime)}`,
            `Zoom: ${Math.round(this.zoom * 100)}%`
        ];
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 150, stats.length * 20 + 10);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px monospace';
        stats.forEach((stat, i) => {
            this.ctx.fillText(stat, 15, 25 + i * 20);
        });
    }
    
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1 / this.zoom;
        
        const size = this.grid.size;
        const startX = Math.floor(-this.canvas.width / 2 / this.zoom - this.canvasOffset.x / this.zoom / size) * size;
        const endX = Math.ceil(this.canvas.width / 2 / this.zoom - this.canvasOffset.x / this.zoom / size) * size;
        const startY = Math.floor(-this.canvas.height / 2 / this.zoom - this.canvasOffset.y / this.zoom / size) * size;
        const endY = Math.ceil(this.canvas.height / 2 / this.zoom - this.canvasOffset.y / this.zoom / size) * size;
        
        for (let x = startX; x <= endX; x += size) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y += size) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
        
        // Draw axes
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2 / this.zoom;
        
        // X axis
        this.ctx.beginPath();
        this.ctx.moveTo(startX, 0);
        this.ctx.lineTo(endX, 0);
        this.ctx.stroke();
        
        // Y axis
        this.ctx.beginPath();
        this.ctx.moveTo(0, startY);
        this.ctx.lineTo(0, endY);
        this.ctx.stroke();
    }
    
    drawGuides() {
        this.ctx.strokeStyle = '#4a9eff';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5, 5]);
        
        // Horizontal guides
        this.guides.horizontal.forEach(y => {
            this.ctx.beginPath();
            this.ctx.moveTo(-this.canvas.width / 2 / this.zoom, y);
            this.ctx.lineTo(this.canvas.width / 2 / this.zoom, y);
            this.ctx.stroke();
        });
        
        // Vertical guides
        this.guides.vertical.forEach(x => {
            this.ctx.beginPath();
            this.ctx.moveTo(x, -this.canvas.height / 2 / this.zoom);
            this.ctx.lineTo(x, this.canvas.height / 2 / this.zoom);
            this.ctx.stroke();
        });
        
        this.ctx.setLineDash([]);
    }
    
    // Enhanced Timeline with Multiple Properties
    renderTimeline() {
        const ctx = this.timelineCtx;
        const width = this.timelineCanvas.width;
        const height = this.timelineCanvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // Draw audio waveform if loaded
        if (this.audio.waveform) {
            this.drawAudioWaveform(ctx, width, height);
        }
        
        // Time markers
        this.drawTimeMarkers(ctx, width, height);
        
        // Draw property tracks
        if (this.selectedObject) {
            const trackHeight = 30;
            let y = 40;
            
            // Draw all property tracks
            const properties = this.selectedProperty === 'all' 
                ? Object.keys(this.selectedObject.keyframes)
                : [this.selectedProperty];
                
            properties.forEach(prop => {
                this.drawPropertyTrack(ctx, prop, y, width, trackHeight);
                y += trackHeight + 5;
            });
        }
        
        // Current time indicator
        const currentX = (this.animation.currentTime * this.pixelsPerMs);
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX, height);
        ctx.stroke();
        
        // Draw playhead handle
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(currentX - 6, 0);
        ctx.lineTo(currentX + 6, 0);
        ctx.lineTo(currentX, 10);
        ctx.closePath();
        ctx.fill();
    }
    
    drawPropertyTrack(ctx, property, y, width, height) {
        const keyframes = this.selectedObject.keyframes[property] || [];
        
        // Track background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(0, y, width, height);
        
        // Property label
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.fillText(property, 5, y + height/2 + 4);
        
        // Draw curve
        if (keyframes.length >= 2) {
            ctx.strokeStyle = this.getPropertyColor(property);
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            for (let t = 0; t <= this.animation.duration; t += 20) {
                const value = this.interpolateValue(keyframes, t);
                const x = t * this.pixelsPerMs;
                const normalizedValue = this.normalizeValue(value, property);
                const curveY = y + height - (normalizedValue * (height - 4)) - 2;
                
                if (t === 0) {
                    ctx.moveTo(x, curveY);
                } else {
                    ctx.lineTo(x, curveY);
                }
            }
            ctx.stroke();
        }
        
        // Draw keyframes
        keyframes.forEach(kf => {
            const x = kf.time * this.pixelsPerMs;
            const isSelected = this.selection.keyframes.includes(kf);
            
            ctx.fillStyle = isSelected ? '#ff6b6b' : this.getPropertyColor(property);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            
            ctx.save();
            ctx.translate(x, y + height/2);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-5, -5, 10, 10);
            ctx.strokeRect(-5, -5, 10, 10);
            ctx.restore();
        });
    }
    
    drawAudioWaveform(ctx, width, height) {
        if (!this.audio.waveform) return;
        
        ctx.fillStyle = 'rgba(74, 158, 255, 0.2)';
        ctx.strokeStyle = 'rgba(74, 158, 255, 0.5)';
        ctx.lineWidth = 1;
        
        const waveHeight = 40;
        const waveY = height - waveHeight - 10;
        const samplesPerPixel = Math.floor(this.audio.waveform.length / width);
        
        ctx.beginPath();
        ctx.moveTo(0, waveY);
        
        for (let x = 0; x < width; x++) {
            const sampleIndex = x * samplesPerPixel;
            const sample = this.audio.waveform[sampleIndex] || 0;
            const y = waveY - (sample * waveHeight / 2);
            ctx.lineTo(x, y);
        }
        
        ctx.lineTo(width, waveY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    drawTimeMarkers(ctx, width, height) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        
        const step = 1000; // 1 second intervals
        for (let time = 0; time <= this.animation.duration; time += step) {
            const x = time * this.pixelsPerMs;
            
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            ctx.fillText(`${time / 1000}s`, x + 4, 12);
        }
    }
    
    getPropertyColor(property) {
        const colors = {
            x: '#ff6b6b',
            y: '#4ecdc4',
            rotation: '#ffe66d',
            scale: '#a8e6cf',
            scaleX: '#a8e6cf',
            scaleY: '#a8e6cf',
            opacity: '#ff8b94',
            fillColor: '#b4a7d6',
            strokeColor: '#d7aefb',
            blur: '#95e1d3',
            shadowX: '#f38181',
            shadowY: '#f38181',
            shadowBlur: '#f38181'
        };
        
        return colors[property] || '#4a9eff';
    }
    
    // Interpolation with Color Support
    interpolateValue(keyframes, time) {
        if (keyframes.length === 0) return 0;
        if (keyframes.length === 1) return keyframes[0].value;
        
        // Find surrounding keyframes
        let kf1 = keyframes[0];
        let kf2 = keyframes[keyframes.length - 1];
        
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
                kf1 = keyframes[i];
                kf2 = keyframes[i + 1];
                break;
            }
        }
        
        if (time <= kf1.time) return kf1.value;
        if (time >= kf2.time) return kf2.value;
        
        const t = (time - kf1.time) / (kf2.time - kf1.time);
        const easedT = this.applyEasing(t, kf1.easing || 'linear');
        
        // Check if values are colors
        if (typeof kf1.value === 'string' && kf1.value.startsWith('#')) {
            return this.interpolateColor(kf1.value, kf2.value, easedT);
        }
        
        return kf1.value + (kf2.value - kf1.value) * easedT;
    }
    
    interpolateColor(color1, color2, t) {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);
        
        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);
        
        return this.rgbToHex(r, g, b);
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    hexToRgba(hex, alpha) {
        const rgb = this.hexToRgb(hex);
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
    
    getInterpolatedProperties(obj, time) {
        const props = {};
        
        Object.keys(obj.properties).forEach(prop => {
            const keyframes = obj.keyframes[prop] || [];
            if (keyframes.length > 0) {
                props[prop] = this.interpolateValue(keyframes, time);
            } else {
                props[prop] = obj.properties[prop];
            }
        });
        
        return props;
    }
    
    // Advanced Event Handling
    setupEventListeners() {
        // Canvas mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleCanvasDoubleClick(e));
        
        // Timeline events
        this.timelineCanvas.addEventListener('mousedown', (e) => this.handleTimelineMouseDown(e));
        this.timelineCanvas.addEventListener('mousemove', (e) => this.handleTimelineMouseMove(e));
        this.timelineCanvas.addEventListener('mouseup', (e) => this.handleTimelineMouseUp(e));
        this.timelineCanvas.addEventListener('contextmenu', (e) => this.handleTimelineRightClick(e));
        
        // Touch support
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // Property controls
        this.setupPropertyControls();
        
        // Prevent context menu on canvas
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    handleCanvasMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.canvas.width/2) / this.zoom + this.canvas.width/2 - this.canvasOffset.x;
        const y = (e.clientY - rect.top - this.canvas.height/2) / this.zoom + this.canvas.height/2 - this.canvasOffset.y;
        
        // Check for handle interactions
        if (this.selectedObject && !this.selectedObject.locked) {
            const handle = this.getHandleAtPoint(x, y);
            if (handle) {
                this.startHandleInteraction(handle, x, y);
                return;
            }
        }
        
        // Check for path point interactions
        if (this.pathEditMode && this.selectedObject && this.selectedObject.path) {
            const pathPoint = this.getPathPointAtPoint(x, y);
            if (pathPoint !== null) {
                this.selectedPathPoint = pathPoint.index;
                this.selectedControlPoint = pathPoint.control;
                this.isDragging = true;
                this.dragOffset = { x: x - pathPoint.x, y: y - pathPoint.y };
                return;
            }
        }
        
        // Check for object selection
        const clickedObject = this.getObjectAtPoint(x, y);
        
        if (clickedObject) {
            if (e.shiftKey) {
                // Multi-select
                this.toggleObjectSelection(clickedObject);
            } else {
                this.selectObject(clickedObject);
            }
            
            this.isDragging = true;
            this.dragOffset = {
                x: x - clickedObject.properties.x,
                y: y - clickedObject.properties.y
            };
        } else {
            // Start selection box or pan
            if (e.shiftKey || e.altKey) {
                this.isPanning = true;
                this.lastMousePos = { x: e.clientX, y: e.clientY };
            } else {
                this.startSelectionBox(x, y);
            }
        }
    }
    
    handleCanvasWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(10, this.zoom * delta));
        
        // Zoom towards mouse position
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldX = (mouseX - this.canvas.width/2) / this.zoom + this.canvas.width/2 - this.canvasOffset.x;
        const worldY = (mouseY - this.canvas.height/2) / this.zoom + this.canvas.height/2 - this.canvasOffset.y;
        
        this.zoom = newZoom;
        
        const newWorldX = (mouseX - this.canvas.width/2) / this.zoom + this.canvas.width/2 - this.canvasOffset.x;
        const newWorldY = (mouseY - this.canvas.height/2) / this.zoom + this.canvas.height/2 - this.canvasOffset.y;
        
        this.canvasOffset.x += newWorldX - worldX;
        this.canvasOffset.y += newWorldY - worldY;
        
        this.render();
    }
    
    // Snapping
    snapToGrid(value) {
        if (!this.grid.snap) return value;
        return Math.round(value / this.grid.size) * this.grid.size;
    }
    
    snapToGuides(x, y) {
        if (!this.guides.snap) return { x, y };
        
        let snappedX = x;
        let snappedY = y;
        
        // Snap to vertical guides
        this.guides.vertical.forEach(guideX => {
            if (Math.abs(x - guideX) < this.grid.snapThreshold) {
                snappedX = guideX;
            }
        });
        
        // Snap to horizontal guides
        this.guides.horizontal.forEach(guideY => {
            if (Math.abs(y - guideY) < this.grid.snapThreshold) {
                snappedY = guideY;
            }
        });
        
        return { x: snappedX, y: snappedY };
    }
    
    // Animation Playback
    animate() {
        const now = Date.now();
        const deltaTime = now - this.lastFrameTime;
        
        if (this.animation.playing) {
            this.animation.currentTime += deltaTime;
            
            if (this.animation.currentTime >= this.animation.duration) {
                if (this.animation.loop) {
                    this.animation.currentTime = 0;
                } else {
                    this.animation.playing = false;
                    this.animation.currentTime = this.animation.duration;
                }
            }
            
            this.updateTime();
            this.render();
            this.renderTimeline();
        }
        
        this.lastFrameTime = now;
        requestAnimationFrame(() => this.animate());
    }
    
    // Export with Enhanced Options
    exportAnimation() {
        const dialog = document.createElement('div');
        dialog.className = 'export-dialog-enhanced';
        dialog.innerHTML = `
            <h2>Export Animation</h2>
            <div class="export-options">
                <label>
                    <input type="radio" name="exportFormat" value="css" checked>
                    CSS Animation
                </label>
                <label>
                    <input type="radio" name="exportFormat" value="js">
                    JavaScript (Web Animations API)
                </label>
                <label>
                    <input type="radio" name="exportFormat" value="json">
                    JSON Data
                </label>
                <label>
                    <input type="radio" name="exportFormat" value="svg">
                    SVG Animation
                </label>
                <label>
                    <input type="radio" name="exportFormat" value="gif">
                    GIF (Experimental)
                </label>
            </div>
            <div class="export-code" id="exportCode"></div>
            <div class="dialog-buttons">
                <button onclick="editor.copyExportCode()">Copy</button>
                <button onclick="editor.downloadExport()">Download</button>
                <button onclick="editor.closeExportDialog()">Close</button>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Generate initial export
        this.updateExportCode();
        
        // Update on format change
        dialog.querySelectorAll('input[name="exportFormat"]').forEach(input => {
            input.addEventListener('change', () => this.updateExportCode());
        });
    }
    
    updateExportCode() {
        const format = document.querySelector('input[name="exportFormat"]:checked').value;
        let code = '';
        
        switch (format) {
            case 'css':
                code = this.generateCSSAnimation();
                break;
            case 'js':
                code = this.generateJSAnimation();
                break;
            case 'json':
                code = this.generateJSONExport();
                break;
            case 'svg':
                code = this.generateSVGAnimation();
                break;
            case 'gif':
                code = 'GIF export coming soon...';
                break;
        }
        
        document.getElementById('exportCode').textContent = code;
    }
    
    // Preset Management
    loadPresets() {
        this.presets = {
            'bounceIn': {
                keyframes: {
                    scale: [
                        { time: 0, value: 0, easing: 'ease-out' },
                        { time: 600, value: 1.2, easing: 'ease-in' },
                        { time: 800, value: 0.9, easing: 'ease-out' },
                        { time: 1000, value: 1 }
                    ],
                    opacity: [
                        { time: 0, value: 0 },
                        { time: 200, value: 1 }
                    ]
                }
            },
            'slideInLeft': {
                keyframes: {
                    x: [
                        { time: 0, value: -300, easing: 'ease-out' },
                        { time: 1000, value: 200 }
                    ]
                }
            },
            'fadeInUp': {
                keyframes: {
                    y: [
                        { time: 0, value: 250, easing: 'ease-out' },
                        { time: 1000, value: 200 }
                    ],
                    opacity: [
                        { time: 0, value: 0, easing: 'ease' },
                        { time: 1000, value: 1 }
                    ]
                }
            },
            'rotateIn': {
                keyframes: {
                    rotation: [
                        { time: 0, value: -180, easing: 'ease-out' },
                        { time: 1000, value: 0 }
                    ],
                    scale: [
                        { time: 0, value: 0, easing: 'ease-out' },
                        { time: 1000, value: 1 }
                    ]
                }
            },
            'elastic': {
                keyframes: {
                    scale: [
                        { time: 0, value: 0 },
                        { time: 200, value: 1.1 },
                        { time: 400, value: 0.9 },
                        { time: 600, value: 1.05 },
                        { time: 800, value: 0.98 },
                        { time: 1000, value: 1 }
                    ]
                }
            },
            'heartbeat': {
                keyframes: {
                    scale: [
                        { time: 0, value: 1 },
                        { time: 140, value: 1.3, easing: 'ease-out' },
                        { time: 280, value: 1, easing: 'ease-in' },
                        { time: 420, value: 1.3, easing: 'ease-out' },
                        { time: 560, value: 1, easing: 'ease-in' },
                        { time: 1000, value: 1 }
                    ]
                }
            }
        };
    }
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset || !this.selectedObject) return;
        
        // Apply preset keyframes to selected object
        Object.keys(preset.keyframes).forEach(prop => {
            this.selectedObject.keyframes[prop] = JSON.parse(JSON.stringify(preset.keyframes[prop]));
        });
        
        this.saveState();
        this.render();
        this.renderTimeline();
    }
    
    // Audio Integration
    loadAudioFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioContext.decodeAudioData(e.target.result, (buffer) => {
                this.audio.buffer = buffer;
                this.audio.duration = buffer.duration * 1000; // Convert to ms
                this.generateWaveform(buffer);
                this.animation.duration = Math.max(this.animation.duration, this.audio.duration);
                this.renderTimeline();
            });
        };
        reader.readAsArrayBuffer(file);
    }
    
    generateWaveform(buffer) {
        const samples = 1000;
        const blockSize = Math.floor(buffer.length / samples);
        const waveform = new Float32Array(samples);
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            
            for (let i = 0; i < samples; i++) {
                let sum = 0;
                for (let j = 0; j < blockSize; j++) {
                    const index = i * blockSize + j;
                    if (index < channelData.length) {
                        sum += Math.abs(channelData[index]);
                    }
                }
                waveform[i] += sum / blockSize;
            }
        }
        
        // Normalize
        const max = Math.max(...waveform);
        for (let i = 0; i < samples; i++) {
            waveform[i] = waveform[i] / max;
        }
        
        this.audio.waveform = waveform;
    }
    
    // Helper Methods
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const centiseconds = Math.floor((ms % 1000) / 10);
        
        return `${minutes}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
    
    normalizeValue(value, property) {
        const ranges = {
            x: [0, this.canvas.width],
            y: [0, this.canvas.height],
            rotation: [-180, 180],
            scale: [0, 3],
            scaleX: [0, 3],
            scaleY: [0, 3],
            opacity: [0, 1],
            blur: [0, 50],
            shadowX: [-50, 50],
            shadowY: [-50, 50],
            shadowBlur: [0, 50],
            shadowOpacity: [0, 1],
            strokeWidth: [0, 20],
            cornerRadius: [0, 50]
        };
        
        const range = ranges[property] || [0, 1];
        return (value - range[0]) / (range[1] - range[0]);
    }
    
    // Additional UI Methods
    toggleGrid() {
        this.grid.enabled = !this.grid.enabled;
        this.render();
    }
    
    toggleOnionSkin() {
        this.animation.onionSkinning = !this.animation.onionSkinning;
        this.render();
    }
    
    togglePlayback() {
        this.animation.playing = !this.animation.playing;
        
        const playButton = document.querySelector('.play-button svg');
        if (this.animation.playing) {
            playButton.innerHTML = '<rect x="5" y="4" width="3" height="8"/><rect x="10" y="4" width="3" height="8"/>';
        } else {
            playButton.innerHTML = '<path d="M3 2l10 6-10 6V2z"/>';
        }
    }
    
    addKeyframe() {
        if (!this.selectedObject) return;
        
        const time = this.animation.currentTime;
        const value = this.selectedObject.properties[this.selectedProperty];
        
        this.setKeyframe(this.selectedObject, this.selectedProperty, time, value);
        this.saveState();
        this.renderTimeline();
    }
    
    setKeyframe(obj, property, time, value, easing = 'linear') {
        if (!obj.keyframes[property]) {
            obj.keyframes[property] = [];
        }
        
        const keyframes = obj.keyframes[property];
        const existing = keyframes.find(kf => Math.abs(kf.time - time) < 1);
        
        if (existing) {
            existing.value = value;
            existing.easing = easing;
        } else {
            keyframes.push({ time, value, easing });
            keyframes.sort((a, b) => a.time - b.time);
        }
    }
    
    // Tool Methods
    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        // Update cursor
        switch (tool) {
            case 'select':
                this.canvas.style.cursor = 'default';
                break;
            case 'rotate':
                this.canvas.style.cursor = 'grab';
                break;
            case 'scale':
                this.canvas.style.cursor = 'nwse-resize';
                break;
            case 'pen':
                this.canvas.style.cursor = 'crosshair';
                break;
        }
    }
}

// Initialize with enhanced features
const editor = new TimelineEditor();