import assert from "node:assert/strict";
import test from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { pdfRegionDrag, pdfRegionToBounds, pdfBoundsToRegion } from "../src/pdf-region.js";
import { footnotePdfBytes } from "./fixtures/pdf-footnotes.mjs";

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
