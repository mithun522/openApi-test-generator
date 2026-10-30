import { Layout } from "../components/Shell";
import { TestsMode } from "../components/tests/TestsMode";

export function TestsPage() {
  return <Layout page="tests">{({ notify, setApi }) => <TestsMode onApi={setApi} notify={notify} />}</Layout>;
}
