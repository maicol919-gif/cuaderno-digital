import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"

interface Alumno { cedula: string; nombre: string }

const DURACIONES = [1, 1.5, 2, 3, 4]

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

export default function NuevaClase() {
  const navigate = useNavigate()
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [seleccionado, setSeleccionado] = useState<Alumno | null>(null)
  const [duracion, setDuracion] = useState(1)
  const [fecha, setFecha] = useState(todayDate)
  const [hora, setHora] = useState(roundedTime)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from("alumnos").select("cedula, nombre").order("nombre")
      .then(({ data }) => data && setAlumnos(data))
  }, [])

  const filtrados = alumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    a.cedula.includes(busqueda)
  )

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  function fmtDur(h: number) {
    if (h === Math.floor(h)) return `${h}h`
    return `${Math.floor(h)}h ${Math.round((h - Math.floor(h)) * 60)}m`
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
      duracion_horas: duracion,
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
          <div style={{ background: "var(--paper)", border: "1.5px solid var(--green)", borderRadius: 14, padding: "14px 14px", overflow: "hidden" }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 6 }}>Hora inicio</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ border: "none", outline: "none", background: "none", fontSize: 14, fontWeight: 600, color: "var(--ink)", width: "100%", boxSizing: "border-box" as const }} />
          </div>
        </div>

        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 10 }}>Duración</label>
          <div style={{ display: "flex", gap: 6 }}>
            {DURACIONES.map(d => (
              <button key={d} onClick={() => setDuracion(d)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 12, border: "1px solid", borderColor: d === duracion ? "var(--green)" : "var(--line)", background: d === duracion ? "var(--green)" : "var(--paper)", color: d === duracion ? "#fff" : "var(--muted)", cursor: "pointer" }}>
                {fmtDur(d)}
              </button>
            ))}
          </div>
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

        <div onClick={() => navigate("/alumnos?nuevo=1")}
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--amber-soft)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>+</div>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Añadir alumno nuevo</div>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, padding: "12px 22px 28px", background: "var(--bg)", borderTop: seleccionado ? "1px solid var(--line)" : "none" }}>
        {seleccionado && (
          <button onClick={registrar} disabled={loading}
            style={{ width: "100%", height: 52, borderRadius: 16, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Registrando..." : `Registrar clase — ${seleccionado.nombre.split(" ")[0]}`}
          </button>
        )}
      </div>
    </div>
  )
}
