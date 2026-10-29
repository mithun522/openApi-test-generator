import { useState } from "react";
import { DocsMode } from "./components/docs/DocsMode";
import { TestsMode } from "./components/tests/TestsMode";

type Mode = "tests" | "docs";

const INTRO: Record<Mode, { title: string; text: string }> = {
  tests: {
    title: "Contract to test cases",
    text: "Paste an OpenAPI 3.x or Swagger 2.0 contract (JSON or YAML). You get every positive, validation, boundary and auth test case the contract implies, as plain JSON or a Postman collection with test scripts ready to run.",
  },
  docs: {
    title: "Contracts to system documentation",
    text: "Add the OpenAPI contracts of every service in your system. You get one document with a system map, flows, every endpoint and data model, and consistency checks, as Markdown with Mermaid diagrams for Confluence or Git.",
  },
};

export function App() {
  const [mode, setMode] = useState<Mode>("tests");
  return (
    <>
      <header>
        <nav className="modes" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === "tests"} onClick={() => setMode("tests")}>Test cases</button>
          <button role="tab" aria-selected={mode === "docs"} onClick={() => setMode("docs")}>System documentation</button>
        </nav>
        <h1>{INTRO[mode].title}</h1>
        <p>{INTRO[mode].text}</p>
      </header>
      {/* both modes stay mounted so switching keeps each one's work */}
      <TestsMode hidden={mode !== "tests"} />
      <DocsMode hidden={mode !== "docs"} />
    </>
  );
}
