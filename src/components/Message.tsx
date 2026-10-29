export interface Msg {
  text: string;
  kind: "ok" | "err";
}

export function Message({ msg }: { msg: Msg | null }) {
  return (
    <div className={"msg" + (msg && msg.text ? " " + msg.kind : "")} role="status">
      {msg?.text}
    </div>
  );
}
