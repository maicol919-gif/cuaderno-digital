import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"
import Nav from "../components/Nav"

interface Clase {
  id: string
  hora_inicio: string
  duracion_horas: number
  firma_url: string | null
  alumnos: { nombre: string; codigo: string | null }
}

export default function Hoy() {
  const [clases, setClases] = useState<Clase[]>([])
  const navigate = useNavigate()
  const hoy = new Date().toISOString().split("T")[0]
  const fechaLabel = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })

  function cargar() {
    supabase
      .from("clases")
      .select("id, hora_inicio, duracion_horas, firma_url, alumnos(nombre, codigo)")
      .eq("fecha", hoy)
      .order("hora_inicio")
      .then(({ data }) => data && setClases(data as Clase[]))
  }

  useEffect(() => { cargar() }, [])

  function fmtDur(h: number) {
    if (h === Math.floor(h)) return `${h}h`
    const horas = Math.floor(h)
    const mins = Math.round((h - horas) * 60)
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`
  }

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div style={{ padding: "30px 22px 16px" }}>
        <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 2, textTransform: "capitalize" }}>{fechaLabel}</p>
        <h1 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 26 }}>Hoy</h1>
      </div>

      <div style={{ flex: 1, padding: "0 22px 100px", overflowY: "auto" }}>
        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "4px 0 10px" }}>
          Clases registradas ({clases.length})
        </p>

        {clases.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            Sin clases hoy.<br />Toca el boton verde para anadir la primera.
          </div>
        )}

        {clases.map(c => (
          <div key={c.id}
            onClick={() => !c.firma_url && navigate(`/firma/${c.id}`)}
            style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 10, cursor: c.firma_url ? "default" : "pointer" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 15, color: "var(--green)", width: 60, flexShrink: 0, lineHeight: 1.2 }}>
              {c.hora_inicio.slice(0, 5)}
              <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{fmtDur(c.duracion_horas)}</span>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              {initiales(c.alumnos.nombre)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{c.alumnos.nombre}</div>
              {c.alumnos.codigo && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>Codigo {c.alumnos.codigo}</div>}
            </div>
            <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: c.firma_url ? "var(--green-soft)" : "var(--amber-soft)", color: c.firma_url ? "var(--green)" : "var(--amber)" }}>
              {c.firma_url
                ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              }
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => navigate("/nueva-clase")}
        style={{ position: "fixed", bottom: 96, right: 22, width: 58, height: 58, background: "var(--green)", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px -8px rgba(47,111,79,0.6)" }}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>

      <Nav active="hoy" />
    </div>
  )
}