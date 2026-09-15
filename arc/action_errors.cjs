// Supplement the JSON reporter, which omits ordinary API steps. Never change results.
const fs = require('fs');
const path = require('path');
const clip = (text, limit) => Array.from(String(text)).slice(0, limit).join('');
module.exports = class ActionErrors {
  constructor(options = {}) { this.output = options.output || 'action-errors.json'; this.rows = {}; }
  onTestEnd(test, result) {
    const errors = [];
    const seen = new Set();
    const visit = steps => {
      for (const step of steps || []) {
        const message = String(step.error?.message || '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
        if (step.category === 'pw:api' && message && !seen.has(message)) {
          seen.add(message);
          const location = step.location ? ` at ${clip(path.basename(step.location.file), 160)}:${step.location.line}` : '';
          errors.push({ order: errors.length, duration: step.duration || 0,
            text: `${clip(step.title, 200)} (${step.duration || 0} ms)${location}:\n${clip(message, 1800)}` });
        }
        visit(step.steps);
      }
    };
    visit(result.steps);
    // Keep the most time-consuming failures, then present them in execution order.
    this.rows[test.id] = errors.sort((a,b) => b.duration-a.duration).slice(0,8)
      .sort((a,b) => a.order-b.order).map(e => clip(e.text, 2000));
  }
  onEnd() {
    try { fs.writeFileSync(this.output, JSON.stringify(this.rows)); }
    catch (error) { console.error(`[action diagnostics] ${error.message}`); }
  }
};
