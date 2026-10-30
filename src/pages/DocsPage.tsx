import { DocsMode } from "../components/docs/DocsMode";
import { Layout } from "../components/Shell";

export function DocsPage() {
  return <Layout page="docs">{({ notify }) => <DocsMode notify={notify} />}</Layout>;
}
