import type { LS } from "@/lib/types";

/** Renders both languages. CSS shows the one selected on <html data-lang>. */
export default function T({ v }: { v: LS }) {
  return (
    <>
      <span className="en">{v.en}</span>
      <span className="zh" lang="zh-Hans">{v.zh}</span>
    </>
  );
}
