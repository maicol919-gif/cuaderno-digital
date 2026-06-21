import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"
import { BANCO } from "../lib/ejercicios"

interface Alumno { cedula: string; nombre: string }
interface Ejercicio { nombre: string; calificacion: number | null }
interface ClaseDelDia { horaInicio: string; horaFin: string; horaInicioMins: number; horaFinMins: number; nombreAlumno: string }

function roundedTime() {
  const now = new Date()
  const mins = now.getMinutes()
  const roundedMins = mins < 15 ? 0 : mins < 45 ? 30 : 0
  const h = new Date(now)
  h.setMinutes(roundedMins, 0, 0)
  if (mins >= 45) h.setHours(h.getHours() + 1)
  return h.toTimeString().slice(0, 5)
}

function todayDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
}

function fmtBloques(n: number) {
  const mins = n * 45
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export default function NuevaClase() {
  const navigate = useNavigate()
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [seleccionado, setSeleccionado] = useState<Alumno | null>(null)
  const [cantidadClases, setCantidadClases] = useState(1)
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([{ nombre: "", calificacion: null }])
  const [notaTexto, setNotaTexto] = useState("")
  const [fecha, setFecha] = useState(todayDate)
  const [hora, setHora] = useState(roundedTime)
  const [loading, setLoading] = useState(false)
  const [searchBlock, setSearchBlock] = useState<number | null>(null)
  const [searchText, setSearchText] = useState("")
  const [showNuevoAlumno, setShowNuevoAlumno] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevaCedula, setNuevaCedula] = useState("")
  const [savingAlumno, setSavingAlumno] = useState(false)
  const [errorAlumno, setErrorAlumno] = useState("")
  const [clasesDelDia, setClasesDelDia] = useState<ClaseDelDia[]>([])

  useEffect(() => {
    supabase.from("alumnos").select("cedula, nombre").order("nombre")
      .then(({ data }) => data && setAlumnos(data))
  }, [])

  useEffect(() => {
    const instructor = JSON.parse(localStorage.getItem("cd_instructor") || "{}")
    if (!instructor.id || !fecha) { setClasesDelDia([]); return }
    supabase
      .from("clases")
      .select("hora_inicio, cantidad_clases, alumno_cedula")
      .eq("instructor_id", instructor.id)
      .eq("fecha", fecha)
      .then(({ data }) => {
        if (!data || data.length === 0) { setClasesDelDia([]); return }
        setClasesDelDia(data.map(c => {
          const [h, m] = c.hora_inicio.slice(0, 5).split(":").map(Number)
          const startMins = h * 60 + m
          const endMins = startMins + (c.cantidad_clases ?? 1) * 45
          const pad = (n: number) => n.toString().padStart(2, "0")
          return {
            horaInicio: c.hora_inicio.slice(0, 5),
            horaFin: `${pad(Math.floor(endMins / 60))}:${pad(endMins % 60)}`,
            horaInicioMins: startMins,
            horaFinMins: endMins,
            nombreAlumno: alumnos.find(a => a.cedula === c.alumno_cedula)?.nombre ?? "Alumno",
          }
        }))
      })
  }, [fecha])

  const [newH, newM] = hora.split(":").map(Number)
  const newStartMins = newH * 60 + newM
  const newEndMins = newStartMins + cantidadClases * 45
  const conflictoClase = clasesDelDia.find(c => newStartMins < c.horaFinMins && newEndMins > c.horaInicioMins) ?? null
  const hayConflicto = conflictoClase !== null

  const filtrados = alumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.cedula.includes(busqueda)
  )

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  function setCantidad(n: number) {
    const next = Math.max(1, n)
    setCantidadClases(next)
    setEjercicios(prev => {
      const arr = [...prev]
      while (arr.length < next) arr.push({ nombre: "", calificacion: null })
      return arr.slice(0, next)
    })
  }

  function selectEj(blockIdx: number, nombre: string) {
    const next = [...ejercicios]
    next[blockIdx] = { ...next[blockIdx], nombre }
    setEjercicios(next)
    setSearchBlock(null)
    setSearchText("")
  }

  function clearEj(blockIdx: number) {
    const next = [...ejercicios]
    next[blockIdx] = { nombre: "", calificacion: next[blockIdx].calificacion }
    setEjercicios(next)
  }

  function setCalif(blockIdx: number, valor: number | null) {
    const next = [...ejercicios]
    next[blockIdx] = { ...next[blockIdx], calificacion: valor }
    setEjercicios(next)
  }

  async function guardarNuevoAlumno(e: React.FormEvent) {
    e.preventDefault()
    setErrorAlumno("")
    setSavingAlumno(true)
    const instructor = JSON.parse(localStorage.getItem("cd_instructor") || "{}")
    const { error } = await supabase.from("alumnos").insert({
      instructor_id: instructor.id,
      cedula: nuevaCedula,
      nombre: nuevoNombre,
    })
    setSavingAlumno(false)
    if (error) {
      setErrorAlumno(error.code === "23505" ? "Ya existe un alumno con esa cédula" : error.message)
      return
    }
    const { data } = await supabase.from("alumnos").select("cedula, nombre").order("nombre")
    if (data) {
      setAlumnos(data)
      const nuevo = data.find(a => a.cedula === nuevaCedula)
      if (nuevo) setSeleccionado(nuevo)
    }
    setNuevoNombre(""); setNuevaCedula(""); setShowNuevoAlumno(false)
  }

  async function registrar() {
    if (!seleccionado) return
    setLoading(true)
    const instructor = JSON.parse(localStorage.getItem("cd_instructor") || "{}")
    const { data, error } = await supabase.from("clases").insert({
      instructor_id: instructor.id,
      alumno_cedula: seleccionado.cedula,
      fecha,
      hora_inicio: hora + ":00",
      cantidad_clases: cantidadClases,
      ejercicios,
      notas: notaTexto.trim() || null,
    }).select("id").single()
    if (!error && data) navigate(`/firma/${data.id}`)
    setLoading(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div style={{ padding: "30px 22px 14px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <button onClick={() => navigate("/")} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <h2 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18 }}>Nueva clase</h2>
      </div>

      <div style={{ flex: 1, padding: "0 22px 100px", overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 14px", overflow: "hidden" }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6 }}>Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ border: "none", outline: "none", background: "none", fontSize: 14, fontWeight: 600, color: "var(--ink)", width: "100%", boxSizing: "border-box" as const }} />
          </div>
          <div>
            <div style={{ background: hayConflicto ? "var(--red-soft)" : "var(--paper)", border: `1.5px solid ${hayConflicto ? "var(--red)" : "var(--green)"}`, borderRadius: 14, padding: "14px 14px", overflow: "hidden" }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: hayConflicto ? "var(--red)" : "var(--muted)", marginBottom: 6 }}>Hora inicio</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ border: "none", outline: "none", background: "none", fontSize: 14, fontWeight: 600, color: hayConflicto ? "var(--red)" : "var(--ink)", width: "100%", boxSizing: "border-box" as const }} />
            </div>
            {hayConflicto && conflictoClase && (
              <p style={{ fontSize: 11, color: "var(--red)", fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>
                La clase anterior ({conflictoClase.horaInicio}, {conflictoClase.nombreAlumno}) termina a las {conflictoClase.horaFin}. No puedes registrar antes de esa hora.
              </p>
            )}
          </div>
        </div>

        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 12 }}>Clases</label>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
            <button onClick={() => setCantidad(cantidadClases - 1)} disabled={cantidadClases <= 1}
              style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg)", fontWeight: 800, fontSize: 22, cursor: cantidadClases <= 1 ? "default" : "pointer", color: cantidadClases <= 1 ? "var(--line)" : "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 32, color: "var(--ink)", minWidth: 32, textAlign: "center" as const }}>{cantidadClases}</span>
            <button onClick={() => setCantidad(cantidadClases + 1)}
              style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: "var(--green)", fontWeight: 800, fontSize: 22, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
          <p style={{ textAlign: "center" as const, fontSize: 12, color: "var(--muted)", fontWeight: 600, margin: "10px 0 0" }}>= {fmtBloques(cantidadClases)} totales</p>
        </div>

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px" }}>Alumno</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 16px", marginBottom: 10 }}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--muted)", flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o cédula" style={{ border: "none", outline: "none", background: "none", fontSize: 15, width: "100%", color: "var(--ink)" }} />
        </div>

        {filtrados.map(a => {
          const sel = seleccionado?.cedula === a.cedula
          return (
            <div key={a.cedula} onClick={() => setSeleccionado(sel ? null : a)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 14, marginBottom: 6, cursor: "pointer", background: sel ? "var(--green-soft)" : "transparent", border: sel ? "1.5px solid var(--green)" : "1.5px solid transparent" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: sel ? "var(--green)" : "var(--green-soft)", color: sel ? "#fff" : "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                {initiales(a.nombre)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{a.nombre}</div>
                <div style={{ fontSize: 11, color: sel ? "var(--green)" : "var(--muted)", marginTop: 1 }}>Cédula {a.cedula}</div>
              </div>
              {sel && <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
          )
        })}

        {showNuevoAlumno ? (
          <form onSubmit={guardarNuevoAlumno} style={{ background: "var(--paper)", border: "1.5px solid var(--amber)", borderRadius: 14, padding: "14px 16px", marginTop: 6 }}>
            <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--amber)", margin: "0 0 12px" }}>Nuevo alumno</p>
            <input required value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre completo"
              style={{ width: "100%", boxSizing: "border-box" as const, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 14, background: "var(--bg)", color: "var(--ink)", outline: "none", marginBottom: 8 }} />
            <input required value={nuevaCedula} onChange={e => setNuevaCedula(e.target.value)} placeholder="Cédula"
              style={{ width: "100%", boxSizing: "border-box" as const, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 14, background: "var(--bg)", color: "var(--ink)", outline: "none", marginBottom: 8 }} />
            {errorAlumno && <p style={{ color: "var(--red, #e53e3e)", fontSize: 12, margin: "0 0 8px" }}>{errorAlumno}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { setShowNuevoAlumno(false); setNuevoNombre(""); setNuevaCedula(""); setErrorAlumno("") }}
                style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--muted)" }}>
                Cancelar
              </button>
              <button type="submit" disabled={savingAlumno}
                style={{ flex: 1, height: 40, borderRadius: 10, border: "none", background: "var(--amber)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: savingAlumno ? 0.7 : 1 }}>
                {savingAlumno ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        ) : (
          <div onClick={() => setShowNuevoAlumno(true)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", cursor: "pointer" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--amber-soft)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>+</div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Añadir alumno nuevo</div>
          </div>
        )}

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "20px 0 10px" }}>Ejercicios</p>
        {ejercicios.map((ej, i) => {
          const isSearching = searchBlock === i
          const filteredBanco = searchText.trim()
            ? BANCO.map(g => ({ ...g, items: g.items.filter(it => it.toLowerCase().includes(searchText.toLowerCase())) })).filter(g => g.items.length > 0)
            : BANCO
          return (
            <div key={i} style={{ border: `1px solid ${isSearching ? "var(--green)" : "var(--line)"}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", display: "block", marginBottom: 8 }}>Bloque {i + 1}</span>
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
                  <select value={ej.calificacion ?? ""} onChange={e => setCalif(i, e.target.value ? Number(e.target.value) : null)}
                    style={{ fontSize: 12, fontWeight: 600, border: "1px solid var(--line)", borderRadius: 8, padding: "4px 6px", background: "var(--bg)", color: ej.calificacion ? "var(--green)" : "var(--muted)", cursor: "pointer", outline: "none" }}>
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

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "20px 0 8px" }}>
          Notas <span style={{ fontWeight: 500, textTransform: "none" as const, fontSize: 10, letterSpacing: 0 }}>(opcional)</span>
        </p>
        <textarea value={notaTexto} onChange={e => setNotaTexto(e.target.value)}
          placeholder="Observaciones de la clase…" rows={3}
          style={{ width: "100%", boxSizing: "border-box" as const, fontSize: 13, border: "1px solid var(--line)", borderRadius: 12, padding: "10px 14px", background: "var(--paper)", color: "var(--ink)", resize: "none" as const, outline: "none", fontFamily: "inherit" }} />
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 22px 28px", background: "var(--bg)", borderTop: seleccionado ? "1px solid var(--line)" : "none" }}>
        {seleccionado && (
          <button onClick={registrar} disabled={loading || hayConflicto}
            style={{ width: "100%", height: 52, borderRadius: 16, border: "none", background: (loading || hayConflicto) ? "var(--line)" : "var(--green)", color: (loading || hayConflicto) ? "var(--muted)" : "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: (loading || hayConflicto) ? "default" : "pointer", opacity: 1 }}>
            {loading ? "Registrando..." : `Registrar clase — ${seleccionado.nombre.split(" ")[0]}`}
          </button>
        )}
      </div>
    </div>
  )
}
