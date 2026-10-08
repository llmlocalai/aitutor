"use client";

import { useEffect, useState } from "react";
import T from "@/components/T";
import { ui } from "@/lib/ui";

type S = { state: "checking" | "up" | "down" | "unset"; detail?: string };

export default function LiveStatus() {
  const [s, setS] = useState<S>({ state: "checking" });
  useEffect(() => {
    let dead = false;
    fetch("/api/live")
      .then((r) => r.json())
      .then((d) => {
        if (dead) return;
        if (!d.configured) setS({ state: "unset" });
        else if (d.reachable) setS({ state: "up", detail: `${d.latency_ms} ms` });
        else setS({ state: "down" });
      })
      .catch(() => !dead && setS({ state: "down" }));
    return () => {
      dead = true;
    };
  }, []);
  const label = { checking: ui.stChecking, up: ui.stUp, down: ui.stDown, unset: ui.stUnset }[s.state];
  return (
    <span className={`status ${s.state === "up" ? "up" : s.state === "checking" ? "" : "down"}`}>
      <i />
      <span><T v={label} />{s.detail ? ` (${s.detail})` : ""}</span>
    </span>
  );
}
