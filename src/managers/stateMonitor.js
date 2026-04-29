const vscode = require('vscode');
const { globalState } = require('../state/globalState');
const { isSessionRunning } = require('../debug');
const portManager = require('./portManager');

const ACTIVE_POLL_MS = 1000;
const IDLE_POLL_MS = 2000;

class StateMonitor {
    constructor() {
        this.state = 'idle';
        this.lastPort = null;
        this.timer = null;
        this.disposed = false;
        this._emitter = new vscode.EventEmitter();
        this.onDidChangeState = this._emitter.event;
    }

    activate() {
        this.runTick();
    }

    async runTick() {
        if (this.disposed) return;
        await this.tick();
        if (this.disposed) return;
        const delay = this.state === 'idle' ? IDLE_POLL_MS : ACTIVE_POLL_MS;
        this.timer = setTimeout(() => this.runTick(), delay);
    }

    async tick() {
        const port = globalState.tcpPort;
        let next;
        if (isSessionRunning()) {
            next = 'attached';
        } else if (portManager.isPolling()) {
            // Hold last known state while the attach polling loop owns the port.
            next = this.state;
        } else {
            const open = await portManager.isPortOpen(port);
            next = open ? 'ready' : 'idle';
        }
        if (next !== this.state || port !== this.lastPort) {
            this.state = next;
            this.lastPort = port;
            this._emitter.fire(next);
        }
    }

    dispose() {
        this.disposed = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this._emitter.dispose();
    }
}

module.exports = { StateMonitor };
