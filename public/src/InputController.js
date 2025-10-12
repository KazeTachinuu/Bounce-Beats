/**
 * InputController - Handles all user input
 * Single source of truth for mouse/keyboard/touch state
 */
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

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.mouse.isDown = true;
        this.mouse.downTime = Date.now();
        this.mouse.downX = x;
        this.mouse.downY = y;

        if (this.onMouseDown) {
            this.onMouseDown({ x, y });
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.mouse.x = x;
        this.mouse.y = y;

        if (this.onMouseMove) {
            this.onMouseMove({ x, y });
        }
    }

    handleMouseUp(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const holdDuration = Date.now() - this.mouse.downTime;

        if (this.onMouseUp) {
            this.onMouseUp({
                x,
                y,
                downX: this.mouse.downX,
                downY: this.mouse.downY,
                holdDuration,
                isClick: holdDuration < 200,
                isHold: holdDuration >= 500
            });
        }

        this.mouse.isDown = false;
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
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
        const rect = this.canvas.getBoundingClientRect();
        this.handleMouseUp({
            clientX: this.mouse.x + rect.left,
            clientY: this.mouse.y + rect.top
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
