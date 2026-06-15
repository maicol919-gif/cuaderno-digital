import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface ResumenAlumno {
  nombre: string
  horas: number
}

export async function generarPDF(resumen: ResumenAlumno[], totalHoras: number, periodo: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  doc.setFillColor(47, 111, 79)
  doc.rect(0, 0, 210, 40, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.text("Cuaderno del Instructor", 20, 18)
  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  doc.text(`Resumen: ${periodo}`, 20, 28)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(`Total: ${totalHoras}h`, 190, 23, { align: "right" })

  doc.setTextColor(31, 43, 36)
  autoTable(doc, {
    startY: 50,
    head: [["Alumno", "Horas"]],
    body: resumen.map(r => [r.nombre, `${r.horas}h`]),
    headStyles: { fillColor: [47, 111, 79], textColor: 255, fontStyle: "bold", fontSize: 11 },
    bodyStyles: { fontSize: 11, textColor: [31, 43, 36] },
    alternateRowStyles: { fillColor: [230, 240, 234] },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 20, right: 20 },
  })

  doc.save(`resumen-${periodo.replace(/\s/g, "-")}.pdf`)
}