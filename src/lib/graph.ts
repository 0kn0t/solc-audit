/// Shared D3/dagre/ELK graph utilities.

import * as d3 from 'd3';

export function setupSvgZoom(svg: SVGSVGElement): void {
  const svgSel = d3.select(svg);
  const g = svgSel.select<SVGGElement>('g.graph-root');

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform.toString());
    });

  svgSel.call(zoom);

  // Fit to view on initial render
  requestAnimationFrame(() => {
    const bbox = g.node()?.getBBox();
    if (!bbox) return;
    const { width, height } = svg.getBoundingClientRect();
    const scale = Math.min(
      (width - 40) / (bbox.width || 1),
      (height - 40) / (bbox.height || 1),
      1.5
    );
    const tx = (width - bbox.width * scale) / 2 - bbox.x * scale;
    const ty = (height - bbox.height * scale) / 2 - bbox.y * scale;
    svgSel.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  });
}

export function contractColor(name: string | null): string {
  if (!name) return 'var(--text-muted)';
  const colors = ['#7aa2f7', '#9ece6a', '#bb9af7', '#7dcfff', '#e0af68', '#73daca', '#ff9e64', '#f7768e'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}
