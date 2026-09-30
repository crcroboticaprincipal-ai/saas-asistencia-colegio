# GUÍA COMPLETA DE REPORTES E INFORMES — Sistema Asisto
## Colegio U.E. Rafael Castillo | Ciclo 2026-2027

> **Uso:** Manual de procesamiento, descarga e interpretación de reportes para el equipo directivo, coordinadores y personal de administración.  
> **Ubicación:** Guardado exclusivamente de forma local en la computadora institucional.

---

## 📋 Índice de Reportes del Sistema

El sistema **ASISTO** cuenta con **7 tipos de informes y reportes especializados**, clasificados en dos grandes áreas:

### A. Reportes de Estudiantes
1. [Reporte de Asistencia General (Institucional)](#1-reporte-de-asistencia-general-institucional)
2. [Reporte Individual por Estudiante (Ficha del Alumno)](#2-reporte-individual-por-estudiante)
3. [Reporte Grupal por Grado y Sección](#3-reporte-grupal-por-grado-y-sección)
4. [Reporte de Analítica por Materia (Detección de Fugas Internas)](#4-reporte-de-analítica-por-materia)
5. [Reporte e Impresión de Carnets QR](#5-reporte-e-impresión-de-carnets-qr)

### B. Reportes de Personal y Docentes (RRHH)
6. [Reporte de Calendario Mensual de Personal (Fichaje RRHH)](#6-reporte-de-calendario-mensual-de-personal)
7. [Reporte de Alertas de Ausencias del Día](#7-reporte-de-alertas-de-ausencias-del-día)

---

## 1. Reporte de Asistencia General (Institucional)

Ubicación en el sistema: **Admin → Reportes** (`/admin/reportes`)  
Formato de salida: **Excel (.xlsx)**

### ¿Para qué sirve?
Ofrece una visión ejecutiva y detallada de todas las entradas y salidas de los alumnos registradas en la puerta principal en un período determinado.

### Pasos para generarlo y descargarlo:
1. Ve al menú **Reportes** en el panel lateral.
2. En la pestaña **Resumen General**, selecciona el filtro de tiempo:
   - **HOY:** Registros del día en curso.
   - **SEMANA:** Últimos 7 días.
   - **MES:** Últimos 30 días.
3. Si deseas buscar a alguien en particular, usa la barra de búsqueda por nombre o cédula.
4. Presiona el botón **"📥 Exportar Excel"**.

### ¿Cómo leer e interpretar el archivo Excel?
El archivo descargado contiene **2 Hojas**:
* **Hoja 1: "Resumen Institucional"**
  - Muestra las métricas clave: *Total de Entradas*, *Minutos Totales de Retardo* acumulados y el número de *Alumnos en Semáforo Rojo*.
  - Muestra la lista de alumnos con retardos más críticos para citación a representantes.
* **Hoja 2: "Registro Detallado"**
  - Contiene las columnas: `Fecha`, `Nombre Completo`, `Cédula`, `Grado y Sección`, `Hora Entrada`, `Hora Salida` y `Minutos de Retardo`.
  - **Lectura visual:** Las celdas con retardos mayores a 0 minutos se colorean automáticamente en **Rojo Carmesí** para rápida identificación.

---

## 2. Reporte Individual por Estudiante

Ubicación en el sistema: **Admin → Reportes → Pestaña Individual** (`/admin/reportes`)  
Formato de salida: **Excel (.xlsx)**

### ¿Para qué sirve?
Genera el expediente e historial completo de asistencia de un estudiante específico. Es la herramienta oficial para entregar balances a los representantes en reuniones o citaciones pedagógicas.

### Pasos para generarlo y descargarlo:
1. Ve a **Reportes** y selecciona la pestaña **Individual**.
2. Ingresa la **Cédula** o el **Nombre** del estudiante en el buscador y presiona "Buscar".
3. Opcionalmente, define un rango de fechas (`Desde` / `Hasta`).
4. Revisa la vista previa en pantalla.
5. Haz clic en **"Exportar Historial (Excel)"**.

### ¿Cómo leer e interpretar el archivo Excel?
- El archivo se descarga con el nombre `Asisto_[Cedula_Alumno].xlsx`.
- Presenta en orden cronológico cada día del período seleccionado con su hora exacta de llegada y salida.
- Permite demostrar al representante el patrón de puntualidad o inasistencias de su representado con datos cuantitativos inmodificables.

---

## 3. Reporte Grupal por Grado y Sección

Ubicación en el sistema: **Admin → Reportes → Pestaña Grupal** (`/admin/reportes`)  
Formato de salida: **Excel (.xlsx)**

### ¿Para qué sirve?
Permite evaluar el comportamiento de asistencia de un curso completo (ej: *3er Grado "A"* o *4to Año "B"*). Ideal para entregas de notas de fin de lapso y trabajo del Profesor Guía.

### Pasos para generarlo y descargarlo:
1. En el panel de **Reportes**, selecciona la pestaña **Grupal**.
2. Filtra por el **Grado / Año** deseado (ej: `1er Grado` a `5to Año`).
3. Selecciona la **Sección** (`A` o `B`).
4. Indica el rango de fechas a auditar.
5. Presiona **"Consultar"** y luego **"Exportar Reporte de Sección (Excel)"**.

### ¿Cómo leer e interpretar el archivo Excel?
- Agrupa a todos los alumnos pertenecientes a la sección seleccionada.
- Permite comparar qué sección del mismo año tiene mejor índice de puntualidad y asistencia.

---

## 4. Reporte de Analítica por Materia (Detección de Fugas Internas)

Ubicación en el sistema: **Admin → Académico → Analítica** (`/admin/academico`)  
Formato de salida: **Excel (.xlsx)** y **Gráficos interactivos**

### ¿Para qué sirve?
Es el informe académico más avanzado del sistema. Audita la asistencia que los profesores toman dentro del aula de clases asignatura por asignatura. **Permite detectar fugas internas** (alumnos que entraron al colegio por la puerta principal pero no se presentaron en la clase de una materia específica).

### Pasos para generarlo y descargarlo:
1. Ve al menú **Académico** en la sección *Analítica por Materia*.
2. Selecciona la fecha de inicio y fin de la auditoría.
3. Si lo deseas, filtra por un grado en específico.
4. Presiona el botón azul **"Exportar Excel"**.

### ¿Cómo leer e interpretar el archivo Excel?
El archivo contiene la hoja **"Analítica por Materia"**:
- **Columnas:** `Materia`, `Grado`, `Sección`, `Presentes`, `Ausentes` y `% Asistencia`.
- **Semáforo de Asistencia:**
  - 🟢 **Verde (≥ 90%):** Excelente concurrencia a la clase.
  - 🟡 **Ámbar (70% - 89%):** Ausentismo moderado.
  - 🔴 **Rojo (< 70%):** Alerta crítica de inasistencias en esa materia.

---

## 5. Reporte e Impresión de Carnets QR

Ubicación en el sistema: **Admin → Estudiantes** (`/admin/estudiantes`)  
Formato de salida: **Vista de Impresión / Archivo PDF Carnets**

### ¿Para qué sirve?
Genera la grilla oficial de carnets escolares listos para imprimir o recortar, cada uno con el código QR único del estudiante y sus datos institucionales.

### Pasos para generarlo:
1. Entra a **Estudiantes**.
2. Marca las casillas de los alumnos que deseas imprimir (o usa "Seleccionar Todos").
3. Presiona el botón azul **"Imprimir (N)"**.
4. Se abrirá la vista de carnets optimizada para papel. Usa la función del navegador (`Ctrl + P`) para imprimir directamente o guardar como **PDF**.

---

## 6. Reporte de Calendario Mensual de Personal (Fichaje RRHH)

Ubicación en el sistema: **Admin → RRHH → Calendario** (`/admin/rrhh/calendario`)  
Formato de salida: **Excel (.xlsx)** con formato de matriz de calendario

### ¿Para qué sirve?
Genera la hoja de asistencia laboral individual de cada docente o empleado administrativo del colegio para el cálculo de nómina, bonos de puntualidad y control de RRHH.

### Pasos para generarlo y descargarlo:
1. Ve a **RRHH → Calendario**.
2. Selecciona el **Empleado** del desplegable y el **Mes / Año** a evaluar.
3. Presiona **"📥 Descargar Calendario Excel"**.

### ¿Cómo leer e interpretar el archivo Excel?
El archivo se estructura visualmente como un **calendario mensual de pared (Lunes a Domingo)**:
- **Casillas Diarias:**
  - `▲ HH:MM` (Hora de Entrada real en portería)
  - `▼ HH:MM` (Hora de Salida real)
  - `+Xm tarde` (Minutos de retardo evaluados según su horario laboral)
- **Codificación de Colores en el Calendario:**
  - 🟢 **Verde Oscuro (`#052E16`):** Entró puntual a su hora esperada.
  - 🔴 **Rojo Oscuro (`#450A0A`):** Presentó retardo en la entrada.
  - 🟡 **Ámbar (`#422006`):** Marcó entrada sin evaluar tolerancia.
  - ⬛ **Gris Oscuro (`#0F172A`):** Fin de semana o día sin registro.
- **Cuadro Resumen de Pie de Página:** Muestra el total de *Días Registrados*, *Días Puntuales*, *Retardos* y el **% de Puntualidad Mensual del Empleado**.

---

## 7. Reporte de Alertas de Ausencias del Día

Ubicación en el sistema: **Dashboard Admin** (`/admin`)  
Formato de salida: **Panel Interactivo de Pantalla**

### ¿Para qué sirve?
Monitorea en tiempo real durante la mañana qué profesores o personal administrativo no se han presentado a laborar pasadas sus horas de tolerancia.

### ¿Cómo interpretarlo?
- Muestra tarjetas de alerta destacadas en rojo.
- Permite al equipo directivo reorganizar suplencias de aula antes de iniciar la jornada escolar.

---

## 🛠️ Resumen de Frecuencia Recomendada para el Equipo

| Reporte | Frecuencia Sugerida | Responsable Recomendado |
|---|---|---|
| **Alertas de Ausencias del Día** | Diario (07:15 AM) | Coordinador Académico |
| **Asistencia General de Estudiantes** | Semanal (Viernes) | Control de Estudios / Dirección |
| **Reporte de Analítica por Materia** | Quincenal / Mensual | Coordinadores de Lapso |
| **Calendario Mensual de RRHH** | Mensual (Fin de mes) | Administración / RRHH |
| **Reportes Individuales por Alumno** | A demanda / Citaciones | Profesores Guía y Psicopedagogía |

---

*Guía de Reportes ASISTO — Sistema de Asistencia Escolar U.E. Colegio Rafael Castillo*  
*Documento guardado únicamente en almacenamiento local de la institución.*
