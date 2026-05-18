// Admin API: Crear usuario personal con acceso PIN
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Client is initialized dynamically inside the route handler

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { email, pin, nombres, apellidos, rol, username } = await req.json();

    if (!email || !pin || !nombres) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // 1. Crear usuario en Supabase Auth con email interno + PIN como contraseña
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
      user_metadata: { nombres, apellidos, username },
      app_metadata: {
        rol,
        institucion_id: "c4e8711a-f035-428c-b98f-69555a819ec7",
      },
    });

    if (authError) {
      // Si el usuario ya existe, devolvemos ok (idempotente)
      if (authError.message.includes("already been registered")) {
        return NextResponse.json({ ok: true, message: "Usuario ya existe" });
      }
      throw new Error(authError.message);
    }

    // 2. Actualizar personal con auth_user_id
    if (authData.user) {
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
