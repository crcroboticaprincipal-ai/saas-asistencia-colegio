import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://obtjhfoffpskzvkbsgnv.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9idGpoZm9mZnBza3p2a2JzZ252Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ4Njk5MiwiZXhwIjoyMDkzMDYyOTkyfQ.EI1ccqunh2LI9Yyb4xZkwFAKqdCr7piYl1JICv1QmQk";

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function testLogin(username: string, pin: string) {
  console.log(`\nTesting login for '${username}' with PIN '${pin}'...`);
  
  // 1. Find user in personal table
  const { data: pData, error: pError } = await sb
    .from('personal')
    .select('institucion_id, auth_user_id')
    .eq('username', username.trim().toLowerCase())
    .eq('activo', true)
    .maybeSingle();

  if (pError || !pData) {
    console.error(`❌ Personal lookup failed:`, pError || "User not found or inactive");
    return;
  }
  console.log(`✅ Personal record found. auth_user_id: ${pData.auth_user_id}, institucion_id: ${pData.institucion_id}`);

  // 2. Find institution
  const { data: iData, error: iError } = await sb
    .from('instituciones')
    .select('nombre_corto')
    .eq('id', pData.institucion_id)
    .single();

  if (iError || !iData || !iData.nombre_corto) {
    console.error(`❌ Institution lookup failed:`, iError || "No short name configured");
    return;
  }
  console.log(`✅ Institution short name resolved: ${iData.nombre_corto}`);

  // 3. Derive credentials
  const slug = iData.nombre_corto.toLowerCase().replace(/[^a-z0-9]/g, '');
  const email = `${username.toLowerCase().trim()}@${slug}.asisto.local`;
  const password = pin;
  console.log(`Derived email: '${email}', password: '${password}'`);

  // 4. Try signing in with Supabase Auth
  const { data: signInData, error: signInError } = await sb.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    console.error(`❌ Auth sign-in failed:`, signInError.message);
    
    // Try alt legacy domain qrono.local
    if (email.endsWith('.asisto.local')) {
      const altEmail = email.replace('.asisto.local', '.qrono.local');
      console.log(`Retrying with legacy email: '${altEmail}'...`);
      const { data: retryData, error: retryError } = await sb.auth.signInWithPassword({
        email: altEmail,
        password,
      });
      if (retryError) {
        console.error(`❌ Legacy retry failed:`, retryError.message);
      } else {
        console.log(`✅ Success on legacy retry! User ID: ${retryData.user?.id}`);
      }
    }
  } else {
    console.log(`✅ Auth sign-in succeeded! User ID: ${signInData.user?.id}`);
  }
}

async function run() {
  await testLogin("superadmin", "9999");
  await testLogin("j.martinez", "3333");
  await testLogin("virgicastillo", "9999"); // Just check if it's there
}

run().catch(console.error);
