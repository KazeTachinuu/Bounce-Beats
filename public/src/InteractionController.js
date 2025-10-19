/**
 * InteractionController - Handles interaction logic between input and entities
 * Single place for all "what happens when user does X" logic
 */
import { INTERACTION_CONFIG } from './constants.js';
import { CommandHistory } from './CommandHistory.js';
import {
    AddLineCommand,
    RemoveLineCommand,
    MoveLineCommand,
    MoveLineEndpointCommand,
    AddSpawnerCommand,
    RemoveSpawnerCommand,
    ClearAllCommand
} from './commands.js';

export class InteractionController {
    constructor(entities, ui, audio) {
        this.entities = entities;
        this.ui = ui;
        this.audio = audio;
        this.history = new CommandHistory();

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
            offsetY: 0,
            // Store initial position for undo
            initialX1: 0,
            initialY1: 0,
            initialX2: 0,
            initialY2: 0
        };

        // Ball spray state
        this.lastBallSpray = 0;
    }

    // ==================== MOUSE DOWN ====================

    handleMouseDown(pos) {
        this.audio.init();

        // Priority 0: Start game if welcome screen is showing
        if (this.ui.isWelcomeShowingTitle()) {
            this.ui.startGame();
            this.entities.startWelcomeBallsFall();
            return;
        }

        // Priority 1: Help icon
        if (this.ui.isPointInHelpIcon(pos.x, pos.y)) {
            this.ui.toggleHelp();
            return;
        }

        // Priority 2: Delete button
        if (this.ui.isPointInDeleteButton(pos.x, pos.y)) {
            const line = this.ui.getSelectedLine();
            if (line) {
                const cmd = new RemoveLineCommand(this.entities, line);
                this.history.execute(cmd);
            }
            this.ui.deselectLine();
            return;
        }

        // Priority 2: Remove spawner
        const spawner = this.ui.hovered.spawner;
        if (spawner) {
            const cmd = new RemoveSpawnerCommand(this.entities, spawner);
            this.history.execute(cmd);
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
            // Store initial position for undo
            this.dragging.initialX1 = endpoint.line.x1;
            this.dragging.initialY1 = endpoint.line.y1;
            this.dragging.initialX2 = endpoint.line.x2;
            this.dragging.initialY2 = endpoint.line.y2;
            return;
        }

        // Priority 4: Start line drag (move entire line)
        const line = this.ui.hovered.line;
        if (line) {
            this.dragging.active = true;
            this.dragging.type = 'line';
            this.dragging.line = line;

            // Store initial position for undo
            this.dragging.initialX1 = line.x1;
            this.dragging.initialY1 = line.y1;
            this.dragging.initialX2 = line.x2;
            this.dragging.initialY2 = line.y2;

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
            const line = this.dragging.line;
            const finalX1 = line.x1;
            const finalY1 = line.y1;
            const finalX2 = line.x2;
            const finalY2 = line.y2;

            // Only create undo command if position actually changed
            const moved = finalX1 !== this.dragging.initialX1 ||
                         finalY1 !== this.dragging.initialY1 ||
                         finalX2 !== this.dragging.initialX2 ||
                         finalY2 !== this.dragging.initialY2;

            if (moved) {
                // Create command with old position from drag start
                let cmd;
                if (this.dragging.type === 'endpoint') {
                    cmd = new MoveLineEndpointCommand(
                        this.entities,
                        line,
                        this.dragging.endpoint,
                        this.dragging.endpoint === 'start' ? finalX1 : finalX2,
                        this.dragging.endpoint === 'start' ? finalY1 : finalY2
                    );
                    // Override old position with initial position (before drag started)
                    cmd.oldX = this.dragging.endpoint === 'start' ? this.dragging.initialX1 : this.dragging.initialX2;
                    cmd.oldY = this.dragging.endpoint === 'start' ? this.dragging.initialY1 : this.dragging.initialY2;
                } else if (this.dragging.type === 'line') {
                    cmd = new MoveLineCommand(
                        this.entities,
                        line,
                        finalX1,
                        finalY1,
                        finalX2,
                        finalY2
                    );
                    // Override old position with initial position (before drag started)
                    cmd.oldX1 = this.dragging.initialX1;
                    cmd.oldY1 = this.dragging.initialY1;
                    cmd.oldX2 = this.dragging.initialX2;
                    cmd.oldY2 = this.dragging.initialY2;
                }

                // Add to history (command already executed during drag)
                // Don't use execute() since the action already happened
                this.history.undoStack.push(cmd);
                this.history.redoStack = [];

                // Enforce max history size
                if (this.history.undoStack.length > this.history.maxHistorySize) {
                    this.history.undoStack.shift();
                }
            }

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
            const cmd = new AddSpawnerCommand(this.entities, event.x, event.y);
            this.history.execute(cmd);
        }
        // Click = spawn ball (don't track individual balls for undo)
        else if (event.isClick) {
            this.entities.addBall(event.x, event.y);
        }
    }

    // ==================== KEYBOARD ====================

    handleKeyPress(key, ctrlKey, metaKey, shiftKey) {
        // Handle Ctrl+Z (undo) and Ctrl+Y or Ctrl+Shift+Z (redo)
        const cmdKey = ctrlKey || metaKey; // Support both Ctrl and Cmd (Mac)

        if (cmdKey && key.toLowerCase() === 'z') {
            if (shiftKey) {
                // Ctrl+Shift+Z = redo
                this.history.redo();
            } else {
                // Ctrl+Z = undo
                this.history.undo();
            }
            return;
        }

        if (cmdKey && key.toLowerCase() === 'y') {
            // Ctrl+Y = redo
            this.history.redo();
            return;
        }

        // Normalize key to lowercase for consistent handling
        const normalizedKey = key.toLowerCase();

        const handlers = {
            'c': () => {
                const cmd = new ClearAllCommand(this.entities);
                this.history.execute(cmd);
            },
            'delete': () => this.handleDeleteKey(),
            'x': () => this.entities.clearBalls(),
            ' ': () => this.togglePause?.(),
            'backspace': () => this.handleBackspace(),
            'escape': () => this.ui.deselectLine(),
            'h': () => this.ui.toggleHelp(),
            't': () => this.ui.toggleStats()
        };

        const handler = handlers[normalizedKey];
        if (handler) handler();
    }

    clearLinesAndSpawners() {
        const cmd = new ClearAllCommand(this.entities);
        this.history.execute(cmd);
    }

    handleDeleteKey() {
        const line = this.ui.getSelectedLine();
        if (line) {
            const cmd = new RemoveLineCommand(this.entities, line);
            this.history.execute(cmd);
            this.ui.deselectLine();
        } else {
            const cmd = new ClearAllCommand(this.entities);
            this.history.execute(cmd);
        }
    }

    handleBackspace() {
        if (this.entities.lines.length === 0) return;
        const lastLine = this.entities.lines[this.entities.lines.length - 1];
        const cmd = new RemoveLineCommand(this.entities, lastLine);
        this.history.execute(cmd);
    }

    // ==================== HELPERS ====================

    finishDrawing() {
        if (!this.drawing.active) return;

        const cmd = new AddLineCommand(
            this.entities,
            this.drawing.x1,
            this.drawing.y1,
            this.drawing.x2,
            this.drawing.y2
        );
        this.history.execute(cmd);

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
