import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  FunctionAnalysis, StateVarAccess, GlobalRange,
  CallGraphData, FunctionSummary, PathInfo, ArithCheck,
  ContextMode, SecurityFinding,
} from '../types';

@customElement('context-panel')
export class ContextPanel extends LitElement {
  static styles = css`
    :host { display: block; position: absolute; inset: 0; overflow: hidden; }

    .panel { display: flex; flex-direction: column; height: 100%; min-height: 0; }

    /* ── Mode: Function Overview ── */
    .overview {
      flex: 1; overflow-y: auto; padding: 12px 14px; font-size: 13px;
      min-height: 0;
    }
    .header {
      margin-bottom: 12px; padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .func-name {
      font-size: 15px; font-weight: 700; color: var(--text-primary);
      font-family: var(--font-mono);
    }
    .func-meta {
      font-size: 12px; color: var(--text-muted); margin-top: 4px;
    }
    .stat {
      display: inline-block; margin-right: 12px;
    }
    .stat-value { font-weight: 600; color: var(--text-primary); }

    /* ── Sections ── */
    .section { margin-bottom: 14px; }
    .section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted);
      margin-bottom: 6px;
      display: flex; align-items: center; gap: 6px;
    }
    .section-title-clickable {
      cursor: pointer;
    }
    .section-title-clickable:hover { color: var(--text-secondary); }
    .chevron {
      font-size: 8px; transition: transform 0.1s;
    }
    .chevron.open { transform: rotate(90deg); }

    /* ── Risk Summary ── */
    .risk-grid {
      display: grid; grid-template-columns: auto 1fr;
      gap: 2px 12px; font-size: 12px;
    }
    .risk-label { color: var(--text-muted); }
    .risk-count { color: var(--text-primary); font-weight: 600; font-family: var(--font-mono); }
    .risk-red { color: #ff5555; }
    .risk-orange { color: #ffb74d; }

    /* ── State Dependencies ── */
    .dep-row {
      display: flex; justify-content: space-between;
      padding: 3px 0; font-size: 12px;
    }
    .dep-label { color: var(--text-muted); }
    .dep-value { color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; }
    .dep-rw { font-size: 10px; color: var(--text-muted); }

    /* ── Path list ── */
    .path-item {
      display: flex; align-items: center; gap: 8px;
      padding: 5px 8px; cursor: pointer;
      border-radius: 3px; font-size: 12px;
    }
    .path-item:hover { background: var(--bg-hover); }
    .path-exit {
      font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 600;
    }
    .exit-return { background: rgba(158,206,106,0.15); color: #9ece6a; }
    .exit-revert { background: rgba(255,121,63,0.15); color: #ff793f; }
    .exit-truncated { background: rgba(255,183,77,0.15); color: #ffb74d; }
    .path-feasible { color: var(--green); font-size: 10px; }
    .path-infeasible { color: var(--red); opacity: 0.6; font-size: 10px; }

    /* ── Caller/callee list ── */
    .ref-item {
      font-size: 12px; padding: 3px 0;
      color: var(--accent); cursor: pointer;
    }
    .ref-item:hover { text-decoration: underline; }

    /* ── Summary table ── */
    .summary-row {
      display: flex; justify-content: space-between;
      padding: 3px 0; font-size: 12px;
    }
    .summary-label { color: var(--text-muted); }
    .summary-value { color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; }

    .empty { color: var(--text-muted); font-size: 12px; font-style: italic; }

    /* ── Mode bar ── */
    .mode-bar {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 8px; flex-shrink: 0;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border);
    }
    .mode-btn {
      font-size: 10px; padding: 2px 8px; border-radius: 10px;
      border: 1px solid var(--border); background: none;
      color: var(--text-muted); cursor: pointer;
      font-family: var(--font-sans);
    }
    .mode-btn:hover { background: var(--bg-hover); }
    .mode-btn.active {
      background: rgba(122,162,247,0.15);
      color: var(--accent); border-color: var(--accent);
    }

    /* ── Variable Inspector ── */
    .var-inspector { flex: 1; overflow-y: auto; padding: 12px 14px; font-size: 13px; }
    .var-name-header {
      font-size: 15px; font-weight: 700; color: var(--text-primary);
      font-family: var(--font-mono); margin-bottom: 8px;
    }
    .var-type { font-size: 12px; color: var(--cyan); margin-bottom: 12px; }
    .var-range-box {
      padding: 8px 10px; border-radius: 4px;
      background: var(--bg-secondary); margin-bottom: 12px;
      font-family: var(--font-mono); font-size: 12px;
    }
    .var-range-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
    .var-range-value { color: var(--text-primary); margin-top: 2px; }

    /* ── Raw Data ── */
    .raw-data { flex: 1; overflow-y: auto; padding: 12px 14px; font-size: 12px; }
    .raw-section { margin-bottom: 16px; }
    .raw-pre {
      font-family: var(--font-mono); font-size: 11px;
      white-space: pre-wrap; word-break: break-all;
      background: var(--bg-secondary); padding: 8px;
      border-radius: 4px; max-height: 300px; overflow-y: auto;
    }
    .export-btn {
      font-size: 11px; padding: 3px 10px; border-radius: 3px;
      border: 1px solid var(--border); background: var(--bg-tertiary);
      color: var(--text-secondary); cursor: pointer;
      font-family: var(--font-sans);
    }
    .export-btn:hover { background: var(--bg-hover); }
  `;

