import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { highlightSolidity } from '../lib/highlight';
import type {
  FunctionAnalysis, StateVarAccess, GlobalRange, ArithCheck,
  PathInfo, StatementInfo, VarRange,
} from '../types';

// ─── Risk Level Computation ───────────────────────────────────────────────

type RiskLevel = 'red' | 'orange' | 'blue' | 'green' | 'none';

interface LineRiskInfo {
  level: RiskLevel;
  symbol: string;
  descriptions: string[];
}

interface DomainAnnotation {
  text: string;
  badge: 'narrowed' | 'truncation' | 'precision' | 'external' | 'assign' | 'info';
}

const RED_CHECKS = new Set(['Overflow', 'Underflow', 'DivByZero', 'UncheckedReturn']);
const ORANGE_CHECKS = new Set(['DivisionTruncation', 'MulAfterDiv', 'RightShiftTruncation', 'DowncastTruncation']);

function riskPriority(level: RiskLevel): number {
  switch (level) {
    case 'red': return 0;
    case 'orange': return 1;
    case 'blue': return 2;
    case 'green': return 3;
    case 'none': return 4;
  }
}

@customElement('annotated-source')
export class AnnotatedSource extends LitElement {
  static styles = css`
    :host { display: block; position: absolute; inset: 0; overflow: auto; background: var(--bg-primary); }

    .code-container {
      display: flex;
      font-family: var(--font-mono);
      font-size: 13px;
      line-height: 1.7;
    }

    /* ── Gutter (risk indicators + line numbers) ── */
    .gutter {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      width: 68px;
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      user-select: none;
    }
    .gutter-line {
      display: flex;
      align-items: center;
      height: 1.7em;
      padding: 0 4px 0 2px;
      cursor: pointer;
    }
    .gutter-line:hover { background: var(--bg-hover); }
    .gutter-marker {
      width: 20px;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .marker-red { color: #ff5555; }
    .marker-orange { color: #ffb74d; }
    .marker-blue { color: #7aa2f7; }
    .marker-green { color: #9ece6a; }
    .marker-path {
      width: 3px;
      height: 100%;
      background: var(--accent);
      border-radius: 1px;
      flex-shrink: 0;
      margin-right: 2px;
    }
    .line-num {
      min-width: 36px;
      text-align: right;
      color: var(--text-muted);
      font-size: 12px;
      padding-right: 6px;
    }

    /* ── Source code ── */
    .code {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-x: auto;
      tab-size: 4;
      min-width: 0;
    }
    .code-line {
      height: 1.7em;
      white-space: pre;
      padding: 0 16px 0 12px;
    }
    .code-line.highlighted {
      background: rgba(158, 206, 106, 0.15);
    }
    .code-line.risk-red {
      background: rgba(255, 85, 85, 0.06);
    }
    .code-line.risk-orange {
      background: rgba(255, 183, 77, 0.06);
    }
    .code-line.risk-blue {
      background: rgba(122, 162, 247, 0.05);
    }
    .code-line.path-line {
      background: rgba(122, 162, 247, 0.06);
    }
    .code-line.step-line {
      background: rgba(158, 206, 106, 0.15);
    }

    /* ── Annotation column ── */
    .annotations {
      width: 280px;
      flex-shrink: 0;
      border-left: 1px solid var(--border);
      background: var(--bg-secondary);
      overflow: hidden;
    }
    .annotation-line {
      height: 1.7em;
      display: flex;
      align-items: center;
      padding: 0 8px;
      overflow: hidden;
    }
    .annotation-text {
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ann-narrowed { color: #9ece6a; }
    .ann-truncation { color: #ffb74d; }
    .ann-precision { color: #ffb74d; }
    .ann-external { color: #ff5555; }
    .ann-assign { color: #7dcfff; }
    .ann-info { color: var(--text-muted); }

    /* ── Toggle button ── */
    .toggle-annotations {
      position: absolute;
      right: 4px;
      top: 4px;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid var(--border);
      background: var(--bg-secondary);
      color: var(--text-muted);
      cursor: pointer;
      z-index: 1;
    }
    .toggle-annotations:hover { background: var(--bg-tertiary); }

    /* ── Hover tooltip ── */
    .tooltip {
      position: fixed;
      z-index: 100;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 12px;
      font-family: var(--font-mono);
      max-width: 400px;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .tooltip-type { color: var(--cyan); font-size: 11px; }
    .tooltip-domain { color: var(--green); }
    .tooltip-check { color: #ffb74d; font-size: 11px; margin-top: 2px; }

    /* ── Syntax highlighting ── */
    .hl-keyword { color: var(--purple); font-weight: 500; }
    .hl-type { color: var(--cyan); }
    .hl-string { color: var(--green); }
    .hl-number { color: var(--orange); }
    .hl-comment { color: var(--text-muted); font-style: italic; }

    .empty {
      display: flex; align-items: center; justify-content: center;
      height: 100%; color: var(--text-muted); font-size: 14px;
    }
  `;

