import assert from "node:assert/strict";
import test from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { pdfRegionDrag, pdfRegionToBounds, pdfBoundsToRegion, pdfRegionRaster, savePdfRegion, insertPdfRegion, isPdfRegionShortcut, pdfRegionResize, replacePdfRegionGeometry } from "../src/pdf-region.js";
import { footnotePdfBytes } from "./fixtures/pdf-footnotes.mjs";
import { pdfRegionNoteRow, replaceManagedReadingHighlights } from "../src/reading-note.js";

test("PDF regions clamp to the starting page in either drag direction", () => {
  const page = { left: 10, top: 30, width: 100, height: 200 };
  const expected = { left: 0, top: 0, width: 100, height: 200 };
  assert.deepEqual(pdfRegionDrag(page, [10, 30], [200, 300]), expected);
  assert.deepEqual(pdfRegionDrag(page, [110, 230], [-4, -6]), expected);
  assert.equal(pdfRegionDrag(page, [12, 32], [22, 90]), null);
});

test("PDF bounds round-trip across zoom and page rotation", async (t) => {
  const task = getDocument({ data: footnotePdfBytes() });
  t.after(() => task.destroy());
  const page = await (await task.promise).getPage(1);
  for (const rotation of [0, 90, 180, 270]) {
    const original = page.getViewport({ scale: 1, rotation });
    const zoomed = page.getViewport({ scale: 3, rotation });
    const region = { left: 20, top: 30, width: 80, height: 90 };
    const bounds = pdfRegionToBounds(original, region, original);
    assert.deepEqual(pdfBoundsToRegion(zoomed, bounds, zoomed), { left: 60, top: 90, width: 240, height: 270 });
    const differentlySized = { width: original.width / 2, height: original.height / 2 };
    assert.deepEqual(pdfBoundsToRegion(original, bounds, differentlySized), { left: 10, top: 15, width: 40, height: 45 });
  }
});

test("PDF region raster crops a rotated page at the source and caps its longest edge", async (t) => {
  const task = getDocument({ data: footnotePdfBytes() });
  t.after(() => task.destroy());
  const page = await (await task.promise).getPage(1);
  const unit = page.getViewport({ scale: 1, rotation: 90 });
  const rect = { left: 28, top: 52, width: 600, height: 400 };
  const bounds = pdfRegionToBounds(unit, rect, unit);
  const crop = pdfRegionRaster(page, bounds, 90, 1000);
  assert.equal(crop.width, 1000);
  assert.equal(crop.height, 667);
  assert.ok(Math.abs(crop.transform[4] + 28 * crop.viewport.scale) < 1e-9);
  assert.ok(Math.abs(crop.transform[5] + 52 * crop.viewport.scale) < 1e-9);
});

test("retrying a region save reuses the PNG and the annotation ID", async () => {
  const created = new Set();
  const vault = {
    adapter: { exists: async path => created.has(path) },
    createFolder: async path => { created.add(path); },
    createBinary: async path => { created.add(path); },
  };
  const record = { id: "test-region", color: "yellow", imagePath: "Qiaomu PDF Annotations/test-region.png" };
  const rows = [];
  let captures = 0;
  const capture = async () => { captures++; return new ArrayBuffer(0); };
  await assert.rejects(savePdfRegion(vault, record, capture, () => { throw new Error("store unavailable"); }));
  const persist = async row => { insertPdfRegion(rows, row); return true; };
  assert.equal(await savePdfRegion(vault, record, capture, persist), true);
  assert.equal(await savePdfRegion(vault, record, capture, persist), true);
  assert.deepEqual(rows, [record]);
  assert.equal(captures, 1);
});

test("a region embeds its image without quote text and leaves manual note sections intact", () => {
  const image = "![[Qiaomu PDF Annotations/region.png]]";
  const row = pdfRegionNoteRow(image, "Page 2", "[Return to source](obsidian://qiaomu-reader?page=2)", "\n\n**Comment:** Diagram");
  const original = "# Reading\n\n## Quotes\n\nOld snippet\n\n## My excerpts\n\n> Manual excerpt\n\n## Notes\n\nHandwritten notes\n";
  const withRegion = replaceManagedReadingHighlights(original, "## Quotes\n\n" + row, "Legacy excerpts");
  assert.match(withRegion, /!\[\[Qiaomu PDF Annotations\/region.png\]\]/);
  assert.match(withRegion, /Page 2 · \[Return to source\]/);
  assert.match(withRegion, /\*\*Comment:\*\* Diagram/);
  const removed = replaceManagedReadingHighlights(withRegion, "", "Legacy excerpts");
  assert.equal(removed, "# Reading\n\n## My excerpts\n\n> Manual excerpt\n\n## Notes\n\nHandwritten notes\n");
});

test("desktop region shortcut matches the platform and leaves other modifiers available", () => {
  const event = { button: 0, pointerType: "mouse", metaKey: true, shiftKey: false, ctrlKey: false, altKey: false };
  assert.equal(isPdfRegionShortcut(event, true), true);
  assert.equal(isPdfRegionShortcut(event, false), false);
  assert.equal(isPdfRegionShortcut({ ...event, metaKey: false, shiftKey: true }, false), true);
  assert.equal(isPdfRegionShortcut({ ...event, pointerType: "touch" }, true), false);
  assert.equal(isPdfRegionShortcut({ ...event, button: 1 }, true), false);
  assert.equal(isPdfRegionShortcut({ ...event, altKey: true }, true), false);
});

test("resizing one edge clamps to the page and keeps the opposite edge fixed", () => {
  const page = { width: 100, height: 80 };
  const rect = { left: 20, top: 15, width: 50, height: 40 };
  assert.deepEqual(pdfRegionResize(page, rect, "left", [-50, 42]), { ...rect, left: 0, width: 70 });
  assert.deepEqual(pdfRegionResize(page, rect, "right", [80, -42]), { ...rect, width: 80 });
  assert.deepEqual(pdfRegionResize(page, rect, "top", [30, 70]), { ...rect, top: 45, height: 10 });
  assert.deepEqual(pdfRegionResize(page, rect, "bottom", [30, -80]), { ...rect, height: 10 });
  assert.deepEqual(pdfRegionResize(page, rect, "bottom", [30, 0]), rect);
});

test("replacing region geometry keeps its identity and newer metadata and is safe to retry", () => {
  const original = { id: "area-1", page: 2, kind: "pdf-region", imagePath: "old.png", color: "yellow", bounds: [1, 2, 3, 4] };
  const replacement = { ...original, imagePath: "new.png", bounds: [0, 2, 3, 4] };
  const rows = [{ ...original, comment: "newer comment", color: "green" }];
  replacePdfRegionGeometry(rows, original, replacement);
  replacePdfRegionGeometry(rows, original, replacement);
  assert.deepEqual(rows, [{ ...replacement, comment: "newer comment", color: "green" }]);
  assert.throws(() => replacePdfRegionGeometry(rows, original, { ...replacement, imagePath: "conflict.png" }));
  assert.throws(() => replacePdfRegionGeometry([], original, replacement));
});
