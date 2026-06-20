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

function fmtNotaDate(isoStr: string) {
  const d = new Date(isoStr)
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

function initiales(n: string) {
  return n.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase()
}

function fmtHTotal(h: number) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return mm > 0 ? `${hh}h${mm}` : `${hh}h`
}

export default function Ficha() {
  const { cedula } = useParams<{ cedula: string }>()
  const navigate = useNavigate()
  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [clases, setClases] = useState<ClaseFicha[]>([])
  const [notasPorClase, setNotasPorClase] = useState<Record<string, Nota[]>>({})
  const [loading, setLoading] = useState(true)

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
        setClases(cls as ClaseFicha[])
        const ids = (cls as ClaseFicha[]).map(c => c.id)
        const { data: nts } = await supabase
          .from("notas")
          .select("id, clase_id, contenido, created_at")
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

  const totalHoras = clases.reduce((s, c) => s + c.cantidad_clases * 45 / 60, 0)
  const totalNotas = Object.values(notasPorClase).flat().length

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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--green-soft)", color: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
              {initiales(alumno.nombre)}
            </div>
            <div>
              <h2 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18, margin: 0 }}>{alumno.nombre}</h2>
              <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>Cédula {alumno.cedula}</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: "0 22px 100px", overflowY: "auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            { n: clases.length, l: "clases" },
            { n: fmtHTotal(totalHoras), l: "horas" },
            { n: totalNotas, l: "notas" },
          ].map(s => (
            <div key={s.l} style={{ flex: 1, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 20, color: "var(--ink)" }}>{s.n}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 10px" }}>Historial</p>

        {clases.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", marginTop: 40 }}>Sin clases registradas</p>
        )}

        {clases.map(c => {
          const notas = notasPorClase[c.id] || []
          const ejs = c.ejercicios || []
          return (
            <div key={c.id} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ejs.length > 0 || notas.length > 0 ? 10 : 0 }}>
                <div>
                  <span style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 14, color: "var(--green)" }}>{fmtFecha(c.fecha)}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{c.hora_inicio.slice(0, 5)} · {c.cantidad_clases} clase{c.cantidad_clases > 1 ? "s" : ""} · {fmtDur(c.cantidad_clases * 45 / 60)}</span>
                </div>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: c.firma_url ? "var(--green-soft)" : "var(--amber-soft)", color: c.firma_url ? "var(--green)" : "var(--amber)", flexShrink: 0 }}>
                  {c.firma_url
                    ? <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    : <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                  }
                </div>
              </div>

              {ejs.some(e => e.nombre) && (
                <div style={{ marginBottom: notas.length > 0 ? 10 : 0 }}>
                  {ejs.map((ej, i) => ej.nombre ? (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "var(--muted)", minWidth: 16 }}>B{i + 1}</span>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: "var(--green-soft)", color: "var(--green)", border: "1px solid var(--green)", fontWeight: 600 }}>{ej.nombre}</span>
                    </div>
                  ) : null)}
                </div>
              )}

              {ejs.length === 0 && notas.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", margin: 0 }}>Sin ejercicios ni notas</p>
              )}

              {notas.map(n => (
                <div key={n.id} style={{ borderLeft: "2.5px solid var(--green)", paddingLeft: 10, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>{fmtNotaDate(n.created_at)}</div>
                  <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.4 }}>{n.contenido}</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <Nav active="alumnos" />
    </div>
  )
}
