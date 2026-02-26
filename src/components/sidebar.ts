import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ContractInfo, AnalysisResult } from '../types';

interface TreeFolder {
  name: string;
  path: string;
  contracts: ContractInfo[];
  children: Map<string, TreeFolder>;
}

@customElement('audit-sidebar')
export class AuditSidebar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      background: var(--bg-secondary);
      border-right: 1px solid var(--border);
      font-size: 13px;
    }

    /* ── Search ── */
    .search-box {
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .search-input {
      width: 100%;
      box-sizing: border-box;
      padding: 5px 8px 5px 26px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--bg-primary);
      color: var(--text-primary);
      font-size: 12px;
      font-family: var(--font-sans);
      outline: none;
    }
    .search-input::placeholder { color: var(--text-muted); }
    .search-input:focus { border-color: var(--accent); }
    .search-wrap {
      position: relative;
    }
    .search-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 11px;
      pointer-events: none;
    }
    .search-count {
      font-size: 10px;
      color: var(--text-muted);
      padding: 3px 2px 0;
    }

    /* ── Scrollable list ── */
    .list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0 16px;
    }

    /* ── Tree row (shared by all levels) ── */
    .tree-row {
      display: flex;
      align-items: center;
      padding: 3px 8px;
      cursor: pointer;
      gap: 4px;
      white-space: nowrap;
      user-select: none;
    }
    .tree-row:hover { background: var(--bg-hover); }
    .tree-row.selected { background: rgba(122, 162, 247, 0.12); }

    /* ── Indentation ── */
    .indent { flex-shrink: 0; }

    /* ── Chevron ── */
    .chevron {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      color: var(--text-muted);
      flex-shrink: 0;
      transition: transform 0.1s;
    }
    .chevron.open { transform: rotate(90deg); }
    .chevron.hidden { visibility: hidden; }

    /* ── Icons ── */
    .icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    .icon-folder { color: var(--yellow); }
    .icon-folder-open { color: var(--yellow); }
    .icon-contract { color: var(--accent); }
    .icon-interface { color: var(--cyan); }
    .icon-library { color: var(--purple); }
    .icon-abstract { color: var(--orange); }
    .icon-func { color: var(--green); }
    .icon-var { color: var(--text-muted); font-size: 10px; }
    .icon-event { color: var(--yellow); font-size: 10px; }

    /* ── Labels ── */
    .label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .folder-label { color: var(--text-secondary); font-weight: 500; font-size: 12px; }
    .contract-label { color: var(--text-primary); font-weight: 600; }
    .func-label { color: var(--text-primary); font-weight: 500; min-width: 60px; flex-shrink: 0; }
    .selected .func-label { color: var(--accent); }
    .selected .contract-label { color: var(--accent); }
    .var-label { color: var(--text-muted); font-size: 12px; }

    /* ── Badges ── */
    .badge {
      font-size: 9px;
      padding: 0 4px;
      border-radius: 2px;
      flex-shrink: 0;
      color: var(--text-muted);
      background: var(--bg-tertiary);
    }
    .badge-kind { color: var(--text-muted); }
    .badge-view { color: var(--cyan); }
    .badge-pure { color: var(--purple); }
    .badge-payable { color: var(--yellow); }

    /* ── Risk indicators ── */
    .risk-dot {
      width: 7px; height: 7px;
      border-radius: 50%; flex-shrink: 0;
    }
    .risk-dot-red { background: #ff5555; }
    .risk-dot-orange { background: #ffb74d; }
    .path-count {
      font-size: 9px; font-weight: 500;
      color: var(--text-muted); flex-shrink: 0;
    }

    /* ── Func params (dimmed) ── */
    .func-params {
      color: var(--text-muted);
      font-size: 11px;
      flex-shrink: 10;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 50%;
    }

    /* ── Vis dot ── */
    .vis-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .vis-public { background: var(--accent); }
    .vis-external { background: var(--green); }
    .vis-internal { background: var(--orange); }
    .vis-private { background: var(--red); }
    .vis-default { background: var(--text-muted); }

    .no-results {
      padding: 24px 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 12px;
    }
    .hl { color: var(--yellow); font-weight: 700; }

    /* ── Section header inside contract ── */
    .section-row {
      display: flex;
      align-items: center;
      padding: 2px 8px;
      gap: 4px;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
    }
    .section-row:hover { background: var(--bg-hover); }
    .section-label {
      font-size: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .section-count {
      font-size: 9px;
      color: var(--text-muted);
    }
  `;

  @property({ type: Array }) contracts: ContractInfo[] = [];
  @property({ type: Number }) selectedContractId: number | null = null;
  @property({ type: Number }) selectedFunctionId: number | null = null;
  @property({ attribute: false }) analysisMap: Map<string, AnalysisResult> = new Map();

  @state() private searchQuery = '';
  @state() private expandedPaths = new Set<string>();
  @state() private expandedContracts = new Set<number>();
  @state() private expandedSections = new Set<string>();
  private _lastContractCount = 0;

  render() {
    const q = this.searchQuery.toLowerCase().trim();
    // Always hide interfaces from the sidebar
    const noInterfaces = this.contracts.filter(c => c.kind.toLowerCase() !== 'interface');
    const filtered = q ? this.filterContracts(q, noInterfaces) : noInterfaces;
    const tree = this.buildTree(filtered);

    // Auto-expand first level when contracts first load
    if (this.contracts.length > 0 && this._lastContractCount === 0) {
      this._lastContractCount = this.contracts.length;
      const paths = new Set(this.expandedPaths);
      for (const [, child] of tree.children) {
        paths.add(child.path);
      }
      this.expandedPaths = paths;
    }

    return html`
      <div class="search-box">
        <div class="search-wrap">
          <span class="search-icon">\u2315</span>
          <input
            class="search-input"
            type="text"
            placeholder="Search contracts & functions..."
            .value=${this.searchQuery}
            @input=${(e: Event) => { this.searchQuery = (e.target as HTMLInputElement).value; }}
          />
        </div>
        ${q ? html`<div class="search-count">${filtered.length} of ${this.contracts.length} contracts</div>` : ''}
      </div>
      <div class="list">
        ${filtered.length === 0 && q
          ? html`<div class="no-results">No matches for "${this.searchQuery}"</div>`
          : this.renderTree(tree, 0, q)
        }
      </div>
    `;
  }

  private filterContracts(q: string, source?: ContractInfo[]): ContractInfo[] {
    return (source ?? this.contracts).filter(c => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.functions.some(f => f.name.toLowerCase().includes(q))) return true;
      return false;
    });
  }

  private buildTree(contracts: ContractInfo[]): TreeFolder {
    const root: TreeFolder = { name: '', path: '', contracts: [], children: new Map() };
    for (const c of contracts) {
      const filePath = c.sourceFile || 'unknown';
      const parts = filePath.split('/').filter(Boolean);
      let node = root;
      let builtPath = '';
      for (const part of parts) {
        builtPath += '/' + part;
        if (!node.children.has(part)) {
          node.children.set(part, { name: part, path: builtPath, contracts: [], children: new Map() });
        }
        node = node.children.get(part)!;
      }
      node.contracts.push(c);
    }
    // Collapse single-child folders
    return this.collapseTree(root);
  }

  private collapseTree(folder: TreeFolder): TreeFolder {
    // First collapse children
    const newChildren = new Map<string, TreeFolder>();
    for (const [key, child] of folder.children) {
      newChildren.set(key, this.collapseTree(child));
    }
    folder.children = newChildren;

    // If a folder has exactly one child folder and no contracts, merge them
    if (folder.children.size === 1 && folder.contracts.length === 0 && folder.name !== '') {
      const [childKey, child] = [...folder.children.entries()][0];
      if (child.children.size > 0 || child.contracts.length > 0) {
        return {
          name: folder.name + '/' + child.name,
          path: child.path,
          contracts: child.contracts,
          children: child.children,
        };
      }
    }
    return folder;
  }

  private isFolderExpanded(path: string): boolean {
    if (this.searchQuery.trim()) return true;
    return this.expandedPaths.has(path);
  }

  private toggleFolder(path: string) {
    const next = new Set(this.expandedPaths);
    if (next.has(path)) next.delete(path); else next.add(path);
    this.expandedPaths = next;
  }

  private isContractExpanded(id: number): boolean {
    if (this.selectedContractId === id) return true;
    if (this.searchQuery.trim()) return true;
    return this.expandedContracts.has(id);
  }

  private toggleContract(id: number) {
    const next = new Set(this.expandedContracts);
    if (next.has(id)) next.delete(id); else next.add(id);
    this.expandedContracts = next;
  }

  private isSectionExpanded(key: string): boolean {
    return this.expandedSections.has(key);
  }

  private toggleSection(key: string) {
    const next = new Set(this.expandedSections);
    if (next.has(key)) next.delete(key); else next.add(key);
    this.expandedSections = next;
  }

  private renderTree(folder: TreeFolder, depth: number, q: string): unknown {
    const items: unknown[] = [];

    // Sort children folders
    const sortedFolders = [...folder.children.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [, child] of sortedFolders) {
      const expanded = this.isFolderExpanded(child.path);
      const totalContracts = this.countContracts(child);
      items.push(html`
        <div class="tree-row" @click=${() => this.toggleFolder(child.path)}>
          <span class="indent" style="width:${depth * 16}px"></span>
          <span class="chevron ${expanded ? 'open' : ''}">\u25B6</span>
          <span class="icon ${expanded ? 'icon-folder-open' : 'icon-folder'}">D</span>
          <span class="label folder-label">${child.name}</span>
          <span class="badge badge-kind">${totalContracts}</span>
        </div>
        ${expanded ? this.renderTree(child, depth + 1, q) : nothing}
      `);
    }

    // Sort contracts
    const sortedContracts = [...folder.contracts].sort((a, b) => a.name.localeCompare(b.name));
    for (const c of sortedContracts) {
      items.push(this.renderContractNode(c, depth, q));
    }

    return items;
  }

  private countContracts(folder: TreeFolder): number {
    let n = folder.contracts.length;
    for (const [, child] of folder.children) n += this.countContracts(child);
    return n;
  }

  private contractIcon(c: ContractInfo): { cls: string; icon: string } {
    if (c.kind === 'interface') return { cls: 'icon-interface', icon: 'I' };
    if (c.kind === 'library') return { cls: 'icon-library', icon: 'L' };
    if (c.isAbstract) return { cls: 'icon-abstract', icon: 'A' };
    return { cls: 'icon-contract', icon: 'C' };
  }

  private renderContractNode(c: ContractInfo, depth: number, q: string) {
    const selected = this.selectedContractId === c.id;
    const expanded = this.isContractExpanded(c.id);
    const hasChildren = c.functions.length > 0 || c.stateVars.length > 0 || c.events.length > 0;
    const { cls, icon } = this.contractIcon(c);
    const funcCount = c.functions.length;

    return html`
      <div
        class="tree-row ${selected ? 'selected' : ''}"
        @click=${() => { this.selectContract(c.id); this.toggleContract(c.id); }}
      >
        <span class="indent" style="width:${depth * 16}px"></span>
        <span class="chevron ${expanded ? 'open' : ''} ${!hasChildren ? 'hidden' : ''}">\u25B6</span>
        <span class="icon ${cls}">${icon}</span>
        <span class="label contract-label">${this.highlight(c.name, q)}</span>
        ${funcCount > 0 ? html`<span class="badge badge-kind">${funcCount}f</span>` : nothing}
      </div>
      ${expanded ? this.renderContractChildren(c, depth + 1, q) : nothing}
    `;
  }

  private renderContractChildren(c: ContractInfo, depth: number, q: string) {
    const items: unknown[] = [];

    // Functions directly (no sub-section header if it's the only thing)
    if (c.functions.length > 0) {
      for (const f of c.functions) {
        items.push(this.renderFunctionNode(f, depth, q));
      }
    }

    // State vars (collapsible section)
    if (c.stateVars.length > 0) {
      const secKey = `vars-${c.id}`;
      const secExpanded = this.isSectionExpanded(secKey);
      items.push(html`
        <div class="section-row" @click=${() => this.toggleSection(secKey)}>
          <span class="indent" style="width:${depth * 16}px"></span>
          <span class="chevron ${secExpanded ? 'open' : ''}" style="font-size:7px">\u25B6</span>
          <span class="section-label">State Variables</span>
          <span class="section-count">(${c.stateVars.length})</span>
        </div>
        ${secExpanded ? c.stateVars.map(v => html`
          <div class="tree-row">
            <span class="indent" style="width:${(depth + 1) * 16}px"></span>
            <span class="chevron hidden">\u25B6</span>
            <span class="icon icon-var">V</span>
            <span class="label var-label" title="${v.typeString} ${v.name}">${v.typeString} <b>${v.name}</b></span>
          </div>
        `) : nothing}
      `);
    }

    // Events (collapsible section)
    if (c.events.length > 0) {
      const secKey = `events-${c.id}`;
      const secExpanded = this.isSectionExpanded(secKey);
      items.push(html`
        <div class="section-row" @click=${() => this.toggleSection(secKey)}>
          <span class="indent" style="width:${depth * 16}px"></span>
          <span class="chevron ${secExpanded ? 'open' : ''}" style="font-size:7px">\u25B6</span>
          <span class="section-label">Events</span>
          <span class="section-count">(${c.events.length})</span>
        </div>
        ${secExpanded ? c.events.map(ev => html`
          <div class="tree-row">
            <span class="indent" style="width:${(depth + 1) * 16}px"></span>
            <span class="chevron hidden">\u25B6</span>
            <span class="icon icon-event">E</span>
            <span class="label var-label">${ev.name}</span>
          </div>
        `) : nothing}
      `);
    }

    return items;
  }

  private renderFunctionNode(f: { id: number; name: string; visibility: string; stateMutability: string; isConstructor: boolean; params: { name: string; typeString: string }[]; returnParams: { name: string; typeString: string }[] }, depth: number, q: string) {
    const selected = this.selectedFunctionId === f.id;
    const paramStr = f.params.map(p => p.typeString).join(', ');
    const mutBadge = f.isConstructor ? 'constructor'
      : f.stateMutability === 'view' ? 'view'
      : f.stateMutability === 'pure' ? 'pure'
      : f.stateMutability === 'payable' ? 'payable'
      : '';

    const risk = this.getRiskIndicator(f.id);

    return html`
      <div
        class="tree-row ${selected ? 'selected' : ''}"
        @click=${() => this.selectFunction(f.id)}
        title="${f.visibility} ${f.name}(${paramStr})"
      >
        <span class="indent" style="width:${depth * 16}px"></span>
        <span class="chevron hidden">\u25B6</span>
        <span class="vis-dot vis-${f.visibility.toLowerCase()}"></span>
        <span class="label func-label">${this.highlight(f.name || (f.isConstructor ? 'constructor' : ''), q)}</span>
        <span class="func-params">(${paramStr})</span>
        ${mutBadge ? html`<span class="badge badge-${mutBadge}">${mutBadge}</span>` : nothing}
        ${risk.pathCount > 0 ? html`
          <span class="path-count">${risk.pathCount}p</span>
        ` : nothing}
        ${risk.level === 'red' ? html`
          <span class="risk-dot risk-dot-red"></span>
        ` : risk.level === 'orange' ? html`
          <span class="risk-dot risk-dot-orange"></span>
        ` : nothing}
      </div>
    `;
  }

  private highlight(text: string, q: string) {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return html`${text.slice(0, idx)}<span class="hl">${text.slice(idx, idx + q.length)}</span>${text.slice(idx + q.length)}`;
  }

  /** Get risk indicator for a function: path count + worst arith check severity */
  private getRiskIndicator(funcId: number): { pathCount: number; level: 'red' | 'orange' | 'none' } {
    const RED_CHECKS = ['Overflow', 'Underflow', 'DivByZero'];
    const ORANGE_CHECKS = ['DowncastTruncation', 'DivisionTruncation', 'MulAfterDiv', 'RightShiftTruncation'];
    let pathCount = 0;
    let level: 'red' | 'orange' | 'none' = 'none';

    for (const analysis of this.analysisMap.values()) {
      const fa = analysis.functions.find(f => f.functionId === funcId);
      if (!fa) continue;
      pathCount = fa.feasiblePaths;
      for (const p of fa.paths) {
        if (!p.feasible || !p.arithChecks) continue;
        for (const ac of p.arithChecks) {
          if (RED_CHECKS.includes(ac.check)) {
            level = 'red';
          } else if (ORANGE_CHECKS.includes(ac.check) && level !== 'red') {
            level = 'orange';
          }
        }
      }
    }
    return { pathCount, level };
  }

  private selectContract(id: number) {
    this.dispatchEvent(new CustomEvent('select-contract', {
      detail: { id },
      bubbles: true, composed: true,
    }));
  }

  private selectFunction(id: number) {
    this.dispatchEvent(new CustomEvent('select-function', {
      detail: { id },
      bubbles: true, composed: true,
    }));
  }
}
