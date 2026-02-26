import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CFGData, InlinedCFGData, CFGBlock } from '../types';
import * as d3 from 'd3';
import ELK from 'elkjs/lib/elk.bundled.js';
import { setupSvgZoom, contractColor } from '../lib/graph';
import * as api from '../api';

type CfgMode = 'basic' | 'inlined';

@customElement('cfg-view')
export class CfgView extends LitElement {
  static styles = css`
    :host { display: flex; flex-direction: column; height: 100%; }

    .toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .toggle-btn {
      font-size: 11px; padding: 3px 10px; border-radius: 3px;
      border: 1px solid var(--border); background: none;
      color: var(--text-muted); cursor: pointer;
      font-family: var(--font-sans);
    }
    .toggle-btn:hover { background: var(--bg-hover); }
    .toggle-btn.active {
      background: rgba(122,162,247,0.15);
      color: var(--accent); border-color: var(--accent);
    }
    .loading {
      font-size: 11px; color: var(--text-muted);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

    svg { width: 100%; flex: 1; }
    .block rect {
      fill: var(--bg-secondary); stroke: var(--border); stroke-width: 1px; rx: 4;
    }
    .block-entry rect { stroke: var(--accent); stroke-width: 2px; }
    .block-exit rect { stroke: var(--green); stroke-width: 2px; }
    .block-revert rect { stroke: var(--red); stroke-width: 2px; }
    .block text { font-size: 11px; font-family: var(--font-mono); fill: var(--text-secondary); }
    .block-label { font-size: 10px; fill: var(--text-muted); }

    /* Risk borders on blocks */
    .block-risk-red rect { stroke-left: 3px solid #ff5555; }
    .block-risk-orange rect { stroke-left: 3px solid #ffb74d; }
    .block-risk-blue rect { stroke-left: 3px solid #7aa2f7; }

    /* Inlined callee group */
    .callee-group rect {
      fill: none; stroke-dasharray: 4,2; rx: 6;
    }
    .callee-label {
      font-size: 10px; font-weight: 600; fill: var(--text-secondary);
    }

    /* Edge styles */
    .edge-true { stroke: var(--green); }
    .edge-false { stroke: var(--red); }
    .edge-goto { stroke: var(--text-muted); }
    .edge-loopBack { stroke: var(--yellow); stroke-dasharray: 4,2; }
    .edge-loopBreak { stroke: var(--orange); }
    .edge-cross { stroke: var(--purple); stroke-dasharray: 6,3; }
    path { fill: none; stroke-width: 1.5px; }
    marker { fill: var(--text-muted); }

    .empty { color: var(--text-muted); padding: 40px; text-align: center; }
  `;

  @property({ type: Object }) data: CFGData | null = null;
  @property({ type: Number }) functionId: number | null = null;

  @state() private cfgMode: CfgMode = 'basic';
  @state() private inlinedData: InlinedCFGData | null = null;
  @state() private loadingInlined = false;

  updated(changed: Map<string, unknown>) {
    if (changed.has('data') || changed.has('cfgMode') || changed.has('inlinedData')) {
      if (this.cfgMode === 'inlined' && this.inlinedData) {
        this.renderInlinedCFG();
      } else if (this.data) {
        this.renderBasicCFG();
      }
    }
    if (changed.has('functionId')) {
      this.inlinedData = null;
      this.cfgMode = 'basic';
    }
  }

  render() {
    if (!this.data) {
      return html`<div class="empty">Select a function to view its CFG</div>`;
    }
    return html`
      <div class="toolbar">
        <button class="toggle-btn ${this.cfgMode === 'basic' ? 'active' : ''}"
          @click=${() => this.setCfgMode('basic')}>Basic CFG</button>
        <button class="toggle-btn ${this.cfgMode === 'inlined' ? 'active' : ''}"
          @click=${() => this.setCfgMode('inlined')}>Inlined CFG</button>
        ${this.loadingInlined ? html`<span class="loading">Loading inlined CFG...</span>` : ''}
      </div>
      <svg>
        <defs>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" />
          </marker>
          <marker id="arrowhead-cross" viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="var(--purple)" />
          </marker>
        </defs>
        <g class="graph-root"></g>
      </svg>
    `;
  }

