const KEY_MAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  KeyZ: 'jump',
  KeyJ: 'attack',
  KeyX: 'attack',
  KeyK: 'throw',
  ShiftLeft: 'roll',
  ShiftRight: 'roll',
  KeyC: 'roll',
  Escape: 'pause',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
};

export class Input {
  constructor(target = window) {
    this.held = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.anyPressed = false;

    target.addEventListener('keydown', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      e.preventDefault();
      if (!this.held.has(action)) {
        this.held.add(action);
        this.pressed.add(action);
        this.anyPressed = true;
      }
    });

    target.addEventListener('keyup', (e) => {
      const action = KEY_MAP[e.code];
      if (!action) return;
      e.preventDefault();
      this.held.delete(action);
      this.released.add(action);
    });

    window.addEventListener('blur', () => this.held.clear());
  }

  down(action) {
    return this.held.has(action);
  }

  wasPressed(action) {
    return this.pressed.has(action);
  }

  wasReleased(action) {
    return this.released.has(action);
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.anyPressed = false;
  }

  pressVirtual(action) {
    if (!this.held.has(action)) {
      this.held.add(action);
      this.pressed.add(action);
      this.anyPressed = true;
    }
  }

  releaseVirtual(action) {
    this.held.delete(action);
    this.released.add(action);
  }
}

export function bindTouchControls(input, root = document) {
  const buttons = root.querySelectorAll('[data-action]');
  buttons.forEach((el) => {
    const action = el.dataset.action;
    const press = (e) => {
      e.preventDefault();
      el.classList.add('active');
      input.pressVirtual(action);
    };
    const release = (e) => {
      if (e) e.preventDefault();
      el.classList.remove('active');
      input.releaseVirtual(action);
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}
