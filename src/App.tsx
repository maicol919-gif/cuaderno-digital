import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "./lib/supabaseClient"
import type { Session } from "@supabase/supabase-js"
import Hoy from "./pages/Hoy"
import NuevaClase from "./pages/NuevaClase"
import Firma from "./pages/Firma"
import Alumnos from "./pages/Alumnos"
import Resumen from "./pages/Resumen"
import Login from "./pages/Login"

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  return (
    <HashRouter>
      <Routes>
        {!session ? (
          <Route path="*" element={<Login />} />
        ) : (
          <>
            <Route path="/" element={<Hoy />} />
            <Route path="/nueva-clase" element={<NuevaClase />} />
            <Route path="/firma/:claseId" element={<Firma />} />
            <Route path="/alumnos" element={<Alumnos />} />
            <Route path="/resumen" element={<Resumen />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </HashRouter>
  )
}