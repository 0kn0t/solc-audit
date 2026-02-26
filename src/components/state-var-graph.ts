import { LitElement, html, svg, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { StateVarAccess } from '../types';

@customElement('state-var-graph')
export class StateVarGraph extends LitElement {
  static styles = css`
    :host { display: block; padding: 20px; overflow: auto; height: 100%; }
    h2 { color: var(--text-primary); margin-bottom: 16px; font-size: 18px; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tabs button { font-size: 12px; padding: 4px 12px; }
    .tabs button.active { background: var(--accent); color: var(--bg-primary); }

    .filter-hint {
      font-size: 11px; color: var(--text-muted); margin-bottom: 12px;
      font-style: italic;
    }

    /* Conflict table */
    .conflict-table { font-size: 13px; }
    .flag { color: var(--orange); font-weight: 600; }
    .multi-writer { background: rgba(247, 118, 142, 0.1); }
    .func-list { font-size: 12px; color: var(--text-secondary); }
    .read-badge { color: var(--accent); font-size: 11px; }
    .write-badge { color: var(--red); font-size: 11px; }
    .rw-badge { color: var(--purple); font-size: 11px; }

    /* Coupling heatmap */
    .heatmap-container { overflow: auto; }
    .heatmap table { font-size: 11px; border-collapse: collapse; }
    .heatmap th {
      max-width: 100px; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; font-size: 10px; padding: 4px;
    }
    .heatmap th.rotated {
      writing-mode: vertical-rl; transform: rotate(180deg);
      height: 100px; text-align: left;
    }
    .heatmap th.clickable { cursor: pointer; user-select: none; }
    .heatmap th.clickable:hover { color: var(--accent); }
    .heatmap th.disabled { opacity: 0.3; text-decoration: line-through; }
    .heatmap td {
      width: 28px; height: 28px; text-align: center; font-size: 10px;
      border: 1px solid var(--bg-primary);
    }
    .heatmap td.disabled-cell { opacity: 0.15; }

    .bipartite { overflow: auto; }
    .bipartite svg { width: 100%; min-height: 300px; }
    .var-node { fill: var(--bg-tertiary); stroke: var(--border); }
    .var-node.disabled { fill: var(--bg-primary); stroke: var(--border); opacity: 0.3; }
    .func-node { fill: var(--bg-secondary); stroke: var(--border); }
    .func-node.disabled { fill: var(--bg-primary); stroke: var(--border); opacity: 0.3; }
    .edge-read { stroke: var(--accent); stroke-width: 1; opacity: 0.5; }
    .edge-write { stroke: var(--red); stroke-width: 1.5; opacity: 0.6; }
    .edge-rw { stroke: var(--purple); stroke-width: 2; opacity: 0.7; }
    .edge-disabled { stroke: var(--border); stroke-width: 0.5; opacity: 0.1; }
    text { font-size: 11px; fill: var(--text-secondary); }
    text.disabled { opacity: 0.3; text-decoration: line-through; }
    .clickable-node { cursor: pointer; }
    .clickable-node:hover text { fill: var(--accent); }

    .filter-bar {
      display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .filter-bar button {
      font-size: 10px; padding: 2px 8px; border: 1px solid var(--border);
      background: var(--bg-secondary); color: var(--text-secondary);
      border-radius: 3px; cursor: pointer;
    }
    .filter-bar button:hover { border-color: var(--accent); color: var(--accent); }
    .filter-count { font-size: 10px; color: var(--text-muted); }
  `;

  @property({ type: Array }) data: StateVarAccess[] = [];
  @property({ type: String }) scopeLabel = '';
  @state() private view: 'conflict' | 'heatmap' | 'bipartite' = 'conflict';
  @state() private disabledVars = new Set<number>();
  @state() private disabledFuncs = new Set<number>();

  private toggleVar(varId: number) {
    const next = new Set(this.disabledVars);
    if (next.has(varId)) next.delete(varId); else next.add(varId);
    this.disabledVars = next;
  }

  private toggleFunc(funcId: number) {
    const next = new Set(this.disabledFuncs);
    if (next.has(funcId)) next.delete(funcId); else next.add(funcId);
    this.disabledFuncs = next;
  }

  private enableAll() {
    this.disabledVars = new Set();
    this.disabledFuncs = new Set();
  }

  private get activeData(): StateVarAccess[] {
    return this.data.filter(v => !this.disabledVars.has(v.varId));
  }

  private get hasFilters(): boolean {
    return this.disabledVars.size > 0 || this.disabledFuncs.size > 0;
  }

  render() {
    if (!this.data.length) {
      return html`<div class="empty-state">No state variable access data</div>`;
    }

    return html`
      <h2>State Variable Compositional Analysis</h2>
      ${this.scopeLabel ? html`<div style="color: var(--text-muted); font-size: 12px; margin-bottom: 12px;">Scoped to ${this.scopeLabel}</div>` : ''}
      <div class="tabs">
        <button class="${this.view === 'conflict' ? 'active' : ''}" @click=${() => this.view = 'conflict'}>Conflict Table</button>
        <button class="${this.view === 'heatmap' ? 'active' : ''}" @click=${() => this.view = 'heatmap'}>Coupling Heatmap</button>
        <button class="${this.view === 'bipartite' ? 'active' : ''}" @click=${() => this.view = 'bipartite'}>Bipartite Graph</button>
      </div>
      ${this.hasFilters ? html`
        <div class="filter-bar">
          <span class="filter-count">
            ${this.disabledVars.size > 0 ? `${this.disabledVars.size} vars hidden` : ''}
            ${this.disabledVars.size > 0 && this.disabledFuncs.size > 0 ? ', ' : ''}
            ${this.disabledFuncs.size > 0 ? `${this.disabledFuncs.size} funcs hidden` : ''}
          </span>
          <button @click=${this.enableAll}>Show All</button>
        </div>
      ` : ''}
      ${this.view === 'conflict' ? this.renderConflictTable() : ''}
      ${this.view === 'heatmap' ? this.renderHeatmap() : ''}
      ${this.view === 'bipartite' ? this.renderBipartite() : ''}
    `;
  }

  private renderConflictTable() {
    return html`
      <div class="filter-hint">Click variable names or function badges to toggle visibility across all views</div>
      <table class="conflict-table">
        <thead>
          <tr>
            <th>Variable</th><th>Type</th><th>Contract</th>
            <th>Readers</th><th>Writers</th><th>Flags</th>
          </tr>
        </thead>
        <tbody>
          ${this.data.map(v => {
            const isVarDisabled = this.disabledVars.has(v.varId);
            const multiWriter = v.writers.length > 1;
            const rwFuncs = v.readers.filter(r => v.writers.some(w => w.funcId === r.funcId));
            return html`
              <tr class="${multiWriter && !isVarDisabled ? 'multi-writer' : ''}" style="${isVarDisabled ? 'opacity: 0.3' : ''}">
                <td>
                  <span style="cursor: pointer; ${isVarDisabled ? 'text-decoration: line-through' : ''}"
                        title="Click to ${isVarDisabled ? 'show' : 'hide'}"
                        @click=${() => this.toggleVar(v.varId)}>
                    ${v.varName}
                  </span>
                </td>
                <td style="color: var(--cyan); font-size: 12px;">${v.typeString}</td>
                <td style="color: var(--text-muted)">${v.contractName}</td>
                <td class="func-list">
                  ${v.readers.map(r => {
                    const dis = this.disabledFuncs.has(r.funcId);
                    return html`<span class="read-badge" style="cursor: pointer; ${dis ? 'opacity: 0.3; text-decoration: line-through' : ''}"
                      title="Click to ${dis ? 'show' : 'hide'} ${r.funcName}"
                      @click=${() => this.toggleFunc(r.funcId)}>${r.funcName}</span> `;
                  })}
                </td>
                <td class="func-list">
                  ${v.writers.map(w => {
                    const dis = this.disabledFuncs.has(w.funcId);
                    return html`<span class="write-badge" style="cursor: pointer; ${dis ? 'opacity: 0.3; text-decoration: line-through' : ''}"
                      title="Click to ${dis ? 'show' : 'hide'} ${w.funcName}"
                      @click=${() => this.toggleFunc(w.funcId)}>${w.funcName}</span> `;
                  })}
                </td>
                <td>
                  ${multiWriter ? html`<span class="flag">Multi-writer</span> ` : ''}
                  ${rwFuncs.length > 0 ? html`<span class="flag">R+W</span>` : ''}
                </td>
              </tr>
            `;
          })}
        </tbody>
      </table>
    `;
  }

  private renderHeatmap() {
    // Build function coupling matrix: shared state var count
    // Only count vars that are not disabled
    const activeVarIds = new Set(this.activeData.map(v => v.varId));
    const varIdToName = new Map(this.data.map(v => [v.varId, v.varName]));

    const funcMap = new Map<number, { name: string; vars: Set<number>; allVars: Set<number> }>();
    for (const v of this.data) {
      for (const f of [...v.readers, ...v.writers]) {
        if (!funcMap.has(f.funcId)) {
          funcMap.set(f.funcId, { name: f.funcName, vars: new Set(), allVars: new Set() });
        }
        const entry = funcMap.get(f.funcId)!;
        entry.allVars.add(v.varId);
        if (activeVarIds.has(v.varId)) {
          entry.vars.add(v.varId);
        }
      }
    }

    const funcs = Array.from(funcMap.entries()).map(([id, { name, vars, allVars }]) => ({ id, name, vars, allVars }));

    if (funcs.length === 0) {
      return html`<div style="color: var(--text-muted)">No functions touch state variables</div>`;
    }

    return html`
      <div class="filter-hint">Click function names (row/column headers) to toggle visibility</div>
      <div class="heatmap-container">
        <div class="heatmap">
          <table>
            <tr>
              <th></th>
              ${funcs.map(f => {
                const dis = this.disabledFuncs.has(f.id);
                return html`<th class="rotated clickable ${dis ? 'disabled' : ''}"
                  title="${f.name} — click to ${dis ? 'show' : 'hide'}"
                  @click=${() => this.toggleFunc(f.id)}>${f.name}</th>`;
              })}
            </tr>
            ${funcs.map(row => {
              const rowDis = this.disabledFuncs.has(row.id);
              return html`
              <tr>
                <th class="clickable ${rowDis ? 'disabled' : ''}"
                    title="${row.name} — click to ${rowDis ? 'show' : 'hide'}"
                    style="text-align: right; padding-right: 8px;"
                    @click=${() => this.toggleFunc(row.id)}>
                  ${row.name}
                </th>
                ${funcs.map(col => {
                  const colDis = this.disabledFuncs.has(col.id);
                  const cellDis = rowDis || colDis;
                  const sharedVarIds = [...row.vars].filter(v => col.vars.has(v));
                  const shared = sharedVarIds.length;
                  const maxShared = Math.max(row.vars.size, col.vars.size, 1);
                  const intensity = shared / maxShared;
                  const bg = cellDis || shared === 0
                    ? 'transparent'
                    : `rgba(122, 162, 247, ${0.1 + intensity * 0.6})`;
                  const varNames = sharedVarIds.map(id => varIdToName.get(id) ?? `var#${id}`).join(', ');
                  const tip = shared > 0
                    ? `${row.name} / ${col.name}: ${shared} shared — ${varNames}`
                    : `${row.name} / ${col.name}: no shared vars`;
                  return html`
                    <td class="${cellDis ? 'disabled-cell' : ''}"
                        style="background: ${bg}"
                        title="${tip}">
                      ${shared > 0 && !cellDis ? shared : ''}
                    </td>
                  `;
                })}
              </tr>
            `})}
          </table>
        </div>
      </div>
    `;
  }

  private renderBipartite() {
    const vars = this.data;
    const funcSet = new Map<number, string>();
    for (const v of vars) {
      for (const f of [...v.readers, ...v.writers]) {
        funcSet.set(f.funcId, f.funcName);
      }
    }
    const funcs = Array.from(funcSet.entries()).map(([id, name]) => ({ id, name }));

    const w = 800;
    const padding = 150;
    const spacing = 28;

    const varY = (i: number) => 20 + i * spacing;
    const funcY = (i: number) => 20 + i * spacing;
    const funcIdxMap = new Map(funcs.map((f, i) => [f.id, i]));

    const svgH = Math.max(vars.length, funcs.length) * spacing + 40;

    return html`
      <div class="filter-hint">Click variables (left) or functions (right) to toggle visibility</div>
      <div class="bipartite">
        <svg viewBox="0 0 ${w} ${svgH}" style="height: ${svgH}px">
          ${svg`
            <!-- Edges -->
            ${vars.flatMap((v, vi) => {
              const varDis = this.disabledVars.has(v.varId);
              const writerIds = new Set(v.writers.map(w => w.funcId));
              const readerIds = new Set(v.readers.map(r => r.funcId));
              const allFuncIds = new Set([...writerIds, ...readerIds]);
              return [...allFuncIds].map(fid => {
                const fi = funcIdxMap.get(fid);
                if (fi === undefined) return svg``;
                const funcDis = this.disabledFuncs.has(fid);
                const edgeDis = varDis || funcDis;
                if (edgeDis) {
                  return svg`<line x1="${padding}" y1="${varY(vi)}" x2="${w - padding}" y2="${funcY(fi)}" class="edge-disabled" />`;
                }
                const isRead = readerIds.has(fid);
                const isWrite = writerIds.has(fid);
                const cls = isRead && isWrite ? 'edge-rw' : isWrite ? 'edge-write' : 'edge-read';
                return svg`<line x1="${padding}" y1="${varY(vi)}" x2="${w - padding}" y2="${funcY(fi)}" class="${cls}" />`;
              });
            })}
            <!-- Var nodes -->
            ${vars.map((v, i) => {
              const dis = this.disabledVars.has(v.varId);
              return svg`
              <g transform="translate(${padding}, ${varY(i)})" class="clickable-node" @click=${() => this.toggleVar(v.varId)}>
                <circle r="5" class="var-node ${dis ? 'disabled' : ''}" />
                <text x="-10" text-anchor="end" dominant-baseline="middle" class="${dis ? 'disabled' : ''}">${v.varName}</text>
              </g>
            `})}
            <!-- Func nodes -->
            ${funcs.map((f, i) => {
              const dis = this.disabledFuncs.has(f.id);
              return svg`
              <g transform="translate(${w - padding}, ${funcY(i)})" class="clickable-node" @click=${() => this.toggleFunc(f.id)}>
                <circle r="5" class="func-node ${dis ? 'disabled' : ''}" />
                <text x="10" dominant-baseline="middle" class="${dis ? 'disabled' : ''}">${f.name}</text>
              </g>
            `})}
          `}
        </svg>
      </div>
    `;
  }
}
