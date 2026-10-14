import Link from "next/link";
import T from "@/components/T";
import { t } from "@/lib/types";
import { ui } from "@/lib/ui";

/** Switch between the Databricks guides. */
export default function DbxTabs({ active }: { active: "replicate" | "native" | "triage" }) {
  return (
    <nav className="dbx-tabs" aria-label="Databricks guides">
      <Link href="/databricks/build" className={active === "native" ? "on" : ""} aria-current={active === "native" ? "page" : undefined}>
        <b><T v={ui.nbTabNative} /></b><span><T v={ui.nbTabNativeSub} /></span>
      </Link>
      <Link href="/databricks" className={active === "replicate" ? "on" : ""} aria-current={active === "replicate" ? "page" : undefined}>
        <b><T v={ui.nbTabReplicate} /></b><span><T v={ui.nbTabReplicateSub} /></span>
      </Link>
      <Link href="/databricks/contract-triage" className={active === "triage" ? "on" : ""} aria-current={active === "triage" ? "page" : undefined}>
        <b><T v={t("Contract triage follow-along", "合同分诊跟做指南")} /></b>
        <span><T v={t("The hackathon blueprint, card by card: Mac, GitHub, Databricks", "黑客松蓝图逐卡跟做：Mac、GitHub、Databricks")} /></span>
      </Link>
    </nav>
  );
}
