import assert from "node:assert/strict";
import test from "node:test";
import { resolveLayerIcon, LAYER_ICON_PRESETS } from "./layer-icons.ts";

test("presets include crate and keycard", () => {
  const keys = LAYER_ICON_PRESETS.map((p) => p.key);
  assert.ok(keys.includes("crate"));
  assert.ok(keys.includes("keycard"));
});

test("http URL resolves as url", () => {
  const r = resolveLayerIcon("https://example.com/a.png");
  assert.equal(r.kind, "url");
  assert.equal(r.value, "https://example.com/a.png");
});

test("preset key resolves as preset", () => {
  const r = resolveLayerIcon("crate");
  assert.equal(r.kind, "preset");
  assert.equal(r.value, "crate");
});

test("empty falls back", () => {
  const r = resolveLayerIcon("", "key");
  assert.equal(r.kind, "preset");
  assert.equal(r.value, "key");
});
