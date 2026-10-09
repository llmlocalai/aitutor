/** Shared by the harness page (server) and its client components. Plain module: no "use client". */
export const FAMILY_KEY = "aitutor.harness.family";
/** Runs before paint (inlined by the page), so notes for the saved family show without a flash. */
export const FAMILY_BOOT = `try{var f=localStorage.getItem("${FAMILY_KEY}");if(f)document.documentElement.setAttribute("data-family",f)}catch(e){}`;

export function currentFamily(): string {
  if (typeof document === "undefined") return "all";
  return document.documentElement.getAttribute("data-family") || "all";
}
