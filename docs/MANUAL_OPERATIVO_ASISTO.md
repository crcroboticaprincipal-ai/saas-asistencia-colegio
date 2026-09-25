# MANUAL OPERATIVO — Sistema Asisto
## Colegio U.E. Rafael Castillo | Ciclo 2026-2027

> **Versión:** 2.0 — Septiembre 2026  
> **Autor:** Equipo de Sistemas Asisto  
> **Uso:** Capacitación de coordinadores, docentes y personal administrativo

---

## Tabla de Contenidos

1. [Acceso al Sistema](#1-acceso-al-sistema)
2. [Panel de Administrador](#2-panel-de-administrador)
3. [Cargar Materias](#3-cargar-materias)
4. [Configurar Horarios de Docentes](#4-configurar-horarios-de-docentes)
5. [Importar Alumnos desde Excel](#5-importar-alumnos-desde-excel)
6. [Gestionar Personal (RRHH)](#6-gestionar-personal-rrhh)
7. [Escáner de Portería](#7-escáner-de-portería)
8. [Pase de Lista en el Aula](#8-pase-de-lista-en-el-aula)
9. [Reportes y Exportación](#9-reportes-y-exportación)
10. [Hard Reset / Inicio de Ciclo](#10-hard-reset--inicio-de-ciclo)
11. [Preguntas Frecuentes (FAQ)](#11-preguntas-frecuentes-faq)

---

## 1. Acceso al Sistema

| URL de producción | `https://asisto.vercel.app` |
|---|---|
| **Super Admin** | `orlandoasisto@asisto.app` |
| **Roles disponibles** | Super Admin · Coordinador · Docente · Personal |

### Iniciar Sesión
1. Abre la URL en cualquier navegador (recomendado: Chrome, Edge).
2. Ingresa tu **correo** y **contraseña** configurados por el administrador.
3. Serás redirigido a tu panel según tu rol.

> **⚠️ Si olvidaste tu contraseña:** Haz clic en "¿Olvidaste tu contraseña?" en la pantalla de login. Recibirás un correo de restablecimiento.

---

## 2. Panel de Administrador

Ubicación: **`/admin`**

El panel principal muestra en tiempo real:
- Conteo de estudiantes activos
- Asistencias del día (entradas / salidas)
- Alertas de inasistencia recientes
- Actividad reciente del escáner

### Navegación lateral
| Sección | Ruta | Descripción |
|---|---|---|
| Dashboard | `/admin` | Resumen en tiempo real |
| Estudiantes | `/admin/estudiantes` | CRUD de alumnos |
| RRHH | `/admin/rrhh` | Gestión de personal y docentes |
| Materias | `/admin/materias` | Catálogo de asignaturas |
| Académico | `/admin/academico` | Horarios y asignaciones |
| Reportes | `/admin/reportes` | Descarga de reportes |
| Importar | `/admin/importar` | Carga masiva desde Excel |

---

## 3. Cargar Materias

Ubicación: **Admin → Materias** (`/admin/materias`)

Cada materia debe existir en el catálogo **antes** de poder asignarse a un docente o usarse en el Pase de Lista.

### Pasos para crear una materia:
1. Haz clic en el botón **"+ Nueva Materia"**.
2. Completa los campos:
   - **Nombre:** Ej: `Matemáticas`, `Biología`, `Castellano y Literatura`
   - **Código (opcional):** Ej: `MAT-01`
   - **Nivel:** Selecciona del desplegable el grado/año al que pertenece. Opciones disponibles:
     - `1er Grado` a `6to Grado` (Primaria)
     - `1er Año` a `5to Año` (Bachillerato)
     - `General` (aplica a todos los grados)
3. Haz clic en **"Guardar"**.

> **💡 Consejo:** Crea primero TODAS las materias del pensum completo antes de proceder a la asignación de docentes. Esto ahorra tiempo.

### Orden recomendado de carga para el inicio del ciclo:
1. ✅ Crear todas las materias de Primaria (1er al 6to Grado)
2. ✅ Crear todas las materias de Bachillerato (1er al 5to Año)
3. ✅ Asignar docentes con sus horarios
4. ✅ Importar alumnos desde Excel

---

## 4. Configurar Horarios de Docentes

Ubicación: **Admin → RRHH** (`/admin/rrhh`)

Cada docente registrado en el sistema tiene un **Panel de Docente** con dos secciones:

### A. Horario Laboral
Define **cuándo** trabaja el docente (para control de puntualidad en portería):
1. Clic en el ícono ⚙️ del docente en la lista de personal.
2. Ve a la pestaña **"Horario Laboral"**.
3. Activa los **días laborables** (Lunes–Viernes por defecto).
4. Para cada día activo, define:
   - **Hora de entrada esperada** (Ej: `07:00`)
   - **Hora de salida esperada** (Ej: `14:00`)
   - **Tolerancia de entrada** en minutos (Ej: `10` min)
5. Haz clic en **"Guardar Configuración"**.

> **Nota:** Los días no marcados se registran como *días libres* — el escáner no evaluará retardo esos días.

### B. Carga Académica
Define **qué clases dicta** el docente (para el Pase de Lista del aula):
1. Clic en el ícono ⚙️ del docente.
2. Ve a la pestaña **"Carga Académica"**.
3. Para cada clase que dicta, agrega una fila con:
   - **Materia:** Selecciona del desplegable (debe estar ya creada en Materias).
   - **Grado / Año:** Selecciona del desplegable canónico.
   - **Sección:** `A` o `B`
   - **Día:** El día que dicta esa clase.
   - **Hora inicio / Hora fin:** Ej: `07:00` – `08:00`
4. Repite para cada clase y haz clic en **"Guardar Configuración"**.

> **💡 Importante:** Sin carga académica configurada, el docente no podrá usar el Pase de Lista del Aula.

---

## 5. Importar Alumnos desde Excel

Ubicación: **Admin → Importar** (`/admin/importar`) o **Admin → Estudiantes → Carga Masiva**

### Paso 1: Descarga la Plantilla Oficial
1. Haz clic en **"📥 Descargar Plantilla Oficial (Excel)"**.
2. Se descargará el archivo `plantilla_alumnos_asisto.xlsx`.
3. Ábrelo en Excel o LibreOffice Calc.

### Columnas de la plantilla:
| Columna | Descripción | Obligatorio |
|---|---|---|
| `cedula` | Solo números (sin V-, E-) | ✅ |
| `nombres` | Nombres del alumno | ✅ |
| `apellidos` | Apellidos del alumno | ✅ |
| `genero` | `M` o `F` | No |
| `grado_ano` | Selecciona del desplegable | ✅ |
| `seccion` | `A` o `B` | ✅ |
| `representante_nombre` | Nombre completo del representante | ✅ |
| `representante_telefono` | Teléfono de contacto | No |
| `representante_correo` | Correo para notificaciones automáticas | ✅ |

### Grados válidos:
- **Primaria:** `1er Grado`, `2do Grado`, `3er Grado`, `4to Grado`, `5to Grado`, `6to Grado`
- **Bachillerato:** `1er Año`, `2do Año`, `3er Año`, `4to Año`, `5to Año`

> **⚠️ Importante:** Usa la celda desplegable en la columna `grado_ano`. El sistema rechazará cualquier valor que no sea exactamente uno de los grados canónicos.

### Paso 2: Llena los datos
- Elimina las filas de ejemplo (filas 2 y 3).
- Ingresa un alumno por fila.
- **No modifiques los encabezados** de la fila 1.
- Máximo 500 alumnos por archivo (si tienes más, usa varios archivos).

### Paso 3: Sube el archivo
1. En la sección Importar, arrastra el archivo o haz clic para seleccionarlo.
2. Verás una **Vista Previa** con los datos detectados.
3. Si el sistema detecta errores de validación, te mostrará una **tabla de errores** con el número de fila y la descripción del problema.
4. Corrige los errores en Excel y vuelve a subir.
5. Si no hay errores, presiona **"Importar a Base de Datos"**.
6. La barra de progreso avanzará mientras se registran los alumnos.
7. Al finalizar, podrás **generar e imprimir los carnets QR** directamente.

---

## 6. Gestionar Personal (RRHH)

Ubicación: **Admin → RRHH** (`/admin/rrhh`)

### Agregar nuevo empleado/docente:
1. Clic en **"+ Nuevo Personal"**.
2. Completa:
   - Nombres y Apellidos
   - Cédula de identidad
   - Cargo (Ej: `Docente`, `Coordinador`, `Vigilante`)
   - Rol del sistema (determina sus permisos)
   - Correo electrónico institucional
3. El sistema genera automáticamente un **QR único** (basado en el UUID del empleado).
4. Haz clic en **"Guardar"**.

### PIN de acceso al Pase de Lista
Cada docente necesita un **PIN de 4 dígitos** para autenticarse en el Pase de Lista del Aula:
1. En la lista de personal, haz clic en el ícono de llave 🔑 del docente.
2. Ingresa un PIN de 4 dígitos y confírmalo.
3. Haz clic en **"Establecer PIN"**.
4. Entrega el PIN al docente de forma segura.

> **Seguridad:** El PIN se almacena encriptado. Nadie (ni el admin) puede ver el PIN actual; solo puede **resetearlo**.

---

## 7. Escáner de Portería

Ubicación: **`/escaner`** (acceso directo desde la pantalla principal)

El escáner funciona en cualquier dispositivo con cámara (tablet, teléfono, laptop).

### Modos de operación:

| Modo | Función |
|---|---|
| **ENTRADA** | Registra la llegada del alumno o empleado |
| **SALIDA** | Registra la salida |
| **PASE** | Genera un pase digital (entrada tardía, salida anticipada, etc.) |

### Flujo de uso:
1. Selecciona el modo (**ENTRADA** o **SALIDA**).
2. Apunta la cámara al carnet QR del alumno o empleado.
3. El sistema muestra en pantalla:
   - ✅ **Verde** (alumno): Nombre + Grado + Sección + foto (si tiene)
   - ✅ **Verde esmeralda** (personal/empleado): Nombre + Cargo
   - ❌ **Rojo**: Error (alumno inactivo, código desconocido)
4. El escáner vuelve automáticamente al modo activo en 1.2 segundos.

### Marcar sin carnet (por cédula):
- Haz clic en **"⌨️ Marcar por Cédula / ID"**.
- Escribe el número de cédula (sin prefijo V-).
- Presiona **"Procesar Asistencia"**.
- Funciona tanto para alumnos como para personal.

### Notificaciones automáticas:
- Cuando un alumno marca **ENTRADA** o **SALIDA**, el sistema envía un email automáticamente al correo del representante registrado.

---

## 8. Pase de Lista en el Aula

Ubicación: **`/aula/pasar-lista`** (acceso desde el panel del docente)

Los docentes usan esta función para registrar asistencia **dentro del aula**.

### Autenticación del docente:
1. El docente ingresa su **PIN de 4 dígitos**.
2. El sistema muestra la lista de secciones a las que está asignado.
3. Selecciona la sección y materia correspondiente.

### Pasar lista:
- El sistema muestra tarjetas para cada alumno de la sección.
- Desliza (swipe) cada tarjeta:
  - ➡️ **Derecha** = Presente
  - ⬅️ **Izquierda** = Ausente
- O usa el modo escáner QR integrado en el aula.

---

## 9. Reportes y Exportación

Ubicación: **Admin → Reportes** (`/admin/reportes`)

Los reportes disponibles incluyen:
- **Asistencia General** (por fecha, grado o sección)
- **Asistencia por Materia** (por docente y período)
- **Reporte de Personal** (puntualidad y ausentismo)
- **Alumnos con Alertas** (inasistencias acumuladas)

### Exportar datos:
1. Selecciona el tipo de reporte y el rango de fechas.
2. Haz clic en **"Exportar Excel"** o **"Exportar PDF"**.

---

## 10. Hard Reset / Inicio de Ciclo

> **⚠️ SOLO el Super Admin (`orlandoasisto@asisto.app`) puede realizar esta operación.**

El Hard Reset elimina todos los datos de alumnos y asistencias para iniciar un nuevo ciclo escolar limpio. **Personal, materias y configuración institucional se conservan.**

### Cómo ejecutar:
Esta operación se ejecuta desde el código o mediante la API interna:
```
POST /api/qrono-admin/hard-reset
Body: { "confirmar": true, "email": "orlandoasisto@asisto.app" }
```

### Promoción de año escolar:
Para promover todos los alumnos al grado siguiente (manteniendo su sección):
```
POST /api/admin/ciclo-escolar/promover
```
- Los alumnos de **5to Año** son marcados como `Graduado`.
- El resto avanza al siguiente grado en el catálogo canónico.
- Las materias y asignaciones de docentes se limpian (se recargan nuevas).

---

## 11. Preguntas Frecuentes (FAQ)

**P: El escáner dice "Código no reconocido". ¿Qué hago?**  
R: Verifica que el alumno esté importado en el sistema con estado "Activo". También puedes marcar manualmente por cédula.

**P: El representante no recibe el correo de notificación.**  
R: Verifica que el correo del representante esté correctamente registrado (sin espacios extra). Revisa también la carpeta de spam del correo del representante.

**P: Un docente no ve sus alumnos en el Pase de Lista.**  
R: Confirma que tenga la **Carga Académica** configurada con el grado, sección, materia y horario correctos en su panel de RRHH.

**P: El grado que necesito no aparece en el desplegable de Excel.**  
R: Los únicos grados válidos son los del catálogo canónico (Primaria: 1er-6to Grado; Bachillerato: 1er-5to Año). Escribe exactamente como aparece en la lista desplegable de la plantilla.

**P: ¿Cómo agrego un nuevo año (Ej: 6to Año) en el futuro?**  
R: El catálogo canónico está centralizado en `src/lib/grados-catalogo.ts`. Un desarrollador debe agregar el nuevo grado al array `GRADOS_BACHILLERATO` y hacer un nuevo despliegue.

**P: ¿Puedo usar el sistema en un teléfono?**  
R: Sí. El sistema es completamente responsivo. El escáner de portería está optimizado para uso en tablets y teléfonos con cámara trasera.

---

*Manual generado automáticamente — Asisto Sistema de Asistencia Escolar*  
*Última actualización: Septiembre 2026*
