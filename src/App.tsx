import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { supabase } from "./lib/supabaseClient"
import Hoy from "./pages/Hoy"
import NuevaClase from "./pages/NuevaClase"
import Firma from "./pages/Firma"
import Alumnos from "./pages/Alumnos"
import Ficha from "./pages/Ficha"
import Resumen from "./pages/Resumen"
import Login from "./pages/Login"

type Instructor = { id: string; nombre: string; cedula: string; academia: string | null }

const SESSION_TIMEOUT = 10_800_000

type InitState =
  | { instructor: Instructor; expiredCedula: null }
  | { instructor: null; expiredCedula: string | null }

function getInitialState(): InitState {
  try {
    const saved = localStorage.getItem("cd_instructor")
    if (!saved) return { instructor: null, expiredCedula: null }
    const inst: Instructor = JSON.parse(saved)
    const lastActivity = parseInt(localStorage.getItem("cd_last_activity") || "0", 10)
    if (lastActivity && Date.now() - lastActivity > SESSION_TIMEOUT) {
      supabase.auth.signOut()
      localStorage.removeItem("cd_last_activity")
      return { instructor: null, expiredCedula: inst.cedula }
    }
    return { instructor: inst, expiredCedula: null }
  } catch { return { instructor: null, expiredCedula: null } }
}

export default function App() {
  const initState = getInitialState()
  const [instructor, setInstructor] = useState<Instructor | null>(initState.instructor)
  const [expiredCedula] = useState<string | null>(initState.expiredCedula)

  const lastThrottle = useRef(0)
  useEffect(() => {
    function onActivity() {
      const now = Date.now()
      if (now - lastThrottle.current < 60000) return
      lastThrottle.current = now
      localStorage.setItem("cd_last_activity", now.toString())
    }
    window.addEventListener("click", onActivity)
    window.addEventListener("touchstart", onActivity)
    return () => {
      window.removeEventListener("click", onActivity)
      window.removeEventListener("touchstart", onActivity)
    }
  }, [])

  if (!instructor) return (
    <Login
      onLogin={setInstructor}
      initialStep={expiredCedula ? "pin" : "cedula"}
      initialCedula={expiredCedula ?? ""}
    />
  )

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Hoy />} />
        <Route path="/nueva-clase" element={<NuevaClase />} />
        <Route path="/firma/:claseId" element={<Firma />} />
        <Route path="/alumnos" element={<Alumnos />} />
        <Route path="/ficha/:cedula" element={<Ficha />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  )
}
