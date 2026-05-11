const SUPABASE_URL = 'https://obtjhfoffpskzvkbsgnv.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idGpoZm9mZnBza3p2a2JzZ252Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODY5OTIsImV4cCI6MjA5MzA2Mjk5Mn0.zcVbN1VIKvvH6OOiHWG_QzzUwZaxTKZPFucX_E2ZPDs';

const SQL = `
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

-- Tabla de Asistencias
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

-- Politicas (permitir todo para anon por ahora)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_estudiantes') THEN
    CREATE POLICY "allow_all_estudiantes" ON public.estudiantes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_asistencias') THEN
    CREATE POLICY "allow_all_asistencias" ON public.asistencias FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.asistencias;
`;

async function run() {
  console.log('Creating tables in Supabase...');

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL })
  });

  // The RPC approach might not work with anon key, let's try the SQL endpoint
  // Try using pg_net or direct table creation check
  console.log('RPC response:', res.status);
  
  // Instead, let's verify by trying to access the tables
  const estRes = await fetch(`${SUPABASE_URL}/rest/v1/estudiantes?select=id&limit=1`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    }
  });
  
  const asiRes = await fetch(`${SUPABASE_URL}/rest/v1/asistencias?select=id&limit=1`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    }
  });

  console.log('Estudiantes table:', estRes.status, estRes.status === 200 ? 'EXISTS ✅' : 'NOT FOUND ❌');
  console.log('Asistencias table:', asiRes.status, asiRes.status === 200 ? 'EXISTS ✅' : 'NOT FOUND ❌');
  
  if (estRes.status !== 200 || asiRes.status !== 200) {
    console.log('\n⚠️  Las tablas no existen aún. Necesitas ejecutar el SQL en el panel de Supabase.');
    console.log('    URL: https://supabase.com/dashboard/project/obtjhfoffpskzvkbsgnv/sql/new');
    console.log('    Copia y pega el contenido de supabase_schema.sql');
  } else {
    console.log('\n✅ Ambas tablas existen y están accesibles.');
    const estData = await estRes.json();
    const asiData = await asiRes.json();
    console.log(`   Estudiantes: ${estData.length} registros`);
    console.log(`   Asistencias: ${asiData.length} registros`);
  }
}

run().catch(console.error);