  @property({ type: String }) source = '';
  @property({ type: Array }) lineMap: [number, number, number][] = [];
  @property({ type: Object }) analysis: FunctionAnalysis | null = null;
  @property({ type: Array }) pathDetail: PathInfo[] | null = null;
  @property({ type: Array }) stateVarAccess: StateVarAccess[] = [];
  @property({ type: Array }) globalRanges: GlobalRange[] = [];
  @property({ type: Number }) selectedPathIndex: number | null = null;
  @property({ type: Number }) selectedStepIndex: number | null = null;

  @state() private showAnnotations = true;
  @state() private tooltipInfo: { x: number; y: number; content: string[] } | null = null;

  // ─── Computed Maps ────────────────────────────────────────────────

  /** Map nodeId → first source line number */
  private get nodeIdToLine(): Map<number, number> {
    const map = new Map<number, number>();
    for (const [line, _col, nodeId] of this.lineMap) {
      if (!map.has(nodeId)) map.set(nodeId, line);
    }
    return map;
  }

  /** Map line → nodeIds on that line */
  private get lineToNodeIds(): Map<number, number[]> {
    const map = new Map<number, number[]>();
    for (const [line, _col, nodeId] of this.lineMap) {
      const arr = map.get(line);
      if (arr) { if (!arr.includes(nodeId)) arr.push(nodeId); }
      else map.set(line, [nodeId]);
    }
    return map;
  }

  /** Aggregate arith checks from all feasible paths → per line */
  private get lineArithChecks(): Map<number, ArithCheck[]> {
    const map = new Map<number, ArithCheck[]>();
    if (!this.analysis || !this.source) return map;

    const paths = this.pathDetail ?? this.analysis.paths;
    const sourceLines = this.source.split('\n');

    // Collect all unique arithChecks across all feasible paths
    const allChecks = new Map<string, ArithCheck>(); // key: "opNode:check"
    for (const path of paths) {
      if (!path.feasible || !path.arithChecks) continue;
      for (const ac of path.arithChecks) {
        const key = `${ac.opNode}:${ac.check}`;
        if (!allChecks.has(key)) allChecks.set(key, ac);
      }
    }

    // First try nodeId → line mapping (works when lineMap has entries)
    const nodeToLine = this.nodeIdToLine;
    const unmapped: ArithCheck[] = [];

    for (const ac of allChecks.values()) {
      const line = nodeToLine.get(ac.opNode);
      if (line) {
        const arr = map.get(line);
        if (arr) arr.push(ac);
        else map.set(line, [ac]);
      } else {
        unmapped.push(ac);
      }
    }

    // For unmapped checks, use opText to find the source line
    for (const ac of unmapped) {
      const opText = ac.opText?.trim();
      if (!opText || opText.length < 2) continue;

      // Search source lines for a line containing this expression
      for (let i = 0; i < sourceLines.length; i++) {
        const srcLine = sourceLines[i];
        if (srcLine.includes(opText)) {
          const lineNum = i + 1;
          const arr = map.get(lineNum);
          if (arr) {
            if (!arr.some(a => a.opNode === ac.opNode && a.check === ac.check)) arr.push(ac);
          } else {
            map.set(lineNum, [ac]);
          }
          break; // first match
        }
      }
    }

    return map;
  }