  @property({ type: String }) mode: ContextMode = 'overview';
  @property({ type: Array }) functions: FunctionAnalysis[] = [];
  @property({ type: Number }) selectedFunctionId: number | null = null;
  @property({ type: Number }) selectedPathIndex: number | null = null;
  @property({ type: Object }) analysis: FunctionAnalysis | null = null;
  @property({ type: Array }) pathDetail: PathInfo[] | null = null;
  @property({ type: Array }) stateVarAccess: StateVarAccess[] = [];
  @property({ type: Array }) globalRanges: GlobalRange[] = [];
  @property({ type: Object }) callGraph: CallGraphData | null = null;
  @property({ type: Array }) summaries: FunctionSummary[] = [];

  // Variable inspector state
  @property({ type: String }) selectedVarName: string | null = null;
  @property({ type: Number }) selectedVarId: number | null = null;

  @state() private pathsExpanded = false;

  // ─── Computed ──────────────────────────────────────────────────

  private get funcAnalysis(): FunctionAnalysis | null {
    if (this.analysis) return this.analysis;
    if (!this.selectedFunctionId) return null;
    return this.functions.find(f => f.functionId === this.selectedFunctionId) ?? null;
  }

  private get funcSummary(): FunctionSummary | null {
    const fid = this.selectedFunctionId ?? this.funcAnalysis?.functionId;
    if (!fid) return null;
    return this.summaries.find(s => s.functionId === fid) ?? null;
  }

  private get callers(): { id: number; name: string }[] {
    if (!this.callGraph || !this.selectedFunctionId) return [];
    const funcId = this.selectedFunctionId;
    const callers: { id: number; name: string }[] = [];
    for (const edge of this.callGraph.edges) {
      if (edge.to === funcId) {
        const node = this.callGraph.nodes.find(n => n.id === edge.from);
        if (node && !callers.some(c => c.id === node.id)) {
          callers.push({ id: node.id, name: node.contractName ? `${node.contractName}.${node.name}` : node.name });
        }
      }
    }
    return callers;
  }

  private get callees(): { id: number; name: string }[] {
    if (!this.callGraph || !this.selectedFunctionId) return [];
    const funcId = this.selectedFunctionId;
    const callees: { id: number; name: string }[] = [];
    for (const edge of this.callGraph.edges) {
      if (edge.from === funcId && edge.to != null) {
        const node = this.callGraph.nodes.find(n => n.id === edge.to);
        if (node && !callees.some(c => c.id === node.id)) {
          callees.push({ id: node.id, name: node.contractName ? `${node.contractName}.${node.name}` : node.name });
        }
      }
    }
    return callees;
  }

  /** Aggregate all arith checks across feasible paths */
  private get riskSummary(): Record<string, number> {
    const counts: Record<string, number> = {};
    const fa = this.funcAnalysis;
    if (!fa) return counts;

    const paths = this.pathDetail ?? fa.paths;
    for (const path of paths) {
      if (!path.feasible || !path.arithChecks) continue;
      for (const ac of path.arithChecks) {
        counts[ac.check] = (counts[ac.check] ?? 0) + 1;
      }
    }
    return counts;
  }

