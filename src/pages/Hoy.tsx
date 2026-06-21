import { useEffect, useState, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"
import { BANCO } from "../lib/ejercicios"
import Nav from "../components/Nav"

function logout() {
  localStorage.removeItem("cd_instructor")
  localStorage.removeItem("cd_last_activity")
  supabase.auth.signOut()
  window.location.replace(window.location.pathname)
}

interface Ejercicio {
  nombre: string
  calificacion: number | null
}

interface Clase {
  id: string
  fecha: string
  hora_inicio: string
  cantidad_clases: number
  firma_url: string | null
  ejercicios: Ejercicio[]
  alumnos: { nombre: string; cedula: string }
}

interface Nota {
  id: string
  contenido: string
  created_at: string
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + "T12:00:00")
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtLabel(dateStr: string, hoy: string) {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long" }) + (dateStr === hoy ? "" : "")
}

function addMins(timeStr: string, mins: number) {
  const [h, m] = timeStr.slice(0, 5).split(":").map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

function bloqueTime(hora_inicio: string, idx: number) {
  return `${addMins(hora_inicio, idx * 45)} – ${addMins(hora_inicio, (idx + 1) * 45)}`
}

function fmtBloques(n: number) {
  const mins = n * 45
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function fmtNotaDate(isoStr: string) {
  const d = new Date(isoStr)
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

function isLocked(created_at: string) {
  return new Date().getTime() - new Date(created_at).getTime() > 7 * 24 * 60 * 60 * 1000
}

export default function Hoy() {
  const hoy = localToday()
  const [fecha, setFecha] = useState(hoy)
  const [clases, setClases] = useState<Clase[]>([])
  const [firmaVer, setFirmaVer] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Clase | null>(null)
  const [editando, setEditando] = useState<Clase | null>(null)
  const [editDur, setEditDur] = useState(1)
  const [editFecha, setEditFecha] = useState("")
  const [editHora, setEditHora] = useState("")
  const [saving, setSaving] = useState(false)
  const [notas, setNotas] = useState<Nota[]>([])
  const [nuevaNota, setNuevaNota] = useState("")
  const [savingNota, setSavingNota] = useState(false)
  const [detalleEjs, setDetalleEjs] = useState<Ejercicio[]>([])
  const [searchBlock, setSearchBlock] = useState<number | null>(null)
  const [searchText, setSearchText] = useState("")
  const [editingNotaId, setEditingNotaId] = useState<string | null>(null)
  const [editingNotaText, setEditingNotaText] = useState("")
  const dateInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const esHoy = fecha === hoy
  const titulo = esHoy ? "Hoy" : new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long" })
  const fechaLabel = new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })

  function cargar(f = fecha) {
    supabase
      .from("clases")
      .select("id, fecha, hora_inicio, cantidad_clases, firma_url, ejercicios, alumnos:alumno_cedula(nombre, cedula)")
      .eq("fecha", f)
      .order("hora_inicio")
      .then(({ data }) => data && setClases(data as unknown as Clase[]))
  }

  useEffect(() => { setFecha(localToday()) }, [location.key])
  useEffect(() => { cargar(fecha) }, [fecha, location])

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  function cerrarDetalle() {
    setDetalle(null)
    setNotas([])
    setNuevaNota("")
    setDetalleEjs([])
    setSearchBlock(null)
    setSearchText("")
    setEditingNotaId(null)
  }

  async function abrirDetalle(c: Clase) {
    setDetalle(c)
    const nb = c.cantidad_clases
    const saved = c.ejercicios || []
    setDetalleEjs(Array.from({ length: nb }, (_, i) => saved[i] ?? { nombre: "", calificacion: null }))
    const { data } = await supabase
      .from("notas")
      .select("id, contenido, created_at")
      .eq("clase_id", c.id)
      .order("created_at")
    if (data) setNotas(data as Nota[])
  }

  async function selectEj(blockIdx: number, nombre: string) {
    if (!detalle) return
    const next = [...detalleEjs]
    next[blockIdx] = { ...next[blockIdx], nombre }
    setDetalleEjs(next)
    setSearchBlock(null)
    setSearchText("")
    await supabase.from("clases").update({ ejercicios: next }).eq("id", detalle.id)
    setClases(clases.map(c => c.id === detalle.id ? { ...c, ejercicios: next } : c))
  }

  async function clearEj(blockIdx: number) {
    if (!detalle) return
    const next = [...detalleEjs]
    next[blockIdx] = { nombre: "", calificacion: next[blockIdx].calificacion }
    setDetalleEjs(next)
    await supabase.from("clases").update({ ejercicios: next }).eq("id", detalle.id)
    setClases(clases.map(c => c.id === detalle.id ? { ...c, ejercicios: next } : c))
  }

  async function setCalificacion(blockIdx: number, valor: number | null) {
    if (!detalle) return
    const next = [...detalleEjs]
    next[blockIdx] = { ...next[blockIdx], calificacion: valor }
    setDetalleEjs(next)
    await supabase.from("clases").update({ ejercicios: next }).eq("id", detalle.id)
    setClases(clases.map(c => c.id === detalle.id ? { ...c, ejercicios: next } : c))
  }

  async function agregarNota() {
    if (!nuevaNota.trim() || !detalle) return
    setSavingNota(true)
    const instructor = JSON.parse(localStorage.getItem("cd_instructor") || "{}")
    const { data } = await supabase.from("notas").insert({
      clase_id: detalle.id,
      instructor_id: instructor.id,
      contenido: nuevaNota.trim(),
    }).select("id, contenido, created_at").single()
    if (data) setNotas([...notas, data as Nota])
    setNuevaNota("")
    setSavingNota(false)
  }

  async function guardarEditNota(notaId: string) {
    if (!editingNotaText.trim()) return
    await supabase.from("notas").update({ contenido: editingNotaText.trim() }).eq("id", notaId)
    setNotas(notas.map(n => n.id === notaId ? { ...n, contenido: editingNotaText.trim() } : n))
    setEditingNotaId(null)
  }

  function abrirEditar(e: React.MouseEvent, c: Clase) {
    e.stopPropagation()
    setEditando(c)
    setEditDur(c.cantidad_clases)
    setEditFecha(c.fecha ?? fecha)
    setEditHora(c.hora_inicio.slice(0, 5))
  }

  async function guardarEditar() {
    if (!editando) return
    setSaving(true)
    await supabase.from("clases").update({ cantidad_clases: editDur, fecha: editFecha, hora_inicio: editHora + ":00" }).eq("id", editando.id)
    setSaving(false)
    setEditando(null)
    cargar()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div style={{ padding: "28px 22px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 2, textTransform: "capitalize" }}>{fechaLabel}</p>
            <h1 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 26 }}>{titulo}</h1>
          </div>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: 6, background: "#FFF0EE", border: "none", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "var(--danger)", cursor: "pointer", marginTop: 4 }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Salir
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "10px 14px" }}>
          <button onClick={() => setFecha(addDays(fecha, -1))} style={{ width: 34, height: 34, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ textAlign: "center", cursor: "pointer", position: "relative" }} onClick={() => dateInputRef.current?.showPicker()}>
            <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 15, color: "var(--ink)", margin: 0 }}>{fmtLabel(fecha, hoy)}</p>
            {esHoy && <p style={{ fontSize: 11, color: "var(--green)", fontWeight: 600, margin: 0 }}>Hoy</p>}
            <input ref={dateInputRef} type="date" value={fecha} max={hoy} onChange={e => e.target.value && setFecha(e.target.value)}
              style={{ position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0, pointerEvents: "none" }} />
          </div>
          <button onClick={() => setFecha(addDays(fecha, 1))}
            style={{ width: 34, height: 34, borderRadius: 10, background: "var(--bg)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "0 22px 100px", overflowY: "auto" }}>
        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "4px 0 10px" }}>
          Clases registradas ({clases.length})
        </p>

        {clases.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            Sin clases {esHoy ? "hoy" : "este día"}.<br />{esHoy && "Toca el botón verde para añadir la primera."}
          </div>
        )}

        {clases.map(c => (
          <div key={c.id}
            onClick={() => abrirDetalle(c)}
            style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 10, cursor: "pointer" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 15, color: "var(--green)", width: 60, flexShrink: 0, lineHeight: 1.2 }}>
              {c.hora_inicio.slice(0, 5)}
              <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{c.cantidad_clases} clase{c.cantidad_clases > 1 ? "s" : ""} · {fmtBloques(c.cantidad_clases)}</span>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              {initiales(c.alumnos.nombre)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{c.alumnos.nombre}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>Cédula {c.alumnos.cedula}</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: c.firma_url ? "var(--green-soft)" : "var(--amber-soft)", color: c.firma_url ? "var(--green)" : "var(--amber)", flexShrink: 0 }}>
              {c.firma_url
                ? <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                : <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              }
            </div>
          </div>
        ))}
      </div>

      {esHoy && (
        <button onClick={() => navigate("/nueva-clase")}
          style={{ position: "fixed", bottom: 96, right: 22, width: 58, height: 58, background: "var(--green)", border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px -8px rgba(47,111,79,0.6)" }}>
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      )}

      {detalle && (
        <div onClick={cerrarDetalle} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--paper)", borderRadius: "26px 26px 0 0", width: "100%", maxHeight: "90dvh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "8px auto 0", flexShrink: 0 }} />

            <div style={{ overflowY: "auto", padding: "16px 22px 0", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                  {initiales(detalle.alumnos.nombre)}
                </div>
                <div>
                  <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: "var(--ink)", margin: 0 }}>{detalle.alumnos.nombre}</p>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Cédula {detalle.alumnos.cedula}</p>
                </div>
              </div>

              <div style={{ background: "var(--bg)", borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["Fecha", new Date(detalle.fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })],
                  ["Hora inicio", detalle.hora_inicio.slice(0, 5)],
                  ["Duración", `${detalle.cantidad_clases} clase${detalle.cantidad_clases > 1 ? "s" : ""} · ${fmtBloques(detalle.cantidad_clases)}`],
                  ["Firma", detalle.firma_url ? "Registrada" : "Pendiente"],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: label === "Firma" ? (detalle.firma_url ? "var(--green)" : "var(--amber)") : "var(--ink)" }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Ejercicios por bloque */}
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", margin: "0 0 10px" }}>Ejercicios</p>
              {detalleEjs.map((ej, i) => {
                const isSearching = searchBlock === i
                const filteredBanco = searchText.trim()
                  ? BANCO.map(g => ({ ...g, items: g.items.filter(it => it.toLowerCase().includes(searchText.toLowerCase())) })).filter(g => g.items.length > 0)
                  : BANCO
                return (
                  <div key={i} style={{ border: `1px solid ${isSearching ? "var(--green)" : "var(--line)"}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Bloque {i + 1}</span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{bloqueTime(detalle.hora_inicio, i)}</span>
                    </div>
                    {isSearching ? (
                      <div>
                        <input autoFocus value={searchText} onChange={e => setSearchText(e.target.value)}
                          placeholder="Buscar ejercicio…"
                          style={{ width: "100%", boxSizing: "border-box" as const, border: "1px solid var(--green)", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "var(--bg)", color: "var(--ink)", outline: "none" }} />
                        <div style={{ border: "1px solid var(--line)", borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: "auto" as const }}>
                          {filteredBanco.map(g => (
                            <div key={g.cat}>
                              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: "var(--muted)", padding: "5px 10px 2px", background: "var(--bg)", letterSpacing: "0.06em" }}>{g.cat}</div>
                              {g.items.map(item => (
                                <div key={item} onClick={() => selectEj(i, item)}
                                  style={{ fontSize: 13, padding: "8px 10px", borderTop: "1px solid var(--line)", cursor: "pointer", color: "var(--ink)" }}>
                                  {item}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                        <button onClick={() => { setSearchBlock(null); setSearchText("") }}
                          style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", marginTop: 6, padding: 0 }}>
                          Cancelar
                        </button>
                      </div>
                    ) : ej.nombre ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px", borderRadius: 20, background: "var(--green-soft)", color: "var(--green)", border: "1px solid var(--green)", fontWeight: 600 }}>
                          {ej.nombre}
                          <button onClick={() => clearEj(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--green)", fontSize: 15, lineHeight: 1, padding: 0 }}>✕</button>
                        </span>
                        <select
                          value={ej.calificacion ?? ""}
                          onChange={e => {
                            const nuevo = e.target.value ? Number(e.target.value) : null
                            const actual = ej.calificacion
                            if (actual !== null && actual !== undefined && nuevo !== null) {
                              if (!confirm(`¿Cambiar calificación de ${actual} a ${nuevo}?`)) return
                            }
                            setCalificacion(i, nuevo)
                          }}
                          style={{ fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", borderRadius: 8, padding: "4px 6px", background: "var(--bg)", color: ej.calificacion ? "var(--green)" : "var(--muted)", cursor: "pointer", outline: "none" }}
                        >
                          <option value="">—</option>
                          {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div onClick={() => { setSearchBlock(i); setSearchText("") }}
                        style={{ display: "flex", alignItems: "center", gap: 8, border: "1px dashed var(--line)", borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "var(--muted)", fontSize: 13 }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                        Seleccionar ejercicio
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Notas */}
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", margin: "16px 0 10px" }}>Notas</p>

              {notas.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginBottom: 10 }}>Sin notas aún</p>}

              {notas.map(n => {
                const locked = isLocked(n.created_at)
                const editing = editingNotaId === n.id
                return (
                  <div key={n.id} style={{ borderLeft: "2.5px solid var(--green)", paddingLeft: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtNotaDate(n.created_at)}</span>
                      {!locked && !editing && (
                        <button onClick={() => { setEditingNotaId(n.id); setEditingNotaText(n.contenido) }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--muted)", display: "flex", alignItems: "center" }}>
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      )}
                      {locked && <span style={{ fontSize: 10, color: "var(--muted)" }}>bloqueada</span>}
                    </div>
                    {editing ? (
                      <div>
                        <textarea value={editingNotaText} onChange={e => setEditingNotaText(e.target.value)} rows={3}
                          style={{ width: "100%", boxSizing: "border-box" as const, fontSize: 13, border: "1.5px solid var(--green)", borderRadius: 8, padding: 8, background: "var(--bg)", color: "var(--ink)", resize: "none" as const }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button onClick={() => setEditingNotaId(null)} style={{ flex: 1, height: 32, borderRadius: 8, border: "1px solid var(--line)", background: "none", fontSize: 12, cursor: "pointer", color: "var(--ink)" }}>Cancelar</button>
                          <button onClick={() => guardarEditNota(n.id)} style={{ flex: 2, height: 32, borderRadius: 8, border: "none", background: "var(--green)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{ fontSize: 13, color: "var(--ink)", margin: 0, lineHeight: 1.4 }}>{n.contenido}</p>
                    )}
                  </div>
                )
              })}

              <div style={{ marginBottom: 10 }}>
                <textarea value={nuevaNota} onChange={e => setNuevaNota(e.target.value)} placeholder="Añadir nota…" rows={2}
                  style={{ width: "100%", boxSizing: "border-box" as const, fontSize: 13, border: "1px solid var(--line)", borderRadius: 10, padding: 10, background: "var(--bg)", color: "var(--ink)", resize: "none" as const }} />
                {nuevaNota.trim() && (
                  <button onClick={agregarNota} disabled={savingNota}
                    style={{ width: "100%", height: 38, marginTop: 6, borderRadius: 10, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: savingNota ? 0.7 : 1 }}>
                    {savingNota ? "Guardando..." : "Guardar nota"}
                  </button>
                )}
              </div>
            </div>

            <div style={{ padding: "12px 22px 34px", flexShrink: 0, borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {detalle.firma_url
                  ? <button onClick={() => { setFirmaVer(detalle.firma_url!); cerrarDetalle() }}
                      style={{ flex: 1, height: 46, borderRadius: 13, border: "none", background: "var(--green-soft)", color: "var(--green)", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      Ver firma
                    </button>
                  : <button onClick={() => { navigate(`/firma/${detalle.id}`); cerrarDetalle() }}
                      style={{ flex: 1, height: 46, borderRadius: 13, border: "none", background: "var(--amber-soft)", color: "var(--amber)", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      Firmar
                    </button>
                }
                <button onClick={e => { abrirEditar(e, detalle); cerrarDetalle() }}
                  style={{ flex: 1, height: 46, borderRadius: 13, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
                  Editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {firmaVer && (
        <div onClick={() => setFirmaVer(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--paper)", borderRadius: 20, padding: 20, width: "100%", maxWidth: 380 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16 }}>Firma registrada</p>
              <button onClick={() => setFirmaVer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>
            <img src={firmaVer} alt="Firma" style={{ width: "100%", borderRadius: 12, border: "1px solid var(--line)", background: "#fff" }} />
          </div>
        </div>
      )}

      {editando && (
        <div onClick={() => setEditando(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--paper)", borderRadius: "26px 26px 0 0", padding: "10px 22px 34px", width: "100%" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 20px" }} />
            <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 17, marginBottom: 16 }}>Editar clase</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
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
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 12 }}>Clases</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
                <button onClick={() => setEditDur(Math.max(1, editDur - 1))} disabled={editDur <= 1}
                  style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--line)", background: "var(--paper)", fontWeight: 800, fontSize: 22, cursor: editDur <= 1 ? "default" : "pointer", color: editDur <= 1 ? "var(--line)" : "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 32, color: "var(--ink)", minWidth: 32, textAlign: "center" as const }}>{editDur}</span>
                <button onClick={() => setEditDur(editDur + 1)}
                  style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: "var(--green)", fontWeight: 800, fontSize: 22, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
              <p style={{ textAlign: "center" as const, fontSize: 12, color: "var(--muted)", fontWeight: 600, margin: "10px 0 0" }}>= {fmtBloques(editDur)} totales</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditando(null)} style={{ flex: 1, height: 50, borderRadius: 14, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardarEditar} disabled={saving} style={{ flex: 2, height: 50, borderRadius: 14, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      <Nav active="hoy" />
    </div>
  )
}
