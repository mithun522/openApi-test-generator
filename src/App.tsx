import { useCallback, useState } from "react";
import { DocsMode } from "./components/docs/DocsMode";
import { BottomNav, Drawer, TopBar, type ApiInfo, type Mode } from "./components/Shell";
import { TestsMode } from "./components/tests/TestsMode";
import { Toast } from "./components/ui";

export function App() {
  const [mode, setMode] = useState<Mode>("tests");
  const [drawer, setDrawer] = useState(false);
  const [api, setApi] = useState<ApiInfo | null>(null);
  const [toast, setToast] = useState("");
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const clearToast = useCallback(() => setToast(""), []);
  const switchMode = (m: Mode) => { setMode(m); window.scrollTo({ top: 0 }); };

  return (
    <>
      <TopBar api={api} onMenu={() => setDrawer(true)} />
      <Drawer open={drawer} mode={mode} api={api} onClose={closeDrawer} onMode={switchMode} />
      {/* both modes stay mounted so switching keeps each one's work */}
      <TestsMode hidden={mode !== "tests"} onApi={setApi} notify={setToast} />
      <DocsMode hidden={mode !== "docs"} notify={setToast} />
      <BottomNav mode={mode} onMode={switchMode} onMore={() => setDrawer(true)} />
      <Toast text={toast} onDone={clearToast} />
    </>
  );
}
