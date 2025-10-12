/**
 * UIManager - Manages all UI state and rendering coordination
 * Single place for hover states, selection, UI elements
 */
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
            visible: true,
            showTime: Date.now()
        };

        // Stats panel
        this.stats = {
            visible: true
        };
    }

    // ==================== HOVER ====================

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

    // ==================== SELECTION ====================

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

    // ==================== DELETE BUTTON ====================

    setDeleteButton(bounds) {
        this.deleteButton = bounds;
    }

    isPointInDeleteButton(x, y) {
        if (!this.deleteButton) return false;
        const btn = this.deleteButton;
        return x >= btn.x && x <= btn.x + btn.width &&
               y >= btn.y && y <= btn.y + btn.height;
    }

    // ==================== HELP ICON ====================

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

    // ==================== HELP ====================

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

        // Auto-hide when fade completes
        if (!isVisible && this.help.visible) {
            this.help.visible = false;
        }

        return isVisible;
    }

    getHelpAlpha() {
        const elapsed = Date.now() - this.help.showTime;
        if (elapsed > 3000) {
            return 1 - (elapsed - 3000) / 2000;
        }
        return 1;
    }

    // ==================== CURSOR ====================

    getCursor() {
        if (this.hovered.spawner) return 'pointer';
        if (this.hovered.endpoint) return 'move';
        if (this.hovered.line) return 'pointer';
        return 'crosshair';
    }
}
