import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type {
  ContractInfo, AnalysisResult, ViewTab, GraphSubTab,
  FunctionAnalysis, CFGData, CallGraphData, FunctionSummary, GlobalRange, StateVarAccess,
  SourceWithMapping, PathInfo, ContextMode,
} from '../types';
import * as api from '../api';

@customElement('app-shell')
export class AppShell extends LitElement {
  static styles = css`
    :host { display: flex; flex-direction: column; height: 100vh; }

    /* ── Toolbar ── */
    .toolbar {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 16px; background: var(--bg-secondary);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .logo { font-weight: 700; font-size: 15px; color: var(--accent); }
    .file-name { color: var(--text-muted); font-size: 13px; }
    .node-count { color: var(--text-muted); font-size: 12px; }
    .spacer { flex: 1; }
    .analyze-btn { font-size: 12px; padding: 4px 14px; }
    .analyze-btn.analyzing {
      color: var(--yellow);
      animation: pulse 1.5s infinite;
      pointer-events: none;
    }
    .analyzed-badge {
      font-size: 11px; color: var(--green);
      padding: 2px 8px; border-radius: 3px;
      background: rgba(158, 206, 106, 0.1);
    }
    .status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      flex-shrink: 0;
    }
    .status-analyzing { background: var(--yellow); animation: pulse 1.5s infinite; }
    .status-analyzed { background: var(--green); }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    /* ── Layout ── */
    .main { display: flex; flex: 1; overflow: hidden; }
    .content { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0; }
    .view { flex: 1; overflow: hidden; min-height: 0; display: flex; flex-direction: column; }

    /* ── Tab Bar ── */
    .tab-strip {
      display: flex; gap: 0; flex-shrink: 0;
      background: var(--bg-secondary);
      border-bottom: 2px solid var(--border);
      padding: 0 8px;
    }
    .tab-btn {
      padding: 10px 18px;
      font-size: 13px; font-weight: 500;
      color: var(--text-muted); cursor: pointer;
      user-select: none; white-space: nowrap;
      border: none; background: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: color 0.15s, border-color 0.15s, background 0.15s;
      font-family: var(--font-sans);
    }
    .tab-btn:hover {
      color: var(--text-secondary);
      background: var(--bg-tertiary);
    }
    .tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    /* ── Sub-tab bar ── */
    .sub-tab-strip {
      display: flex; gap: 0; flex-shrink: 0;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border);
      padding: 0 8px;
    }
    .sub-tab-btn {
      padding: 6px 14px;
      font-size: 12px; font-weight: 500;
      color: var(--text-muted); cursor: pointer;
      user-select: none; white-space: nowrap;
      border: none; background: none;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;
      font-family: var(--font-sans);
    }
    .sub-tab-btn:hover { color: var(--text-secondary); }
    .sub-tab-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    /* ── Source split panel ── */
    .source-split {
      display: flex; flex: 1; overflow: hidden; min-height: 0;
    }
    .source-left {
      flex: 60; min-width: 0; min-height: 0;
      overflow: hidden;
      position: relative;
    }
    .source-right {
      flex: 40; min-width: 0; min-height: 0;
      overflow: hidden;
      position: relative;
      border-left: 1px solid var(--border);
    }

    /* ── Context label ── */
    .context-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 16px;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border);
      font-size: 12px; color: var(--text-muted); flex-shrink: 0;
    }
    .context-label { color: var(--text-secondary); font-weight: 600; }
  `;

  @state() private loaded = false;
  @state() private analyzing = false;
  @state() private analyzingAll = false;
  @state() private analyzeAllProgress = '';
  @state() private fileName = '';
  @state() private nodeCount = 0;
  @state() private sourceUnits: number[] = [];
  @state() private contracts: ContractInfo[] = [];
  @state() private analysisMap = new Map<string, AnalysisResult>();
  @state() private selectedContractId: number | null = null;
  @state() private selectedFunctionId: number | null = null;
  @state() private activeTab: ViewTab = 'code';
  @state() private graphSubTab: GraphSubTab = 'cfg';

