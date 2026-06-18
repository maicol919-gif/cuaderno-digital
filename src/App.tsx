import { HashRouter, Routes, Route, Navigate } from "react-router-dom"
import { useState } from "react"
import Hoy from "./pages/Hoy"
import NuevaClase from "./pages/NuevaClase"
import Firma from "./pages/Firma"
import Alumnos from "./pages/Alumnos"
import Resumen from "./pages/Resumen"
import Login from "./pages/Login"

type Instructor = { id: string; nombre: string; cedula: string; academia: string | null }

function getSavedInstructor(): Instructor | null {
  try { return JSON.parse(localStorage.getItem("cd_instructor") || "null") }
  catch { return null }
}

export default function App() {
  const [instructor, setInstructor] = useState<Instructor | null>(getSavedInstructor)

  if (!instructor) return <Login onLogin={setInstructor} />

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Hoy />} />
        <Route path="/nueva-clase" element={<NuevaClase />} />
        <Route path="/firma/:claseId" element={<Firma />} />
        <Route path="/alumnos" element={<Alumnos />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </HashRouter>
  )
}
