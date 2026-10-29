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
| `js/docs-model.js` | Docs mode: contract to service model (`serviceModel`, `withSpec`), consistency checks |
| `js/docs-links.js` | Docs mode: declared and inferred links between services (`findLinks`) |
| `js/docs-flows.js` | Docs mode: sequence-diagram flows and the system summary |
| `js/docs-markdown.js` | Docs mode: the Markdown + Mermaid document (`toMarkdown`) |
| `js/docs-ui.js` | Docs mode: contract list, link review, rendering, copy and download |
| `js/sample-system.js` | Sample 4-service system for the docs demo button |
| `js/main.js` | Event wiring |

## Conventions

- Scripts are classic (non-module) files that share one global scope, so the page still works from `file://`.
  Load order matters only for top-level code: `state.js` first, `main.js` last. Keep it in `index.html`.
- Functions are only called at runtime, so files can call each other regardless of order.
- New feature = new file in `js/` plus a `<script>` tag before `main.js`; wire its events in `main.js`.

## System documentation mode

Switch to **System documentation** and add the contracts of every service (paste several at once separated by `---`, or upload multiple files). You get one Markdown document with Mermaid diagrams: overview, system map, a plain-English summary, flows, every endpoint, data models and consistency checks. View it in the app, copy it, or download the `.md` for Confluence (with a Mermaid macro) or Git. Everything runs in the browser; contracts are never uploaded anywhere.

A contract says what a service offers, not what it calls. Links between services therefore come from two places:

- **Declared** (certain): extensions in the contracts.
- **Suggested** (guesses): a field like `customerId` in one service where another service owns `/customers/{id}`, or the same model name in two contracts. Review them under *Suggested links* and untick the wrong ones.

```yaml
x-service-name: Order Service        # optional: name other contracts use to refer to this service
x-subscribes: [payment.refunded]     # events this service consumes (root or operation level)
paths:
  /orders:
    post:
      x-calls:                       # services this operation calls
        - Payment Service POST /payments
        - service: Customer Service
          operation: GET /customers/{customerId}
          description: checks the customer exists
      x-publishes: [order.created]   # events this operation emits
```

`x-calls` can also sit at the root of a contract when the call isn't tied to one operation. A service named in `x-calls` whose contract isn't loaded appears as a dashed "not loaded" box.
