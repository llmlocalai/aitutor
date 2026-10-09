import Link from "next/link";
import T from "@/components/T";
import { ui } from "@/lib/ui";

/** Switch between the two Databricks guides. */
export default function DbxTabs({ active }: { active: "replicate" | "native" }) {
  return (
    <nav className="dbx-tabs" aria-label="Databricks guides">
      <Link href="/databricks/build" className={active === "native" ? "on" : ""} aria-current={active === "native" ? "page" : undefined}>
        <b><T v={ui.nbTabNative} /></b><span><T v={ui.nbTabNativeSub} /></span>
      </Link>
      <Link href="/databricks" className={active === "replicate" ? "on" : ""} aria-current={active === "replicate" ? "page" : undefined}>
        <b><T v={ui.nbTabReplicate} /></b><span><T v={ui.nbTabReplicateSub} /></span>
      </Link>
    </nav>
  );
}
