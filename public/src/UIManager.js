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
            line: null,
            lines: [],
            spawners: []
        };

        // Area selection
        this.areaSelection = {
            active: false,
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0
        };

        // Multi-selection resize
        this.multiSelectionBounds = null;
        this.resizeHandle = null;

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

    selectMultiple(lines, spawners) {
        this.selected.lines = lines;
        this.selected.spawners = spawners;
    }

    deselectMultiple() {
        this.selected.lines = [];
        this.selected.spawners = [];
    }

    getSelectedMultiple() {
        return {
            lines: this.selected.lines,
            spawners: this.selected.spawners
        };
    }

    hasMultipleSelection() {
        return this.selected.lines.length > 0 || this.selected.spawners.length > 0;
    }

    // ==================== AREA SELECTION ====================

    startAreaSelection(x, y) {
        this.areaSelection.active = true;
        this.areaSelection.x1 = x;
        this.areaSelection.y1 = y;
        this.areaSelection.x2 = x;
        this.areaSelection.y2 = y;
    }

    updateAreaSelection(x, y) {
        if (!this.areaSelection.active) return;
        this.areaSelection.x2 = x;
        this.areaSelection.y2 = y;
    }

    finishAreaSelection() {
        this.areaSelection.active = false;
    }

    getAreaSelection() {
        if (!this.areaSelection.active) return null;
        return this.areaSelection;
    }

    getAreaSelectionBounds() {
        const x1 = Math.min(this.areaSelection.x1, this.areaSelection.x2);
        const y1 = Math.min(this.areaSelection.y1, this.areaSelection.y2);
        const x2 = Math.max(this.areaSelection.x1, this.areaSelection.x2);
        const y2 = Math.max(this.areaSelection.y1, this.areaSelection.y2);
        return { x1, y1, x2, y2 };
    }

    // ==================== MULTI-SELECTION RESIZE ====================

    setMultiSelectionBounds(boundsAndHandles) {
        this.multiSelectionBounds = boundsAndHandles;
    }

    findResizeHandle(x, y) {
        if (!this.multiSelectionBounds || !this.multiSelectionBounds.handles) return null;

        const handleSize = 10;
        for (const handle of this.multiSelectionBounds.handles) {
            const dist = Math.hypot(x - handle.x, y - handle.y);
            if (dist < handleSize) {
                return handle;
            }
        }
        return null;
    }

    setResizeHandle(handle) {
        this.resizeHandle = handle;
    }

    getResizeHandle() {
        return this.resizeHandle;
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

    getCursor(mouseX, mouseY) {
        // Priority order for cursor feedback (most specific to least)
        if (this.resizeHandle) return this.resizeHandle.cursor;
        if (this.hovered.endpoint) return 'move';
        if (this.hovered.spawner) return 'pointer';
        if (this.hovered.line) return 'move'; // Move cursor when hovering line (can drag)

        // Show move cursor when hovering inside multi-selection box
        if (this.hasMultipleSelection() && this.multiSelectionBounds && mouseX !== undefined && mouseY !== undefined) {
            const bounds = this.multiSelectionBounds.bounds;
            const insideBox = mouseX >= bounds.minX && mouseX <= bounds.maxX &&
                             mouseY >= bounds.minY && mouseY <= bounds.maxY;
            if (insideBox) return 'move';
        }

        return 'crosshair';
    }
}
