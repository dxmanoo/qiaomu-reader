function rectBetween([x1, y1], [x2, y2]) {
  return {
    left: Math.min(x1, x2),
    top: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function pdfRegionDrag(page, start, end, minimum = 10) {
  const local = ([x, y]) => [
    Math.max(0, Math.min(page.width, x - page.left)),
    Math.max(0, Math.min(page.height, y - page.top)),
  ];
  const rect = rectBetween(local(start), local(end));
  return rect.width > minimum && rect.height > minimum ? rect : null;
}

export function pdfRegionToBounds(viewport, rect, displayed) {
  const point = (x, y) => viewport.convertToPdfPoint(
    x * viewport.width / displayed.width,
    y * viewport.height / displayed.height,
  );
  const pdf = rectBetween(point(rect.left, rect.top), point(rect.left + rect.width, rect.top + rect.height));
  return [pdf.left, pdf.top, pdf.left + pdf.width, pdf.top + pdf.height];
}

export function pdfBoundsToRegion(viewport, [x1, y1, x2, y2], displayed = viewport) {
  const point = (x, y) => {
    const [vx, vy] = viewport.convertToViewportPoint(x, y);
    return [vx * displayed.width / viewport.width, vy * displayed.height / viewport.height];
  };
  return rectBetween(point(x1, y1), point(x2, y2));
}
