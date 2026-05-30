// Admin API: Crear usuario personal con acceso PIN
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const { email, pin, nombres, apellidos, rol, username, institucion_id } = await req.json();

    if (!email || !pin || !nombres) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // Resolver institucion_id dinámicamente desde la DB si no viene en el body
    let finalInstitucionId = institucion_id;
    if (!finalInstitucionId) {
      const { data: inst, error: instErr } = await supabaseAdmin
        .from("instituciones")
        .select("id")
        .eq("activo", true)
        .limit(1)
        .maybeSingle();

      if (instErr || !inst) {
        return NextResponse.json({ error: "No se encontró una institución activa en el sistema" }, { status: 400 });
      }
      finalInstitucionId = inst.id;
    }

    // 1. Crear usuario en Supabase Auth con email interno + PIN como contraseña
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { nombres, apellidos, username },
      app_metadata: { rol, institucion_id: finalInstitucionId },
    });

    if (authError) {
      if (authError.message.includes("already been registered")) {
        return NextResponse.json(
          { error: "⚠️ Error: El documento o usuario ya se encuentra registrado" },
          { status: 409 }
        );
      }
      throw new Error(authError.message);
    }

    // 2. Vincular personal con auth_user_id
    if (authData.user && username) {
      await supabaseAdmin
        .from("personal")
        .update({ auth_user_id: authData.user.id })
        .eq("username", username)
        .is("auth_user_id", null);
    }

    return NextResponse.json({ ok: true, userId: authData.user?.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
