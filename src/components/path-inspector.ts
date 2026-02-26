import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { FunctionAnalysis, PathInfo, StatementInfo, VarRange } from '../types';

type StepKind = 'assert' | 'assertNot' | 'assign' | 'havoc' | 'checked' | 'call' | 'stmt';

interface VarDiff {
  varName: string;
  oldRange: string | null;
  newRange: string;
  kind: 'NARROWED' | 'WIDENED' | 'NEW' | 'UNRESTRICTED';
}

interface WatchVar {
  name: string;
  type: string;
  domain: string;
  lastChangedStep: number;
  isUnrestricted: boolean;
}

@customElement('path-inspector')
export class PathInspector extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column; height: 100%;
      font-size: 13px;
    }

    /* ── Path Selector Bar ── */
    .selector-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-secondary);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .back-btn {
      font-size: 12px; padding: 3px 8px; border-radius: 3px;
      border: 1px solid var(--border); background: var(--bg-tertiary);
      color: var(--text-secondary); cursor: pointer;
      font-family: var(--font-sans);
    }
    .back-btn:hover { background: var(--bg-hover); }

    .path-select {
      padding: 3px 8px; border-radius: 3px;
      border: 1px solid var(--border); background: var(--bg-tertiary);
      color: var(--text-primary); font-size: 12px;
      font-family: var(--font-sans);
    }

    .filter-btn {
      font-size: 10px; padding: 2px 8px; border-radius: 10px;
      border: 1px solid var(--border); background: none;
      color: var(--text-muted); cursor: pointer;
      font-family: var(--font-sans);
    }
    .filter-btn:hover { background: var(--bg-hover); }
    .filter-btn.active {
      background: rgba(122,162,247,0.15);
      color: var(--accent);
      border-color: var(--accent);
    }

    .path-info {
      font-size: 11px; color: var(--text-muted);
    }

    .exit-badge {
      font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 600;
    }
    .exit-return { background: rgba(158,206,106,0.15); color: #9ece6a; }
    .exit-revert { background: rgba(255,121,63,0.15); color: #ff793f; }
    .exit-truncated { background: rgba(255,183,77,0.15); color: #ffb74d; }
    .feasible { color: var(--green); font-size: 11px; }
    .infeasible { color: var(--red); font-size: 11px; }

    /* ── Step List ── */
    .steps {
      flex: 3; overflow-y: auto; padding: 4px 0;
    }
    .step-card {
      margin: 2px 8px;
      padding: 6px 10px;
      border-radius: 4px;
      border-left: 3px solid transparent;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
    }
    .step-card:hover { background: var(--bg-hover); }
    .step-card.selected { background: rgba(122,162,247,0.12); }

    /* Step type border colors */
    .step-assert { border-left-color: #9ece6a; }
    .step-assertNot { border-left-color: #ff5555; }
    .step-assign { border-left-color: #7dcfff; }
    .step-havoc { border-left-color: #ffb74d; }
    .step-checked { border-left-color: #bb9af7; }
    .step-call { border-left-color: #e0af68; }
    .step-stmt { border-left-color: var(--border); }

    .step-header {
      display: flex; align-items: center; gap: 6px;
    }
    .step-type-badge {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      padding: 0 4px; border-radius: 2px;
      letter-spacing: 0.3px;
    }
    .badge-assert { background: rgba(158,206,106,0.15); color: #9ece6a; }
    .badge-assertNot { background: rgba(255,85,85,0.15); color: #ff5555; }
    .badge-assign { background: rgba(125,207,255,0.15); color: #7dcfff; }
    .badge-havoc { background: rgba(255,183,77,0.15); color: #ffb74d; }
    .badge-checked { background: rgba(187,154,247,0.15); color: #bb9af7; }
    .badge-call { background: rgba(224,175,104,0.15); color: #e0af68; }
    .badge-stmt { background: var(--bg-tertiary); color: var(--text-muted); }

    .step-idx {
      color: var(--text-muted); font-size: 10px;
    }
    .step-text {
      color: var(--text-secondary);
      word-break: break-word;
      margin-top: 2px;
    }

    /* ── Range diffs ── */
    .range-diffs {
      display: flex; flex-wrap: wrap; gap: 4px;
      margin-top: 4px;
    }
    .range-diff {
      font-size: 10px; padding: 1px 6px; border-radius: 2px;
    }
    .diff-NARROWED { background: rgba(158,206,106,0.15); color: #9ece6a; }
    .diff-WIDENED { background: rgba(255,85,85,0.12); color: #ff5555; }
    .diff-NEW { background: rgba(122,162,247,0.15); color: var(--accent); }
    .diff-UNRESTRICTED { background: rgba(255,85,85,0.12); color: #ff5555; }

    .range-transition {
      font-size: 10px; color: var(--text-muted);
      margin-top: 2px; font-family: var(--font-mono);
    }
    .range-arrow { color: var(--text-muted); margin: 0 4px; }

    /* ── Watch Panel ── */
    .watch-panel {
      flex: 2; min-height: 120px;
      border-top: 1px solid var(--border);
      background: var(--bg-secondary);
      overflow-y: auto;
    }
    .watch-header {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0;
      background: var(--bg-secondary);
      z-index: 1;
    }
    .watch-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted);
    }
    .watch-step-label {
      font-size: 10px; color: var(--text-muted);
    }

    .watch-table {
      width: 100%;
      font-size: 11px;
      font-family: var(--font-mono);
    }
    .watch-row {
      display: flex; padding: 2px 12px; gap: 8px;
    }
    .watch-row:nth-child(even) { background: var(--bg-tertiary); }
    .watch-row.unrestricted { color: #ffb74d; }
    .watch-var-name {
      width: 120px; flex-shrink: 0;
      color: var(--text-secondary);
      overflow: hidden; text-overflow: ellipsis;
    }
    .watch-var-domain {
      flex: 1;
      color: var(--text-primary);
      overflow: hidden; text-overflow: ellipsis;
    }
    .watch-var-step {
      width: 40px; flex-shrink: 0;
      color: var(--text-muted);
      text-align: right;
    }

    .empty { color: var(--text-muted); padding: 16px; font-size: 12px; }
  `;

  @property({ type: Array }) pathDetail: PathInfo[] | null = null;
  @property({ type: Number }) selectedPathIndex = 0;

  @state() private selectedStepIndex = 0;
  @state() private filter: 'all' | 'return' | 'revert' | 'arith' = 'all';

  private get filteredPaths(): { path: PathInfo; originalIndex: number }[] {
    if (!this.pathDetail) return [];
    return this.pathDetail
      .map((path, i) => ({ path, originalIndex: i }))
      .filter(({ path }) => {
        if (!path.feasible) return false;
        switch (this.filter) {
          case 'return': return path.exit === 'return';
          case 'revert': return path.exit === 'revert';
          case 'arith': return path.arithChecks?.length > 0;
          default: return true;
        }
      });
  }

  private get currentPath(): PathInfo | null {
    if (!this.pathDetail) return null;
    return this.pathDetail[this.selectedPathIndex] ?? null;
  }

  /** Compute cumulative ranges up to selectedStepIndex */
  private get cumulativeRanges(): Map<string, { range: VarRange; lastStep: number }> {
    const map = new Map<string, { range: VarRange; lastStep: number }>();
    const path = this.currentPath;
    if (!path) return map;

    for (let i = 0; i <= this.selectedStepIndex && i < path.statements.length; i++) {
      const stmt = path.statements[i];
      if (typeof stmt !== 'string' && (stmt as StatementInfo).ranges) {
        for (const [varName, range] of Object.entries((stmt as StatementInfo).ranges)) {
          map.set(varName, { range, lastStep: i });
        }
      }
    }
    return map;
  }

  /** Compute per-step variable diffs */
  private computeStepDiffs(stmtIndex: number): VarDiff[] {
    const path = this.currentPath;
    if (!path) return [];

    const stmt = path.statements[stmtIndex];
    if (typeof stmt === 'string' || !(stmt as StatementInfo).ranges) return [];

    const info = stmt as StatementInfo;
    const diffs: VarDiff[] = [];

    // Build previous cumulative ranges
    const prevCumulative: Record<string, VarRange> = {};
    for (let i = 0; i < stmtIndex; i++) {
      const s = path.statements[i];
      if (typeof s !== 'string' && (s as StatementInfo).ranges) {
        Object.assign(prevCumulative, (s as StatementInfo).ranges);
      }
    }

    for (const [varName, range] of Object.entries(info.ranges)) {
      const curStr = this.rangeString(range);
      const prev = prevCumulative[varName];

      if (!prev) {
        diffs.push({ varName, oldRange: null, newRange: curStr, kind: 'NEW' });
      } else {
        const prevStr = this.rangeString(prev);
        if (prevStr !== curStr) {
          const kind = this.classifyChange(prev, range);
          diffs.push({ varName, oldRange: prevStr, newRange: curStr, kind });
        }
      }
    }
    return diffs;
  }

  private classifyChange(prev: VarRange, curr: VarRange): 'NARROWED' | 'WIDENED' | 'UNRESTRICTED' {
    // Check if current is full type range (unrestricted)
    const curStr = this.rangeString(curr);
    if (curStr === 'TOP' || curStr.includes('MAX_UINT256')) return 'UNRESTRICTED';

    // Compare interval count as heuristic
    const prevSize = prev.intervals.length || 1;
    const curSize = curr.intervals.length || 1;
    if (curSize < prevSize || curr.exclusions.length > prev.exclusions.length) return 'NARROWED';
    return 'WIDENED';
  }

  // ─── Render ───────────────────────────────────────────────────────

  render() {
    if (!this.pathDetail || this.pathDetail.length === 0) {
      return html`<div class="empty">No path data available. Analyze a function first.</div>`;
    }

    const path = this.currentPath;
    if (!path) {
      return html`<div class="empty">No path selected</div>`;
    }

    const filtered = this.filteredPaths;
    const currentFilterIdx = filtered.findIndex(f => f.originalIndex === this.selectedPathIndex);
    const totalFiltered = filtered.length;

    return html`
      ${this.renderSelectorBar(path, currentFilterIdx, totalFiltered)}
      ${this.renderStepList(path)}
      ${this.renderWatchPanel()}
    `;
  }

  private renderSelectorBar(path: PathInfo, filterIdx: number, totalFiltered: number) {
    return html`
      <div class="selector-bar">
        <button class="back-btn" @click=${this.onBack}>\u2190 Back</button>
        <select class="path-select" @change=${this.onPathSelect}>
          ${this.filteredPaths.map(({ path: p, originalIndex }) => html`
            <option value=${originalIndex} ?selected=${originalIndex === this.selectedPathIndex}>
              Path #${p.index} ${p.exit.toUpperCase()} (${p.constraintCount} constraints)
            </option>
          `)}
        </select>
        <span class="exit-badge exit-${path.exit}">${path.exit}</span>
        <span class="${path.feasible ? 'feasible' : 'infeasible'}">
          ${path.feasible ? 'feasible' : 'infeasible'}
        </span>
        <span class="path-info">
          ${filterIdx >= 0 ? `${filterIdx + 1} of ${totalFiltered}` : ''} feasible
        </span>
        <div style="display:flex;gap:4px;margin-left:auto;">
          ${(['all', 'return', 'revert', 'arith'] as const).map(f => html`
            <button class="filter-btn ${this.filter === f ? 'active' : ''}"
              @click=${() => { this.filter = f; }}
            >${f === 'all' ? 'All' : f === 'arith' ? 'Arith' : f.charAt(0).toUpperCase() + f.slice(1)}</button>
          `)}
        </div>
      </div>
    `;
  }

  private renderStepList(path: PathInfo) {
    const statements = path.statements;

    return html`
      <div class="steps">
        ${statements.map((stmt, i) => {
          const info = typeof stmt === 'string' ? null : stmt as StatementInfo;
          const text = typeof stmt === 'string' ? stmt : info!.text;
          const type: StepKind = info?.type ?? 'stmt';
          const diffs = this.computeStepDiffs(i);

          return html`
            <div class="step-card step-${type} ${this.selectedStepIndex === i ? 'selected' : ''}"
              @click=${() => this.onStepClick(i)}
            >
              <div class="step-header">
                <span class="step-type-badge badge-${type}">${this.typeLabel(type)}</span>
                <span class="step-idx">#${i + 1}</span>
              </div>
              <div class="step-text">${text}</div>
              ${diffs.length > 0 ? html`
                <div class="range-diffs">
                  ${diffs.map(d => html`
                    <span class="range-diff diff-${d.kind}">
                      ${d.varName}: ${d.kind}
                    </span>
                  `)}
                </div>
                ${diffs.filter(d => d.oldRange).map(d => html`
                  <div class="range-transition">
                    ${d.varName}: ${d.oldRange} <span class="range-arrow">\u2192</span> ${d.newRange}
                  </div>
                `)}
              ` : nothing}
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderWatchPanel() {
    const cumulative = this.cumulativeRanges;
    if (cumulative.size === 0) {
      return html`
        <div class="watch-panel">
          <div class="watch-header">
            <span class="watch-title">Variable Watch</span>
          </div>
          <div class="empty">No variable data at this step</div>
        </div>
      `;
    }

    // Sort: recently changed first, then unrestricted highlighted
    const entries = [...cumulative.entries()]
      .sort((a, b) => b[1].lastStep - a[1].lastStep);

    return html`
      <div class="watch-panel">
        <div class="watch-header">
          <span class="watch-title">Variable Watch</span>
          <span class="watch-step-label">at step ${this.selectedStepIndex + 1}</span>
        </div>
        ${entries.map(([name, { range, lastStep }]) => {
          const domainStr = this.rangeString(range);
          const isUnrestricted = domainStr === 'TOP' || domainStr.includes('MAX_UINT256');
          return html`
            <div class="watch-row ${isUnrestricted ? 'unrestricted' : ''}">
              <span class="watch-var-name" title="${name}">${name}</span>
              <span class="watch-var-domain">${domainStr}</span>
              <span class="watch-var-step">#${lastStep + 1}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private typeLabel(type: StepKind): string {
    switch (type) {
      case 'assert': return 'ASSERT';
      case 'assertNot': return 'ASSERT_NOT';
      case 'assign': return 'ASSIGN';
      case 'havoc': return 'HAVOC';
      case 'checked': return 'CHECKED';
      case 'call': return 'CALL';
      case 'stmt': return 'STMT';
    }
  }

  private rangeString(range: VarRange): string {
    if (range.intervals.length > 0) {
      const parts = range.intervals.map(([lo, hi]) =>
        lo === hi ? this.shortNum(lo) : `${this.shortNum(lo)}..${this.shortNum(hi)}`
      );
      let s = parts.join(' \u222A ');
      if (range.exclusions.length > 0) {
        s += ` \\ {${range.exclusions.map(e => this.shortNum(e)).join(',')}}`;
      }
      return s;
    }
    if (range.min !== null || range.max !== null) {
      return `[${range.min ? this.shortNum(range.min) : '0'}, ${range.max ? this.shortNum(range.max) : 'MAX'}]`;
    }
    return 'TOP';
  }

  private shortNum(s: string): string {
    if (s === '115792089237316195423570985008687907853269984665640564039457584007913129639935') return 'MAX_UINT256';
    if (s === '340282366920938463463374607431768211455') return 'MAX_UINT128';
    if (s.length > 15) return s.slice(0, 6) + '..' + s.slice(-4);
    return s;
  }

  // ─── Events ───────────────────────────────────────────────────────

  private onPathSelect(e: Event) {
    const idx = parseInt((e.target as HTMLSelectElement).value);
    this.selectedPathIndex = idx;
    this.selectedStepIndex = 0;
    this.dispatchEvent(new CustomEvent('select-path', {
      detail: { pathIndex: idx },
      bubbles: true, composed: true,
    }));
  }

  private onStepClick(index: number) {
    this.selectedStepIndex = index;
    this.dispatchEvent(new CustomEvent('highlight-step', {
      detail: { stepIndex: index },
      bubbles: true, composed: true,
    }));
  }

  private onBack() {
    this.dispatchEvent(new CustomEvent('back', {
      bubbles: true, composed: true,
    }));
  }
}
