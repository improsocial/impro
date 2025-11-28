class Timer {
  static instances = new Map();

  constructor(label) {
    this.label = label;
    this.startTime = null;
    this.endTime = null;
  }

  start() {
    this.startTime = performance.now();
  }

  end() {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  log(message) {
    const duration = this.endTime - this.startTime;
    const msg = [`${this.label} ${duration}ms`, message]
      .filter(Boolean)
      .join(" ");
    console.info(msg);
  }

  static start(label) {
    let timer = this.instances.get(label);
    if (!timer) {
      timer = new Timer(label);
      this.instances.set(label, timer);
    }
    timer.start();
  }

  static end(label) {
    const timer = this.instances.get(label);
    if (!timer) {
      throw new Error(`Timer not found: ${label}`);
    }
    timer.end();
    timer.log();
  }
}

window.timer = Timer;
