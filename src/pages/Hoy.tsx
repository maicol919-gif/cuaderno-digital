import { useEffect, useState, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { supabase } from "../lib/supabaseClient"
import Nav from "../components/Nav"

function logout() {
  localStorage.removeItem("cd_instructor")
  window.location.href = "/"
}

const DURACIONES = [1, 1.5, 2, 3, 4]

interface Clase {
  id: string
  fecha: string
  hora_inicio: string
  duracion_horas: number
  firma_url: string | null
  alumnos: { nombre: string; cedula: string }
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
  const dateInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const esHoy = fecha === hoy
  const titulo = esHoy ? "Hoy" : new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long" })
  const fechaLabel = new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })

  function cargar(f = fecha) {
    supabase
      .from("clases")
      .select("id, fecha, hora_inicio, duracion_horas, firma_url, alumnos:alumno_cedula(nombre, cedula)")
      .eq("fecha", f)
      .order("hora_inicio")
      .then(({ data }) => data && setClases(data as unknown as Clase[]))
  }

  useEffect(() => { cargar(fecha) }, [fecha, location])

  function fmtDur(h: number) {
    if (h === Math.floor(h)) return `${h}h`
    const horas = Math.floor(h)
    const mins = Math.round((h - horas) * 60)
    return horas > 0 ? `${horas}h ${mins}m` : `${mins}m`
  }

  function initiales(n: string) {
    return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
  }

  function abrirEditar(e: React.MouseEvent, c: Clase) {
    e.stopPropagation()
    setEditando(c)
    setEditDur(c.duracion_horas)
    setEditFecha(c.fecha ?? fecha)
    setEditHora(c.hora_inicio.slice(0, 5))
  }

  async function guardarEditar() {
    if (!editando) return
    setSaving(true)
    await supabase.from("clases").update({ duracion_horas: editDur, fecha: editFecha, hora_inicio: editHora + ":00" }).eq("id", editando.id)
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
            onClick={() => setDetalle(c)}
            style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 10, cursor: "pointer" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 15, color: "var(--green)", width: 60, flexShrink: 0, lineHeight: 1.2 }}>
              {c.hora_inicio.slice(0, 5)}
              <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{fmtDur(c.duracion_horas)}</span>
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
        <div onClick={() => setDetalle(null)} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-end", zIndex: 200 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--paper)", borderRadius: "26px 26px 0 0", padding: "10px 22px 34px", width: "100%" }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--line)", margin: "6px auto 16px" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                {initiales(detalle.alumnos.nombre)}
              </div>
              <div>
                <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: "var(--ink)", margin: 0 }}>{detalle.alumnos.nombre}</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Cédula {detalle.alumnos.cedula}</p>
              </div>
            </div>
            <div style={{ background: "var(--bg)", borderRadius: 14, padding: "12px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Fecha", new Date(detalle.fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })],
                ["Hora inicio", detalle.hora_inicio.slice(0, 5)],
                ["Duración", fmtDur(detalle.duracion_horas)],
                ["Firma", detalle.firma_url ? "Registrada" : "Pendiente"],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: label === "Firma" ? (detalle.firma_url ? "var(--green)" : "var(--amber)") : "var(--ink)" }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {detalle.firma_url
                ? <button onClick={() => { setFirmaVer(detalle.firma_url!); setDetalle(null) }}
                    style={{ flex: 1, height: 46, borderRadius: 13, border: "none", background: "var(--green-soft)", color: "var(--green)", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Ver firma
                  </button>
                : <button onClick={() => { navigate(`/firma/${detalle.id}`); setDetalle(null) }}
                    style={{ flex: 1, height: 46, borderRadius: 13, border: "none", background: "var(--amber-soft)", color: "var(--amber)", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Firmar
                  </button>
              }
              <button onClick={e => { abrirEditar(e, detalle); setDetalle(null) }}
                style={{ flex: 1, height: 46, borderRadius: 13, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 700, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
                Editar
              </button>
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
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: 10 }}>Duración</p>
              <div style={{ display: "flex", gap: 8 }}>
                {DURACIONES.map(d => (
                  <button key={d} onClick={() => setEditDur(d)}
                    style={{ flex: 1, padding: "10px 0", borderRadius: 12, fontWeight: 700, fontSize: 13, border: "1px solid", borderColor: d === editDur ? "var(--green)" : "var(--line)", background: d === editDur ? "var(--green)" : "var(--paper)", color: d === editDur ? "#fff" : "var(--muted)", cursor: "pointer" }}>
                    {fmtDur(d)}
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

      <Nav active="hoy" />
    </div>
  )
}
