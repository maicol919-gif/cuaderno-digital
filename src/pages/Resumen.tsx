import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"
import Nav from "../components/Nav"
import { generarPDF } from "../lib/pdf"

type Periodo = "semana" | "anterior" | "mes"

interface Clase {
  id: string
  fecha: string
  hora_inicio: string
  duracion_horas: number
  firma_url: string | null
  alumnos: { nombre: string }
}

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
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

export default function Resumen() {
  const [periodo, setPeriodo] = useState<Periodo>("semana")
  const [clases, setClases] = useState<Clase[]>([])
  const navigate = useNavigate()
  const [expandido, setExpandido] = useState<string | null>(null)
  const [editando, setEditando] = useState<Clase | null>(null)
  const [editFecha, setEditFecha] = useState("")
  const [editHora, setEditHora] = useState("")
  const [editDur, setEditDur] = useState(1)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const rango = getRango(periodo)

  const totalHoras = clases.reduce((s, c) => s + Number(c.duracion_horas), 0)

  useEffect(() => {
    supabase
      .from("clases")
      .select("id, fecha, hora_inicio, duracion_horas, firma_url, alumnos:alumno_cedula(nombre)")
      .gte("fecha", rango.desde)
      .lte("fecha", rango.hasta)
      .order("fecha", { ascending: false })
      .order("hora_inicio", { ascending: false })
      .then(({ data }) => data && setClases(data as unknown as Clase[]))
  }, [periodo])

  function fmtDur(h: number) {
    if (h === Math.floor(h)) return `${h}h`
    const horas = Math.floor(h)
    const mins = Math.round((h - horas) * 60)
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`
  }

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  function fmtFecha(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00")
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
  }

  function fmtFechaLarga(dateStr: string) {
    const d = new Date(dateStr + "T12:00:00")
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
  }

  function abrirEditar(c: Clase) {
    setEditando(c)
    setEditFecha(c.fecha)
    setEditHora(c.hora_inicio.slice(0, 5))
    setEditDur(c.duracion_horas)
  }

  async function guardarEditar() {
    if (!editando) return
    setSaving(true)
    await supabase.from("clases").update({ fecha: editFecha, hora_inicio: editHora + ":00", duracion_horas: editDur }).eq("id", editando.id)
    setSaving(false)
    setEditando(null)
    setExpandido(null)
    const rango = getRango(periodo)
    supabase
      .from("clases")
      .select("id, fecha, hora_inicio, duracion_horas, firma_url, alumnos:alumno_cedula(nombre)")
      .gte("fecha", rango.desde).lte("fecha", rango.hasta)
      .order("fecha", { ascending: false }).order("hora_inicio", { ascending: false })
      .then(({ data }) => data && setClases(data as unknown as Clase[]))
  }

  async function exportar() {
    setExporting(true)
    const resumen = Object.entries(
      clases.reduce((acc, c) => {
        const n = c.alumnos?.nombre ?? "?"
        acc[n] = (acc[n] || 0) + Number(c.duracion_horas)
        return acc
      }, {} as Record<string, number>)
    ).map(([nombre, horas]) => ({ nombre, horas })).sort((a, b) => b.horas - a.horas)
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
            <button key={p} onClick={() => { setPeriodo(p); setExpandido(null) }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 700, fontSize: 12, border: "1px solid", borderColor: p === periodo ? "var(--green)" : "var(--line)", background: p === periodo ? "var(--green)" : "var(--paper)", color: p === periodo ? "#fff" : "var(--muted)", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ background: "var(--green)", color: "#fff", borderRadius: 18, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Total de horas</div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 28 }}>{fmtDur(totalHoras)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Clases</div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 28 }}>{clases.length}</div>
          </div>
        </div>

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 10 }}>
          Clases registradas
        </p>

        {clases.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--muted)", fontSize: 13 }}>Sin clases en este periodo.</div>
        )}

        {clases.map(c => {
          const abierto = expandido === c.id
          return (
            <div key={c.id}
              style={{ background: "var(--paper)", border: `1.5px solid ${abierto ? "var(--green)" : "var(--line)"}`, borderRadius: 16, marginBottom: 8, overflow: "hidden" }}>
              <div onClick={() => setExpandido(abierto ? null : c.id)}
                style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {initiales(c.alumnos?.nombre ?? "?")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{c.alumnos?.nombre ?? "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>
                    {fmtFecha(c.fecha)} · {c.hora_inicio.slice(0, 5)} · {fmtDur(c.duracion_horas)}
                  </div>
                </div>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: c.firma_url ? "var(--green-soft)" : "var(--amber-soft)", color: c.firma_url ? "var(--green)" : "var(--amber)", flexShrink: 0 }}>
                  {c.firma_url
                    ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                    : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                  }
                </div>
              </div>

              {abierto && (
                <div style={{ background: "var(--bg)", borderTop: "1px solid var(--line)", padding: "12px 14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 12 }}>
                    {[
                      ["Fecha", fmtFechaLarga(c.fecha)],
                      ["Hora inicio", c.hora_inicio.slice(0, 5)],
                      ["Duración", fmtDur(c.duracion_horas)],
                      ["Firma", c.firma_url ? "Registrada" : "Pendiente"],
                    ].map(([label, val]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: label === "Firma" ? (c.firma_url ? "var(--green)" : "var(--amber)") : "var(--ink)" }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!c.firma_url && (
                      <button onClick={() => navigate(`/firma/${c.id}`)}
                        style={{ flex: 1, height: 38, borderRadius: 10, border: "none", background: "var(--amber-soft)", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, color: "var(--amber)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
                        Firmar
                      </button>
                    )}
                    <button onClick={() => abrirEditar(c)}
                      style={{ flex: 1, height: 38, borderRadius: 10, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, color: "var(--ink)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Editar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "var(--paper)", borderTop: "1px solid var(--line)", padding: "10px 22px 30px" }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 16px" }} />
        <button onClick={exportar} disabled={exporting || clases.length === 0}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 54, borderRadius: 16, border: "none", background: clases.length === 0 ? "var(--line)" : "var(--green)", color: clases.length === 0 ? "var(--muted)" : "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: clases.length === 0 ? "default" : "pointer" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          {exporting ? "Generando PDF..." : "Exportar PDF"}
        </button>
      </div>

      {editando && (
        <div onClick={() => setEditando(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--paper)", borderRadius: "26px 26px 0 0", padding: "10px 22px 34px", width: "100%" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 20px" }} />
            <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 17, marginBottom: 16 }}>Editar clase</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div style={{ background: "var(--bg)", border: "1.5px solid var(--green)", borderRadius: 14, padding: "12px 14px", overflow: "hidden" }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6 }}>Fecha</p>
                <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} style={{ border: "none", outline: "none", background: "none", fontSize: 13, fontWeight: 600, color: "var(--ink)", width: "100%", boxSizing: "border-box" as const }} />
              </div>
              <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px", overflow: "hidden" }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6 }}>Hora inicio</p>
                <input type="time" value={editHora} onChange={e => setEditHora(e.target.value)} style={{ border: "none", outline: "none", background: "none", fontSize: 13, fontWeight: 600, color: "var(--ink)", width: "100%", boxSizing: "border-box" as const }} />
              </div>
            </div>
            <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 10 }}>Duración</p>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 1.5, 2, 3, 4].map(d => (
                  <button key={d} onClick={() => setEditDur(d)}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 700, fontSize: 12, border: "1px solid", borderColor: d === editDur ? "var(--green)" : "var(--line)", background: d === editDur ? "var(--green)" : "var(--paper)", color: d === editDur ? "#fff" : "var(--muted)", cursor: "pointer" }}>
                    {d === Math.floor(d) ? `${d}h` : `${Math.floor(d)}h ${Math.round((d - Math.floor(d)) * 60)}m`}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditando(null)} style={{ flex: 1, height: 50, borderRadius: 14, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardarEditar} disabled={saving} style={{ flex: 2, height: 50, borderRadius: 14, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      <Nav active="resumen" />
    </div>
  )
}
