# OpenAPI test generator

Paste an OpenAPI 3.x / Swagger 2.0 contract and get test cases as JSON or a Postman collection.
No build step: open `index.html` in a browser.

## Layout

| File | Responsibility |
| --- | --- |
| `index.html` | Markup and script load order |
| `css/styles.css` | All styling |
| `js/state.js` | Shared state (`spec`, `RESULT`, `currentTab`) and tiny helpers (`$`, `clone`, `esc`, `strVal`) |
| `js/refs.js` | `$ref` resolution, `allOf` merging, schema type helpers |
| `js/sampling.js` | Valid sample values from a schema |
| `js/mutations.js` | Invalid and boundary values, request-body field walker |
| `js/response-schema.js` | Response schema to Postman-safe JSON schema |
| `js/auth.js` | Security schemes, auth JSON, Postman variable names (`varName`, `pv`) |
| `js/spec-parser.js` | `parseSpec` (JSON/YAML) and `baseUrl` |
| `js/endpoints.js` | Endpoint picker (which operations get tests) |
| `js/generator.js` | `generate()`: operations to test cases |
| `js/postman.js` | `toPostman()` and `pmItem()`: Postman collection v2.1 |
| `js/ui.js` | Rendering, output tabs, copy and download |
| `js/sample-contract.js` | Sample contract for the demo button |
| `js/main.js` | Event wiring |

## Conventions

- Scripts are classic (non-module) files that share one global scope, so the page still works from `file://`.
  Load order matters only for top-level code: `state.js` first, `main.js` last. Keep it in `index.html`.
- Functions are only called at runtime, so files can call each other regardless of order.
- New feature = new file in `js/` plus a `<script>` tag before `main.js`; wire its events in `main.js`.
