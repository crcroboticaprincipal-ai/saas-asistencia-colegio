"use client";

import { useEffect, useState } from "react";
import { 
  User, Lock, ShieldAlert, Key, Eye, EyeOff, 
  CheckCircle2, AlertCircle, Loader2, Save 
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function PerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // User details
  const [userInfo, setUserInfo] = useState<{
    id: string;
    nombre: string;
    email: string;
    rol: string;
    tipo: 'admin' | 'personal';
  } | null>(null);

  // Form states
  const [claveActual, setClaveActual] = useState("");
  const [nuevaClave, setNuevaClave] = useState("");
  const [confirmarClave, setConfirmarClave] = useState("");

  const [showClaveActual, setShowClaveActual] = useState(false);
  const [showNuevaClave, setShowNuevaClave] = useState(false);
  const [showConfirmarClave, setShowConfirmarClave] = useState(false);

  useEffect(() => {
    async function cargarSesion() {
      try {
        // 1. Intentar cargar sesión admin
        const res = await fetch("/api/auth");
        const data = await res.json();
        
        if (data.authenticated) {
          // Es un usuario administrador
          setUserInfo({
            id: data.rol === 'superadmin' ? 'superadmin' : (data.email || 'admin'), // fallback if id is not direct
            nombre: data.nombre,
            email: data.email,
            rol: data.rol,
            tipo: 'admin'
          });
          
          // Buscar id de usuario exacto en la tabla usuarios_sistema
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          if (supabaseUrl && data.email) {
            const { createClient } = await import("@supabase/supabase-js");
            const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
            const { data: userRow } = await supabase
              .from('usuarios_sistema')
              .select('id')
              .eq('email', data.email)
              .maybeSingle();
            
            if (userRow) {
              setUserInfo(prev => prev ? { ...prev, id: userRow.id } : null);
            }
          }
          
          setLoading(false);
          return;
        }

        // 2. Intentar cargar desde localStorage si es personal
        const personalDataRaw = localStorage.getItem("personal_data");
        if (personalDataRaw) {
          const personalData = JSON.parse(personalDataRaw);
          setUserInfo({
            id: personalData.id,
            nombre: `${personalData.nombres} ${personalData.apellidos}`,
            email: personalData.correo || personalData.username,
            rol: personalData.rol || 'personal',
            tipo: 'personal'
          });
          setLoading(false);
          return;
        }

        // No hay sesión activa, redirigir a login
        router.push("/login");
      } catch (e) {
        console.error("Error al cargar sesión:", e);
        setError("Error al validar sesión activa");
        setLoading(false);
      }
    }

    cargarSesion();
  }, [router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!claveActual || !nuevaClave || !confirmarClave) {
      setError("Por favor completa todos los campos.");
      return;
    }

    if (nuevaClave !== confirmarClave) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    if (nuevaClave.length < 4) {
      setError("La contraseña o PIN debe tener al menos 4 caracteres.");
      return;
    }

    // Si es personal, validar que el PIN cumpla los requisitos si es puramente numérico
    if (userInfo?.tipo === 'personal' && /^\d+$/.test(nuevaClave) && (nuevaClave.length < 4 || nuevaClave.length > 6)) {
      setError("Un PIN numérico de personal debe tener entre 4 y 6 dígitos.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/perfil/cambiar-clave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoUsuario: userInfo?.tipo,
          userId: userInfo?.id,
          claveActual,
          nuevaClave
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al cambiar la contraseña");
      }

      setSuccess("¡Tu credencial de acceso ha sido actualizada correctamente!");
      setClaveActual("");
      setNuevaClave("");
      setConfirmarClave("");
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 sm:py-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Mi Perfil</h1>
        <p className="text-slate-400 mt-1 text-sm">Administra tu cuenta y configura tu clave de acceso.</p>
      </div>

      {/* Bento-style Cards */}
      <div className="grid grid-cols-1 gap-6">
        {/* Info card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/[0.06] flex flex-col sm:flex-row items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-2xl font-bold">
            {userInfo?.nombre[0]}
          </div>
          <div className="text-center sm:text-left min-w-0 flex-1">
            <h2 className="text-lg font-bold text-white truncate">{userInfo?.nombre}</h2>
            <p className="text-slate-400 text-xs sm:text-sm font-mono truncate">{userInfo?.email}</p>
            <span className="inline-block mt-2 text-[10px] px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-semibold uppercase tracking-wider">
              {userInfo?.rol}
            </span>
          </div>
        </div>

        {/* Change password card */}
        <div className="glass-panel p-6 rounded-2xl border border-white/[0.06] space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-white/[0.06]">
            <Key className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Seguridad de la Cuenta</h2>
          </div>

          {success && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-fade-in">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p>{success}</p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm animate-fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Contraseña / PIN Actual
              </label>
              <div className="relative">
                <input
                  required
                  type={showClaveActual ? "text" : "password"}
                  value={claveActual}
                  onChange={(e) => setClaveActual(e.target.value)}
                  placeholder="Introduce tu clave actual"
                  className="w-full bg-slate-950/40 border border-white/[0.08] rounded-xl py-3 px-4 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowClaveActual(!showClaveActual)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                >
                  {showClaveActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Nueva Contraseña / PIN
                </label>
                <div className="relative">
                  <input
                    required
                    type={showNuevaClave ? "text" : "password"}
                    value={nuevaClave}
                    onChange={(e) => setNuevaClave(e.target.value)}
                    placeholder="Min. 4 caracteres"
                    className="w-full bg-slate-950/40 border border-white/[0.08] rounded-xl py-3 px-4 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNuevaClave(!showNuevaClave)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                  >
                    {showNuevaClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Confirmar Nueva Credencial
                </label>
                <div className="relative">
                  <input
                    required
                    type={showConfirmarClave ? "text" : "password"}
                    value={confirmarClave}
                    onChange={(e) => setConfirmarClave(e.target.value)}
                    placeholder="Repite la nueva clave"
                    className="w-full bg-slate-950/40 border border-white/[0.08] rounded-xl py-3 px-4 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmarClave(!showConfirmarClave)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                  >
                    {showConfirmarClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={saving || !claveActual || !nuevaClave || !confirmarClave}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-all shadow-lg ${
                  saving || !claveActual || !nuevaClave || !confirmarClave
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/[0.04]"
                    : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
