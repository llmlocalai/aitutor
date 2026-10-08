import Link from "next/link";
import { buildOrder, byId } from "@/lib/curriculum";

export const metadata = { title: "Build order" };

export default function Playbook() {
  const order = buildOrder();
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow">Playbook</div>
        <h1>One valid build order, with the reason for every position</h1>
        <p className="lede">
          This is a sequence in which every module's prerequisites already exist. Other valid
          sequences exist. Modules with no dependency between them can swap places, and any module
          can be built early if you stub what it needs.
        </p>
      </header>
      <ol className="order">
        {order.map((m) => (
          <li key={m.id}>
            <div>
              <h3>
                <Link href={`/modules/${m.id}`}>{m.title}</Link>
                <span className={`tag ${m.depth}`}>{m.depth === "deep" ? "full lesson" : "outline"}</span>
              </h3>
              <p className="muted" style={{ margin: "4px 0 8px" }}>{m.short}</p>
              {m.prereqs.length === 0 ? (
                <p className="small muted">Starting point. Needs nothing else.</p>
              ) : (
                <ul className="why-list">
                  {m.prereqs.map((p) => (
                    <li key={p.id}>
                      <b>After {byId[p.id].title}</b>
                      <span>{p.why}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
