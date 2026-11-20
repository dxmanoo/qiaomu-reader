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

export function isPdfRegionShortcut(event, mac) {
  return event.button <= 0 && event.pointerType !== "touch" && !event.altKey && !event.ctrlKey
    && (mac ? event.metaKey && !event.shiftKey : event.shiftKey && !event.metaKey);
}

export function pdfRegionResize(page, region, edge, [dx, dy]) {
  const horizontal = edge === "left" || edge === "right";
  const origin = horizontal ? "left" : "top";
  const size = horizontal ? "width" : "height";
  const start = region[origin], length = region[size], end = start + length;
  const minimum = Math.min(10, length);
  const delta = horizontal ? dx : dy;
  if (edge === origin) {
    const next = Math.min(end - minimum, Math.max(0, start + delta));
    return next === start ? region : { ...region, [origin]: next, [size]: end - next };
  }
  const next = Math.max(start + minimum, Math.min(page[size], end + delta));
  return next === end ? region : { ...region, [size]: next - start };
}

export function pdfRegionMove(page, region, [dx, dy]) {
  const left = Math.max(0, Math.min(region.left + dx, page.width - region.width));
  const top = Math.max(0, Math.min(region.top + dy, page.height - region.height));
  return left === region.left && top === region.top ? region : { ...region, left, top };
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

export const PDF_REGION_FOLDER = "ObsReader PDF Annotations";

export function pdfRegionSnapshot(sourcePath, record, rotation) {
  return {
    annotationId: record.id, sourcePath, page: record.page,
    bounds: [...record.bounds], rotation, capturedAt: new Date().toISOString(),
  };
}

export function embedPdfRegionSnapshot(png, snapshot) {
  const image = ArrayBuffer.isView(png)
    ? new Uint8Array(png.buffer, png.byteOffset, png.byteLength)
    : new Uint8Array(png);
  // Insert international text following the fixed-length IHDR chunk.
  const offset = 33;
  const text = new TextEncoder().encode("ObsReader\0\0\0\0\0" + JSON.stringify(snapshot));
  const chunk = new Uint8Array(text.length + 12);
  const header = new DataView(chunk.buffer);
  header.setUint32(0, text.length);
  chunk.set([105, 84, 88, 116], 4); // iTXt
  chunk.set(text, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  header.setUint32(chunk.length - 4, crc ^ 0xffffffff);
  const result = new Uint8Array(image.length + chunk.length);
  result.set(image.subarray(0, offset));
  result.set(chunk, offset);
  result.set(image.subarray(offset), offset + chunk.length);
  return result.buffer;
}

export function isPdfRegion(record) {
  return record?.kind === "pdf-region";
}

export function pdfRegionRaster(page, bounds, rotation, limit = 2048) {
  const unit = page.getViewport({ scale: 1, rotation });
  const rect = pdfBoundsToRegion(unit, bounds);
  const longest = Math.max(rect.width, rect.height);
  if (!(longest > 0)) throw new Error("Invalid PDF region");
  const scale = Math.min(3, limit / longest);
  return {
    viewport: page.getViewport({ scale, rotation }),
    width: Math.min(limit, Math.max(1, Math.ceil(rect.width * scale))),
    height: Math.min(limit, Math.max(1, Math.ceil(rect.height * scale))),
    transform: [1, 0, 0, 1, -rect.left * scale, -rect.top * scale],
  };
}

export async function savePdfRegion(vault, record, capture, persist) {
  if (!await vault.adapter.exists(record.imagePath)) {
    await writePdfRegionImage(vault, record.imagePath, await capture());
  }
  return persist(record);
}

export async function writePdfRegionImage(vault, path, image) {
  const file = vault.getFileByPath(path);
  if (file) return vault.modifyBinary(file, image);
  const folder = path.slice(0, path.lastIndexOf("/"));
  if (!await vault.adapter.exists(folder)) {
    try { await vault.createFolder(folder); }
    catch (error) { if (!await vault.adapter.exists(folder)) throw error; }
  }
  return vault.createBinary(path, image);
}

export function insertPdfRegion(rows, record) {
  const index = rows.findIndex(row => row.id === record.id);
  if (index < 0) rows.push(record);
  else rows[index] = { ...rows[index], color: record.color };
}

export function replacePdfRegionGeometry(rows, original, bounds) {
  const index = rows.findIndex((row) => row.id === original.id && isPdfRegion(row));
  const current = rows[index];
  if (!current || current.imagePath !== original.imagePath) throw new Error("PDF region changed");
  rows[index] = { ...current, bounds };
}
