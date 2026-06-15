import { useState } from "react"
import { supabase } from "../lib/supabaseClient"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ padding: "60px 22px 40px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--green)", marginBottom: 6 }}>Cuaderno Digital</p>
        <h1 style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 28, lineHeight: 1.2 }}>Bienvenido,<br />instructor</h1>
      </div>
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" required style={{ border: "none", outline: "none", background: "none", fontSize: 16, width: "100%", color: "var(--ink)" }} />
        </div>
        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 16, padding: "14px 16px" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>Contrasena</label>
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" required style={{ border: "none", outline: "none", background: "none", fontSize: 16, width: "100%", color: "var(--ink)" }} />
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 16, height: 54, fontFamily: "Manrope", fontWeight: 800, fontSize: 15, marginTop: 8 }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}