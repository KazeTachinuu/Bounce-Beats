/**
 * InteractionController - Handles interaction logic between input and entities
 * Single place for all "what happens when user does X" logic
 */
import { INTERACTION_CONFIG } from './constants.js';

export class InteractionController {
    constructor(entities, ui, audio) {
        this.entities = entities;
        this.ui = ui;
        this.audio = audio;

        // Drawing state
        this.drawing = {
            active: false,
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0
        };

        // Dragging state
        this.dragging = {
            active: false,
            line: null,
            endpoint: null,
            type: null, // 'endpoint', 'line', 'multiple', or 'resize'
            offsetX: 0,
            offsetY: 0,
            startX: 0,
            startY: 0,
            initialBounds: null,
            resizeHandle: null
        };

        // Ball spray state
        this.lastBallSpray = 0;

        // Modifier keys
        this.shiftPressed = false;
    }

    // ==================== MOUSE DOWN ====================

    handleMouseDown(pos) {
        this.audio.init();

        // Priority 1: Help icon
        if (this.ui.isPointInHelpIcon(pos.x, pos.y)) {
            this.ui.toggleHelp();
            return;
        }

        // Priority 2: Delete button
        if (this.ui.isPointInDeleteButton(pos.x, pos.y)) {
            const line = this.ui.getSelectedLine();
            if (line) this.entities.removeLine(line);

            // Also handle multi-delete
            const multi = this.ui.getSelectedMultiple();
            if (multi.lines.length > 0 || multi.spawners.length > 0) {
                this.entities.removeMultiple(multi.lines, multi.spawners);
                this.ui.deselectMultiple();
            }

            this.ui.deselectLine();
            return;
        }

        // Priority 2: Remove spawner (or adjust rhythm with scroll)
        const spawner = this.ui.hovered.spawner;
        if (spawner && !this.shiftPressed) {
            this.entities.removeSpawner(spawner);
            this.ui.setHoveredSpawner(null);
            return;
        }

        // Priority 3: Resize multiple selection (handles)
        if (this.ui.hasMultipleSelection() && !this.shiftPressed) {
            const resizeHandle = this.ui.findResizeHandle(pos.x, pos.y);
            if (resizeHandle) {
                this.dragging.active = true;
                this.dragging.type = 'resize';
                this.dragging.resizeHandle = resizeHandle;
                this.dragging.startX = pos.x;
                this.dragging.startY = pos.y;
                this.dragging.initialBounds = { ...this.ui.multiSelectionBounds.bounds };
                return;
            }

            // Priority 4: Drag multiple selection (inside bounding box)
            const bounds = this.ui.multiSelectionBounds?.bounds;
            if (bounds) {
                const insideBox = pos.x >= bounds.minX && pos.x <= bounds.maxX &&
                                 pos.y >= bounds.minY && pos.y <= bounds.maxY;

                if (insideBox) {
                    this.dragging.active = true;
                    this.dragging.type = 'multiple';
                    this.dragging.startX = pos.x;
                    this.dragging.startY = pos.y;
                    return;
                }
            }
        }

        // Priority 4: Start endpoint drag
        const endpoint = this.ui.hovered.endpoint;
        if (endpoint && !this.shiftPressed) {
            this.dragging.active = true;
            this.dragging.type = 'endpoint';
            this.dragging.line = endpoint.line;
            this.dragging.endpoint = endpoint.endpoint;
            return;
        }

        // Priority 5: Start line drag (move entire line)
        const line = this.ui.hovered.line;
        if (line && !this.shiftPressed) {
            this.dragging.active = true;
            this.dragging.type = 'line';
            this.dragging.line = line;

            // Calculate offset from mouse to line center
            const centerX = (line.x1 + line.x2) / 2;
            const centerY = (line.y1 + line.y2) / 2;
            this.dragging.offsetX = centerX - pos.x;
            this.dragging.offsetY = centerY - pos.y;

            this.ui.selectLine(line);
            return;
        }

        // Priority 6: Start area selection (with Shift) or drawing
        if (this.shiftPressed) {
            this.ui.deselectLine();
            this.ui.deselectMultiple();
            this.ui.startAreaSelection(pos.x, pos.y);
        } else {
            this.ui.deselectLine();
            this.ui.deselectMultiple();
            this.drawing.active = true;
            this.drawing.x1 = pos.x;
            this.drawing.y1 = pos.y;
            this.drawing.x2 = pos.x;
            this.drawing.y2 = pos.y;
        }
    }

    // ==================== MOUSE MOVE ====================

