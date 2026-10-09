import Link from "next/link";
import { notFound } from "next/navigation";
import CodeBlock from "@/components/CodeBlock";
import T from "@/components/T";
import { byId } from "@/lib/curriculum";
import { guideById, guides } from "@/lib/platforms";
import type { PlatformId } from "@/lib/types";
import { ui } from "@/lib/ui";

export function generateStaticParams() {
  return guides.map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = guideById[id as PlatformId];
  return g ? { title: g.name } : {};
}

export default async function Guide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = guideById[id as PlatformId];
  if (!g) notFound();
  return (
    <div className="wrap">
      <header className="lesson-head">
        <div className="eyebrow"><Link href="/platforms"><T v={ui.navPlatforms} /></Link> / <T v={g.kind} /></div>
        <h1>{g.name}</h1>
        <p className="lede"><T v={g.summary} /></p>
      </header>
      {g.id !== "other" && <div className="note" style={{ marginBottom: 18 }}><T v={ui.plWarn} /></div>}
      {g.id === "databricks" && (
        <p style={{ marginBottom: 18 }}><Link className="btn" href="/databricks"><T v={ui.dbxPlaybook} /></Link></p>
      )}
      <div className="two">
        <div className="card"><h3><T v={ui.youOwn} /></h3><p><T v={g.owns.you} /></p></div>
        <div className="card"><h3><T v={ui.platformOwns} /></h3><p><T v={g.owns.platform} /></p></div>
      </div>

      <h2><T v={ui.hBuild} /></h2>
      {g.steps.map((s, i) => (
        <details key={s.title.en} className="step" open>
          <summary>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span className="t"><T v={s.title} /></span>
          </summary>
          <div className="body">
            <div className="io in">
              <b><T v={ui.correspondsTo} /></b>
              <span><Link href={`/modules/${s.module}`}><T v={ui.module} /> {byId[s.module].n}: <T v={byId[s.module].title} /></Link></span>
            </div>
            <h4><T v={ui.doThis} /></h4>
            <ol className="do">
              {s.do.map((d) => (<li key={d.en}><T v={d} /></li>))}
            </ol>
            {s.code && <CodeBlock text={s.code.text} label={s.code.file ?? s.code.lang} />}
            <div className="verify"><b><T v={ui.doneWhen} /></b><T v={s.verify} /></div>
          </div>
        </details>
      ))}

      <h2><T v={ui.sources} /></h2>
      {g.sources.length === 0 ? (
        <p className="muted"><T v={ui.noSources} /></p>
      ) : (
        <ul className="bullets">
          {g.sources.map((s) => (<li key={s.url}><a href={s.url} rel="noreferrer">{s.title}</a></li>))}
        </ul>
      )}
    </div>
  );
}
