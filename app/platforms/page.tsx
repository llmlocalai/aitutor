import Link from "next/link";
import { modules, platforms } from "@/lib/curriculum";

export const metadata = { title: "Platforms" };

export default function Platforms() {
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow">Carry it elsewhere</div>
        <h1>Every module on every platform</h1>
        <p className="lede">
          The parts stay the same across platforms. What changes is who runs each part: you, or the
          platform. Read a row to see one idea in six places. Read a column to plan a build on one
          platform.
        </p>
      </header>
      <div className="two" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3>What you always own</h3>
          <p>
            Tool definitions, instructions and skills, answer checks, evaluation sets, and the
            curation of your knowledge. Keep these outside any one vendor's format where you can.
          </p>
        </div>
        <div className="card">
          <h3>What a platform usually takes over</h3>
          <p>
            Model serving, the agent loop, state storage, tracing, scheduling, and access control.
            You configure them and you still have to measure them.
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th className="rowh">Module</th>
              {platforms.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr key={m.id}>
                <td className="rowh">
                  <Link href={`/modules/${m.id}#platforms`}>{m.title}</Link>
                </td>
                {platforms.map((p) => (
                  <td key={p.id}>{m.portability[p.id]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Platform feature names were checked in October 2026 and change often. Confirm against
        current vendor documentation before you commit to a design.
      </p>
    </div>
  );
}
