/**
 * InteractionController - Handles interaction logic between input and entities
 * Single place for all "what happens when user does X" logic
 */
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
            endpoint: null
        };

        // Ball spray state
        this.lastBallSpray = 0;
    }

    // ==================== MOUSE DOWN ====================

    handleMouseDown(pos) {
        this.audio.init();

        // Priority 1: Delete button
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
            this.dragging.line = endpoint.line;
            this.dragging.endpoint = endpoint.endpoint;
            return;
        }

        // Priority 4: Select or delete line
        const line = this.ui.hovered.line;
        if (line) {
            // If clicking the already-selected line, delete it
            if (line === this.ui.getSelectedLine()) {
                this.entities.removeLine(line);
                this.ui.deselectLine();
            } else {
                // Otherwise, select it
                this.ui.selectLine(line);
            }
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
            this.entities.updateLineEndpoint(
                this.dragging.line,
                this.dragging.endpoint,
                pos.x,
                pos.y
            );
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
            return;
        }

        // Finish drawing (only if actually dragged)
        if (this.drawing.active) {
            const dragDistance = Math.hypot(
                this.drawing.x2 - this.drawing.x1,
                this.drawing.y2 - this.drawing.y1
            );

            // If dragged enough, create line
            if (dragDistance > 10) {
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
        const handlers = {
            'c': () => this.entities.clear(),
            'x': () => this.entities.clearBalls(),
            ' ': () => this.togglePause?.(),
            'Backspace': () => this.entities.removeLastLine(),
            'Delete': () => {
                const line = this.ui.getSelectedLine();
                if (line) this.entities.removeLine(line);
                this.ui.deselectLine();
            },
            'Escape': () => this.ui.deselectLine(),
            'h': () => this.ui.toggleHelp()
        };

        const handler = handlers[key] || handlers[key.toLowerCase()];
        if (handler) handler();
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
            const line = this.entities.findNearestLine(pos.x, pos.y, 15);
            this.ui.setHoveredLine(line);
        }

        const spawner = this.entities.findNearestSpawner(pos.x, pos.y, 25);
        this.ui.setHoveredSpawner(spawner);

        const endpoint = this.ui.getSelectedLine() ? null :
                        this.entities.findNearestEndpoint(pos.x, pos.y, 20);
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

            if (holdDuration > 500 && now - this.lastBallSpray > 150) {
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