    handleMouseMove(pos) {
        // Update area selection
        if (this.ui.getAreaSelection()) {
            this.ui.updateAreaSelection(pos.x, pos.y);
            return;
        }

        // Update dragging
        if (this.dragging.active) {
            if (this.dragging.type === 'endpoint') {
                // Drag endpoint
                this.entities.updateLineEndpoint(
                    this.dragging.line,
                    this.dragging.endpoint,
                    pos.x,
                    pos.y
                );
            } else if (this.dragging.type === 'line') {
                // Move entire line
                const line = this.dragging.line;
                const newCenterX = pos.x + this.dragging.offsetX;
                const newCenterY = pos.y + this.dragging.offsetY;

                // Calculate current line center
                const oldCenterX = (line.x1 + line.x2) / 2;
                const oldCenterY = (line.y1 + line.y2) / 2;

                // Calculate delta
                const deltaX = newCenterX - oldCenterX;
                const deltaY = newCenterY - oldCenterY;

                // Move both endpoints
                this.entities.updateLinePosition(
                    line,
                    line.x1 + deltaX,
                    line.y1 + deltaY,
                    line.x2 + deltaX,
                    line.y2 + deltaY
                );
            } else if (this.dragging.type === 'multiple') {
                // Move multiple selection
                const deltaX = pos.x - this.dragging.startX;
                const deltaY = pos.y - this.dragging.startY;

                const multi = this.ui.getSelectedMultiple();
                this.entities.moveMultiple(multi.lines, multi.spawners, deltaX, deltaY);

                this.dragging.startX = pos.x;
                this.dragging.startY = pos.y;
            } else if (this.dragging.type === 'resize') {
                // Resize multiple selection - simple and clean
                const handle = this.dragging.resizeHandle;
                const deltaX = pos.x - this.dragging.startX;
                const deltaY = pos.y - this.dragging.startY;

                // Calculate new bounds
                const newBounds = { ...this.dragging.initialBounds };

                // Update only the edges being dragged
                if (handle.position.includes('l')) newBounds.minX += deltaX;
                if (handle.position.includes('r')) newBounds.maxX += deltaX;
                if (handle.position.includes('t')) newBounds.minY += deltaY;
                if (handle.position.includes('b')) newBounds.maxY += deltaY;

                // Prevent too small
                if (newBounds.maxX - newBounds.minX < 50) return;
                if (newBounds.maxY - newBounds.minY < 50) return;

                // Apply resize
                const multi = this.ui.getSelectedMultiple();
                this.entities.scaleMultiple(
                    multi.lines,
                    multi.spawners,
                    this.dragging.initialBounds,
                    newBounds
                );

                // Update for next frame
                this.dragging.startX = pos.x;
                this.dragging.startY = pos.y;
                this.dragging.initialBounds = newBounds;
            }
            return;
        }

        // Update drawing
        if (this.drawing.active) {
            this.drawing.x2 = pos.x;
            this.drawing.y2 = pos.y;
            return;
        }

        // Update hover states
        this.updateHoverStates(pos);
    }

    // ==================== MOUSE UP ====================

    handleMouseUp(event) {
        // Finish area selection
        const areaSelection = this.ui.getAreaSelection();
        if (areaSelection) {
            const bounds = this.ui.getAreaSelectionBounds();
            const selected = this.entities.findEntitiesInArea(
                bounds.x1, bounds.y1, bounds.x2, bounds.y2
            );

            if (selected.lines.length > 0 || selected.spawners.length > 0) {
                this.ui.selectMultiple(selected.lines, selected.spawners);
            }

            this.ui.finishAreaSelection();
            return;
        }

        // Finish dragging
        if (this.dragging.active) {
            this.dragging.active = false;
            this.dragging.line = null;
            this.dragging.endpoint = null;
            this.dragging.type = null;
            this.dragging.offsetX = 0;
            this.dragging.offsetY = 0;
            this.dragging.startX = 0;
            this.dragging.startY = 0;
            this.dragging.initialBounds = null;
            this.dragging.resizeHandle = null;
            return;
        }

        // Finish drawing (only if actually dragged)
        if (this.drawing.active) {
            const dragDistance = Math.hypot(
                this.drawing.x2 - this.drawing.x1,
                this.drawing.y2 - this.drawing.y1
            );

            // If dragged enough, create line
            if (dragDistance > INTERACTION_CONFIG.minDragDistance) {
                this.finishDrawing();
                return;
            }

            // Otherwise cancel drawing and continue to ball/spawner logic
            this.drawing.active = false;
        }

        // Don't spawn on UI
        if (this.isMouseOverUI(event.downX, event.downY)) {
            return;
        }

        // Hold = create spawner
        if (event.isHold) {
            this.entities.addSpawner(event.x, event.y);
        }
        // Click = spawn ball
        else if (event.isClick) {
            this.entities.addBall(event.x, event.y);
        }
    }

    // ==================== KEYBOARD ====================

