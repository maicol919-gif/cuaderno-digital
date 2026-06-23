import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"
import Nav from "../components/Nav"

interface Alumno { cedula: string; nombre: string }

interface ClaseFicha {
  id: string
  fecha: string
  hora_inicio: string
  cantidad_clases: number
  firma_url: string | null
  ejercicios: { nombre: string; calificacion: number | null }[]
}

interface Nota {
  id: string
  clase_id: string
  contenido: string
  created_at: string
  ejercicio_index: number | null
}

function fmtDur(h: number) {
  if (h === Math.floor(h)) return `${h}h`
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`
}

function fmtFecha(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })
}

function fmtFechaCorta(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })
}

function fmtNotaDate(isoStr: string) {
  const d = new Date(isoStr)
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

function initiales(n: string) {
  return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
}

function fmtRelativa(dateStr: string): string {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + "T12:00:00")
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((hoy.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return "Hoy"
  if (diff === 1) return "Ayer"
  if (diff <= 7) return `Hace ${diff} días`
  return fmtFechaCorta(dateStr)
}

function calColor(v: number | null): { bg: string; color: string } {
  if (v === null) return { bg: "var(--green-soft)", color: "var(--green)" }
  if (v >= 7) return { bg: "var(--green)", color: "#fff" }
  if (v >= 5) return { bg: "var(--amber)", color: "#fff" }
  return { bg: "var(--danger)", color: "#fff" }
}

export default function Ficha() {
  const { cedula } = useParams<{ cedula: string }>()
  const navigate = useNavigate()
  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [clases, setClases] = useState<ClaseFicha[]>([])
  const [notasPorClase, setNotasPorClase] = useState<Record<string, Nota[]>>({})
  const [loading, setLoading] = useState(true)
  const [ejerciciosOpen, setEjerciciosOpen] = useState(true)
  const [clasesOpen, setClasesOpen] = useState<Record<string, boolean>>({})
  const [expandedEjercicios, setExpandedEjercicios] = useState<Record<string, boolean>>({})

  // Menú ⋯
  const [menuOpen, setMenuOpen] = useState(false)
  // Sheet editar
  const [sheetEditar, setSheetEditar] = useState(false)
  const [editNombre, setEditNombre] = useState("")
  const [editCodigo, setEditCodigo] = useState("")
  const [savingEditar, setSavingEditar] = useState(false)
  // Sheet archivar
  const [sheetArchivar, setSheetArchivar] = useState(false)
  const [savingArchivar, setSavingArchivar] = useState(false)

  async function cargarAlumno() {
    const { data: al } = await supabase.from("alumnos").select("cedula, nombre").eq("cedula", cedula!).single()
    if (al) setAlumno(al)
  }

  async function guardarEditar() {
    if (!editNombre.trim()) return
    setSavingEditar(true)
    await supabase.from("alumnos").update({ nombre: editNombre.trim(), codigo: editCodigo.trim() || null }).eq("cedula", cedula!)
    await cargarAlumno()
    setSavingEditar(false)
    setSheetEditar(false)
  }

  async function confirmarArchivar() {
    setSavingArchivar(true)
    await supabase.from("alumnos").update({ archivado: true }).eq("cedula", cedula!)
    setSavingArchivar(false)
    navigate(-1)
  }

  useEffect(() => {
    if (!cedula) return
    async function cargar() {
      const [{ data: al }, { data: cls }] = await Promise.all([
        supabase.from("alumnos").select("cedula, nombre").eq("cedula", cedula!).single(),
        supabase.from("clases")
          .select("id, fecha, hora_inicio, cantidad_clases, firma_url, ejercicios")
          .eq("alumno_cedula", cedula!)
          .order("fecha", { ascending: false }),
      ])
      if (al) setAlumno(al)
      if (cls && cls.length > 0) {
        const lista = cls as ClaseFicha[]
        setClases(lista)
        // más reciente abierta por defecto
        setClasesOpen({ [lista[0].id]: true })
        const ids = lista.map(c => c.id)
        const { data: nts } = await supabase
          .from("notas")
          .select("id, clase_id, contenido, created_at, ejercicio_index")
          .in("clase_id", ids)
          .order("created_at")
        if (nts) {
          const grouped: Record<string, Nota[]> = {}
          for (const n of nts as Nota[]) {
            if (!grouped[n.clase_id]) grouped[n.clase_id] = []
            grouped[n.clase_id].push(n)
          }
          setNotasPorClase(grouped)
        }
      }
      setLoading(false)
    }
    cargar()
  }, [cedula])

  // --- Stats ---
  const todasCals = clases.flatMap(c => (c.ejercicios || []).map(e => e.calificacion).filter((v): v is number => v !== null))
  const promedio = todasCals.length > 0 ? todasCals.reduce((a, b) => a + b, 0) / todasCals.length : null
  const ultimaFecha = clases.length > 0 ? clases[0].fecha : null

  const promedioColor = promedio === null
    ? { bg: "var(--paper)", color: "var(--muted)" }
    : calColor(promedio)

  // --- Promedio por ejercicio ---
  const ejMap: Record<string, number[]> = {}
  for (const c of clases) {
    for (const ej of c.ejercicios || []) {
      if (ej.nombre && ej.calificacion !== null) {
        if (!ejMap[ej.nombre]) ejMap[ej.nombre] = []
        ejMap[ej.nombre].push(ej.calificacion)
      }
    }
  }
  const ejPromedios = Object.entries(ejMap).map(([nombre, vals]) => ({
    nombre,
    prom: vals.reduce((a, b) => a + b, 0) / vals.length,
  }))

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div style={{ padding: "30px 22px 14px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => navigate("/alumnos")} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        {alumno && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
              {initiales(alumno.nombre)}
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{alumno.nombre}</h2>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Cédula {alumno.cedula}</p>
            </div>
          </div>
        )}
        {/* Botón ⋯ */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
              <div style={{ position: "absolute", top: 42, right: 0, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 51, minWidth: 180, overflow: "hidden" }}>
                <button
                  onClick={() => { setMenuOpen(false); setEditNombre(alumno?.nombre ?? ""); setEditCodigo(""); setSheetEditar(true) }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: "var(--bg)", border: "none", cursor: "pointer", fontFamily: "Manrope", fontWeight: 700, fontSize: 14, color: "var(--ink)", textAlign: "left" }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Editar alumno
                </button>
                <div style={{ height: 1, background: "var(--line)" }} />
                <button
                  onClick={() => { setMenuOpen(false); setSheetArchivar(true) }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: "var(--amber-soft)", border: "none", cursor: "pointer", fontFamily: "Manrope", fontWeight: 700, fontSize: 14, color: "var(--amber)", textAlign: "left" }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                  </svg>
                  Archivar alumno
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, padding: "0 22px 100px", overflowY: "auto" }}>

        {/* STATS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {/* clases */}
          <div style={{ flex: 1, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 20, color: "var(--ink)" }}>{clases.length}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>clases</div>
          </div>
          {/* promedio */}
          <div style={{ flex: 1, background: promedioColor.bg, border: "1px solid var(--line)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 20, color: promedioColor.color }}>
              {promedio === null ? "–" : promedio.toFixed(1)}
            </div>
            <div style={{ fontSize: 11, color: promedioColor.color, marginTop: 2, opacity: promedio === null ? 1 : 0.85 }}>
              {promedio === null ? "Sin datos" : "promedio"}
            </div>
          </div>
          {/* última clase */}
          <div style={{ flex: 1, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: ultimaFecha ? 13 : 20, color: "var(--ink)", lineHeight: 1.2, paddingTop: ultimaFecha ? 3 : 0 }}>
              {ultimaFecha ? fmtRelativa(ultimaFecha) : "–"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>última clase</div>
          </div>
        </div>

        {/* PROMEDIO POR EJERCICIO */}
        {ejPromedios.length > 0 && (
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, marginBottom: 16, overflow: "hidden" }}>
            <button
              onClick={() => setEjerciciosOpen(o => !o)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", background: "none", border: "none", cursor: "pointer" }}
            >
              <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>Promedio por ejercicio</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: ejerciciosOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            <div style={{ maxHeight: ejerciciosOpen ? 600 : 0, overflow: "hidden", transition: "max-height 0.25s ease" }}>
              <div style={{ padding: "0 16px 14px" }}>
                {ejPromedios.map(({ nombre, prom }) => {
                  const barColor = prom >= 7 ? "var(--green)" : "var(--amber)"
                  return (
                    <div key={nombre} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span
                        onClick={() => setExpandedEjercicios(prev => ({ ...prev, [nombre]: !prev[nombre] }))}
                        style={{ fontSize: 12, color: "var(--ink)", minWidth: 90, maxWidth: 110, overflow: "hidden", textOverflow: expandedEjercicios[nombre] ? "unset" : "ellipsis", whiteSpace: expandedEjercicios[nombre] ? "normal" : "nowrap", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
                      >{nombre}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--line)" }}>
                        <div style={{ width: `${Math.min(prom / 10, 1) * 100}%`, height: "100%", borderRadius: 3, background: barColor }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: "Manrope", fontWeight: 700, color: barColor, minWidth: 28, textAlign: "right" }}>{prom.toFixed(1)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* HISTORIAL */}
        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px" }}>Historial</p>

        {clases.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 40 }}>Sin clases registradas</p>
        )}

        {clases.map(c => {
          const notas = notasPorClase[c.id] || []
          const ejs = c.ejercicios || []
          const open = !!clasesOpen[c.id]
          const hasBody = ejs.some(e => e.nombre) || notas.length > 0

          return (
            <div key={c.id} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
              {/* Cabecera siempre visible */}
              <button
                onClick={() => setClasesOpen(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "none", border: "none", cursor: hasBody ? "pointer" : "default" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 14, color: "var(--green)" }}>{fmtFecha(c.fecha)}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{c.hora_inicio.slice(0, 5)} · {c.cantidad_clases} clase{c.cantidad_clases > 1 ? "s" : ""} · {fmtDur(c.cantidad_clases * 45 / 60)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: c.firma_url ? "var(--green-soft)" : "var(--amber-soft)", color: c.firma_url ? "var(--green)" : "var(--amber)" }}>
                    {c.firma_url
                      ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      : <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                    }
                  </div>
                  {hasBody && (
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--muted)" strokeWidth="2.2" strokeLinecap="round" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  )}
                </div>
              </button>

              {/* Body colapsable */}
              {hasBody && (
                <div style={{ maxHeight: open ? 2000 : 0, overflow: "hidden", transition: "max-height 0.25s ease" }}>
                  <div style={{ padding: "0 16px 14px" }}>
                    {ejs.map((ej, i) => {
                      if (!ej.nombre) return null
                      const notasEj = notas.filter(n => n.ejercicio_index === i)
                      const cc = calColor(ej.calificacion)
                      return (
                        <div key={i} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: notasEj.length > 0 ? 6 : 0 }}>
                            <span style={{ fontSize: 10, color: "var(--muted)", minWidth: 18 }}>B{i + 1}</span>
                            <span style={{
                              fontSize: 11, padding: "3px 10px", borderRadius: 20,
                              background: cc.bg, color: cc.color,
                              fontWeight: 600,
                              border: ej.calificacion === null ? "1px solid var(--green)" : "none",
                            }}>
                              {ej.nombre}{ej.calificacion !== null ? ` · ${ej.calificacion}` : ""}
                            </span>
                          </div>
                          {notasEj.map(n => (
                            <div key={n.id} style={{ borderLeft: "2.5px solid var(--green)", paddingLeft: 10, marginBottom: 6, marginLeft: 24 }}>
                              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{fmtNotaDate(n.created_at)}</div>
                              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.4 }}>{n.contenido}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {/* Notas generales (ejercicio_index null) */}
                    {notas.filter(n => n.ejercicio_index === null).map(n => (
                      <div key={n.id} style={{ borderLeft: "2.5px solid var(--amber)", paddingLeft: 10, marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{fmtNotaDate(n.created_at)}</div>
                        <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.4 }}>{n.contenido}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Nav active="alumnos" />

      {/* Sheet: Editar alumno */}
      {sheetEditar && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <div style={{ background: "var(--paper)", borderRadius: "26px 26px 0 0", padding: "10px 22px 34px", width: "100%" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 20px" }} />
            <h3 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Editar alumno</h3>
            <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>Nombre completo</label>
              <input
                value={editNombre}
                onChange={e => setEditNombre(e.target.value)}
                placeholder="Ej. Juan Rodríguez"
                style={{ border: "none", outline: "none", background: "none", fontSize: 16, width: "100%", color: "var(--ink)" }}
                autoFocus
              />
            </div>
            <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>Código</label>
              <input
                value={editCodigo}
                onChange={e => setEditCodigo(e.target.value)}
                inputMode="numeric"
                placeholder="Ej. 1023456789"
                style={{ border: "none", outline: "none", background: "none", fontSize: 16, width: "100%", color: "var(--ink)" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setSheetEditar(false)} style={{ flex: 1, height: 54, borderRadius: 16, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={guardarEditar} disabled={savingEditar} style={{ flex: 2, height: 54, borderRadius: 16, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{savingEditar ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet: Archivar alumno */}
      {sheetArchivar && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <div style={{ background: "var(--paper)", borderRadius: "26px 26px 0 0", padding: "10px 22px 34px", width: "100%" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 24px" }} />
            <h3 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18, marginBottom: 10 }}>¿Archivar a {alumno?.nombre}?</h3>
            <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, marginBottom: 24 }}>Ya no aparecerá en listas activas ni en el selector de nueva clase. Su historial se conserva.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setSheetArchivar(false)} style={{ flex: 1, height: 54, borderRadius: 16, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>Cancelar</button>
              <button type="button" onClick={confirmarArchivar} disabled={savingArchivar} style={{ flex: 2, height: 54, borderRadius: 16, border: "none", background: "var(--amber)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>{savingArchivar ? "Archivando..." : "Sí, archivar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
