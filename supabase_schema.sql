-- SQL para ejecutar en el panel SQL de Supabase

-- Tabla de Estudiantes
CREATE TABLE IF NOT EXISTS public.estudiantes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cedula VARCHAR(50) UNIQUE NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    grado VARCHAR(50) NOT NULL,
    seccion VARCHAR(10) NOT NULL,
    nombre_representante VARCHAR(255) NOT NULL,
    correo_representante VARCHAR(255) NOT NULL,
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla de Asistencias (Incidencias/Registros)
CREATE TABLE IF NOT EXISTS public.asistencias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estudiante_id UUID REFERENCES public.estudiantes(id) ON DELETE CASCADE,
    tipo VARCHAR(20) CHECK (tipo IN ('ENTRADA', 'SALIDA')) NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE NOT NULL,
    hora TIME DEFAULT CURRENT_TIME NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.estudiantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;

-- Políticas temporales (para permitir todo, o se puede ajustar para mayor seguridad)
CREATE POLICY "Permitir todo a anonimos en estudiantes" ON public.estudiantes FOR ALL USING (true);
CREATE POLICY "Permitir todo a anonimos en asistencias" ON public.asistencias FOR ALL USING (true);

-- Habilitar Realtime para la tabla asistencias
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.asistencias;
