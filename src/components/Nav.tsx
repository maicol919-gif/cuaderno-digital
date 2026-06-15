import { useNavigate } from "react-router-dom"

interface NavProps {
  active: "hoy" | "alumnos" | "resumen"
}

export default function Nav({ active }: NavProps) {
  const navigate = useNavigate()
  const color = (tab: string) => tab === active ? "var(--green)" : "var(--muted)"

  return (
    <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, height: 80, background: "var(--paper)", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-around", paddingBottom: 14 }}>
      <button onClick={() => navigate("/")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: color("hoy"), background: "none", border: "none" }}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        Hoy
      </button>
      <button onClick={() => navigate("/alumnos")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: color("alumnos"), background: "none", border: "none" }}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2M16 3.5a4 4 0 010 7"/></svg>
        Alumnos
      </button>
      <button onClick={() => navigate("/resumen")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: color("resumen"), background: "none", border: "none" }}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18M7 16l4-6 4 3 4-7"/></svg>
        Resumen
      </button>
    </nav>
  )
}