  // ─── Render ───────────────────────────────────────────────────

  render() {
    return html`
      <div class="panel">
        ${this.mode === 'path' ? html`
          <path-inspector
            .pathDetail=${this.pathDetail}
            .selectedPathIndex=${this.selectedPathIndex ?? 0}
            @highlight-step=${this.forwardEvent}
            @select-path=${this.forwardEvent}
            @back=${this.onBackToOverview}
          ></path-inspector>
        ` : this.mode === 'variable' ? html`
          ${this.renderModeBar()}
          ${this.renderVariableInspector()}
        ` : this.mode === 'raw-data' ? html`
          ${this.renderModeBar()}
          ${this.renderRawData()}
        ` : html`
          ${this.renderModeBar()}
          ${this.renderOverview()}
        `}
      </div>
    `;
  }

  private renderModeBar() {
    const modes: { key: ContextMode; label: string }[] = [
      { key: 'overview', label: 'Overview' },
      { key: 'raw-data', label: 'Raw Data' },
    ];
    if (this.selectedVarId != null) {
      modes.splice(1, 0, { key: 'variable', label: 'Variable' });
    }

    return html`
      <div class="mode-bar">
        ${modes.map(m => html`
          <button class="mode-btn ${this.mode === m.key ? 'active' : ''}"
            @click=${() => this.switchMode(m.key)}
          >${m.label}</button>
        `)}
      </div>
    `;
  }

  // ─── Mode 1: Function Overview ────────────────────────────────

  private renderOverview() {
    const fa = this.funcAnalysis;
    if (!fa) {
      return html`<div class="overview"><div class="empty">Select a function to view analysis</div></div>`;
    }

    const summary = this.funcSummary;
    const paths = this.pathDetail ?? fa.paths;
    const feasiblePaths = paths.filter(p => p.feasible);
    const risks = this.riskSummary;
    const riskEntries = Object.entries(risks);

    return html`
      <div class="overview">
        <!-- Header -->
        <div class="header">
          <div class="func-name">${fa.functionName}</div>
          <div class="func-meta">
            ${fa.contractName ? html`${fa.contractName} &middot; ` : nothing}
            <span class="stat"><span class="stat-value">${paths.length}</span> paths (<span class="stat-value">${feasiblePaths.length}</span> feasible)</span>
          </div>
        </div>

        <!-- Risk Summary -->
        ${riskEntries.length > 0 ? html`
          <div class="section">
            <div class="section-title">Risk Summary</div>
            <div class="risk-grid">
              ${riskEntries.map(([check, count]) => {
                const isRed = ['Overflow', 'Underflow', 'DivByZero', 'UncheckedReturn'].includes(check);
                return html`
                  <span class="risk-label">${check}</span>
                  <span class="risk-count ${isRed ? 'risk-red' : 'risk-orange'}">${count}</span>
                `;
              })}
            </div>
          </div>
        ` : nothing}

        <!-- Parameter/Return Domains -->
        ${summary ? html`
          <div class="section">
            <div class="section-title">Domains</div>
            ${summary.paramRanges.map(p => html`
              <div class="summary-row">
                <span class="summary-label">param[${p.paramIndex}]</span>
                <span class="summary-value">${this.formatRange(p.min, p.max)}</span>
              </div>
            `)}
            ${summary.returnRange ? html`
              <div class="summary-row">
                <span class="summary-label">return</span>
                <span class="summary-value">${this.formatRange(summary.returnRange.min, summary.returnRange.max)}</span>
              </div>
            ` : nothing}
            ${summary.stateWrites.map(w => html`
              <div class="summary-row">
                <span class="summary-label">${w.varName}</span>
                <span class="summary-value">${this.formatRange(w.min, w.max)}</span>
              </div>
            `)}
          </div>
        ` : nothing}

        <!-- State Dependencies -->
        ${this.stateVarAccess.length > 0 ? html`
          <div class="section">
            <div class="section-title">State Dependencies</div>
            ${this.stateVarAccess.map(v => html`
              <div class="dep-row">
                <span class="dep-label" style="cursor:pointer;color:var(--accent);"
                  @click=${() => this.inspectVariable(v.varId, v.varName)}
                >${v.varName}</span>
                <span class="dep-rw">R:${v.readers.length} W:${v.writers.length}</span>
              </div>
            `)}
          </div>
        ` : nothing}

        <!-- Callers/Callees -->
        ${this.callers.length > 0 ? html`
          <div class="section">
            <div class="section-title">Called by</div>
            ${this.callers.map(c => html`
              <div class="ref-item" @click=${() => this.navigateToFunction(c.id)}>${c.name}</div>
            `)}
          </div>
        ` : nothing}
        ${this.callees.length > 0 ? html`
          <div class="section">
            <div class="section-title">Calls</div>
            ${this.callees.map(c => html`
              <div class="ref-item" @click=${() => this.navigateToFunction(c.id)}>${c.name}</div>
            `)}
          </div>
        ` : nothing}

        <!-- Paths -->
        ${paths.length > 0 ? html`
          <div class="section">
            <div class="section-title section-title-clickable"
              @click=${() => this.pathsExpanded = !this.pathsExpanded}
            >
              <span class="chevron ${this.pathsExpanded ? 'open' : ''}">&#9654;</span>
              Paths (${paths.length})
            </div>
            ${this.pathsExpanded ? feasiblePaths.map((p, i) => {
              const originalIdx = paths.indexOf(p);
              return html`
                <div class="path-item" @click=${() => this.selectPath(originalIdx)}>
                  <span class="path-exit exit-${p.exit}">${p.exit}</span>
                  <span class="${p.feasible ? 'path-feasible' : 'path-infeasible'}">
                    ${p.constraintCount}c
                  </span>
                  ${p.arithChecks?.length ? html`
                    <span style="color:#ff793f;font-size:10px;">${p.arithChecks.length} checks</span>
                  ` : nothing}
                </div>
              `;
            }) : nothing}
          </div>
        ` : nothing}
      </div>
    `;
  }

