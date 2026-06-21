import { useState, useEffect, useRef } from "react"
import { supabase } from "../lib/supabaseClient"

export default function Login({
  onLogin,
  initialStep = "cedula",
  initialCedula = "",
}: {
  onLogin: (instructor: { id: string; nombre: string; cedula: string; academia: string | null }) => void
  initialStep?: "cedula" | "pin"
  initialCedula?: string
}) {
  const [cedula, setCedula] = useState(initialCedula)
  const [pin, setPin] = useState("")
  const [step, setStep] = useState<"cedula" | "pin">(initialStep)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const stepRef = useRef(step)
  const cedulaRef = useRef(cedula)
  const pinRef = useRef(pin)
  const confirmCedulaRef = useRef<() => void>(() => {})
  stepRef.current = step
  cedulaRef.current = cedula
  pinRef.current = pin

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") pressKey(e.key)
      else if (e.key === "Backspace") pressKey("⌫")
      else if (e.key === "Enter") {
        if (stepRef.current === "cedula") confirmCedulaRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function pressKey(k: string) {
    setError("")
    if (stepRef.current === "cedula") {
      if (k === "⌫") { setCedula(c => c.slice(0, -1)); return }
      if (cedulaRef.current.length >= 12) return
      setCedula(c => c + k)
    } else {
      if (k === "⌫") { setPin(p => p.slice(0, -1)); return }
      if (pinRef.current.length >= 4) return
      const next = pinRef.current + k
      setPin(next)
      if (next.length === 4) setTimeout(() => verify(cedulaRef.current, next), 80)
    }
  }

  async function confirmCedula() {
    const ced = cedulaRef.current
    setLoading(true)
    const { data, error: err } = await supabase
      .from("instructores")
      .select("cedula")
      .eq("cedula", ced)
      .eq("activo", true)
      .maybeSingle()
    setLoading(false)
    if (err || !data) {
      setError("Cédula no reconocida")
      setCedula("")
      setPin("")
      setStep("cedula")
    } else {
      setStep("pin")
    }
  }
  confirmCedulaRef.current = confirmCedula

  async function verify(ced: string, p: string) {
    setLoading(true)
    const { data, error: err } = await supabase
      .from("instructores")
      .select("id, nombre, cedula, academia")
      .eq("cedula", ced)
      .eq("pin", p)
      .eq("activo", true)
      .maybeSingle()
    setLoading(false)
    if (err || !data) {
      setError("PIN incorrecto")
      setPin("")
    } else {
      localStorage.setItem("cd_instructor", JSON.stringify(data))
      localStorage.setItem("cd_last_activity", Date.now().toString())
      onLogin(data)
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#1A2620", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
      <div style={{ width: "100%", maxWidth: 340 }}>

        <div style={{ textAlign: "center", paddingBottom: 32 }}>
          <p style={{ fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#4A9E6F", marginBottom: 14 }}>Cuaderno Digital</p>
          <h1 style={{ fontFamily: "Manrope, sans-serif", fontSize: 30, fontWeight: 800, color: "#F0EDE6", lineHeight: 1.15, margin: 0 }}>
            Bienvenido,<br />instructor
          </h1>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
          <div style={{ background: step === "cedula" ? "#243029" : "#1E2B23", border: step === "cedula" ? "1.5px solid #2F6F4F" : "1.5px solid #2A3830", borderRadius: 16, padding: "16px 18px" }}>
            <p style={{ fontFamily: "Manrope, sans-serif", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A7A67", marginBottom: 8 }}>Cédula / DNI</p>
            <p style={{ fontFamily: "Manrope, sans-serif", fontSize: 17, fontWeight: 600, color: cedula ? "#F0EDE6" : "#3A5244", margin: 0, letterSpacing: "0.04em", minHeight: 24 }}>
              {cedula || "···"}
            </p>
            {step === "pin" && (
              <button
                onClick={() => { setStep("cedula"); setCedula(""); setPin(""); setError("") }}
                style={{ background: "none", border: "none", color: "#4A9E6F", fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0, marginTop: 4 }}
              >
                Cambiar
              </button>
            )}
          </div>

          <div style={{ background: step === "pin" ? "#243029" : "#1E2B23", border: step === "pin" ? "1.5px solid #2F6F4F" : "1.5px solid #2A3830", borderRadius: 16, padding: "16px 18px" }}>
            <p style={{ fontFamily: "Manrope, sans-serif", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#5A7A67", marginBottom: 12 }}>PIN</p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: i < pin.length ? "#4A9E6F" : "#2E3F35", border: i < pin.length ? "none" : "1.5px solid #3A5244" }} />
              ))}
            </div>
          </div>
        </div>

        {error && <p style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, color: "#E07070", textAlign: "center", margin: "10px 0 0" }}>{error}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 9, marginTop: 18 }}>
          {["1","2","3","4","5","6","7","8","9","⌫","0","✓"].map(k => {
            const isConfirm = k === "✓"
            const isBack = k === "⌫"
            return (
              <button
                key={k}
                onClick={() => isConfirm ? (step === "cedula" ? confirmCedula() : null) : pressKey(k)}
                disabled={loading}
                style={{
                  background: isConfirm ? "#2F6F4F" : "#243029",
                  border: "none",
                  borderRadius: 14,
                  height: 58,
                  fontFamily: "Manrope, sans-serif",
                  fontSize: isBack ? 18 : isConfirm ? 20 : 22,
                  fontWeight: isBack || isConfirm ? 400 : 700,
                  color: isBack ? "#5A7A67" : "#F0EDE6",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {isConfirm && loading ? "..." : k}
              </button>
            )
          })}
        </div>

        <p style={{ fontFamily: "Manrope, sans-serif", fontSize: 12, color: "#3A5244", textAlign: "center", marginTop: 20 }}>
          {step === "cedula" ? "Ingresa tu cédula y presiona ✓" : "Ingresa tu PIN de 4 dígitos"}
        </p>

      </div>
    </div>
  )
}
