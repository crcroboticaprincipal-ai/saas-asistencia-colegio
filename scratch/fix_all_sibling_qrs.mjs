import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*([^\r\n]+)/);
const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*([^\r\n]+)/);

const url = urlMatch ? urlMatch[1].trim().replace(/^"|"$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^"|"$/g, '') : '';

const sb = createClient(url, key, { auth: { persistSession: false } });

function slugifyNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function repararQRsUnicos() {
  console.log("🔧 Iniciando reparación e individualización de Códigos QR para hermanos...");

  const { data: todos, error } = await sb
    .from('estudiantes')
    .select('id, cedula, nombre_completo, qr_code');

  if (error || !todos) {
    console.error("❌ Error:", error);
    process.exit(1);
  }

  console.log(`📊 Auditando ${todos.length} estudiantes en Supabase...`);

  let actualizados = 0;
  const qrUnicos = new Set();

  for (const est of todos) {
    const slug = slugifyNombre(est.nombre_completo);
    // Para hermanos con sufijo (ej: 35195031-H2), incluir el sufijo en el QR para asegurar unicidad absoluta
    const baseCed = est.cedula.replace(/^(V-|E-|RC-|QR-|ASISTO-)/i, '').trim();
    let qrNuevo = `ASISTO-${baseCed}-${slug}`;

    // Si ya existe ese QR exacto en la iteración, agregar un modificador
    if (qrUnicos.has(qrNuevo)) {
      qrNuevo = `ASISTO-${baseCed}-${slug}-${est.id.slice(0, 4)}`;
    }
    qrUnicos.add(qrNuevo);

    if (est.qr_code !== qrNuevo) {
      const { error: errUpd } = await sb.from('estudiantes').update({ qr_code: qrNuevo }).eq('id', est.id);
      if (!errUpd) actualizados++;
    }
  }

  console.log(`✅ ${actualizados} códigos QR fueron ajustados para garantizar unicidad absoluta de hermanos.`);
}

repararQRsUnicos();
