import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('file-loader')
export class FileLoader extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
    }
    .drop-zone {
      width: 500px;
      max-width: 90%;
      padding: 48px 32px;
      border: 2px dashed var(--border);
      border-radius: var(--radius);
      text-align: center;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s;
    }
    .drop-zone.dragover {
      border-color: var(--accent);
      background: rgba(122, 162, 247, 0.05);
    }
    .drop-zone h2 {
      color: var(--text-primary);
      margin-bottom: 8px;
      font-size: 18px;
    }
    .drop-zone p {
      color: var(--text-muted);
      font-size: 13px;
    }
    input[type="file"] { display: none; }
    .progress {
      width: 500px;
      max-width: 90%;
    }
    .progress-bar {
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--accent);
      transition: width 0.3s;
    }
    .status {
      color: var(--text-secondary);
      font-size: 13px;
      text-align: center;
    }
    .file-info {
      color: var(--text-muted);
      font-size: 12px;
    }
  `;

  @state() private dragover = false;
  @state() private loading = false;
  @state() private progress = 0;
  @state() private statusText = '';

  render() {
    if (this.loading) {
      return html`
        <div class="progress">
          <div class="status">${this.statusText}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${this.progress}%"></div>
          </div>
        </div>
      `;
    }

    return html`
      <div
        class="drop-zone ${this.dragover ? 'dragover' : ''}"
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
        @click=${this.onClick}
      >
        <h2>Load Solidity Compiler Output</h2>
        <p>Drop a build-info JSON, standard-json output, or combined-json file here</p>
        <p class="file-info">Supports files up to 500MB+</p>
      </div>
      <input type="file" accept=".json" @change=${this.onFileSelect} />
    `;
  }

  private onDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragover = true;
  }

  private onDragLeave() {
    this.dragover = false;
  }

  private onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragover = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  private onClick() {
    this.shadowRoot?.querySelector('input')?.click();
  }

  private onFileSelect(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
  }

  private async processFile(file: File) {
    this.loading = true;
    this.progress = 10;
    this.statusText = `Reading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`;

    try {
      const text = await file.text();
      this.progress = 50;
      this.statusText = 'Parsing AST...';

      this.dispatchEvent(new CustomEvent('file-loaded', {
        detail: { jsonStr: text, fileName: file.name },
        bubbles: true,
        composed: true,
      }));
    } catch (err) {
      this.statusText = `Error: ${err}`;
      this.loading = false;
    }
  }

  setProgress(progress: number, status: string) {
    this.progress = progress;
    this.statusText = status;
  }

  reset() {
    this.loading = false;
    this.progress = 0;
    this.statusText = '';
  }
}