    handleKeyPress(key) {
        // Normalize key to lowercase for consistent handling
        const normalizedKey = key.toLowerCase();

        const handlers = {
            // Standard shortcuts
            'delete': () => this.handleDeleteKey(),
            'backspace': () => this.handleDeleteKey(), // Same as Delete - respect selections
            'escape': () => {
                this.ui.deselectLine();
                this.ui.deselectMultiple();
            },

            // App-specific shortcuts
            'c': () => this.clearLinesAndSpawners(),
            'x': () => this.entities.clearBalls(),
            ' ': () => this.togglePause?.(),
            'h': () => this.ui.toggleHelp(),
            't': () => this.ui.toggleStats(),

            // Modifiers
            'shift': () => { this.shiftPressed = true; }
        };

        const handler = handlers[normalizedKey];
        if (handler) handler();
    }

    handleKeyUp(key) {
        const normalizedKey = key.toLowerCase();
        if (normalizedKey === 'shift') {
            this.shiftPressed = false;
        }
    }

    clearLinesAndSpawners() {
        this.entities.clearLines();
        this.entities.clearSpawners();
    }

    handleDeleteKey() {
        // Priority: multi-selection > single selection > delete all
        const multi = this.ui.getSelectedMultiple();
        if (multi.lines.length > 0 || multi.spawners.length > 0) {
            this.entities.removeMultiple(multi.lines, multi.spawners);
            this.ui.deselectMultiple();
            return;
        }

        const line = this.ui.getSelectedLine();
        if (line) {
            this.entities.removeLine(line);
            this.ui.deselectLine();
            return;
        }

        // Only clear all if nothing is selected (safer UX)
        this.clearLinesAndSpawners();
    }

    // ==================== HELPERS ====================

    finishDrawing() {
        if (!this.drawing.active) return;

        this.entities.addLine(
            this.drawing.x1,
            this.drawing.y1,
            this.drawing.x2,
            this.drawing.y2
        );

        this.drawing.active = false;
    }

    updateHoverStates(pos) {
        // Check for resize handle hover first
        if (this.ui.hasMultipleSelection()) {
            const handle = this.ui.findResizeHandle(pos.x, pos.y);
            this.ui.setResizeHandle(handle);
            if (handle) return; // Don't check other hovers when over handle
        }

        // Don't show hover when line is selected
        if (this.ui.getSelectedLine()) {
            this.ui.setHoveredLine(null);
        } else {
            const line = this.entities.findNearestLine(pos.x, pos.y, INTERACTION_CONFIG.lineHoverThreshold);
            this.ui.setHoveredLine(line);
        }

        const spawner = this.entities.findNearestSpawner(pos.x, pos.y, INTERACTION_CONFIG.spawnerHoverThreshold);
        this.ui.setHoveredSpawner(spawner);

        const endpoint = this.ui.getSelectedLine() ? null :
                        this.entities.findNearestEndpoint(pos.x, pos.y, INTERACTION_CONFIG.endpointHoverThreshold);
        this.ui.setHoveredEndpoint(endpoint);
    }

    isMouseOverUI(x, y) {
        return this.ui.isPointInDeleteButton(x, y) ||
               this.ui.hovered.line ||
               this.ui.hovered.spawner;
    }

    // ==================== UPDATE ====================

    update(mouseState) {
        // Ball spray on hold
        if (mouseState.isDown && !this.drawing.active && !this.dragging.active) {
            const holdDuration = Date.now() - mouseState.downTime;
            const now = Date.now();

            if (holdDuration > INTERACTION_CONFIG.holdThreshold && now - this.lastBallSpray > INTERACTION_CONFIG.ballSprayInterval) {
                if (!this.isMouseOverUI(mouseState.downX, mouseState.downY)) {
                    // Circular spray pattern with increasing radius
                    const sprayCount = Math.floor((holdDuration - INTERACTION_CONFIG.holdThreshold) / 500) + 1;
                    const radius = 15 + (sprayCount * 3);
                    const angle = (now / 100) % (Math.PI * 2); // Rotating spray

                    // Multiple balls in a burst for snappy feel
                    const burstSize = Math.min(3, Math.floor(holdDuration / 1000) + 1);

                    for (let i = 0; i < burstSize; i++) {
                        const offsetAngle = angle + (i * Math.PI * 2 / burstSize);
                        const offsetX = Math.cos(offsetAngle) * radius;
                        const offsetY = Math.sin(offsetAngle) * radius;
                        this.entities.addBall(mouseState.x + offsetX, mouseState.y + offsetY);
                    }

                    this.lastBallSpray = now;
                }
            }
        }
    }

    // ==================== GETTERS ====================

    getDrawing() {
        return this.drawing.active ? this.drawing : null;
    }

    getDragging() {
        return this.dragging.active ? this.dragging : null;
    }
}
