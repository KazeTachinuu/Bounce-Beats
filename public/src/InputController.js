/**
 * InputController - Handles all user input
 * Single source of truth for mouse/keyboard/touch state
 */
import { INTERACTION_CONFIG } from './constants.js';

export class InputController {
    constructor(canvas) {
        this.canvas = canvas;

        // Mouse state
        this.mouse = {
            x: 0,
            y: 0,
            isDown: false,
            downTime: 0,
            downX: 0,
            downY: 0
        };

        // Bind events
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Event callbacks (set by game)
        this.onMouseDown = null;
        this.onMouseMove = null;
        this.onMouseUp = null;
        this.onKeyPress = null;
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleMouseDown(e) {
        const { x, y } = this.getCanvasCoordinates(e);

        this.mouse.isDown = true;
        this.mouse.downTime = Date.now();
        this.mouse.downX = x;
        this.mouse.downY = y;

        if (this.onMouseDown) {
            this.onMouseDown({ x, y });
        }
    }

    handleMouseMove(e) {
        const { x, y } = this.getCanvasCoordinates(e);

        this.mouse.x = x;
        this.mouse.y = y;

        if (this.onMouseMove) {
            this.onMouseMove({ x, y });
        }
    }

    handleMouseUp(e) {
        const { x, y } = this.getCanvasCoordinates(e);

        const holdDuration = Date.now() - this.mouse.downTime;

        if (this.onMouseUp) {
            this.onMouseUp({
                x,
                y,
                downX: this.mouse.downX,
                downY: this.mouse.downY,
                holdDuration,
                isClick: holdDuration < INTERACTION_CONFIG.clickThreshold,
                isHold: holdDuration >= INTERACTION_CONFIG.holdThreshold
            });
        }

        this.mouse.isDown = false;
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseDown({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseMove({
            clientX: touch.clientX,
            clientY: touch.clientY
        });
    }

    handleTouchEnd(e) {
        e.preventDefault();
        // Reuse current mouse position (already in canvas coordinates)
        this.handleMouseUp({
            clientX: this.mouse.x + this.canvas.getBoundingClientRect().left,
            clientY: this.mouse.y + this.canvas.getBoundingClientRect().top
        });
    }

    handleKeyDown(e) {
        if (this.onKeyPress) {
            this.onKeyPress(e.key);
        }
    }

    getHoldDuration() {
        if (!this.mouse.isDown) return 0;
        return Date.now() - this.mouse.downTime;
    }

    setCursor(cursor) {
        this.canvas.style.cursor = cursor;
    }
}
