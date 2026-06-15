import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import Nav from "../components/Nav"
import { generarPDF } from "../lib/pdf"

type Periodo = "semana" | "anterior" | "mes"
interface ResumenAlumno { nombre: string; horas: number }

function getRango(p: Periodo) {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  lunes.setHours(0, 0, 0, 0)

  if (p === "semana") {
    const dom = new Date(lunes); dom.setDate(lunes.getDate() + 6)
    return { desde: lunes.toISOString().split("T")[0], hasta: dom.toISOString().split("T")[0], label: `${lunes.getDate()} - ${dom.getDate()} de ${dom.toLocaleDateString("es-ES", { month: "long" })}` }
  }
  if (p === "anterior") {
    const la = new Date(lunes); la.setDate(lunes.getDate() - 7)
    const ld = new Date(la); ld.setDate(la.getDate() + 6)
    return { desde: la.toISOString().split("T")[0], hasta: ld.toISOString().split("T")[0], label: `${la.getDate()} - ${ld.getDate()} de ${ld.toLocaleDateString("es-ES", { month: "long" })}` }
  }
  const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return { desde: ini.toISOString().split("T")[0], hasta: fin.toISOString().split("T")[0], label: hoy.toLocaleDateString("es-ES", { month: "long", year: "numeric" }) }
}

export default function Resumen() {
  const [periodo, setPeriodo] = useState<Periodo>("semana")
  const [resumen, setResumen] = useState<ResumenAlumno[]>([])
  const [totalHoras, setTotalHoras] = useState(0)
  const [exporting, setExporting] = useState(false)
  const rango = getRango(periodo)

  useEffect(() => {
    supabase.from("clases").select("duracion_horas, alumnos(nombre)").gte("fecha", rango.desde).lte("fecha", rango.hasta)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, number> = {}
        let total = 0
        for (const c of data as unknown as { duracion_horas: number; alumnos: { nombre: string } }[]) {
          const n = c.alumnos?.nombre ?? "?"
          map[n] = (map[n] || 0) + Number(c.duracion_horas)
          total += Number(c.duracion_horas)
        }
        setTotalHoras(total)
        setResumen(Object.entries(map).map(([nombre, horas]) => ({ nombre, horas })).sort((a, b) => b.horas - a.horas))
      })
  }, [periodo])

  function fmtH(h: number) { return `${h}h` }
  function initiales(n: string) { return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase() }

  async function exportar() {
    setExporting(true)
    await generarPDF(resumen, totalHoras, rango.label)
    setExporting(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div style={{ padding: "30px 22px 16px" }}>
        <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>{rango.label}</p>
        <h1 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 26 }}>Resumen</h1>
      </div>

      <div style={{ flex: 1, padding: "0 22px 160px", overflowY: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {([["semana", "Esta semana"], ["anterior", "Sem. pasada"], ["mes", "Mes"]] as const).map(([p, label]) => (
            <button key={p} onClick={() => setPeriodo(p)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 700, fontSize: 12, border: "1px solid", borderColor: p === periodo ? "var(--green)" : "var(--line)", background: p === periodo ? "var(--green)" : "var(--paper)", color: p === periodo ? "#fff" : "var(--muted)" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ background: "var(--green)", color: "#fff", borderRadius: 18, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Total de horas</div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 28 }}>{fmtH(totalHoras)}</div>
          </div>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"><path d="M3 3v18h18M7 16l4-6 4 3 4-7"/></svg>
        </div>

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>Horas por alumno</p>
        {resumen.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Sin clases en este periodo.</div>}
        {resumen.map(r => (
          <div key={r.nombre} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--line)" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              {initiales(r.nombre)}
            </div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{r.nombre}</div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: "var(--green)", background: "var(--green-soft)", borderRadius: 10, padding: "4px 12px" }}>{fmtH(r.horas)}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "var(--paper)", borderTop: "1px solid var(--line)", padding: "10px 22px 30px" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 16px" }} />
        <button onClick={exportar} disabled={exporting || resumen.length === 0}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 54, borderRadius: 16, border: "none", background: resumen.length === 0 ? "var(--line)" : "var(--green)", color: resumen.length === 0 ? "var(--muted)" : "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          {exporting ? "Generando PDF..." : "Exportar PDF"}
        </button>
      </div>

      <Nav active="resumen" />
    </div>
  )
}
