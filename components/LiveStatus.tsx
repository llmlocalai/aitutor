"use client";

import { useEffect, useState } from "react";

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
        else if (d.reachable)
          setS({ state: "up", detail: `${d.latency_ms} ms${d.tools != null ? `, ${d.tools} MCP tools registered` : ""}` });
        else setS({ state: "down" });
      })
      .catch(() => !dead && setS({ state: "down" }));
    return () => {
      dead = true;
    };
  }, []);

  const label = {
    checking: "Checking the local build",
    up: `Local build reachable (${s.detail})`,
    down: "Local build not reachable right now. Showing the last pushed snapshot.",
    unset: "Live link not configured yet. Showing the pushed snapshot.",
  }[s.state];

  return (
    <span className={`status ${s.state === "up" ? "up" : s.state === "checking" ? "" : "down"}`}>
      <i />
      {label}
    </span>
  );
}
