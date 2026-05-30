import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generarEmailInterno } from "@/lib/login-pin";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Variables de entorno de Supabase no configuradas.");
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const { nombres, apellidos, cedula, correo, telefono, cargo, rol, username, pin, institucion_id } = body;

    // Validar que se recibió institucion_id
    if (!institucion_id) {
      return NextResponse.json({ error: "Se requiere seleccionar una institución" }, { status: 400 });
    }

    // Obtener nombre_corto de la institución para el email interno
    const { data: instData, error: instError } = await supabaseAdmin
      .from("instituciones")
      .select("nombre_corto")
      .eq("id", institucion_id)
      .single();

    if (instError || !instData) {
      return NextResponse.json({ error: "Institución no encontrada" }, { status: 404 });
    }

    const nombreCorto = instData.nombre_corto || "INST";
    let authUserId = null;

    // 1. Si hay username y pin, crear usuario en Supabase Auth
    if (username && pin) {
      const email = generarEmailInterno(username, nombreCorto);
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
        user_metadata: { nombres, apellidos, username },
        app_metadata: {
          rol,
          institucion_id,
        },
      });

      if (authError) {
        if (authError.message.includes("already been registered")) {
          // Auth user exists — still try to link to personal table below
        } else {
          throw new Error(authError.message);
        }
      }

      if (authData?.user) {
        authUserId = authData.user.id;
      } else {
        // If already registered, fetch the user ID
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const found = existingUser.users.find(u => u.email === email);
        if (found) authUserId = found.id;
      }
    }

    // 2. Insertar en tabla personal usando Service Role (salta RLS)
    const { data: personalData, error: dbError } = await supabaseAdmin.from("personal").insert([{
      nombres,
      apellidos,
      cedula: cedula || null,
      correo: correo || null,
      telefono: telefono || null,
      cargo: cargo || null,
      rol,
      username: username || null,
      auth_user_id: authUserId,
      institucion_id,
    }]).select().single();

    if (dbError) {
      // Detectar violaciones de restricción única (cédula, username, correo duplicados)
      if (
        dbError.message.includes('duplicate key') ||
        dbError.message.includes('unique constraint') ||
        dbError.code === '23505'
      ) {
        return NextResponse.json(
          { error: "\u26a0\ufe0f Error: El documento o usuario ya se encuentra registrado" },
          { status: 409 }
        );
      }
      throw new Error(dbError.message);
    }

    return NextResponse.json({ ok: true, personal: personalData });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