  // Source + mapping
  @state() private sourceCode = '';
  @state() private sourceMapping: SourceWithMapping | null = null;
  @state() private sourceLabel = '';

  // Analysis detail
  @state() private cfgData: CFGData | null = null;
  @state() private selectedFuncAnalysis: FunctionAnalysis | null = null;
  @state() private pathDetail: PathInfo[] | null = null;

  // Navigation
  @state() private contextMode: ContextMode = 'overview';
  @state() private selectedPathIndex: number | null = null;
  @state() private selectedStepIndex: number | null = null;

  // ─── Computed Properties ──────────────────────────────────────

  private get selectedContract(): ContractInfo | null {
    if (!this.selectedContractId) return null;
    return this.contracts.find(c => c.id === this.selectedContractId) ?? null;
  }

  private get currentAnalysis(): AnalysisResult | null {
    const c = this.selectedContract;
    if (!c) return null;
    return this.analysisMap.get(c.name) ?? null;
  }

  private get isCurrentAnalyzed(): boolean {
    return this.currentAnalysis !== null;
  }

  private get scopeLabel(): string {
    if (!this.selectedFunctionId) {
      const c = this.selectedContract;
      return c ? `All functions in ${c.name}` : '';
    }
    return this.sourceLabel || '';
  }

  private get scopedFunctions(): FunctionAnalysis[] {
    const analysis = this.currentAnalysis;
    if (!analysis) return [];
    if (this.selectedFunctionId) {
      return analysis.functions.filter(f => f.functionId === this.selectedFunctionId);
    }
    return analysis.functions;
  }

  private get scopedSummaries(): FunctionSummary[] {
    const analysis = this.currentAnalysis;
    if (!analysis) return [];
    if (this.selectedFunctionId) {
      return analysis.summaries.filter(s => s.functionId === this.selectedFunctionId);
    }
    return analysis.summaries;
  }

  private get scopedRanges(): GlobalRange[] {
    const analysis = this.currentAnalysis;
    if (!analysis) return [];
    if (!this.selectedFunctionId) return analysis.globalRanges;
    const touchedVarIds = this.touchedStateVarIds;
    if (!touchedVarIds) return analysis.globalRanges;
    return analysis.globalRanges.filter(r => touchedVarIds.has(r.varId));
  }

  private get scopedStateVars(): StateVarAccess[] {
    const analysis = this.currentAnalysis;
    if (!analysis) return [];
    if (!this.selectedFunctionId) return analysis.stateVarAnalysis;
    const touchedVarIds = this.touchedStateVarIds;
    if (!touchedVarIds) return analysis.stateVarAnalysis;
    return analysis.stateVarAnalysis.filter(v => touchedVarIds.has(v.varId));
  }

  private get touchedStateVarIds(): Set<number> | null {
    const analysis = this.currentAnalysis;
    if (!analysis || !this.selectedFunctionId) return null;
    const ids = new Set<number>();
    for (const v of analysis.stateVarAnalysis) {
      const touches = v.readers.some(r => r.funcId === this.selectedFunctionId) ||
                      v.writers.some(w => w.funcId === this.selectedFunctionId);
      if (touches) ids.add(v.varId);
    }
    return ids;
  }

