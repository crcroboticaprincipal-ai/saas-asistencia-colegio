# Sistema de Gestión de Asistencia - UE Colegio Rafael Castillo

Este es un sistema full-stack desarrollado con Next.js, Supabase y Resend para la gestión de asistencia mediante códigos QR.

## Tecnologías Utilizadas
- **Frontend/Backend:** Next.js (App Router)
- **Base de Datos:** Supabase (PostgreSQL) + Realtime
- **Correos:** Resend API
- **Estilos:** Tailwind CSS (Premium Glassmorphism Design)
- **Escáner:** `html5-qrcode`

## Pasos para la Configuración

### 1. Configurar Supabase
1. Crea un proyecto en [Supabase](https://supabase.com).
2. Ve al panel de "SQL Editor" en Supabase.
3. Copia el contenido del archivo `supabase_schema.sql` y ejecútalo para crear las tablas (`estudiantes` y `asistencias`) y habilitar Realtime.
4. En Supabase, ve a `Project Settings` > `API` y copia tu `Project URL` y `anon public key` (y opcionalmente la `service_role key` para máxima seguridad en la inserción).

### 2. Configurar Resend (Correos)
1. Crea una cuenta en [Resend](https://resend.com).
2. Añade y verifica tu dominio (para poder enviar correos a cualquier persona). Si estás en pruebas, solo podrás enviar a tu propio correo registrado.
3. Genera un API Key en Resend.

### 3. Variables de Entorno
Crea un archivo llamado `.env.local` en la raíz de este proyecto con el siguiente contenido:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_supabase_service_role_key # Opcional, si no se usa la API puede fallar o usa la ANON_KEY
RESEND_API_KEY=tu_resend_api_key
```

### 4. Ejecutar el Proyecto
Instala las dependencias si no lo has hecho (el ingeniero ya las instaló):
```bash
npm install
```

Inicia el servidor de desarrollo:
```bash
npm run dev
```

El proyecto estará disponible en `http://localhost:3000`.

## Módulos del Sistema
- **Dashboard (`/`):** Panel en tiempo real de entradas y salidas, incluyendo un Semáforo Conductual.
- **Importar (`/importar`):** Carga masiva mediante un archivo Excel `.xlsx`. Genera automáticamente los Códigos QR para imprimirlos como Carnets Digitales.
- **Escáner (`/escaner`):** Escáner web para dispositivos móviles. Registra Entrada/Salida y dispara notificaciones por correo.
- **Reportes (`/reportes`):** Tabla histórica con filtros de fecha y búsqueda, con opciones para exportar a Excel y PDF.

## Despliegue en Vercel
Este proyecto está completamente listo para ser desplegado en Vercel. Solo debes enlazar tu repositorio y agregar las mismas variables de entorno del paso 3 en el panel de configuración de Vercel.
