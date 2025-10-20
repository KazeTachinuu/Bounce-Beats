export class CommandHistory {
    constructor(maxHistorySize = 100) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = maxHistorySize;
    }

    execute(command) {
        command.execute();
        this.undoStack.push(command);
        this.redoStack = [];
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length === 0) return false;
        const command = this.undoStack.pop();
        command.undo();
        this.redoStack.push(command);
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;
        const command = this.redoStack.pop();
        command.execute();
        this.undoStack.push(command);
        return true;
    }
}
