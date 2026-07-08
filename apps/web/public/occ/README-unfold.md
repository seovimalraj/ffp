# Flatten Runtime Note

The active Flatten runtime depends on `AnalyzeSheetMetal` existing in:

- `apps/web/public/occ/occt-import-js.v2.js`
- `apps/web/public/occ/occt-import-js.v2.wasm`

Legacy paths are retained temporarily for one-release compatibility:

- `apps/web/public/occ/occt-import-js.js`
- `apps/web/public/occ/occt-import-js.wasm`

After updating runtime artifacts, reload the app and confirm the worker console shows:

`[OCCT] AnalyzeSheetMetal: function`
