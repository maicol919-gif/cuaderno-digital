import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"
import Nav from "../components/Nav"

interface Alumno { id: string; nombre: string; codigo: string | null }

export default function Alumnos() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [showForm, setShowForm] = useState(searchParams.get("nuevo") === "1")
  const [nombre, setNombre] = useState("")
  const [codigo, setCodigo] = useState("")
  const [saving, setSaving] = useState(false)

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  async function cargar() {
    const { data } = await supabase.from("alumnos").select("id, nombre, codigo").order("nombre")
    if (data) setAlumnos(data)
  }

  useEffect(() => { cargar() }, [])

  const filtrados = alumnos.filter(a =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.codigo && a.codigo.includes(busqueda))
  )

  async function guardarAlumno(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from("alumnos").insert({ instructor_id: user!.id, nombre, codigo: codigo || null })
    setNombre(""); setCodigo(""); setShowForm(false); setSaving(false)
    cargar()
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div style={{ padding: "30px 22px 16px" }}>
        <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>{alumnos.length} alumnos</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 26 }}>Mis alumnos</h1>
          <button onClick={() => setShowForm(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--green)", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, padding: "0 22px 100px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "12px 16px", marginBottom: 14 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--muted)", flexShrink: 0 }}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar alumno" style={{ border: "none", outline: "none", background: "none", fontSize: 15, width: "100%", color: "var(--ink)" }} />
        </div>

        {filtrados.map((a, i) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 4px", borderBottom: i < filtrados.length - 1 ? "1px solid var(--line)" : "none" }}>
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
      </div>

      {showForm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 100 }}>
          <form onSubmit={guardarAlumno} style={{ background: "var(--paper)", borderRadius: "26px 26px 0 0", padding: "10px 22px 34px", width: "100%" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 20px" }} />
            <h3 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Nuevo alumno</h3>
            <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} required placeholder="Nombre completo" style={{ border: "none", outline: "none", background: "none", fontSize: 16, width: "100%", color: "var(--ink)" }} />
            </div>
            <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>Codigo (opcional)</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="Ej. 6460" style={{ border: "none", outline: "none", background: "none", fontSize: 16, width: "100%", color: "var(--ink)" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, height: 54, borderRadius: 16, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 800, fontSize: 15 }}>Cancelar</button>
              <button type="submit" disabled={saving} style={{ flex: 2, height: 54, borderRadius: 16, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15 }}>{saving ? "Guardando..." : "Guardar alumno"}</button>
            </div>
          </form>
        </div>
      )}

      <Nav active="alumnos" />
    </div>
  )
}
