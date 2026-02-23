# Flatten Runtime Note

The Flatten toggle depends on `AnalyzeSheetMetal` existing in `occt-import-js.wasm`.

To enable Flatten, replace these runtime files with artifacts that export `AnalyzeSheetMetal`:

- `apps/web/public/occ/occt-import-js.js`
- `apps/web/public/occ/occt-import-js.wasm`

After replacing the files, reload the app and confirm the worker console shows:

`[OCCT] AnalyzeSheetMetal: function`
