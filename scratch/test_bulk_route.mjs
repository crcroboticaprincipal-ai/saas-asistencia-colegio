import * as XLSX from 'xlsx';
import { POST } from '../src/app/api/admin/estudiantes/bulk/route.ts';

async function testRoute() {
  console.log("🧪 Creando archivo Excel de prueba con Educación Inicial y Hermanos (misma cédula)...");

  const rows = [
    {
      cedula: "12345678",
      nombres: "PEDRITO ALBERTO",
      apellidos: "PÉREZ GONZÁLEZ",
      genero: "M",
      grado_ano: "Inicial A",
      seccion: "A",
      representante_nombre: "MARÍA GONZÁLEZ",
      representante_correo: "maria@email.com",
    },
    {
      cedula: "12345678",
      nombres: "JUAN CARLOS",
      apellidos: "PÉREZ GONZÁLEZ",
      genero: "M",
      grado_ano: "1er Nivel Inicial",
      seccion: "B",
      representante_nombre: "MARÍA GONZÁLEZ",
      representante_correo: "maria@email.com",
    },
    {
      cedula: "87654321",
      nombres: "ANA MARÍA",
      apellidos: "RODRÍGUEZ LÓPEZ",
      genero: "F",
      grado_ano: "Inicial C",
      seccion: "C",
      representante_nombre: "CARLOS RODRÍGUEZ",
      representante_correo: "carlos@email.com",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Estudiantes");
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  // Crear FormData simulado
  const file = new File([buffer], 'test_import.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const formData = new FormData();
  formData.append('archivo', file);

  const req = new Request('http://localhost:3000/api/admin/estudiantes/bulk', {
    method: 'POST',
    body: formData,
  });

  console.log("🚀 Ejecutando POST /api/admin/estudiantes/bulk...");
  const response = await POST(req);
  const json = await response.json();

  console.log("📌 Status HTTP:", response.status);
  console.log("📌 Respuesta JSON completa:", JSON.stringify(json, null, 2));
}

testRoute();
