import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import Nav from "../components/Nav"
import { generarPDFDiario, ClaseReporte } from "../lib/pdf"

type Periodo = "semana" | "anterior" | "mes"
interface ResumenAlumno { nombre: string; horas: number; clases: number }

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function todayStr() {
  return localDate(new Date())
}

function getRango(p: Periodo) {
  const hoy = new Date()
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7))
  lunes.setHours(12, 0, 0, 0)
  if (p === "semana") {
    const dom = new Date(lunes); dom.setDate(lunes.getDate() + 6)
    return { desde: localDate(lunes), hasta: localDate(dom), label: `${lunes.getDate()} - ${dom.getDate()} de ${dom.toLocaleDateString("es-ES", { month: "long" })}` }
  }
  if (p === "anterior") {
    const la = new Date(lunes); la.setDate(lunes.getDate() - 7)
    const ld = new Date(la); ld.setDate(la.getDate() + 6)
    return { desde: localDate(la), hasta: localDate(ld), label: `${la.getDate()} - ${ld.getDate()} de ${ld.toLocaleDateString("es-ES", { month: "long" })}` }
  }
  const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return { desde: localDate(ini), hasta: localDate(fin), label: hoy.toLocaleDateString("es-ES", { month: "long", year: "numeric" }) }
}

function addMins(timeStr: string, mins: number) {
  const [h, m] = timeStr.slice(0, 5).split(":").map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

export default function Resumen() {
  const [periodo, setPeriodo] = useState<Periodo>("semana")
  const [resumen, setResumen] = useState<ResumenAlumno[]>([])
  const [totalHoras, setTotalHoras] = useState(0)
  const [totalClases, setTotalClases] = useState(0)
  const [verReporte, setVerReporte] = useState(false)
  const [clasesReporte, setClasesReporte] = useState<ClaseReporte[]>([])
  const [loadingReporte, setLoadingReporte] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fechaPDF, setFechaPDF] = useState(todayStr)
  const rango = getRango(periodo)
  const instructor = JSON.parse(localStorage.getItem("cd_instructor") || "{}")

  useEffect(() => {
    supabase
      .from("clases")
      .select("duracion_horas, alumnos:alumno_cedula(nombre)")
      .gte("fecha", rango.desde).lte("fecha", rango.hasta)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { horas: number; clases: number }> = {}
        let total = 0
        for (const c of data as unknown as { duracion_horas: number; alumnos: { nombre: string } }[]) {
          const n = c.alumnos?.nombre ?? "?"
          if (!map[n]) map[n] = { horas: 0, clases: 0 }
          map[n].horas += Number(c.duracion_horas)
          map[n].clases += 1
          total += Number(c.duracion_horas)
        }
        setTotalHoras(total)
        setTotalClases(data.length)
        setResumen(Object.entries(map).map(([nombre, v]) => ({ nombre, ...v })).sort((a, b) => b.horas - a.horas))
      })
  }, [periodo])

  async function abrirReporte() {
    setLoadingReporte(true)
    setVerReporte(true)
    const { data } = await supabase
      .from("clases")
      .select("fecha, hora_inicio, duracion_horas, firma_url, ejercicios, alumnos:alumno_cedula(nombre, cedula)")
      .eq("fecha", fechaPDF)
      .order("hora_inicio")
    if (data) setClasesReporte(data as unknown as ClaseReporte[])
    setLoadingReporte(false)
  }

  async function descargarPDF() {
    setExporting(true)
    await generarPDFDiario(clasesReporte, instructor.nombre ?? "Instructor", fechaPDF)
    setExporting(false)
  }

  function expandBloques(clases: ClaseReporte[]) {
    const bloques: { hora: string; cedula: string; ejercicio: string; firma_url: string | null }[] = []
    for (const c of clases) {
      const total = Math.round((c.duracion_horas * 60) / 45)
      const ejs = c.ejercicios ?? []
      for (let i = 0; i < total; i++) {
        bloques.push({
          hora: addMins(c.hora_inicio, i * 45),
          cedula: c.alumnos.cedula,
          ejercicio: ejs[i]?.nombre || "—",
          firma_url: c.firma_url,
        })
      }
    }
    return bloques
  }

  function fmtH(h: number) {
    if (h === Math.floor(h)) return `${h}h`
    const horas = Math.floor(h)
    const mins = Math.round((h - horas) * 60)
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`
  }

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  const bloques = expandBloques(clasesReporte)
  const fechaPDFLabel = new Date(fechaPDF + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div style={{ padding: "30px 22px 16px" }}>
        <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>{rango.label}</p>
        <h1 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 26 }}>Resumen</h1>
      </div>

      <div style={{ flex: 1, padding: "0 22px 200px", overflowY: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {([["semana", "Esta semana"], ["anterior", "Sem. pasada"], ["mes", "Mes"]] as const).map(([p, label]) => (
            <button key={p} onClick={() => setPeriodo(p)}
              style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 700, fontSize: 12, border: "1px solid", borderColor: p === periodo ? "var(--green)" : "var(--line)", background: p === periodo ? "var(--green)" : "var(--paper)", color: p === periodo ? "#fff" : "var(--muted)", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ background: "var(--green)", color: "#fff", borderRadius: 18, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Total horas</div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 28 }}>{fmtH(totalHoras)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Clases</div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 28 }}>{totalClases}</div>
          </div>
        </div>

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>Horas por alumno</p>

        {resumen.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Sin clases en este periodo.</div>
        )}

        {resumen.map((r, i) => (
          <div key={r.nombre} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: i < resumen.length - 1 ? "1px solid var(--line)" : "none" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              {initiales(r.nombre)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{r.nombre}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{r.clases} {r.clases === 1 ? "clase" : "clases"}</div>
            </div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 15, color: "var(--green)", background: "var(--green-soft)", borderRadius: 10, padding: "4px 12px", flexShrink: 0 }}>
              {fmtH(r.horas)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "fixed", bottom: 65, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "var(--paper)", borderTop: "1px solid var(--line)", padding: "12px 22px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", flexShrink: 0 }}>PDF del día</label>
          <input
            type="date"
            value={fechaPDF}
            max={todayStr()}
            onChange={e => e.target.value && setFechaPDF(e.target.value)}
            style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 10, padding: "7px 10px", fontSize: 13, fontWeight: 600, color: "var(--ink)", background: "var(--bg)", outline: "none" }}
          />
        </div>
        <button onClick={abrirReporte}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 54, borderRadius: 16, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Ver reporte
        </button>
      </div>

      {verReporte && (
        <div onClick={() => setVerReporte(false)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--paper)", borderRadius: "26px 26px 0 0", width: "100%", maxHeight: "90dvh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "10px 22px 0", flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 14px" }} />
              <div style={{ background: "var(--green)", borderRadius: 14, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: "#fff", margin: 0 }}>{instructor.nombre}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", margin: 0, textTransform: "capitalize" }}>{fechaPDFLabel}</p>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0 22px" }}>
              {loadingReporte ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Cargando...</div>
              ) : bloques.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Sin clases este día.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--line)" }}>
                      {["Hora", "Código", "Ejercicio", "Firma"].map(h => (
                        <th key={h} style={{ padding: "6px 4px", textAlign: h === "Firma" ? "center" : "left", fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bloques.map((b, i) => (
                      <tr key={i} style={{ borderBottom: "0.5px solid var(--line)", background: i % 2 === 0 ? "transparent" : "var(--bg)" }}>
                        <td style={{ padding: "8px 4px", fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" as const }}>{b.hora}</td>
                        <td style={{ padding: "8px 4px", color: "var(--muted)", fontSize: 11 }}>{b.cedula}</td>
                        <td style={{ padding: "8px 4px", color: "var(--ink)" }}>{b.ejercicio}</td>
                        <td style={{ padding: "8px 4px", textAlign: "center" }}>
                          {b.firma_url
                            ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 4, background: "var(--green-soft)" }}>
                                <svg viewBox="0 0 12 12" width="11" height="11" fill="none"><path d="M2 6l3 3 5-5" stroke="var(--green)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </span>
                            : <span style={{ display: "inline-flex", width: 20, height: 20, borderRadius: 4, border: "0.5px solid var(--line)" }} />
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "20px 0 8px" }}>
                <div>
                  <p style={{ fontSize: 10, color: "var(--muted)", margin: "0 0 18px" }}>Firma del instructor</p>
                  <div style={{ borderBottom: "1px solid var(--ink)" }} />
                  <p style={{ fontSize: 10, color: "var(--muted)", margin: "4px 0 0" }}>{instructor.nombre}</p>
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--muted)", margin: "0 0 18px" }}>Recibido</p>
                  <div style={{ borderBottom: "1px solid var(--ink)" }} />
                  <p style={{ fontSize: 10, color: "var(--muted)", margin: "4px 0 0" }}>Sello / firma</p>
                </div>
              </div>
            </div>

            <div style={{ padding: "12px 22px 30px", flexShrink: 0, borderTop: "1px solid var(--line)" }}>
              <button onClick={descargarPDF} disabled={exporting || loadingReporte || bloques.length === 0}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 52, borderRadius: 16, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: exporting || bloques.length === 0 ? 0.7 : 1 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                {exporting ? "Generando PDF..." : "Descargar PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Nav active="resumen" />
    </div>
  )
}
