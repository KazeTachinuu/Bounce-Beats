export class UIManager {
    constructor() {
        // Hover states
        this.hovered = {
            line: null,
            spawner: null,
            endpoint: null
        };

        // Selection state
        this.selected = {
            line: null
        };

        // UI elements
        this.deleteButton = null;
        this.helpIcon = null;

        // Help overlay
        this.help = {
            visible: false,
            showTime: 0
        };

        // Stats panel
        this.stats = {
            visible: true
        };

        this.welcome = {
            isActive: true,
            startTime: Date.now(),
            clickedToStart: false,
            ballsFalling: false,
            ballsFallTime: 0,
            ballsCreated: false
        };
    }

    needsWelcomeBalls() {
        return this.welcome.isActive && !this.welcome.ballsCreated;
    }

    markWelcomeBallsCreated() {
        this.welcome.ballsCreated = true;
    }

    setHoveredLine(line) {
        this.hovered.line = line;
    }

    setHoveredSpawner(spawner) {
        this.hovered.spawner = spawner;
    }

    setHoveredEndpoint(endpoint) {
        this.hovered.endpoint = endpoint;
    }

    clearHover() {
        this.hovered.line = null;
        this.hovered.spawner = null;
        this.hovered.endpoint = null;
    }

    selectLine(line) {
        this.selected.line = line;
    }

    deselectLine() {
        this.selected.line = null;
        this.deleteButton = null;
    }

    getSelectedLine() {
        return this.selected.line;
    }

    setDeleteButton(bounds) {
        this.deleteButton = bounds;
    }

    isPointInDeleteButton(x, y) {
        if (!this.deleteButton) return false;
        const btn = this.deleteButton;
        return x >= btn.x && x <= btn.x + btn.width &&
               y >= btn.y && y <= btn.y + btn.height;
    }

    setHelpIcon(bounds) {
        this.helpIcon = bounds;
    }

    isPointInHelpIcon(x, y) {
        if (!this.helpIcon) return false;
        const icon = this.helpIcon;
        const centerX = icon.x + icon.width / 2;
        const centerY = icon.y + icon.height / 2;
        const radius = icon.width / 2;
        const distance = Math.hypot(x - centerX, y - centerY);
        return distance <= radius;
    }

    toggleHelp() {
        this.help.visible = !this.help.visible;
        this.help.showTime = Date.now();
    }

    toggleStats() {
        this.stats.visible = !this.stats.visible;
    }

    shouldShowStats() {
        return this.stats.visible;
    }

    shouldShowHelp() {
        if (!this.help.visible) return false;
        const elapsed = Date.now() - this.help.showTime;
        const isVisible = elapsed < 5000;
        if (!isVisible && this.help.visible) this.help.visible = false;
        return isVisible;
    }

    getHelpAlpha() {
        const elapsed = Date.now() - this.help.showTime;
        if (elapsed > 3000) {
            return 1 - (elapsed - 3000) / 2000;
        }
        return 1;
    }

    isWelcomeActive() {
        return this.welcome.isActive;
    }

    isWelcomeShowingTitle() {
        return this.welcome.isActive && !this.welcome.clickedToStart;
    }

    startGame() {
        if (!this.welcome.isActive) return false;

        this.welcome.clickedToStart = true;
        this.welcome.ballsFalling = true;
        this.welcome.ballsFallTime = Date.now();
        return true;
    }

    isWelcomeBallsFalling() {
        return this.welcome.ballsFalling;
    }

    finishWelcome() {
        const elapsed = Date.now() - this.welcome.ballsFallTime;
        if (elapsed > 5000) {
            this.welcome.isActive = false;
            this.welcome.ballsFalling = false;
        }
    }

    getCursor() {
        if (this.hovered.spawner) return 'pointer';
        if (this.hovered.endpoint) return 'move';
        if (this.hovered.line) return 'pointer';
        return 'crosshair';
    }
}
