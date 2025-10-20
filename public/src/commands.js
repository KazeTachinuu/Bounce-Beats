export class Command {
    execute() { throw new Error('execute() must be implemented'); }
    undo() { throw new Error('undo() must be implemented'); }
}

export class AddLineCommand extends Command {
    constructor(entities, x1, y1, x2, y2) {
        super();
        this.entities = entities;
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.line = null;
    }

    execute() {
        this.line = this.entities.addLine(this.x1, this.y1, this.x2, this.y2);
        return this.line;
    }

    undo() {
        if (this.line) {
            this.entities.removeLine(this.line);
        }
    }
}

export class RemoveLineCommand extends Command {
    constructor(entities, line) {
        super();
        this.entities = entities;
        this.line = line;
        // Store line data for undo
        this.x1 = line.x1;
        this.y1 = line.y1;
        this.x2 = line.x2;
        this.y2 = line.y2;
    }

    execute() {
        this.entities.removeLine(this.line);
    }

    undo() {
        // Recreate the line
        this.line = this.entities.addLine(this.x1, this.y1, this.x2, this.y2);
    }
}

export class MoveLineEndpointCommand extends Command {
    constructor(entities, line, endpoint, newX, newY) {
        super();
        this.entities = entities;
        this.line = line;
        this.endpoint = endpoint;
        this.newX = newX;
        this.newY = newY;
        // Store old position
        this.oldX = endpoint === 'start' ? line.x1 : line.x2;
        this.oldY = endpoint === 'start' ? line.y1 : line.y2;
    }

    execute() {
        this.entities.updateLineEndpoint(this.line, this.endpoint, this.newX, this.newY);
    }

    undo() {
        this.entities.updateLineEndpoint(this.line, this.endpoint, this.oldX, this.oldY);
    }
}

export class MoveLineCommand extends Command {
    constructor(entities, line, newX1, newY1, newX2, newY2) {
        super();
        this.entities = entities;
        this.line = line;
        // Store old position
        this.oldX1 = line.x1;
        this.oldY1 = line.y1;
        this.oldX2 = line.x2;
        this.oldY2 = line.y2;
        // Store new position
        this.newX1 = newX1;
        this.newY1 = newY1;
        this.newX2 = newX2;
        this.newY2 = newY2;
    }

    execute() {
        this.entities.updateLinePosition(this.line, this.newX1, this.newY1, this.newX2, this.newY2);
    }

    undo() {
        this.entities.updateLinePosition(this.line, this.oldX1, this.oldY1, this.oldX2, this.oldY2);
    }
}

export class AddSpawnerCommand extends Command {
    constructor(entities, x, y) {
        super();
        this.entities = entities;
        this.x = x;
        this.y = y;
        this.spawner = null;
    }

    execute() {
        this.spawner = this.entities.addSpawner(this.x, this.y);
        return this.spawner;
    }

    undo() {
        if (this.spawner) {
            this.entities.removeSpawner(this.spawner);
        }
    }
}

export class RemoveSpawnerCommand extends Command {
    constructor(entities, spawner) {
        super();
        this.entities = entities;
        this.spawner = spawner;
        // Store spawner data for undo
        this.x = spawner.x;
        this.y = spawner.y;
    }

    execute() {
        this.entities.removeSpawner(this.spawner);
    }

    undo() {
        // Recreate the spawner
        this.spawner = this.entities.addSpawner(this.x, this.y);
    }
}

export class BatchCommand extends Command {
    constructor(commands = []) {
        super();
        this.commands = commands;
    }

    addCommand(command) {
        this.commands.push(command);
    }

    execute() {
        this.commands.forEach(cmd => cmd.execute());
    }

    undo() {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            this.commands[i].undo();
        }
    }

    isEmpty() {
        return this.commands.length === 0;
    }
}

export class ClearAllCommand extends Command {
    constructor(entities) {
        super();
        this.entities = entities;
        this.lines = [];
        this.spawners = [];
    }

    execute() {
        // Store all current lines and spawners
        this.lines = [...this.entities.lines];
        this.spawners = [...this.entities.spawners];

        // Store their data
        this.lineData = this.lines.map(line => ({
            x1: line.x1,
            y1: line.y1,
            x2: line.x2,
            y2: line.y2
        }));

        this.spawnerData = this.spawners.map(spawner => ({
            x: spawner.x,
            y: spawner.y
        }));

        // Clear everything
        this.entities.clearLines();
        this.entities.clearSpawners();
    }

    undo() {
        // Recreate all lines
        this.lineData.forEach(data => {
            this.entities.addLine(data.x1, data.y1, data.x2, data.y2);
        });

        // Recreate all spawners
        this.spawnerData.forEach(data => {
            this.entities.addSpawner(data.x, data.y);
        });
    }
}
