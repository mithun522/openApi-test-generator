# OpenAPI test generator

Paste an OpenAPI 3.x / Swagger 2.0 contract and get test cases as JSON or a Postman collection, or add the contracts of a whole system and get its documentation.
React + TypeScript, built with Vite. Everything runs in the browser; contracts are never uploaded anywhere.

## Development

```sh
npm install
npm run dev        # local dev server: / is the test-case page, /docs.html the documentation page
npm test           # Vitest: core logic, docs pipeline, Mermaid validity, UI smoke tests
npm run typecheck
npm run build      # type-check, then build the static site into dist/
```

Pushing to `main` runs `.github/workflows/deploy.yml`, which tests, builds and deploys `dist/` to GitHub Pages.
In the repository settings, set **Pages → Source** to **GitHub Actions**.

## Layout

| Path | Responsibility |
| --- | --- |
| `src/core/` | Test-case generation. Pure functions with no DOM access; every function takes the contract (`Spec`) explicitly. |
| `src/core/refs.ts` | `Spec`: `$ref` resolution and `allOf` merging; schema type helpers |
| `src/core/sampling.ts` | Valid sample values from a schema |
| `src/core/mutations.ts` | Invalid and boundary values, request-body field walker |
| `src/core/response-schema.ts` | Response schema to Postman-safe JSON schema |
| `src/core/auth.ts` | Security schemes, auth JSON, Postman variable names |
| `src/core/spec-parser.ts` | `parseSpec` / `parseSpecs` (JSON/YAML, several documents) and `baseUrl` |
| `src/core/endpoints.ts` | Operation list for the endpoint picker |
| `src/core/generator.ts` | `generate()`: operations to test cases |
| `src/core/postman.ts` | `toPostman()` (collection v2.1) and `exportCases()` |
| `src/docs/` | System documentation: `model.ts` (service model, consistency checks), `links.ts` (declared and suggested links), `flows.ts` (sequence diagrams, summary), `markdown.ts` (the document), `system.ts` (the pipeline) |
| `index.html`, `docs.html` | The two pages: Contract to test cases, and Contracts to system documentation |
| `src/pages/` | Page entry points (`tests.tsx`, `docs.tsx`) and the page components |
| `src/components/Shell.tsx` | Shared chrome: top bar, navigation drawer, bottom nav linking the two pages, toasts |
| `src/components/tests/` | Test-case page UI |
| `src/components/docs/` | Documentation page UI; `DocView` renders the Markdown and loads Mermaid on demand |
| `src/__fixtures__/` | Golden outputs from the original JavaScript version; the tests require the port to match them exactly |

## Conventions

- Keep `src/core` and `src/docs` free of React and DOM code so they stay testable in Node.
- Contract text is untrusted: `docs/markdown.ts` escapes it before it reaches the rendered HTML, and Mermaid runs with `securityLevel: "strict"`.
- A behaviour change to generation or docs output is a deliberate change to the golden fixtures; regenerate them in the same commit.

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