  /** External calls — mark lines containing .call/.transfer/.send/interface calls */
  private get lineExternalCalls(): Map<number, string[]> {
    const map = new Map<number, string[]>();
    if (!this.source) return map;

    // Simple text-based detection of external call patterns on source lines
    const lines = this.source.split('\n');
    const callPatterns = [
      /\.call\s*[({]/,
      /\.delegatecall\s*[({]/,
      /\.staticcall\s*[({]/,
      /\.transfer\s*\(/,
      /\.send\s*\(/,
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pat of callPatterns) {
        if (pat.test(line)) {
          const lineNum = i + 1;
          const existing = map.get(lineNum) ?? [];
          const match = line.trim();
          if (!existing.includes(match)) existing.push(match);
          map.set(lineNum, existing);
          break;
        }
      }
    }

    // Also check for interface calls from inlinedCalls data
    if (this.analysis) {
      const nodeToLine = this.nodeIdToLine;
      for (const ic of (this.analysis.inlinedCallees ?? [])) {
        // Inlined callees have callNode which might map to a source line
      }
    }
    return map;
  }

  /** Lines with require/assert → domain narrowing points */
  private get lineAssertions(): Set<number> {
    const set = new Set<number>();
    if (!this.source) return set;

    // Direct source-line detection of assertion patterns
    const lines = this.source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trimStart();
      if (line.startsWith('require(') || line.startsWith('require (') ||
          line.startsWith('assert(') || line.startsWith('assert (') ||
          line.includes(' require(') || line.includes(' assert(') ||
          line.includes('if (') || line.includes('if(')) {
        // Only mark require/assert, not all if statements
        if (line.includes('require(') || line.includes('require (') ||
            line.includes('assert(') || line.includes('assert (')) {
          set.add(i + 1);
        }
      }
    }
    return set;
  }

  /** Build per-line risk indicators */
  private get lineRisks(): Map<number, LineRiskInfo> {
    const map = new Map<number, LineRiskInfo>();
    const arithChecks = this.lineArithChecks;
    const externalCalls = this.lineExternalCalls;
    const assertions = this.lineAssertions;

    // ArithCheck-based risks
    for (const [line, checks] of arithChecks) {
      const descs: string[] = [];
      let worstLevel: RiskLevel = 'none';

      for (const ac of checks) {
        const desc = `${ac.check}: ${ac.bound}`;
        descs.push(desc);
        const level: RiskLevel = RED_CHECKS.has(ac.check) ? 'red' : ORANGE_CHECKS.has(ac.check) ? 'orange' : 'orange';
        if (riskPriority(level) < riskPriority(worstLevel)) worstLevel = level;
      }

      map.set(line, {
        level: worstLevel,
        symbol: worstLevel === 'red' ? '!!' : '!',
        descriptions: descs,
      });
    }

    // External calls (blue)
    for (const [line, calls] of externalCalls) {
      const existing = map.get(line);
      if (!existing || riskPriority('blue') < riskPriority(existing.level)) {
        // Don't overwrite higher-priority risks, but add descriptions
        if (existing) {
          existing.descriptions.push(...calls.map(c => `EXTERNAL: ${c}`));
        } else {
          map.set(line, {
            level: 'blue',
            symbol: '~',
            descriptions: calls.map(c => `External call: ${c}`),
          });
        }
      } else if (existing) {
        existing.descriptions.push(...calls.map(c => `External call: ${c}`));
      }
    }

    // Assertions (green) - only set if no higher risk
    for (const line of assertions) {
      if (!map.has(line)) {
        map.set(line, {
          level: 'green',
          symbol: '>',
          descriptions: ['Domain narrowing point'],
        });
      }
    }

    return map;
  }

  /** Domain annotations for the right column */
  private get lineAnnotations(): Map<number, DomainAnnotation> {
    const map = new Map<number, DomainAnnotation>();

    const nodeToLine = this.nodeIdToLine;

    // 1. ArithCheck annotations (these have opNode → line mapping from the analysis)
    const arithChecks = this.lineArithChecks;
    for (const [line, checks] of arithChecks) {
      // Show all unique checks on this line
      const uniqueChecks = new Map<string, ArithCheck>();
      for (const ac of checks) {
        if (!uniqueChecks.has(ac.check)) uniqueChecks.set(ac.check, ac);
      }
      const parts = [...uniqueChecks.values()].map(ac => `${ac.check}`);
      const firstCheck = uniqueChecks.values().next().value!;
      const badge: DomainAnnotation['badge'] = RED_CHECKS.has(firstCheck.check) ? 'truncation' : 'precision';
      map.set(line, {
        text: `\u26A0 ${parts.join(', ')}`,
        badge,
      });
    }

    // 2. Source-level annotations: detect patterns in source text
    if (this.source) {
      const lines = this.source.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        if (map.has(lineNum)) continue; // don't overwrite arith annotations
        const line = lines[i];

        // require/assert → narrowing point
        if (/\brequire\s*\(/.test(line) || /\bassert\s*\(/.test(line)) {
          map.set(lineNum, { text: '\u2193 NARROWING POINT', badge: 'narrowed' });
        }
        // External calls
        else if (/\.call\s*[({]/.test(line) || /\.delegatecall\s*[({]/.test(line) ||
                 /\.transfer\s*\(/.test(line) || /\.send\s*\(/.test(line)) {
          map.set(lineNum, { text: '\u26A1 EXTERNAL CALL', badge: 'external' });
        }
      }
    }

    // 3. Multi-writer state vars (from stateVarAccess)
    for (const sv of this.stateVarAccess) {
      if (sv.writers.length > 1) {
        const line = nodeToLine.get(sv.varId);
        if (line && !map.has(line)) {
          map.set(line, {
            text: `MULTI-WRITER: ${sv.writers.map(w => w.funcName).join(', ')}`,
            badge: 'info',
          });
        }
      }
    }

    // 4. Unrestricted global ranges
    for (const gr of this.globalRanges) {
      if (gr.min === null && gr.max === null) {
        const line = nodeToLine.get(gr.varId);
        if (line && !map.has(line)) {
          map.set(line, {
            text: `${gr.varName}: UNRESTRICTED`,
            badge: 'truncation',
          });
        }
      }
    }

    return map;
  }

  /** Lines in the currently selected path */
  private get pathLineSet(): Set<number> {
    if (this.selectedPathIndex == null || !this.pathDetail) return new Set();
    const path = this.pathDetail[this.selectedPathIndex];
    if (!path) return new Set();

    const lines = new Set<number>();
    const nodeToLine = this.nodeIdToLine;

    // Mark all lines that have nodeIds mentioned in path statements
    for (const [nodeId, line] of nodeToLine) {
      // Simple heuristic: if a line is in the function, include it
      // More precise: match statement text to source lines
    }
    return lines;
  }

  /** Current step's highlighted line */
  private get stepLine(): number | null {
    if (this.selectedStepIndex == null || !this.pathDetail || this.selectedPathIndex == null) return null;
    const path = this.pathDetail[this.selectedPathIndex];
    if (!path) return null;
    const stmt = path.statements[this.selectedStepIndex];
    if (!stmt || typeof stmt === 'string') return null;
    // Try to find the line via text matching
    const info = stmt as StatementInfo;
    const text = info.text.trim();
    if (!text) return null;

    const lines = this.source.split('\n');
    for (let i = 0; i < lines.length; i++) {
      // Fuzzy match: check if the source line contains key parts of the statement
      const srcTrim = lines[i].trim();
      if (srcTrim && text.includes(srcTrim.replace(/;$/, '').trim())) {
        return i + 1;
      }
    }
    return null;
  }

  /** Ranges at current step for tooltip display */
  private get stepRanges(): Record<string, VarRange> | null {
    if (this.selectedStepIndex == null || !this.pathDetail || this.selectedPathIndex == null) return null;
    const path = this.pathDetail[this.selectedPathIndex];
    if (!path) return null;

    const cumulative: Record<string, VarRange> = {};
    for (let i = 0; i <= this.selectedStepIndex; i++) {
      const stmt = path.statements[i];
      if (typeof stmt !== 'string' && (stmt as StatementInfo).ranges) {
        Object.assign(cumulative, (stmt as StatementInfo).ranges);
      }
    }
    return Object.keys(cumulative).length > 0 ? cumulative : null;
  }

  // ─── Render ───────────────────────────────────────────────────────

  render() {
    if (!this.source) {
      return html`<div class="empty">Select a contract or function in the sidebar to view source</div>`;
    }

    const lines = this.source.split('\n');
    const risks = this.lineRisks;
    const annotations = this.lineAnnotations;
    const pathLines = this.pathLineSet;
    const currentStepLine = this.stepLine;

    return html`
      <button class="toggle-annotations"
        @click=${() => this.showAnnotations = !this.showAnnotations}
      >${this.showAnnotations ? 'Hide' : 'Show'} Annotations</button>

      ${this.tooltipInfo ? html`
        <div class="tooltip" style="left:${this.tooltipInfo.x}px;top:${this.tooltipInfo.y}px;">
          ${this.tooltipInfo.content.map(c => html`<div>${c}</div>`)}
        </div>
      ` : nothing}

      <div class="code-container">
        <div class="gutter">
          ${lines.map((_, i) => {
            const lineNum = i + 1;
            const risk = risks.get(lineNum);
            const isPath = pathLines.has(lineNum);
            return html`
              <div class="gutter-line" @click=${() => this.onLineClick(lineNum)}>
                ${isPath ? html`<div class="marker-path"></div>` : html`<div style="width:5px"></div>`}
                <span class="gutter-marker ${risk ? `marker-${risk.level}` : ''}">
                  ${risk?.symbol ?? ''}
                </span>
                <span class="line-num">${lineNum}</span>
              </div>
            `;
          })}
        </div>
        <div class="code">
          ${lines.map((line, i) => {
            const lineNum = i + 1;
            const risk = risks.get(lineNum);
            const isPath = pathLines.has(lineNum);
            const isStep = currentStepLine === lineNum;
            const cls = [
              'code-line',
              isStep ? 'step-line' :
                risk?.level === 'red' ? 'risk-red' :
                risk?.level === 'orange' ? 'risk-orange' :
                risk?.level === 'blue' ? 'risk-blue' :
                isPath ? 'path-line' : '',
            ].filter(Boolean).join(' ');

            return html`<div class="${cls}"
              @mouseenter=${(e: MouseEvent) => this.onLineHover(e, lineNum)}
              @mouseleave=${() => this.tooltipInfo = null}
            >${unsafeHTML(highlightSolidity(line) || ' ')}</div>`;
          })}
        </div>
        ${this.showAnnotations ? html`
          <div class="annotations">
            ${lines.map((_, i) => {
              const lineNum = i + 1;
              const ann = annotations.get(lineNum);
              return html`
                <div class="annotation-line">
                  ${ann ? html`
                    <span class="annotation-text ann-${ann.badge}">${ann.text}</span>
                  ` : nothing}
                </div>
              `;
            })}
          </div>
        ` : nothing}
      </div>
    `;
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('selectedStepIndex') || changed.has('selectedPathIndex')) {
      const stepLine = this.stepLine;
      if (stepLine) {
        requestAnimationFrame(() => {
          const lineHeight = 1.7 * 13;
          this.scrollTop = Math.max(0, (stepLine - 5) * lineHeight);
        });
      }
    }
  }

  // ─── Tooltip on hover ────────────────────────────────────────────

  private onLineHover(e: MouseEvent, lineNum: number) {
    const risks = this.lineRisks;
    const risk = risks.get(lineNum);
    const stepRanges = this.stepRanges;
    const content: string[] = [];

    // Show line-level risk info
    if (risk) {
      for (const desc of risk.descriptions) {
        content.push(desc);
      }
    }

    // Show variable domains at current step
    if (stepRanges) {
      const nodeIds = this.lineToNodeIds.get(lineNum);
      if (nodeIds && nodeIds.length > 0) {
        for (const [varName, range] of Object.entries(stepRanges)) {
          content.push(`${varName}: ${this.formatRange(range)}`);
        }
      }
    }

    if (content.length === 0) return;

    this.tooltipInfo = {
      x: e.clientX + 12,
      y: e.clientY - 8,
      content,
    };
  }

  private formatRange(range: VarRange): string {
    if (range.intervals.length > 0) {
      const parts = range.intervals.map(([lo, hi]) =>
        lo === hi ? this.shortNum(lo) : `${this.shortNum(lo)}..${this.shortNum(hi)}`
      );
      let s = parts.length > 1 ? parts.join(' \u222A ') : `[${parts[0]}]`;
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

  /** Shorten large numbers: 2^256-1 → MAX_UINT256, etc. */
  private shortNum(s: string): string {
    if (s === '115792089237316195423570985008687907853269984665640564039457584007913129639935') return 'MAX_UINT256';
    if (s === '340282366920938463463374607431768211455') return 'MAX_UINT128';
    if (s.length > 12) return s.slice(0, 6) + '..' + s.slice(-4);
    return s;
  }

  private onLineClick(line: number) {
    this.dispatchEvent(new CustomEvent('select-line', {
      detail: { line },
      bubbles: true,
      composed: true,
    }));
  }
}