  // ─── Mode 3: Variable Inspector ───────────────────────────────

  private renderVariableInspector() {
    if (!this.selectedVarId || !this.selectedVarName) {
      return html`<div class="var-inspector"><div class="empty">No variable selected</div></div>`;
    }

    const sv = this.stateVarAccess.find(v => v.varId === this.selectedVarId);
    const gr = this.globalRanges.find(r => r.varId === this.selectedVarId);

    return html`
      <div class="var-inspector">
        <div class="var-name-header">${this.selectedVarName}</div>
        ${sv ? html`<div class="var-type">${sv.typeString}</div>` : nothing}
        ${gr ? html`<div class="var-type">${gr.typeString}</div>` : nothing}

        <!-- Global Range -->
        ${gr ? html`
          <div class="var-range-box">
            <div class="var-range-label">Global Range</div>
            <div class="var-range-value">${this.formatRange(gr.min, gr.max)}</div>
          </div>
        ` : nothing}

        <!-- Readers -->
        ${sv && sv.readers.length > 0 ? html`
          <div class="section">
            <div class="section-title">Readers (${sv.readers.length})</div>
            ${sv.readers.map(r => html`
              <div class="ref-item" @click=${() => this.navigateToFunction(r.funcId)}>
                ${r.contractName ? `${r.contractName}.` : ''}${r.funcName}
              </div>
            `)}
          </div>
        ` : nothing}

        <!-- Writers -->
        ${sv && sv.writers.length > 0 ? html`
          <div class="section">
            <div class="section-title">Writers (${sv.writers.length})</div>
            ${sv.writers.map(w => html`
              <div class="ref-item" @click=${() => this.navigateToFunction(w.funcId)}>
                ${w.contractName ? `${w.contractName}.` : ''}${w.funcName}
              </div>
            `)}
          </div>
        ` : nothing}

        <!-- Per-function write ranges -->
        ${this.summaries.filter(s =>
          s.stateWrites.some(sw => sw.varId === this.selectedVarId)
        ).map(s => html`
          <div class="summary-row">
            <span class="summary-label">${s.functionName} writes</span>
            <span class="summary-value">
              ${s.stateWrites.filter(sw => sw.varId === this.selectedVarId)
                .map(sw => this.formatRange(sw.min, sw.max)).join(', ')}
            </span>
          </div>
        `)}
      </div>
    `;
  }

