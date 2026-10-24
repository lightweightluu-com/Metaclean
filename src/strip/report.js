// Sammelt, was gefunden und entfernt wurde. Lebt nur im Arbeitsspeicher.

export class Report {
  constructor() { this.items = []; this.actions = []; this.warnings = []; }
  found(label, value) {
    const v = (value || '').trim();
    if (!v) return;
    if (this.items.some((i) => i.label === label && i.value === v)) return;
    this.items.push({ label, value: v });
  }
  action(text) { if (!this.actions.includes(text)) this.actions.push(text); }
  warn(text) { if (!this.warnings.includes(text)) this.warnings.push(text); }
  toJSON() { return { found: this.items, actions: this.actions, warnings: this.warnings }; }
}

// Fehler mit verständlicher Meldung für die Oberfläche
export class UserError extends Error {
  constructor(message) { super(message); this.user = true; }
}
