// Timeline Animation Editor
class TimelineEditor {
    constructor() {
        this.canvas = document.getElementById('animationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.timelineCanvas = document.getElementById('timelineCanvas');
        this.timelineCtx = this.timelineCanvas.getContext('2d');
        
        this.animation = {
            duration: 5000, // 5 seconds
            keyframes: {},
            currentTime: 0,
            playing: false,
            loop: true
        };
        
        this.selectedProperty = 'x';
        this.selectedKeyframe = null;
        this.copiedKeyframe = null;
        
        this.object = {
            x: 200,
            y: 200,
            width: 100,
            height: 100,
            rotation: 0,
            scale: 1,
            opacity: 1,
            fillColor: '#4a9eff',
            strokeColor: '#ffffff',
            strokeWidth: 2,
            shape: 'rectangle' // rectangle, circle, triangle, star
        };
        
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.timelineOffset = 0;
        this.pixelsPerMs = 0.1;
        
        this.bezierControl1 = { x: 0.25, y: 0.1 };
        this.bezierControl2 = { x: 0.25, y: 1 };
        
        this.init();
        this.loadSampleAnimations();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupBezierEditor();
        this.initializeAnimation();
        this.animate();
    }
    
    setupCanvas() {
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            const rect = container.getBoundingClientRect();
            
            // Main canvas
            this.canvas.width = rect.width - 40;
            this.canvas.height = rect.height - 240;
            this.canvas.style.left = '20px';
            this.canvas.style.top = '20px';
            
            // Timeline canvas
            const timelineWrapper = this.timelineCanvas.parentElement;
            const timelineRect = timelineWrapper.getBoundingClientRect();
            this.timelineCanvas.width = timelineRect.width;
            this.timelineCanvas.height = timelineRect.height;
            
            this.render();
            this.renderTimeline();
        };
        
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    }
    
    setupEventListeners() {
        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleCanvasMouseUp());
        
        // Timeline interactions
        this.timelineCanvas.addEventListener('mousedown', (e) => this.handleTimelineClick(e));
        this.timelineCanvas.addEventListener('contextmenu', (e) => this.handleTimelineRightClick(e));
        
        // Property controls
        document.getElementById('fillColor').addEventListener('input', (e) => {
            this.object.fillColor = e.target.value;
            document.getElementById('fillColorText').value = e.target.value;
            this.render();
        });
        
        document.getElementById('strokeColor').addEventListener('input', (e) => {
            this.object.strokeColor = e.target.value;
            document.getElementById('strokeColorText').value = e.target.value;
            this.render();
        });
        
        document.getElementById('strokeWidth').addEventListener('input', (e) => {
            this.object.strokeWidth = parseFloat(e.target.value);
            e.target.nextElementSibling.textContent = e.target.value;
            this.render();
        });
        
        document.getElementById('opacity').addEventListener('input', (e) => {
            this.object.opacity = parseFloat(e.target.value) / 100;
            e.target.nextElementSibling.textContent = e.target.value + '%';
            this.render();
        });
        
        document.getElementById('animationType').addEventListener('change', (e) => {
            const bezierControls = document.getElementById('bezierControls');
            bezierControls.style.display = e.target.value === 'cubic-bezier' ? 'block' : 'none';
        });
        
        document.getElementById('propertySelect').addEventListener('change', (e) => {
            this.selectedProperty = e.target.value;
            this.renderTimeline();
        });
        
