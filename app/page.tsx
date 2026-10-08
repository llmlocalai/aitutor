import Link from "next/link";
import CurriculumMap from "@/components/CurriculumMap";
import WhyBefore from "@/components/WhyBefore";
import { modules } from "@/lib/curriculum";
import { live } from "@/lib/live";

export default function Home() {
  const deep = modules.filter((m) => m.depth === "deep");
  return (
    <div className="wrap">
      <section className="hero">
        <div className="eyebrow">A playbook built from a working system</div>
        <h1>Build an agent stack, and know why each piece comes when it does.</h1>
        <p className="lede">
          Fifteen modules, from serving a model to a loop that improves itself. Every dependency on
          the map carries its reason, and every module says what to stub if you want to build it out
          of order. Each one also shows the same idea on Databricks, watsonx, Codex, Cursor, Claude
          Code, and a second machine.
        </p>
      </section>

      <CurriculumMap />

      <h2 id="why">Why does A come before B?</h2>
      <p className="muted">
        Pick any two modules. If one depends on the other you get the chain of reasons. If neither
        does, you can build them in either order.
      </p>
      <WhyBefore />

      <h2>Start with a full lesson</h2>
      <div className="two">
        {deep.map((m) => (
          <Link key={m.id} href={`/modules/${m.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="eyebrow">{m.steps?.length} build steps</div>
            <h3 style={{ marginTop: 4 }}>{m.title}</h3>
            <p className="muted small">{m.short}</p>
          </Link>
        ))}
      </div>

      <h2>From the live build</h2>
      <p className="muted">
        {live.generatedAt
          ? `Last snapshot ${new Date(live.generatedAt).toISOString().slice(0, 10)}: ${live.stats.commits} changes, ${live.stats.docs} design notes, ${live.stats.files} source files, sorted into modules.`
          : "No snapshot has been pushed yet. Run the sync job on the build machine."}{" "}
        <Link href="/live">See what changed</Link>
      </p>
    </div>
  );
}
