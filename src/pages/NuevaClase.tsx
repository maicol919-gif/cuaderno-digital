import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"

interface Alumno { id: string; nombre: string; codigo: string | null }

const DURACIONES = [1, 1.5, 2, 3, 4]

export default function NuevaClase() {
  const navigate = useNavigate()
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [duracion, setDuracion] = useState(1)
  const [loading, setLoading] = useState(false)

  const ahora = new Date()
  const horaLabel = ahora.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  const hora = ahora.toTimeString().slice(0, 5)
  const fecha = ahora.toISOString().split("T")[0]

  useEffect(() => {
    supabase.from("alumnos").select("id, nombre, codigo").order("nombre")
      .then(({ data }) => data && setAlumnos(data))
  }, [])

  const filtrados = alumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.codigo && a.codigo.includes(busqueda))
  )

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  function fmtDur(h: number) {
    if (h === Math.floor(h)) return `${h}h`
    return `${Math.floor(h)}h ${Math.round((h - Math.floor(h)) * 60)}m`
  }

  async function seleccionarAlumno(alumno: Alumno) {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from("clases").insert({
      instructor_id: user!.id,
      alumno_id: alumno.id,
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

      <div style={{ flex: 1, padding: "0 22px 40px", overflowY: "auto" }}>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>Hora</label>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{horaLabel} — ahora mismo</div>
        </div>

        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 10 }}>Duracion</label>
          <div style={{ display: "flex", gap: 8 }}>
            {DURACIONES.map(d => (
              <button key={d} onClick={() => setDuracion(d)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 700, fontSize: 13, border: "1px solid", borderColor: d === duracion ? "var(--green)" : "var(--line)", background: d === duracion ? "var(--green)" : "var(--paper)", color: d === duracion ? "#fff" : "var(--muted)" }}>
                {fmtDur(d)}
              </button>
            ))}
          </div>
        </div>

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "18px 0 10px" }}>Alumno</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "12px 16px", marginBottom: 14 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--muted)", flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o codigo" style={{ border: "none", outline: "none", background: "none", fontSize: 15, width: "100%", color: "var(--ink)" }} />
        </div>

        {filtrados.map(a => (
          <div key={a.id} onClick={() => !loading && seleccionarAlumno(a)}
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", borderBottom: "1px solid var(--line)", cursor: "pointer", opacity: loading ? 0.5 : 1 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
              {initiales(a.nombre)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{a.nombre}</div>
              {a.codigo && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>Codigo {a.codigo}</div>}
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--muted)" }}><path d="M9 6l6 6-6 6"/></svg>
          </div>
        ))}

        <div onClick={() => navigate("/alumnos?nuevo=1")}
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", cursor: "pointer" }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--amber-soft)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 20, flexShrink: 0 }}>+</div>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>Anadir alumno nuevo</div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--muted)" }}><path d="M9 6l6 6-6 6"/></svg>
        </div>
      </div>
    </div>
  )
}