        // Hide context menu on click outside
        document.addEventListener('click', () => {
            document.getElementById('contextMenu').style.display = 'none';
        });
    }
    
    setupBezierEditor() {
        const canvas = document.getElementById('bezierEditor');
        const ctx = canvas.getContext('2d');
        let isDragging = false;
        let dragPoint = null;
        
        const render = () => {
            ctx.clearRect(0, 0, 200, 200);
            
            // Grid
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i <= 4; i++) {
                const pos = i * 50;
                ctx.moveTo(pos, 0);
                ctx.lineTo(pos, 200);
                ctx.moveTo(0, pos);
                ctx.lineTo(200, pos);
            }
            ctx.stroke();
            
            // Bezier curve
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 200);
            
            for (let t = 0; t <= 1; t += 0.01) {
                const x = this.cubicBezier(t, 0, this.bezierControl1.x, this.bezierControl2.x, 1) * 200;
                const y = 200 - this.cubicBezier(t, 0, this.bezierControl1.y, this.bezierControl2.y, 1) * 200;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            
            // Control points
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            
            // Lines to control points
            ctx.beginPath();
            ctx.moveTo(0, 200);
            ctx.lineTo(this.bezierControl1.x * 200, 200 - this.bezierControl1.y * 200);
            ctx.moveTo(200, 0);
            ctx.lineTo(this.bezierControl2.x * 200, 200 - this.bezierControl2.y * 200);
            ctx.stroke();
            
            // Control point handles
            ctx.beginPath();
            ctx.arc(this.bezierControl1.x * 200, 200 - this.bezierControl1.y * 200, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(this.bezierControl2.x * 200, 200 - this.bezierControl2.y * 200, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        };
        
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / 200;
            const y = 1 - (e.clientY - rect.top) / 200;
            
            const dist1 = Math.sqrt(Math.pow(x - this.bezierControl1.x, 2) + Math.pow(y - this.bezierControl1.y, 2));
            const dist2 = Math.sqrt(Math.pow(x - this.bezierControl2.x, 2) + Math.pow(y - this.bezierControl2.y, 2));
            
            if (dist1 < 0.05) {
                isDragging = true;
                dragPoint = 1;
            } else if (dist2 < 0.05) {
                isDragging = true;
                dragPoint = 2;
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / 200));
            const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / 200));
            
            if (dragPoint === 1) {
                this.bezierControl1 = { x, y };
            } else {
                this.bezierControl2 = { x, y };
            }
            
            render();
        });
        
        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            dragPoint = null;
        });
        
        render();
    }
    
    initializeAnimation() {
        // Initialize with some default keyframes
        this.animation.keyframes = {
            x: [
                { time: 0, value: 200 },
                { time: 2500, value: 500 },
                { time: 5000, value: 200 }
            ],
            y: [
                { time: 0, value: 200 },
                { time: 5000, value: 200 }
            ],
            rotation: [
                { time: 0, value: 0 },
                { time: 5000, value: 0 }
            ],
            scale: [
                { time: 0, value: 1 },
                { time: 5000, value: 1 }
            ],
            opacity: [
                { time: 0, value: 1 },
                { time: 5000, value: 1 }
            ]
        };
    }
    
    handleCanvasMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on object
        const objBounds = this.getObjectBounds();
        if (x >= objBounds.x - objBounds.width/2 && x <= objBounds.x + objBounds.width/2 &&
            y >= objBounds.y - objBounds.height/2 && y <= objBounds.y + objBounds.height/2) {
            this.isDragging = true;
            this.dragOffset = {
                x: x - this.object.x,
                y: y - this.object.y
            };
        }
    }
    
    handleCanvasMouseMove(e) {
        if (!this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.object.x = x - this.dragOffset.x;
        this.object.y = y - this.dragOffset.y;
        
        // Update or create keyframe at current time
        this.setKeyframe('x', this.animation.currentTime, this.object.x);
        this.setKeyframe('y', this.animation.currentTime, this.object.y);
        
        this.render();
        this.renderTimeline();
    }
    
    handleCanvasMouseUp() {
        this.isDragging = false;
    }
    
    handleTimelineClick(e) {
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if clicking on a keyframe
        const keyframes = this.animation.keyframes[this.selectedProperty] || [];
        for (const kf of keyframes) {
            const kfX = (kf.time * this.pixelsPerMs) - this.timelineOffset;
            const kfY = this.timelineCanvas.height / 2;
            
            if (Math.abs(x - kfX) < 10 && Math.abs(y - kfY) < 10) {
                this.selectedKeyframe = kf;
                this.renderTimeline();
                return;
            }
        }
        
        // Otherwise, scrub timeline
        const time = Math.max(0, Math.min(this.animation.duration, (x + this.timelineOffset) / this.pixelsPerMs));
        this.animation.currentTime = time;
        this.updateTime();
        this.updateObjectFromAnimation();
        this.render();
        this.renderTimeline();
    }
    
    handleTimelineRightClick(e) {
        e.preventDefault();
        
        const rect = this.timelineCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if right-clicking on a keyframe
        const keyframes = this.animation.keyframes[this.selectedProperty] || [];
        for (const kf of keyframes) {
            const kfX = (kf.time * this.pixelsPerMs) - this.timelineOffset;
            const kfY = this.timelineCanvas.height / 2;
            
            if (Math.abs(x - kfX) < 10 && Math.abs(y - kfY) < 10) {
                this.selectedKeyframe = kf;
                this.showContextMenu(e.clientX, e.clientY);
                return;
            }
        }
    }
    
    showContextMenu(x, y) {
        const menu = document.getElementById('contextMenu');
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }
    
    getObjectBounds() {
        return {
            x: this.object.x,
            y: this.object.y,
            width: this.object.width * this.object.scale,
            height: this.object.height * this.object.scale
        };
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw object
        this.ctx.save();
        this.ctx.translate(this.object.x, this.object.y);
        this.ctx.rotate(this.object.rotation * Math.PI / 180);
        this.ctx.scale(this.object.scale, this.object.scale);
        this.ctx.globalAlpha = this.object.opacity;
        
        this.ctx.fillStyle = this.object.fillColor;
        this.ctx.strokeStyle = this.object.strokeColor;
        this.ctx.lineWidth = this.object.strokeWidth;
        
        switch (this.object.shape) {
            case 'rectangle':
                this.ctx.fillRect(-this.object.width/2, -this.object.height/2, this.object.width, this.object.height);
                this.ctx.strokeRect(-this.object.width/2, -this.object.height/2, this.object.width, this.object.height);
                break;
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc(0, 0, this.object.width/2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                break;
            case 'triangle':
                this.ctx.beginPath();
                this.ctx.moveTo(0, -this.object.height/2);
                this.ctx.lineTo(-this.object.width/2, this.object.height/2);
                this.ctx.lineTo(this.object.width/2, this.object.height/2);
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
                break;
            case 'star':
                this.drawStar(0, 0, 5, this.object.width/2, this.object.width/4);
                this.ctx.fill();
                this.ctx.stroke();
                break;
        }
        
        this.ctx.restore();
        
        // Draw motion path if animating position
        if (this.selectedProperty === 'x' || this.selectedProperty === 'y') {
            this.drawMotionPath();
        }
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = 1;
        
        const gridSize = 20;
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - outerRadius);
        
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            this.ctx.lineTo(x, y);
            rot += step;
            
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            this.ctx.lineTo(x, y);
            rot += step;
        }
        
        this.ctx.lineTo(cx, cy - outerRadius);
        this.ctx.closePath();
    }
    
    drawMotionPath() {
        const xKeyframes = this.animation.keyframes.x || [];
        const yKeyframes = this.animation.keyframes.y || [];
        
        if (xKeyframes.length < 2 || yKeyframes.length < 2) return;
        
        this.ctx.strokeStyle = 'rgba(74, 158, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        
        for (let t = 0; t <= this.animation.duration; t += 10) {
            const x = this.interpolateValue(xKeyframes, t);
            const y = this.interpolateValue(yKeyframes, t);
            
            if (t === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    renderTimeline() {
        const ctx = this.timelineCtx;
        const width = this.timelineCanvas.width;
        const height = this.timelineCanvas.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // Time markers
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        
        const step = 1000; // 1 second intervals
        for (let time = 0; time <= this.animation.duration; time += step) {
            const x = (time * this.pixelsPerMs) - this.timelineOffset;
            if (x >= 0 && x <= width) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
                
                ctx.fillText(`${time / 1000}s`, x + 4, 12);
            }
        }
        
        // Current time indicator
        const currentX = (this.animation.currentTime * this.pixelsPerMs) - this.timelineOffset;
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX, height);
        ctx.stroke();
        
        // Draw curve for selected property
        const keyframes = this.animation.keyframes[this.selectedProperty] || [];
        if (keyframes.length >= 2) {
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            for (let t = 0; t <= this.animation.duration; t += 10) {
                const value = this.interpolateValue(keyframes, t);
                const x = (t * this.pixelsPerMs) - this.timelineOffset;
                const y = height - (this.normalizeValue(value, this.selectedProperty) * (height - 40)) - 20;
                
                if (t === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
        
        // Draw keyframes
        for (const kf of keyframes) {
            const x = (kf.time * this.pixelsPerMs) - this.timelineOffset;
            const y = height / 2;
            
            ctx.fillStyle = kf === this.selectedKeyframe ? '#ff6b6b' : '#4a9eff';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.PI / 4);
            ctx.fillRect(-6, -6, 12, 12);
            ctx.strokeRect(-6, -6, 12, 12);
            ctx.restore();
        }
    }
    
    normalizeValue(value, property) {
        switch (property) {
            case 'x':
                return value / this.canvas.width;
            case 'y':
                return value / this.canvas.height;
            case 'rotation':
                return (value + 180) / 360;
            case 'scale':
                return value / 3;
            case 'opacity':
                return value;
            default:
                return 0.5;
        }
    }
    
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
        
        // Interpolate between keyframes
        const t = (time - kf1.time) / (kf2.time - kf1.time);
        const easedT = this.applyEasing(t);
        
        return kf1.value + (kf2.value - kf1.value) * easedT;
    }
    
    applyEasing(t) {
        const type = document.getElementById('animationType').value;
        
        switch (type) {
            case 'linear':
                return t;
            case 'ease':
                return this.cubicBezier(t, 0.25, 0.1, 0.25, 1);
            case 'ease-in':
                return this.cubicBezier(t, 0.42, 0, 1, 1);
            case 'ease-out':
                return this.cubicBezier(t, 0, 0, 0.58, 1);
            case 'ease-in-out':
                return this.cubicBezier(t, 0.42, 0, 0.58, 1);
            case 'cubic-bezier':
                return this.cubicBezier(t, this.bezierControl1.x, this.bezierControl1.y, 
                                         this.bezierControl2.x, this.bezierControl2.y);
            case 'spring':
                return this.springEasing(t);
            default:
                return t;
        }
    }
    
    cubicBezier(t, p1x, p1y, p2x, p2y) {
        // Simplified cubic bezier calculation
        const cx = 3 * p1x;
        const bx = 3 * (p2x - p1x) - cx;
        const ax = 1 - cx - bx;
        
        const cy = 3 * p1y;
        const by = 3 * (p2y - p1y) - cy;
        const ay = 1 - cy - by;
        
        const sampleCurveX = (t) => ((ax * t + bx) * t + cx) * t;
        const sampleCurveY = (t) => ((ay * t + by) * t + cy) * t;
        
        // Newton's method to find t for given x
        let t2 = t;
        for (let i = 0; i < 4; i++) {
            const x = sampleCurveX(t2) - t;
            if (Math.abs(x) < 0.001) break;
            const d = (3 * ax * t2 + 2 * bx) * t2 + cx;
            if (Math.abs(d) < 0.001) break;
            t2 = t2 - x / d;
        }
        
        return sampleCurveY(t2);
    }
    
    springEasing(t) {
        const damping = 0.5;
        const stiffness = 100;
        return 1 - Math.pow(Math.E, -damping * t * 10) * Math.cos(stiffness * t);
    }
    
    updateObjectFromAnimation() {
        const time = this.animation.currentTime;
        
        this.object.x = this.interpolateValue(this.animation.keyframes.x || [], time);
        this.object.y = this.interpolateValue(this.animation.keyframes.y || [], time);
        this.object.rotation = this.interpolateValue(this.animation.keyframes.rotation || [], time);
        this.object.scale = this.interpolateValue(this.animation.keyframes.scale || [], time);
        this.object.opacity = this.interpolateValue(this.animation.keyframes.opacity || [], time);
    }
    
    animate() {
        if (this.animation.playing) {
            this.animation.currentTime += 16.67; // ~60fps
            
            if (this.animation.currentTime >= this.animation.duration) {
                if (this.animation.loop) {
                    this.animation.currentTime = 0;
                } else {
                    this.animation.playing = false;
                    this.animation.currentTime = this.animation.duration;
                }
            }
            
            this.updateTime();
            this.updateObjectFromAnimation();
            this.render();
            this.renderTimeline();
        }
        
        requestAnimationFrame(() => this.animate());
    }
    
    updateTime() {
        const current = this.formatTime(this.animation.currentTime);
        const total = this.formatTime(this.animation.duration);
        
        document.getElementById('currentTime').textContent = current;
        document.getElementById('totalTime').textContent = total;
    }
    
    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const centiseconds = Math.floor((ms % 1000) / 10);
        
        return `${minutes}:${secs.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
    }
    
    // Animation Controls
    togglePlayback() {
        this.animation.playing = !this.animation.playing;
        
        const playButton = document.querySelector('.play-button svg');
        if (this.animation.playing) {
            playButton.innerHTML = '<rect x="5" y="4" width="3" height="8"/><rect x="10" y="4" width="3" height="8"/>';
        } else {
            playButton.innerHTML = '<path d="M3 2l10 6-10 6V2z"/>';
        }
    }
    
    stop() {
        this.animation.playing = false;
        this.animation.currentTime = 0;
        this.updateTime();
        this.updateObjectFromAnimation();
        this.render();
        this.renderTimeline();
        
        const playButton = document.querySelector('.play-button svg');
        playButton.innerHTML = '<path d="M3 2l10 6-10 6V2z"/>';
    }
    
    // Keyframe Management
    addKeyframe() {
        const time = this.animation.currentTime;
        const value = this.object[this.selectedProperty];
        
        this.setKeyframe(this.selectedProperty, time, value);
        this.renderTimeline();
    }
    
    setKeyframe(property, time, value) {
        if (!this.animation.keyframes[property]) {
            this.animation.keyframes[property] = [];
        }
        
        const keyframes = this.animation.keyframes[property];
        const existing = keyframes.find(kf => Math.abs(kf.time - time) < 1);
        
        if (existing) {
            existing.value = value;
        } else {
            keyframes.push({ time, value });
            keyframes.sort((a, b) => a.time - b.time);
        }
    }
    
    deleteKeyframe() {
        if (!this.selectedKeyframe) return;
        
        const keyframes = this.animation.keyframes[this.selectedProperty];
        const index = keyframes.indexOf(this.selectedKeyframe);
        
        if (index !== -1) {
            keyframes.splice(index, 1);
            this.selectedKeyframe = null;
            this.renderTimeline();
        }
    }
    
    duplicateKeyframe() {
        if (!this.selectedKeyframe) return;
        
        const newTime = this.selectedKeyframe.time + 500;
        if (newTime <= this.animation.duration) {
            this.setKeyframe(this.selectedProperty, newTime, this.selectedKeyframe.value);
            this.renderTimeline();
        }
    }
    
    copyKeyframe() {
        if (!this.selectedKeyframe) return;
        this.copiedKeyframe = { ...this.selectedKeyframe };
    }
    
    pasteKeyframe() {
        if (!this.copiedKeyframe) return;
        
        const time = this.animation.currentTime;
        this.setKeyframe(this.selectedProperty, time, this.copiedKeyframe.value);
        this.renderTimeline();
    }
    
    // Sample Animations
    loadSampleAnimations() {
        this.samples = {
            bounce: {
                keyframes: {
                    y: [
                        { time: 0, value: 100 },
                        { time: 500, value: 300 },
                        { time: 1000, value: 100 },
                        { time: 1500, value: 250 },
                        { time: 2000, value: 100 },
                        { time: 2500, value: 200 },
                        { time: 3000, value: 100 }
                    ]
                },
                animationType: 'ease-out'
            },
            rotate: {
                keyframes: {
                    rotation: [
                        { time: 0, value: 0 },
                        { time: 2500, value: 360 },
                        { time: 5000, value: 720 }
                    ]
                },
                animationType: 'ease-in-out'
            },
            fade: {
                keyframes: {
                    opacity: [
                        { time: 0, value: 0 },
                        { time: 1000, value: 1 },
                        { time: 4000, value: 1 },
                        { time: 5000, value: 0 }
                    ]
                },
                animationType: 'ease'
            },
            slide: {
                keyframes: {
                    x: [
                        { time: 0, value: 50 },
                        { time: 2500, value: 550 },
                        { time: 5000, value: 50 }
                    ]
                },
                animationType: 'ease-in-out'
            },
            scale: {
                keyframes: {
                    scale: [
                        { time: 0, value: 1 },
                        { time: 1250, value: 1.5 },
                        { time: 2500, value: 1 },
                        { time: 3750, value: 0.5 },
                        { time: 5000, value: 1 }
                    ]
                },
                animationType: 'ease-in-out'
            },
            path: {
                keyframes: {
                    x: [
                        { time: 0, value: 100 },
                        { time: 1250, value: 400 },
                        { time: 2500, value: 400 },
                        { time: 3750, value: 100 },
                        { time: 5000, value: 100 }
                    ],
                    y: [
                        { time: 0, value: 100 },
                        { time: 1250, value: 100 },
                        { time: 2500, value: 300 },
                        { time: 3750, value: 300 },
                        { time: 5000, value: 100 }
                    ]
                },
                animationType: 'cubic-bezier'
            },
            morph: {
                keyframes: {
                    scale: [
                        { time: 0, value: 1 },
                        { time: 1666, value: 1.2 },
                        { time: 3333, value: 0.8 },
                        { time: 5000, value: 1 }
                    ],
                    rotation: [
                        { time: 0, value: 0 },
                        { time: 1666, value: 120 },
                        { time: 3333, value: 240 },
                        { time: 5000, value: 360 }
                    ]
                },
                animationType: 'ease-in-out',
                shape: 'star'
            },
            color: {
                keyframes: {
                    x: [
                        { time: 0, value: 300 },
                        { time: 5000, value: 300 }
                    ],
                    y: [
                        { time: 0, value: 200 },
                        { time: 5000, value: 200 }
                    ],
                    scale: [
                        { time: 0, value: 1 },
                        { time: 2500, value: 1.5 },
                        { time: 5000, value: 1 }
                    ]
                },
                animationType: 'ease-in-out',
                // Note: Color animation would require additional implementation
            }
        };
    }
    
    loadSample(sampleName) {
        const sample = this.samples[sampleName];
        if (!sample) return;
        
        // Reset animation
        this.stop();
        
        // Load keyframes
        this.animation.keyframes = JSON.parse(JSON.stringify(sample.keyframes));
        
        // Set animation type
        if (sample.animationType) {
            document.getElementById('animationType').value = sample.animationType;
            document.getElementById('animationType').dispatchEvent(new Event('change'));
        }
        
        // Set shape if specified
        if (sample.shape) {
            this.object.shape = sample.shape;
        }
        
        // Update UI
        this.updateObjectFromAnimation();
        this.render();
        this.renderTimeline();
        
        // Highlight selected sample
        document.querySelectorAll('.sample-item').forEach(item => {
            item.classList.remove('active');
        });
        event.target.classList.add('active');
    }
    
    // File Operations
    newAnimation() {
        if (confirm('Create a new animation? Unsaved changes will be lost.')) {
            this.stop();
            this.initializeAnimation();
            this.animation.currentTime = 0;
            this.selectedKeyframe = null;
            this.updateObjectFromAnimation();
            this.render();
            this.renderTimeline();
        }
    }
    
    saveAnimation() {
        const data = {
            animation: this.animation,
            object: this.object,
            bezierControls: {
                control1: this.bezierControl1,
                control2: this.bezierControl2
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'animation.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    loadAnimation() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    this.animation = data.animation;
                    this.object = { ...this.object, ...data.object };
                    
                    if (data.bezierControls) {
                        this.bezierControl1 = data.bezierControls.control1;
                        this.bezierControl2 = data.bezierControls.control2;
                    }
                    
                    this.stop();
                    this.updateObjectFromAnimation();
                    this.render();
                    this.renderTimeline();
                    
                    // Update UI controls
                    document.getElementById('fillColor').value = this.object.fillColor;
                    document.getElementById('fillColorText').value = this.object.fillColor;
                    document.getElementById('strokeColor').value = this.object.strokeColor;
                    document.getElementById('strokeColorText').value = this.object.strokeColor;
                    document.getElementById('strokeWidth').value = this.object.strokeWidth;
                    document.getElementById('opacity').value = this.object.opacity * 100;
                    
                } catch (err) {
                    alert('Error loading animation file: ' + err.message);
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    exportAnimation() {
        const code = this.generateExportCode();
        document.getElementById('exportCode').textContent = code;
        document.getElementById('exportDialog').style.display = 'block';
    }
    
    generateExportCode() {
        const keyframes = [];
        const properties = Object.keys(this.animation.keyframes);
        
        // Generate CSS keyframes
        const steps = new Set();
        properties.forEach(prop => {
            this.animation.keyframes[prop].forEach(kf => {
                steps.add(kf.time);
            });
        });
        
        const sortedSteps = Array.from(steps).sort((a, b) => a - b);
        
        sortedSteps.forEach(time => {
            const percentage = (time / this.animation.duration) * 100;
            const values = {};
            
            properties.forEach(prop => {
                const value = this.interpolateValue(this.animation.keyframes[prop], time);
                
                switch (prop) {
                    case 'x':
                    case 'y':
                        if (!values.transform) values.transform = '';
                        values.transform += ` translate${prop.toUpperCase()}(${value}px)`;
                        break;
                    case 'rotation':
                        if (!values.transform) values.transform = '';
                        values.transform += ` rotate(${value}deg)`;
                        break;
                    case 'scale':
                        if (!values.transform) values.transform = '';
                        values.transform += ` scale(${value})`;
                        break;
                    case 'opacity':
                        values.opacity = value;
                        break;
                }
            });
            
            keyframes.push(`  ${percentage.toFixed(1)}% { ${Object.entries(values).map(([k, v]) => `${k}: ${v};`).join(' ')} }`);
        });
        
        const animationName = 'custom-animation';
        const duration = this.animation.duration / 1000;
        const easing = document.getElementById('animationType').value;
        
        return `/* Generated Animation Code */

@keyframes ${animationName} {
${keyframes.join('\n')}
}

.animated-element {
  animation: ${animationName} ${duration}s ${easing} infinite;
  
  /* Initial styles */
  width: ${this.object.width}px;
  height: ${this.object.height}px;
  background-color: ${this.object.fillColor};
  border: ${this.object.strokeWidth}px solid ${this.object.strokeColor};
}

/* JavaScript Implementation */
const animation = ${JSON.stringify(this.animation, null, 2)};

// Apply animation using Web Animations API
element.animate(
  ${JSON.stringify(this.generateWebAnimationKeyframes(), null, 2)},
  {
    duration: ${this.animation.duration},
    easing: '${easing}',
    iterations: Infinity
  }
);`;
    }
    
    generateWebAnimationKeyframes() {
        const keyframes = [];
        const times = new Set([0, this.animation.duration]);
        
        Object.values(this.animation.keyframes).forEach(kfs => {
            kfs.forEach(kf => times.add(kf.time));
        });
        
        Array.from(times).sort((a, b) => a - b).forEach(time => {
            const frame = {
                offset: time / this.animation.duration
            };
            
            if (this.animation.keyframes.x) {
                const x = this.interpolateValue(this.animation.keyframes.x, time);
                if (!frame.transform) frame.transform = '';
                frame.transform += `translateX(${x}px) `;
            }
            
            if (this.animation.keyframes.y) {
                const y = this.interpolateValue(this.animation.keyframes.y, time);
                if (!frame.transform) frame.transform = '';
                frame.transform += `translateY(${y}px) `;
            }
            
            if (this.animation.keyframes.rotation) {
                const rotation = this.interpolateValue(this.animation.keyframes.rotation, time);
                if (!frame.transform) frame.transform = '';
                frame.transform += `rotate(${rotation}deg) `;
            }
            
            if (this.animation.keyframes.scale) {
                const scale = this.interpolateValue(this.animation.keyframes.scale, time);
                if (!frame.transform) frame.transform = '';
                frame.transform += `scale(${scale}) `;
            }
            
            if (this.animation.keyframes.opacity) {
                frame.opacity = this.interpolateValue(this.animation.keyframes.opacity, time);
            }
            
            if (frame.transform) {
                frame.transform = frame.transform.trim();
            }
            
            keyframes.push(frame);
        });
        
        return keyframes;
    }
    
    copyExportCode() {
        const code = document.getElementById('exportCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            alert('Code copied to clipboard!');
        });
    }
    
    closeExportDialog() {
        document.getElementById('exportDialog').style.display = 'none';
    }
}

// Initialize the editor when the page loads
const editor = new TimelineEditor();