  // ─── Mode 4: Raw Data ─────────────────────────────────────────

  private renderRawData() {
    const fa = this.funcAnalysis;
    return html`
      <div class="raw-data">
        <!-- Function Summaries -->
        ${this.summaries.length > 0 ? html`
          <div class="raw-section">
            <div class="section-title">Function Summaries</div>
            ${this.summaries.map(s => html`
              <div style="margin-bottom:8px;">
                <div style="font-weight:600;color:var(--text-primary);">${s.functionName}</div>
                ${s.paramRanges.map(p => html`
                  <div class="summary-row">
                    <span class="summary-label">param[${p.paramIndex}]</span>
                    <span class="summary-value">${this.formatRange(p.min, p.max)}</span>
                  </div>
                `)}
                ${s.returnRange ? html`
                  <div class="summary-row">
                    <span class="summary-label">return</span>
                    <span class="summary-value">${this.formatRange(s.returnRange.min, s.returnRange.max)}</span>
                  </div>
                ` : nothing}
              </div>
            `)}
          </div>
        ` : nothing}

        <!-- Global Ranges -->
        ${this.globalRanges.length > 0 ? html`
          <div class="raw-section">
            <div class="section-title">Global State Ranges</div>
            ${this.globalRanges.map(r => html`
              <div class="summary-row">
                <span class="summary-label">${r.varName}</span>
                <span class="summary-value">${this.formatRange(r.min, r.max)}</span>
              </div>
            `)}
          </div>
        ` : nothing}

        <!-- Full ArithCheck list -->
        ${fa ? html`
          <div class="raw-section">
            <div class="section-title">All Arithmetic Checks</div>
            ${(this.pathDetail ?? fa.paths).filter(p => p.feasible && p.arithChecks?.length)
              .flatMap(p => p.arithChecks.map(ac => ({ ...ac, pathIndex: p.index })))
              .map(ac => html`
                <div class="summary-row">
                  <span class="summary-label" style="color:${ac.severity === 'high' ? '#ff5555' : '#ffb74d'}">
                    ${ac.check}
                  </span>
                  <span class="summary-value">${ac.bound} (path #${ac.pathIndex})</span>
                </div>
              `)}
          </div>
        ` : nothing}

        <!-- Export -->
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="export-btn" @click=${() => this.exportJSON()}>Export JSON</button>
        </div>
      </div>
    `;
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private formatRange(min: number | null, max: number | null): string {
    if (min === null && max === null) return 'unconstrained';
    if (min !== null && max !== null) return `[${min}, ${max}]`;
    if (min !== null) return `[${min}, ...]`;
    return `[..., ${max}]`;
  }

  private switchMode(mode: ContextMode) {
    this.dispatchEvent(new CustomEvent('switch-mode', {
      detail: { mode },
      bubbles: true, composed: true,
    }));
  }

  private inspectVariable(varId: number, varName: string) {
    this.selectedVarId = varId;
    this.selectedVarName = varName;
    this.dispatchEvent(new CustomEvent('inspect-variable', {
      detail: { varId, varName },
      bubbles: true, composed: true,
    }));
  }

  private selectPath(index: number) {
    this.dispatchEvent(new CustomEvent('select-path', {
      detail: { pathIndex: index },
      bubbles: true, composed: true,
    }));
  }

  private navigateToFunction(funcId: number) {
    this.dispatchEvent(new CustomEvent('navigate-to-function', {
      detail: { functionId: funcId },
      bubbles: true, composed: true,
    }));
  }

  private onBackToOverview() {
    this.dispatchEvent(new CustomEvent('back-to-overview', {
      bubbles: true, composed: true,
    }));
  }

  private forwardEvent(e: Event) {
    this.dispatchEvent(new CustomEvent(e.type, {
      detail: (e as CustomEvent).detail,
      bubbles: true, composed: true,
    }));
  }

  private exportJSON() {
    const data = {
      analysis: this.funcAnalysis,
      summaries: this.summaries,
      globalRanges: this.globalRanges,
      stateVarAccess: this.stateVarAccess,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.funcAnalysis?.functionName ?? 'analysis'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
