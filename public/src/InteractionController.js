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
            type: null, // 'endpoint' or 'line'
            offsetX: 0,
            offsetY: 0
        };

        // Ball spray state
        this.lastBallSpray = 0;
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
            this.ui.deselectLine();
            return;
        }

        // Priority 2: Remove spawner
        const spawner = this.ui.hovered.spawner;
        if (spawner) {
            this.entities.removeSpawner(spawner);
            this.ui.setHoveredSpawner(null);
            return;
        }

        // Priority 3: Start endpoint drag
        const endpoint = this.ui.hovered.endpoint;
        if (endpoint) {
            this.dragging.active = true;
            this.dragging.type = 'endpoint';
            this.dragging.line = endpoint.line;
            this.dragging.endpoint = endpoint.endpoint;
            return;
        }

        // Priority 4: Start line drag (move entire line)
        const line = this.ui.hovered.line;
        if (line) {
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

        // Priority 5: Start drawing
        this.ui.deselectLine();
        this.drawing.active = true;
        this.drawing.x1 = pos.x;
        this.drawing.y1 = pos.y;
        this.drawing.x2 = pos.x;
        this.drawing.y2 = pos.y;
    }

    // ==================== MOUSE MOVE ====================

    handleMouseMove(pos) {
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
        // Finish dragging
        if (this.dragging.active) {
            this.dragging.active = false;
            this.dragging.line = null;
            this.dragging.endpoint = null;
            this.dragging.type = null;
            this.dragging.offsetX = 0;
            this.dragging.offsetY = 0;
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
            'c': () => this.clearLinesAndSpawners(),
            'delete': () => this.handleDeleteKey(),
            'x': () => this.entities.clearBalls(),
            ' ': () => this.togglePause?.(),
            'backspace': () => this.entities.removeLastLine(),
            'escape': () => this.ui.deselectLine(),
            'h': () => this.ui.toggleHelp(),
            't': () => this.ui.toggleStats()
        };

        const handler = handlers[normalizedKey];
        if (handler) handler();
    }

    clearLinesAndSpawners() {
        this.entities.clearLines();
        this.entities.clearSpawners();
    }

    handleDeleteKey() {
        const line = this.ui.getSelectedLine();
        if (line) {
            this.entities.removeLine(line);
            this.ui.deselectLine();
        } else {
            this.clearLinesAndSpawners();
        }
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
                    const offsetX = (Math.random() - 0.5) * 20;
                    const offsetY = (Math.random() - 0.5) * 20;
                    this.entities.addBall(mouseState.x + offsetX, mouseState.y + offsetY);
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
