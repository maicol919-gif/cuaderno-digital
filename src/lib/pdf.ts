import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

export interface ClaseReporte {
  hora_inicio: string
  duracion_horas: number
  firma_url: string | null
  fecha: string
  alumnos: { nombre: string; cedula: string }
  ejercicios: { nombre: string; calificacion: number | null }[] | null
}

function addMins(timeStr: string, mins: number): string {
  const [h, m] = timeStr.slice(0, 5).split(":").map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
}

async function urlToBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  } catch {
    return ""
  }
}

export async function generarPDFDiario(
  clases: ClaseReporte[],
  instructorNombre: string,
  fecha: string
) {
  const sorted = [...clases].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

  type Bloque = { hora: string; cedula: string; ejercicio: string; firma_url: string | null }
  const bloques: Bloque[] = []
  for (const c of sorted) {
    const total = Math.round((c.duracion_horas * 60) / 45)
    const ejs = c.ejercicios ?? []
    for (let i = 0; i < total; i++) {
      bloques.push({
        hora: addMins(c.hora_inicio, i * 45),
        cedula: c.alumnos.cedula,
        ejercicio: ejs[i]?.nombre || "—",
        firma_url: c.firma_url,
      })
    }
  }

  const firmaImages: Record<number, string> = {}
  await Promise.all(
    bloques.map(async (b, i) => {
      if (b.firma_url) {
        const img = await urlToBase64(b.firma_url)
        if (img) firmaImages[i] = img
      }
    })
  )

  const [year, month, day] = fecha.split("-")
  const fechaLabel = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  })

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  doc.setFillColor(47, 111, 79)
  doc.rect(0, 0, 210, 28, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.text(instructorNombre, 15, 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(fechaLabel, 195, 14, { align: "right" })

  const ROW_H = 14

  autoTable(doc, {
    startY: 36,
    head: [["Fecha", "Hora", "Código alumno", "Ejercicio", "Firma"]],
    body: bloques.map(b => [fecha, b.hora, b.cedula, b.ejercicio, ""]),
    headStyles: { fillColor: [47, 111, 79], textColor: 255, fontStyle: "bold", fontSize: 9, cellPadding: 3 },
    bodyStyles: { fontSize: 9, textColor: [31, 43, 36], cellPadding: 3, minCellHeight: ROW_H },
    alternateRowStyles: { fillColor: [245, 243, 238] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 16 },
      2: { cellWidth: 28 },
      3: { cellWidth: 80 },
      4: { cellWidth: 34, halign: "center" },
    },
    margin: { left: 15, right: 15 },
    didDrawCell: (data) => {
      if (data.column.index === 4 && data.row.section === "body") {
        const img = firmaImages[data.row.index]
        if (img) {
          const pad = 2
          doc.addImage(img, "PNG", data.cell.x + pad, data.cell.y + pad, data.cell.width - pad * 2, data.cell.height - pad * 2)
        }
      }
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 16

  doc.setDrawColor(31, 43, 36)
  doc.setLineWidth(0.4)
  doc.line(15, finalY + 14, 85, finalY + 14)
  doc.line(110, finalY + 14, 195, finalY + 14)
  doc.setTextColor(120, 130, 125)
  doc.setFontSize(8)
  doc.text("Firma del instructor", 15, finalY + 19)
  doc.text(instructorNombre, 15, finalY + 23)
  doc.text("Recibido / Sello", 110, finalY + 19)

  doc.save(`reporte-${year}-${month}-${day}.pdf`)
}
