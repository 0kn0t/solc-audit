import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CallGraphData } from '../types';
import * as d3 from 'd3';
import { graphlib, render as dagreRender } from 'dagre-d3-es';
import { contractColor, setupSvgZoom } from '../lib/graph';

@customElement('call-graph-view')
export class CallGraphView extends LitElement {
  static styles = css`
    :host { display: block; height: 100%; }
    svg { width: 100%; height: 100%; }
    .node rect {
      rx: 4; ry: 4;
      stroke-width: 1.5px;
    }
    .node text { font-size: 12px; font-family: var(--font-sans); }
    .edgePath path { stroke: var(--text-muted); stroke-width: 1.5px; fill: none; }
    .edgePath marker { fill: var(--text-muted); }
    .recursive rect { stroke: var(--red) !important; stroke-width: 2.5px !important; }
    .empty { color: var(--text-muted); padding: 40px; text-align: center; }
  `;

  @property({ type: Object }) data: CallGraphData | null = null;

  updated(changed: Map<string, unknown>) {
    if (changed.has('data') && this.data) {
      this.renderGraph();
    }
  }

  render() {
    if (!this.data || !this.data.nodes.length) {
      return html`<div class="empty">No call graph data</div>`;
    }
    return html`<svg><g class="graph-root"></g></svg>`;
  }

  private renderGraph() {
    const data = this.data;
    if (!data) return;

    const g = new graphlib.Graph().setGraph({
      rankdir: 'TB',
      nodesep: 30,
      ranksep: 50,
      marginx: 20,
      marginy: 20,
    }).setDefaultEdgeLabel(() => ({}));

    const recursiveSet = new Set(data.recursiveFunctions);

    for (const node of data.nodes) {
      const label = node.contractName ? `${node.contractName}.${node.name}` : node.name;
      const color = contractColor(node.contractName);
      g.setNode(String(node.id), {
        label,
        style: `fill: ${color}20; stroke: ${color}`,
        labelStyle: `fill: ${color}`,
        class: recursiveSet.has(node.id) ? 'recursive' : '',
        rx: 4, ry: 4,
        paddingLeft: 8, paddingRight: 8,
        paddingTop: 4, paddingBottom: 4,
      });
    }

    const nodeIdSet = new Set(data.nodes.map(n => n.id));
    for (const edge of data.edges) {
      // Skip edges with null/undefined endpoints or targeting nodes not in the graph
      if (edge.from == null || edge.to == null) continue;
      if (!nodeIdSet.has(edge.from) || !nodeIdSet.has(edge.to)) continue;
      g.setEdge(String(edge.from), String(edge.to), {
        style: edge.isExternal ? 'stroke: var(--orange); stroke-dasharray: 5,5' : '',
        arrowheadStyle: edge.isExternal ? 'fill: var(--orange)' : '',
      });
    }

    const svgEl = this.shadowRoot?.querySelector('svg');
    if (!svgEl) return;

    const inner = d3.select(svgEl).select<SVGGElement>('g.graph-root');
    inner.selectAll('*').remove();

    const renderer = dagreRender();
    renderer(inner, g);

    setupSvgZoom(svgEl);
  }
}