  private async setCfgMode(mode: CfgMode) {
    this.cfgMode = mode;
    if (mode === 'inlined' && !this.inlinedData && this.functionId) {
      this.loadingInlined = true;
      try {
        this.inlinedData = await api.getInlinedCFG(this.functionId);
      } catch (err) {
        console.error('Failed to load inlined CFG:', err);
      } finally {
        this.loadingInlined = false;
      }
    }
  }

  // ─── Basic CFG (unchanged logic) ─────────────────────────────

  private async renderBasicCFG() {
    const data = this.data;
    if (!data) return;

    const elk = new ELK();
    const exitSet = new Set(data.exits);
    const revertSet = new Set(data.reverts);

    // Filter out orphan blocks (no incoming edges, not entry, no statements)
    const hasIncoming = new Set<number>();
    for (const edge of data.edges) hasIncoming.add(edge.to);
    const activeBlocks = data.blocks.filter(b =>
      b.id === data.entry || hasIncoming.has(b.id) || b.stmts.length > 0
    );
    const activeBlockIds = new Set(activeBlocks.map(b => b.id));

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '30',
        'elk.layered.spacing.nodeNodeBetweenLayers': '40',
      },
      children: activeBlocks.map(block => {
        const lines = this.blockLines(block);
        return {
          id: String(block.id),
          width: Math.max(200, lines.reduce((m, l) => Math.max(m, Math.min(l.length * 7, 600)), 0)),
          height: 24 + lines.length * 16,
          labels: [{ text: lines.join('\n') }],
        };
      }),
      edges: data.edges
        .filter(e => activeBlockIds.has(e.from) && activeBlockIds.has(e.to))
        .map((edge, i) => ({
          id: `e${i}`,
          sources: [String(edge.from)],
          targets: [String(edge.to)],
          labels: edge.label !== 'goto' ? [{ text: edge.label }] : [],
        })),
    };

    try {
      const layout = await elk.layout(graph);
      this.drawLayout(layout, data, exitSet, revertSet);
    } catch (err) {
      console.error('ELK layout failed:', err);
    }
  }

  private blockLines(block: CFGBlock): string[] {
    const lines = [`B${block.id}: ${block.terminatorType}`];
    for (const stmt of block.stmts) {
      lines.push(stmt.length > 80 ? stmt.substring(0, 77) + '...' : stmt);
    }
    if (block.terminatorType === 'branch' && block.terminator &&
        typeof block.terminator === 'object' && 'condition' in (block.terminator as any)) {
      const cond = (block.terminator as any).condition;
      if (cond) lines.push(`? ${cond}`);
    }
    return lines;
  }

  private drawLayout(layout: any, data: CFGData, exitSet: Set<number>, revertSet: Set<number>) {
    const svgEl = this.shadowRoot?.querySelector('svg');
    if (!svgEl) return;

    const root = d3.select(svgEl).select<SVGGElement>('g.graph-root');
    root.selectAll('*').remove();

    for (const child of layout.children || []) {
      const blockId = parseInt(child.id);
      let cls = 'block';
      if (blockId === data.entry) cls += ' block-entry';
      if (exitSet.has(blockId)) cls += ' block-exit';
      if (revertSet.has(blockId)) cls += ' block-revert';

      const g = root.append('g').attr('class', cls)
        .attr('transform', `translate(${child.x},${child.y})`);
      g.append('rect').attr('width', child.width).attr('height', child.height);

      const label = child.labels?.[0]?.text || `B${blockId}`;
      label.split('\n').forEach((line: string, i: number) => {
        g.append('text').attr('x', 8).attr('y', 16 + i * 16).text(line);
      });
    }

    this.drawEdges(root, layout.edges || [], 'arrowhead');
    setupSvgZoom(svgEl);
  }

  // ─── Inlined CFG ─────────────────────────────────────────────

  private async renderInlinedCFG() {
    const inlined = this.inlinedData;
    if (!inlined) return;

    const elk = new ELK();
    const rootFn = inlined.rootFunction;
    const exitSet = new Set(rootFn.exits);
    const revertSet = new Set(rootFn.reverts);

    // Build ELK graph with all blocks (root + callees)
    const children: any[] = [];
    const edges: any[] = [];
    let edgeIdx = 0;

    // Root function blocks
    for (const block of rootFn.blocks) {
      const lines = this.blockLines(block);
      children.push({
        id: `root_${block.id}`,
        width: Math.max(200, lines.reduce((m, l) => Math.max(m, Math.min(l.length * 7, 600)), 0)),
        height: 24 + lines.length * 16,
        labels: [{ text: lines.join('\n') }],
        _isRoot: true,
        _blockId: block.id,
      });
    }
    for (const edge of rootFn.edges) {
      edges.push({
        id: `e${edgeIdx++}`,
        sources: [`root_${edge.from}`],
        targets: [`root_${edge.to}`],
        labels: edge.label !== 'goto' ? [{ text: edge.label }] : [],
      });
    }

    // Inlined callee blocks
    const calleeColors = new Map<number, string>();
    for (const callee of inlined.inlinedCallees) {
      const color = contractColor(callee.callee.functionName);
      calleeColors.set(callee.callee.functionId, color);

      for (const block of callee.callee.blocks) {
        const lines = this.blockLines(block);
        children.push({
          id: `c${callee.callee.functionId}_${block.id}`,
          width: Math.max(200, lines.reduce((m, l) => Math.max(m, Math.min(l.length * 7, 600)), 0)),
          height: 24 + lines.length * 16,
          labels: [{ text: `\u2190 ${callee.callee.functionName}\n${lines.join('\n')}` }],
          _calleeId: callee.callee.functionId,
          _calleeName: callee.callee.functionName,
          _blockId: block.id,
        });
      }
      for (const edge of callee.callee.edges) {
        edges.push({
          id: `e${edgeIdx++}`,
          sources: [`c${callee.callee.functionId}_${edge.from}`],
          targets: [`c${callee.callee.functionId}_${edge.to}`],
          labels: edge.label !== 'goto' ? [{ text: edge.label }] : [],
        });
      }
    }

    // Cross edges — translate backend IDs (root:B0, callee_123:B0) to ELK IDs (root_0, c123_0)
    const translateCrossId = (id: string): string => {
      // "root:B0" → "root_0", "callee_63376:B0" → "c63376_0"
      const m = id.match(/^root:B(\d+)$/);
      if (m) return `root_${m[1]}`;
      const mc = id.match(/^callee_(\d+):B(\d+)$/);
      if (mc) return `c${mc[1]}_${mc[2]}`;
      return id;
    };
    for (const ce of inlined.crossEdges) {
      const from = translateCrossId(ce.from);
      const to = translateCrossId(ce.to);
      // Only add if both endpoints exist
      const nodeIds = new Set(children.map(c => c.id));
      if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
      edges.push({
        id: `e${edgeIdx++}`,
        sources: [from],
        targets: [to],
        labels: ce.label ? [{ text: ce.label }] : [],
        _isCross: true,
      });
    }

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '35',
        'elk.layered.spacing.nodeNodeBetweenLayers': '45',
      },
      children,
      edges,
    };

    try {
      const layout = await elk.layout(graph);
      this.drawInlinedLayout(layout, rootFn, exitSet, revertSet, calleeColors);
    } catch (err) {
      console.error('ELK inlined layout failed:', err);
    }
  }

  private drawInlinedLayout(layout: any, rootFn: CFGData, exitSet: Set<number>, revertSet: Set<number>, calleeColors: Map<number, string>) {
    const svgEl = this.shadowRoot?.querySelector('svg');
    if (!svgEl) return;

    const root = d3.select(svgEl).select<SVGGElement>('g.graph-root');
    root.selectAll('*').remove();

    // Group callee blocks by calleeId for bounding boxes
    const calleeNodes = new Map<number, { x: number; y: number; w: number; h: number; name: string }[]>();

    for (const child of layout.children || []) {
      const calleeId = child._calleeId;
      const blockId = child._blockId;
      const isRoot = child._isRoot;

      // Determine block styling
      let cls = 'block';
      if (isRoot) {
        if (blockId === rootFn.entry) cls += ' block-entry';
        if (exitSet.has(blockId)) cls += ' block-exit';
        if (revertSet.has(blockId)) cls += ' block-revert';
      }

      const g = root.append('g').attr('class', cls)
        .attr('transform', `translate(${child.x},${child.y})`);

      // Callee blocks get distinct background
      if (calleeId != null) {
        const color = calleeColors.get(calleeId) ?? 'var(--text-muted)';
        g.append('rect')
          .attr('width', child.width)
          .attr('height', child.height)
          .attr('fill', `${color}10`)
          .attr('stroke', color)
          .attr('stroke-width', 1.5);

        // Track for group bounding box
        const arr = calleeNodes.get(calleeId) ?? [];
        arr.push({ x: child.x, y: child.y, w: child.width, h: child.height, name: child._calleeName });
        calleeNodes.set(calleeId, arr);
      } else {
        g.append('rect').attr('width', child.width).attr('height', child.height);
      }

      const label = child.labels?.[0]?.text || `B${blockId}`;
      label.split('\n').forEach((line: string, i: number) => {
        g.append('text').attr('x', 8).attr('y', 16 + i * 16).text(line);
      });
    }

    // Draw callee group bounding boxes
    for (const [calleeId, nodes] of calleeNodes) {
      if (nodes.length === 0) continue;
      const minX = Math.min(...nodes.map(n => n.x)) - 10;
      const minY = Math.min(...nodes.map(n => n.y)) - 20;
      const maxX = Math.max(...nodes.map(n => n.x + n.w)) + 10;
      const maxY = Math.max(...nodes.map(n => n.y + n.h)) + 10;
      const color = calleeColors.get(calleeId) ?? 'var(--text-muted)';

      const groupG = root.insert('g', ':first-child').attr('class', 'callee-group');
      groupG.append('rect')
        .attr('x', minX).attr('y', minY)
        .attr('width', maxX - minX).attr('height', maxY - minY)
        .attr('stroke', color).attr('opacity', 0.4);
      groupG.append('text')
        .attr('class', 'callee-label')
        .attr('x', minX + 4).attr('y', minY + 12)
        .attr('fill', color)
        .text(`\u2190 ${nodes[0].name}()`);
    }

    // Draw edges
    for (const edge of layout.edges || []) {
      const isCross = edge._isCross;
      const sections = edge.sections || [];
      for (const section of sections) {
        const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
        const label = edge.labels?.[0]?.text || 'goto';
        const line = d3.line<{x: number; y: number}>()
          .x(d => d.x).y(d => d.y)
          .curve(d3.curveBasis);

        root.append('path')
          .attr('d', line(points))
          .attr('class', isCross ? 'edge-cross' : `edge-${label}`)
          .attr('marker-end', isCross ? 'url(#arrowhead-cross)' : 'url(#arrowhead)');
      }
    }

    setupSvgZoom(svgEl);
  }

  private drawEdges(root: d3.Selection<SVGGElement, unknown, null, undefined>, edges: any[], markerUrl: string) {
    for (const edge of edges) {
      const sections = edge.sections || [];
      for (const section of sections) {
        const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint];
        const label = edge.labels?.[0]?.text || 'goto';
        const line = d3.line<{x: number; y: number}>()
          .x(d => d.x).y(d => d.y)
          .curve(d3.curveBasis);

        root.append('path')
          .attr('d', line(points))
          .attr('class', `edge-${label}`)
          .attr('marker-end', `url(#${markerUrl})`);
      }
    }
  }
}