  /** Scope call graph to selected function's transitive call tree */
  private get scopedCallGraph(): CallGraphData | null {
    const analysis = this.currentAnalysis;
    if (!analysis?.callGraph) return null;
    const cg = analysis.callGraph;
    if (!this.selectedFunctionId) return cg;

    // BFS from selected function to find all transitive callees
    const reachable = new Set<number>();
    const queue = [this.selectedFunctionId];
    while (queue.length > 0) {
      const id = queue.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const edge of cg.edges) {
        if (edge.from === id && edge.to != null && !reachable.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    }

    return {
      nodes: cg.nodes.filter(n => reachable.has(n.id)),
      edges: cg.edges.filter(e => e.from != null && e.to != null && reachable.has(e.from) && reachable.has(e.to)),
      recursiveFunctions: cg.recursiveFunctions.filter(id => reachable.has(id)),
    };
  }

  // ─── Render ───────────────────────────────────────────────────

  render() {
    if (!this.loaded) {
      return html`<file-loader @file-loaded=${this.onFileLoaded}></file-loader>`;
    }

    const contract = this.selectedContract;
    const analyzed = this.isCurrentAnalyzed;

    return html`
      <div class="toolbar">
        <span class="logo">solc-audit</span>
        <span class="file-name">${this.fileName}</span>
        <span class="node-count">${this.nodeCount.toLocaleString()} nodes</span>
        <span class="spacer"></span>
        ${this.analyzingAll ? html`
          <span class="status-dot status-analyzing"></span>
          <button class="analyze-btn analyzing" disabled>${this.analyzeAllProgress}</button>
        ` : contract ? html`
          ${this.analyzing ? html`
            <span class="status-dot status-analyzing"></span>
            <button class="analyze-btn analyzing" disabled>Analyzing ${contract.name}...</button>
          ` : analyzed ? html`
            <span class="status-dot status-analyzed"></span>
            <span class="analyzed-badge">${contract.name} analyzed</span>
            <button class="analyze-btn" @click=${this.runContractAnalysis} style="opacity:0.7">Re-analyze</button>
          ` : html`
            <button class="analyze-btn" @click=${this.runContractAnalysis}>Analyze ${contract.name}</button>
          `}
          <button class="analyze-btn" @click=${this.runAnalyzeAll} style="margin-left: 8px;">Analyze All</button>
        ` : html`
          <button class="analyze-btn" @click=${this.runAnalyzeAll}>Analyze All</button>
        `}
      </div>
      <div class="main">
        <audit-sidebar
          .contracts=${this.contracts}
          .selectedContractId=${this.selectedContractId}
          .selectedFunctionId=${this.selectedFunctionId}
          .analysisMap=${this.analysisMap}
          @select-contract=${this.onSelectContract}
          @select-function=${this.onSelectFunction}
        ></audit-sidebar>
        <div class="content">
          ${this.renderTabStrip()}
          ${this.sourceLabel ? html`
            <div class="context-bar">
              <span class="context-label">${this.sourceLabel}</span>
            </div>
          ` : ''}
          <div class="view">
            ${this.renderView()}
          </div>
        </div>
      </div>
    `;
  }

  private renderTabStrip() {
    const tabs: { key: ViewTab; label: string }[] = [
      { key: 'code', label: 'Code' },
      { key: 'graphs', label: 'Graphs' },
    ];

    return html`
      <div class="tab-strip">
        ${tabs.map(t => html`
          <button class="tab-btn ${this.activeTab === t.key ? 'active' : ''}"
            @click=${() => { this.activeTab = t.key; }}
          >${t.label}</button>
        `)}
      </div>
    `;
  }

  private renderView() {
    switch (this.activeTab) {
      case 'code':
        return this.renderCodeView();
      case 'graphs':
        return this.renderGraphsView();
      default:
        return html``;
    }
  }

  private renderCodeView() {
    return html`
      <div class="source-split">
        <div class="source-left">
          <annotated-source
            .source=${this.sourceMapping?.source ?? this.sourceCode}
            .lineMap=${this.sourceMapping?.lineMap ?? []}
            .analysis=${this.selectedFuncAnalysis}
            .pathDetail=${this.pathDetail}
            .stateVarAccess=${this.scopedStateVars}
            .globalRanges=${this.scopedRanges}
            .selectedPathIndex=${this.selectedPathIndex}
            .selectedStepIndex=${this.selectedStepIndex}
            @select-line=${this.onSelectLine}
          ></annotated-source>
        </div>
        <div class="source-right">
          <context-panel
            .mode=${this.contextMode}
            .functions=${this.scopedFunctions}
            .selectedFunctionId=${this.selectedFunctionId}
            .selectedPathIndex=${this.selectedPathIndex}
            .analysis=${this.selectedFuncAnalysis}
            .pathDetail=${this.pathDetail}
            .stateVarAccess=${this.scopedStateVars}
            .globalRanges=${this.scopedRanges}
            .callGraph=${this.currentAnalysis?.callGraph ?? null}
            .summaries=${this.scopedSummaries}
            @select-path=${this.onSelectPath}
            @highlight-step=${this.onHighlightStep}
            @back-to-overview=${this.onBackToOverview}
            @switch-mode=${this.onSwitchMode}
            @inspect-variable=${this.onInspectVariable}
            @navigate-to-function=${this.onNavigateToFunction}
          ></context-panel>
        </div>
      </div>
    `;
  }

  private renderGraphsView() {
    const subTabs: { key: GraphSubTab; label: string }[] = [
      { key: 'cfg', label: 'Inlined CFG' },
      { key: 'call-graph', label: 'Call Graph' },
      { key: 'state-flow', label: 'State Flow' },
    ];

    return html`
      <div style="display:flex;flex-direction:column;height:100%;">
        <div class="sub-tab-strip">
          ${subTabs.map(t => html`
            <button class="sub-tab-btn ${this.graphSubTab === t.key ? 'active' : ''}"
              @click=${() => this.graphSubTab = t.key}
            >${t.label}</button>
          `)}
        </div>
        <div style="flex:1;overflow:hidden;">
          ${this.renderGraphContent()}
        </div>
      </div>
    `;
  }

  private renderGraphContent() {
    switch (this.graphSubTab) {
      case 'cfg':
        return html`<cfg-view
          .data=${this.cfgData}
          .functionId=${this.selectedFunctionId}
        ></cfg-view>`;
      case 'call-graph':
        return html`<call-graph-view .data=${this.scopedCallGraph}></call-graph-view>`;
      case 'state-flow':
        return html`<state-var-graph .data=${this.scopedStateVars} .scopeLabel=${this.scopeLabel}></state-var-graph>`;
      default:
        return html``;
    }
  }

  // ─── Event Handlers ───────────────────────────────────────────

  private async onFileLoaded(e: CustomEvent) {
    const { jsonStr, fileName } = e.detail;
    try {
      const { nodeCount, sourceUnits } = await api.loadFile(jsonStr);
      this.nodeCount = nodeCount;
      this.fileName = fileName;
      this.sourceUnits = sourceUnits;
      this.contracts = await api.getContractList();
      this.loaded = true;
    } catch (err) {
      console.error('Failed to load file:', err);
    }
  }

  private async runContractAnalysis() {
    const contract = this.selectedContract;
    if (!contract || this.analyzing) return;

    this.analyzing = true;
    try {
      const result = await api.analyzeContract(contract.name, {});
      const next = new Map(this.analysisMap);
      next.set(contract.name, result);
      this.analysisMap = next;
      // Stay on code tab — no more findings redirect
      this.activeTab = 'code';
    } catch (err) {
      console.error(`Analysis of ${contract.name} failed:`, err);
    } finally {
      this.analyzing = false;
    }
  }

  private async runAnalyzeAll() {
    if (this.analyzingAll || this.analyzing) return;

    // Get analyzable contracts (non-interface, non-library, non-abstract with functions)
    const analyzable = this.contracts.filter(c => {
      const k = c.kind.toLowerCase();
      return k !== 'interface' && k !== 'library' && c.functions.length > 0;
    });

    if (analyzable.length === 0) return;

    this.analyzingAll = true;
    const next = new Map(this.analysisMap);
    let done = 0;

    for (const contract of analyzable) {
      if (next.has(contract.name)) { done++; continue; } // skip already analyzed
      this.analyzeAllProgress = `Analyzing ${contract.name} (${done + 1}/${analyzable.length})...`;
      try {
        const result = await api.analyzeContract(contract.name, {});
        next.set(contract.name, result);
        this.analysisMap = new Map(next);
      } catch (err) {
        console.error(`Analysis of ${contract.name} failed:`, err);
      }
      done++;
    }

    this.analysisMap = next;
    this.analyzingAll = false;
    this.analyzeAllProgress = '';
  }

  private async onSelectContract(e: CustomEvent) {
    const contractId = e.detail.id;
    this.selectedContractId = contractId;
    this.selectedFunctionId = null;
    this.activeTab = 'code';
    this.contextMode = 'overview';
    this.selectedPathIndex = null;
    this.selectedStepIndex = null;
    this.pathDetail = null;

    try {
      const mapping = await api.writeNodeWithMapping(contractId);
      this.sourceMapping = mapping;
      this.sourceCode = mapping.source;
      const c = this.contracts.find(c => c.id === contractId);
      this.sourceLabel = c ? c.name : '';
    } catch {
      this.sourceMapping = null;
      this.sourceCode = '';
      this.sourceLabel = '';
    }
  }

  private async onSelectFunction(e: CustomEvent) {
    const funcId = e.detail.id;
    this.selectedFunctionId = funcId;
    this.contextMode = 'overview';
    this.selectedPathIndex = null;
    this.selectedStepIndex = null;
    this.pathDetail = null;

    // Find function name + contract
    let funcName = '';
    let contractName = '';
    let contractId: number | null = null;
    for (const c of this.contracts) {
      const f = c.functions.find(fn => fn.id === funcId);
      if (f) {
        funcName = f.name || (f.isConstructor ? 'constructor' : '');
        contractName = c.name;
        contractId = c.id;
        break;
      }
    }
    this.sourceLabel = contractName ? `${contractName}.${funcName}` : funcName;
    this.activeTab = 'code';

    // Track contract selection
    if (contractId && contractId !== this.selectedContractId) {
      this.selectedContractId = contractId;
    }

    // Load FUNCTION-ONLY source (not whole contract)
    try {
      const mapping = await api.writeNodeWithMapping(funcId);
      this.sourceMapping = mapping;
      this.sourceCode = mapping.source;
    } catch {
      this.sourceMapping = null;
      this.sourceCode = '';
    }

    // Load CFG in background
    api.getCFG(funcId).then(cfg => { this.cfgData = cfg; }).catch(() => {});

    // Find function analysis + lazy-load path detail
    this.selectedFuncAnalysis = null;
    for (const analysis of this.analysisMap.values()) {
      const fa = analysis.functions.find(f => f.functionId === funcId);
      if (fa) {
        this.selectedFuncAnalysis = fa;
        api.getPathDetail(funcId).then(detailedPaths => {
          if (this.selectedFunctionId === funcId) {
            this.pathDetail = detailedPaths;
            this.selectedFuncAnalysis = { ...fa, paths: detailedPaths };
          }
        }).catch(() => {});
        break;
      }
    }
  }

  private onSelectPath(e: CustomEvent) {
    const { pathIndex } = e.detail;
    this.contextMode = 'path';
    this.selectedPathIndex = pathIndex;
    this.selectedStepIndex = 0;
  }

  private onHighlightStep(e: CustomEvent) {
    const { stepIndex } = e.detail;
    this.selectedStepIndex = stepIndex;
  }

  private onBackToOverview() {
    this.contextMode = 'overview';
    this.selectedPathIndex = null;
    this.selectedStepIndex = null;
  }

  private onSwitchMode(e: CustomEvent) {
    const { mode } = e.detail;
    this.contextMode = mode;
  }

  private onInspectVariable(e: CustomEvent) {
    this.contextMode = 'variable';
  }

  private async onNavigateToFunction(e: CustomEvent) {
    const { functionId } = e.detail;
    this.onSelectFunction(new CustomEvent('select-function', { detail: { id: functionId } }));
  }

  private onSelectLine(e: CustomEvent) {
    // Could navigate to variable inspector if a variable is on this line
  }
}
