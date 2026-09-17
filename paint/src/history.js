export class History {
  constructor(limit = 120) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  record(previousState) {
    this.undoStack.push(previousState);

    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }

    this.redoStack = [];
  }

  undo(currentState) {
    if (this.undoStack.length === 0) {
      return null;
    }

    this.redoStack.push(currentState);
    return this.undoStack.pop();
  }

  redo(currentState) {
    if (this.redoStack.length === 0) {
      return null;
    }

    this.undoStack.push(currentState);
    return this.redoStack.pop();
  }

  reset() {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }
}
