import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import SignaturePad from "signature_pad"
import { supabase } from "../lib/supabaseClient"

interface ClaseInfo {
  hora_inicio: string
  alumnos: { nombre: string }
}

export default function Firma() {
  const { claseId } = useParams<{ claseId: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  const [clase, setClase] = useState<ClaseInfo | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from("clases").select("hora_inicio, alumnos(nombre)").eq("id", claseId!).single()
      .then(({ data }) => data && setClase(data as unknown as ClaseInfo))
  }, [claseId])

  useEffect(() => {
    if (!canvasRef.current) return
    padRef.current = new SignaturePad(canvasRef.current, { penColor: "#1F2B24" })
    function resize() {
      const canvas = canvasRef.current!
      const ratio = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * ratio
      canvas.height = rect.height * ratio
      canvas.getContext("2d")!.scale(ratio, ratio)
      padRef.current!.clear()
    }
    resize()
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  async function aceptarFirma() {
    if (!padRef.current || padRef.current.isEmpty()) return
    setSaving(true)
    const dataUrl = padRef.current.toDataURL("image/png")
    const blob = await (await fetch(dataUrl)).blob()
    const fileName = `firmas/${claseId}.png`
    const { error: upErr } = await supabase.storage.from("firmas").upload(fileName, blob, { contentType: "image/png", upsert: true })
    if (upErr) { alert("Error subiendo firma: " + upErr.message); setSaving(false); return }
    const { data: { publicUrl } } = supabase.storage.from("firmas").getPublicUrl(fileName)
    await supabase.from("clases").update({ firma_url: publicUrl }).eq("id", claseId!)
    navigate("/", { state: { reload: Date.now() } })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100dvh", padding: "30px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--paper)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <h2 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18 }}>Firma del alumno</h2>
      </div>

      {clase && (
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px", marginBottom: 16, flexShrink: 0 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>Clase registrada</label>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{clase.alumnos.nombre} - {clase.hora_inicio.slice(0, 5)}</div>
        </div>
      )}

      <div style={{ flex: 1, border: "2px dashed var(--line)", borderRadius: 18, background: "var(--paper)", position: "relative", minHeight: 200 }}>
        <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", touchAction: "none", borderRadius: 18 }} />
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--muted)", margin: "12px 0 16px" }}>
        Pide a tu alumno que firme aqui con el dedo.
      </p>

      <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
        <button onClick={() => padRef.current?.clear()}
          style={{ flex: 1, height: 54, borderRadius: 16, border: "1px solid var(--line)", background: "var(--paper)", fontFamily: "Manrope", fontWeight: 800, fontSize: 15 }}>
          Borrar
        </button>
        <button onClick={aceptarFirma} disabled={saving}
          style={{ flex: 2, height: 54, borderRadius: 16, border: "none", background: "var(--green)", color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15 }}>
          {saving ? "Guardando..." : "Aceptar firma"}
        </button>
      </div>
    </div>
  )
}
