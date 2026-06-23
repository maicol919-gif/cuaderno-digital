import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"

interface Alumno { cedula: string; nombre: string }
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

function fmtFecha(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]
  return `${d} ${months[m-1]} ${y}`
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
  const [seleccionado, setSeleccionado] = useState<Alumno | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showNuevoAlumnoForm, setShowNuevoAlumnoForm] = useState(false)
  const [cantidadClases, setCantidadClases] = useState(1)
  const [fecha, setFecha] = useState(todayDate)
  const [hora, setHora] = useState(roundedTime)
  const [loading, setLoading] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState("")
  const [nuevaCedula, setNuevaCedula] = useState("")
  const [savingAlumno, setSavingAlumno] = useState(false)
  const [errorAlumno, setErrorAlumno] = useState("")
  const [clasesDelDia, setClasesDelDia] = useState<ClaseDelDia[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fechaRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    if (!dropdownOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [dropdownOpen])

  const [newH, newM] = hora.split(":").map(Number)
  const newStartMins = newH * 60 + newM
  const newEndMins = newStartMins + cantidadClases * 45
  const conflictoClase = clasesDelDia.find(c => newStartMins < c.horaFinMins && newEndMins > c.horaInicioMins) ?? null
  const hayConflicto = conflictoClase !== null

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
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
      setErrorAlumno(error.code === "23505" ? "Ya existe un alumno con ese código" : error.message)
      return
    }
    const { data } = await supabase.from("alumnos").select("cedula, nombre").order("nombre")
    if (data) {
      setAlumnos(data)
      const nuevo = data.find(a => a.cedula === nuevaCedula)
      if (nuevo) setSeleccionado(nuevo)
    }
    setNuevoNombre(""); setNuevaCedula(""); setShowNuevoAlumnoForm(false)
  }

  async function registrar() {
    if (!seleccionado) return
    setLoading(true)
    const instructor = JSON.parse(localStorage.getItem("cd_instructor") || "{}")
    await supabase.from("clases").insert({
      instructor_id: instructor.id,
      alumno_cedula: seleccionado.cedula,
      fecha,
      hora_inicio: hora + ":00",
      cantidad_clases: cantidadClases,
    })
    setLoading(false)
    navigate("/")
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
        <div style={{ background: hayConflicto ? "var(--red-soft)" : "var(--paper)", border: `1.5px solid ${hayConflicto ? "var(--red)" : "var(--line)"}`, borderRadius: 14, overflow: "hidden", marginBottom: 10, display: "flex" }}>
          <div style={{ flex: 1, padding: "14px 14px", cursor: "pointer" }} onClick={() => fechaRef.current?.showPicker?.()}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6, pointerEvents: "none" }}>Fecha</label>
            <input ref={fechaRef} type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ display: "none" }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{fmtFecha(fecha)}</div>
          </div>
          <div style={{ width: 1, background: "var(--line)", alignSelf: "stretch" }} />
          <div style={{ flex: 1, padding: "14px 14px" }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: hayConflicto ? "var(--red)" : "var(--muted)", marginBottom: 6 }}>Hora inicio</label>
            <input type="time" step="900" value={hora} onChange={e => setHora(e.target.value)} style={{ border: "none", outline: "none", background: "none", fontSize: 14, fontWeight: 600, color: hayConflicto ? "var(--red)" : "var(--ink)", width: "100%", boxSizing: "border-box" as const }} />
          </div>
        </div>
        {hayConflicto && conflictoClase && (
          <p style={{ fontSize: 11, color: "var(--red)", fontWeight: 600, marginTop: -4, marginBottom: 10, lineHeight: 1.4 }}>
            La clase anterior ({conflictoClase.horaInicio}, {conflictoClase.nombreAlumno}) termina a las {conflictoClase.horaFin}. No puedes registrar antes de esa hora.
          </p>
        )}

        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--muted)" }}>Bloques</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--green)", marginTop: 2 }}>{fmtBloques(cantidadClases)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button onClick={() => setCantidadClases(c => Math.max(1, c - 1))} disabled={cantidadClases <= 1}
              style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid var(--line)", background: "var(--bg)", fontWeight: 800, fontSize: 22, cursor: cantidadClases <= 1 ? "default" : "pointer", color: cantidadClases <= 1 ? "var(--line)" : "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 32, color: "var(--ink)", minWidth: 32, textAlign: "center" as const }}>{cantidadClases}</span>
            <button onClick={() => setCantidadClases(c => c + 1)}
              style={{ width: 40, height: 40, borderRadius: 12, border: "none", background: "var(--green)", fontWeight: 800, fontSize: 22, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          </div>
        </div>

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px" }}>Alumno</p>

        {showNuevoAlumnoForm ? (
          <form onSubmit={guardarNuevoAlumno} style={{ background: "var(--paper)", border: "1.5px solid var(--amber)", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
            <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--amber)", margin: "0 0 12px" }}>Nuevo alumno</p>
            <input required value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre completo"
              style={{ width: "100%", boxSizing: "border-box" as const, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 14, background: "var(--bg)", color: "var(--ink)", outline: "none", marginBottom: 8 }} />
            <input required value={nuevaCedula} onChange={e => setNuevaCedula(e.target.value)} placeholder="Código" inputMode="numeric" pattern="[0-9]*"
              style={{ width: "100%", boxSizing: "border-box" as const, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", fontSize: 14, background: "var(--bg)", color: "var(--ink)", outline: "none", marginBottom: 8 }} />
            {errorAlumno && <p style={{ color: "var(--red, #e53e3e)", fontSize: 12, margin: "0 0 8px" }}>{errorAlumno}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => { setShowNuevoAlumnoForm(false); setNuevoNombre(""); setNuevaCedula(""); setErrorAlumno("") }}
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
          <div ref={dropdownRef} style={{ position: "relative", marginBottom: 10 }}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              style={{
                width: "100%",
                background: "var(--paper)",
                border: `1.5px solid ${seleccionado || dropdownOpen ? "var(--green)" : "var(--line)"}`,
                borderRadius: dropdownOpen ? "14px 14px 0 0" : 14,
                padding: "13px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                textAlign: "left" as const,
              }}
            >
              <span style={{ fontSize: 15, fontWeight: seleccionado ? 600 : 400, color: seleccionado ? "var(--ink)" : "var(--muted)" }}>
                {seleccionado ? seleccionado.nombre : "Seleccionar alumno…"}
              </span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--muted)", transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
            {dropdownOpen && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "var(--paper)",
                border: "1.5px solid var(--green)",
                borderTop: "none",
                borderRadius: "0 0 14px 14px",
                zIndex: 10,
                maxHeight: 280,
                overflowY: "auto" as const,
              }}>
                {alumnos.map((a, i) => (
                  <div
                    key={a.cedula}
                    onClick={() => { setSeleccionado(a); setDropdownOpen(false) }}
                    style={{
                      padding: "13px 16px",
                      borderTop: i === 0 ? "none" : "1px solid var(--line)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: seleccionado?.cedula === a.cedula ? "var(--green-soft)" : "transparent",
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: seleccionado?.cedula === a.cedula ? "var(--green)" : "var(--green-soft)", color: seleccionado?.cedula === a.cedula ? "#fff" : "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                      {initiales(a.nombre)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{a.nombre}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>Código {a.cedula}</div>
                    </div>
                    {seleccionado?.cedula === a.cedula && (
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    )}
                  </div>
                ))}
                <div
                  onClick={() => { setDropdownOpen(false); setShowNuevoAlumnoForm(true) }}
                  style={{
                    padding: "13px 16px",
                    borderTop: "1px solid var(--line)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--amber)",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                  Crear alumno nuevo
                </div>
              </div>
            )}
          </div>
        )}
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
