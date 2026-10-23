export interface EmailNotificationData {
  nombreRepresentante: string;
  nombreEstudiante: string;
  tipo: 'ENTRADA' | 'SALIDA' | string;
  horaLocal: string;
  fotoUrl?: string | null;
  nombreColegio: string;
  grado?: string;
  seccion?: string;
}

export function generarHtmlCorreoAsistencia(data: EmailNotificationData): string {
  const {
    nombreRepresentante,
    nombreEstudiante,
    tipo,
    horaLocal,
    fotoUrl,
    nombreColegio,
    grado = '',
    seccion = ''
  } = data;

  const esEntrada = tipo === 'ENTRADA';
  const colorTema = esEntrada ? '#10b981' : '#f43f5e'; // Verde esmeralda para entrada, Rosa/Rojo para salida
  const colorFondoPill = esEntrada ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)';
  const textoEstado = esEntrada ? 'ENTRADA REGISTRADA' : 'SALIDA REGISTRADA';

  // Obtener iniciales para el avatar por defecto
  const partesNombre = nombreEstudiante.trim().split(/\s+/);
  const iniciales = partesNombre.length >= 2 
    ? `${partesNombre[0][0]}${partesNombre[partesNombre.length - 1][0]}`.toUpperCase()
    : nombreEstudiante.substring(0, 2).toUpperCase();

  // URL del logo de Asisto (podemos usar una URL pública confiable de Supabase o un placeholder SVG elegante en línea)
  // Como los clientes de correo bloquean algunos SVGs en línea o imágenes no seguras, utilizaremos un diseño HTML puro
  // de alta fidelidad que se renderiza perfecto en cualquier cliente.
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notificación de Asistencia - ${nombreColegio}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 10px;">
        <tr>
          <td align="center">
            
            <!-- CONTENEDOR PRINCIPAL -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9;">
              
              <!-- HEADER DE LA INSTITUCIÓN -->
              <tr>
                <td style="padding: 30px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);">
                  <div style="display: inline-block; width: 56px; height: 56px; background-color: #4f46e5; border-radius: 16px; line-height: 56px; font-size: 28px; text-align: center; margin-bottom: 12px; color: #ffffff; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                    🏫
                  </div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.025em; font-family: sans-serif;">
                    ${nombreColegio}
                  </h1>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600;">
                    Control de Asistencia Digital
                  </p>
                </td>
              </tr>
              
              <!-- CUERPO PRINCIPAL -->
              <tr>
                <td style="padding: 40px 40px 30px 40px;">
                  
                  <!-- SALUDO -->
                  <p style="margin: 0 0 25px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                    Estimado(a) representante <strong>${nombreRepresentante}</strong>,
                  </p>
                  
                  <!-- PILL DE ESTADO -->
                  <div style="text-align: center; margin-bottom: 30px;">
                    <span style="display: inline-block; background-color: ${colorFondoPill}; color: ${colorTema}; font-size: 12px; font-weight: 800; letter-spacing: 0.1em; padding: 8px 18px; border-radius: 100px; border: 1px solid ${colorTema}33; text-transform: uppercase;">
                      ● ${textoEstado}
                    </span>
                  </div>
                  
                  <!-- SECCIÓN DE FOTO / AVATAR -->
                  <div style="text-align: center; margin-bottom: 30px;">
                    ${fotoUrl ? `
                      <div style="display: inline-block; position: relative;">
                        <img src="${fotoUrl}" alt="Foto de ${nombreEstudiante}" style="width: 130px; height: 130px; border-radius: 50%; object-fit: cover; border: 4px solid #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); display: block;" />
                        <div style="position: absolute; bottom: 2px; right: 2px; width: 26px; height: 26px; border-radius: 50%; background-color: ${colorTema}; border: 3px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
                      </div>
                    ` : `
                      <div style="display: inline-block; position: relative;">
                        <div style="width: 130px; height: 130px; border-radius: 50%; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); color: #475569; font-size: 42px; font-weight: 700; line-height: 130px; text-align: center; border: 4px solid #ffffff; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); font-family: sans-serif;">
                          ${iniciales}
                        </div>
                        <div style="position: absolute; bottom: 2px; right: 2px; width: 26px; height: 26px; border-radius: 50%; background-color: ${colorTema}; border: 3px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"></div>
                      </div>
                    `}
                  </div>
                  
                  <!-- DETALLES DEL REGISTRO -->
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 30px;">
                    <tr>
                      <td style="padding-bottom: 12px; font-size: 13px; color: #64748b; font-weight: 500; width: 35%;">Estudiante</td>
                      <td style="padding-bottom: 12px; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right;">${nombreEstudiante}</td>
                    </tr>
                    ${grado || seccion ? `
                    <tr>
                      <td style="padding-bottom: 12px; font-size: 13px; color: #64748b; font-weight: 500;">Sección académica</td>
                      <td style="padding-bottom: 12px; font-size: 14px; color: #334155; font-weight: 600; text-align: right;">${grado} - ${seccion}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding-bottom: 12px; font-size: 13px; color: #64748b; font-weight: 500;">Hora de registro</td>
                      <td style="padding-bottom: 12px; font-size: 14px; color: #334155; font-weight: 600; text-align: right;">${horaLocal}</td>
                    </tr>
                    <tr>
                      <td style="font-size: 13px; color: #64748b; font-weight: 500; width: 35%;">Ubicación</td>
                      <td style="font-size: 14px; color: #334155; font-weight: 600; text-align: right;">Puerta Principal</td>
                    </tr>
                  </table>
                  
                  <!-- MENSAJE DE TRANQUILIDAD -->
                  <div style="background-color: ${colorFondoPill}; border-left: 4px solid ${colorTema}; padding: 15px 20px; border-radius: 8px; margin-bottom: 10px;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #1e293b; font-weight: 500;">
                      ${esEntrada 
                        ? '✓ El estudiante ha ingresado exitosamente a la institución y se encuentra en sus actividades académicas programadas.' 
                        : 'ℹ El estudiante ha salido formalmente del plantel. Le recordamos mantener la supervisión habitual en su traslado.'}
                    </p>
                  </div>
                  
                </td>
              </tr>
              
              <!-- FOOTER DE ASISTO -->
              <tr>
                <td style="padding: 25px 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
                  <!-- Logo Asisto Integrado en HTML con Altas Prestaciones -->
                  <div style="margin-bottom: 10px; font-size: 16px; font-weight: 800; color: #1e293b; font-family: sans-serif; letter-spacing: -0.025em;">
                    ✦ ASISTO <span style="color: #4f46e5; font-size: 12px; font-weight: 600; vertical-align: middle; margin-left: 4px; background: rgba(79, 70, 229, 0.1); padding: 2px 6px; border-radius: 4px;">SaaS</span>
                  </div>
                  <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                    Sistema inteligente de control de asistencia escolar en tiempo real.
                  </p>
                  <p style="margin: 6px 0 0 0; font-size: 11px; color: #94a3b8;">
                    Este es un canal de comunicación seguro y oficial. Por favor, no responda directamente a este correo.
                  </p>
                </td>
              </tr>
              
            </table>
            
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export interface RecoveryEmailData {
  nombreUsuario: string;
  codigoRestablecimiento: string;
  nombreColegio: string;
  enlaceRestablecimiento: string;
}

export function generarHtmlCorreoRecuperacion(data: RecoveryEmailData): string {
  const { nombreUsuario, codigoRestablecimiento, nombreColegio, enlaceRestablecimiento } = data;
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Restablecer tu Acceso - Asisto</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); border: 1px solid #f1f5f9;">
              <tr>
                <td style="padding: 30px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);">
                  <div style="display: inline-block; width: 56px; height: 56px; background-color: #f59e0b; border-radius: 16px; line-height: 56px; font-size: 28px; text-align: center; margin-bottom: 12px; color: #ffffff;">
                    🔑
                  </div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                    ${nombreColegio}
                  </h1>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600;">
                    Recuperación de Credenciales
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px 40px 30px 40px;">
                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334155;">
                    Hola <strong>${nombreUsuario}</strong>,
                  </p>
                  <p style="margin: 0 0 25px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                    Recibimos una solicitud para restablecer el acceso a tu cuenta en Asisto. Utiliza el siguiente código temporal de restablecimiento para configurar un nuevo PIN o contraseña:
                  </p>
                  <div style="text-align: center; margin-bottom: 30px; background-color: #f1f5f9; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1;">
                    <span style="font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: 0.25em;">
                      ${codigoRestablecimiento}
                    </span>
                  </div>
                  <p style="margin: 0 0 25px 0; font-size: 14px; line-height: 1.6; color: #475569; text-align: center;">
                    O haz clic en el siguiente botón para restablecerlo directamente:
                  </p>
                  <div style="text-align: center; margin-bottom: 30px;">
                    <a href="${enlaceRestablecimiento}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                      Restablecer PIN / Contraseña
                    </a>
                  </div>
                  <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                    * Este código de seguridad vencerá en 2 horas. Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 25px 40px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
                  <div style="margin-bottom: 10px; font-size: 16px; font-weight: 800; color: #1e293b;">
                    ✦ ASISTO
                  </div>
                  <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                    Canal oficial de soporte institucional.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function enviarCorreoAsistencia({
  estudianteId,
  tipo,
}: {
  estudianteId: string;
  tipo: string;
}): Promise<{ ok: boolean; message?: string; emailId?: string; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('[notificar] RESEND_API_KEY no configurada en las variables de entorno.');
    return { ok: false, message: 'RESEND_API_KEY no configurada' };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { ok: false, error: 'Supabase credentials missing' };
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  // 1. Obtener datos del estudiante
  const { data: estudiante, error: errEst } = await supabase
    .from('estudiantes')
    .select('id, nombre_completo, cedula, grado, seccion, correo_representante, nombre_representante, foto_url, institucion_id')
    .eq('id', estudianteId)
    .maybeSingle();

  if (errEst || !estudiante) {
    console.error('[notificar] Estudiante no encontrado:', errEst?.message);
    return { ok: false, error: 'Estudiante no encontrado' };
  }

  if (!estudiante.correo_representante) {
    console.warn(`[notificar] El estudiante ${estudiante.nombre_completo} no tiene correo de representante.`);
    return { ok: false, message: 'Sin correo de representante registrado' };
  }

  // 2. Obtener nombre de la institución
  const { data: institucion } = await supabase
    .from('instituciones')
    .select('nombre')
    .eq('id', estudiante.institucion_id)
    .maybeSingle();

  const nombreColegio = institucion?.nombre || 'Colegio Rafael Castillo';

  // 3. Hora local Venezuela
  const now = new Date();
  const horaLocal = now.toLocaleTimeString('es-VE', {
    hour12: true,
    timeZone: 'America/Caracas',
  });

  // 4. Generar HTML
  const emailHtml = generarHtmlCorreoAsistencia({
    nombreRepresentante: estudiante.nombre_representante ?? '',
    nombreEstudiante: estudiante.nombre_completo ?? '',
    tipo,
    horaLocal,
    fotoUrl: estudiante.foto_url,
    nombreColegio,
    grado: estudiante.grado || '',
    seccion: estudiante.seccion || '',
  });

  // 5. Enviar con Resend
  const { Resend } = await import('resend');
  const resend = new Resend(resendApiKey);
  const primaryFrom = process.env.RESEND_FROM_EMAIL || `${nombreColegio} <notificaciones@aulascolegiorafaelcastillo.com>`;
  const subject = `Notificación de ${tipo === 'ENTRADA' ? 'Entrada' : 'Salida'} — ${estudiante.nombre_completo}`;

  let emailData: { id: string } | null = null;
  let emailError: { message?: string; name?: string } | null = null;

  const result1 = await resend.emails.send({
    from: primaryFrom,
    to: estudiante.correo_representante.trim(),
    subject,
    html: emailHtml,
  });

  emailData = result1.data;
  emailError = result1.error;

  // Fallback si el dominio personalizado no está verificado en Resend todavía
  if (
    emailError &&
    (emailError.message?.toLowerCase().includes('domain') ||
      emailError.message?.toLowerCase().includes('verify') ||
      emailError.message?.toLowerCase().includes('onboarding') ||
      emailError.name === 'validation_error')
  ) {
    console.warn('[notificar] Dominio personalizado no verificado en Resend. Reintentando con onboarding@resend.dev...');
    const resultFallback = await resend.emails.send({
      from: `${nombreColegio} <onboarding@resend.dev>`,
      to: estudiante.correo_representante.trim(),
      subject,
      html: emailHtml,
    });
    emailData = resultFallback.data;
    emailError = resultFallback.error;
  }

  if (emailError) {
    console.error('[notificar] Error enviando email vía Resend:', emailError);
    return { ok: false, error: emailError.message || 'Error al enviar email' };
  }

  console.info(`[notificar] ✅ Email enviado a ${estudiante.correo_representante} | id=${emailData?.id}`);
  return { ok: true, emailId: emailData?.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOQUE DE COBRANZAS INSTITUCIONALES (ESTÁNDAR COMÚN)
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailCobranzaData {
  nombreRepresentante: string;
  nombreEstudiante: string;
  grado?: string;
  seccion: string;
  conceptoMeses: string;
  montoCuotas: number;
  montoMora?: number;
  totalPendiente: number;
  nombreColegio?: string;
  observacion?: string;
}

export function generarHtmlCorreoCobranza(data: EmailCobranzaData): string {
  const {
    nombreRepresentante,
    nombreEstudiante,
    grado = '',
    seccion = '',
    conceptoMeses,
    montoCuotas,
    montoMora = 0,
    totalPendiente,
    nombreColegio = 'U.E. Colegio Rafael Castillo',
    observacion,
  } = data;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://colegiorafaelcastillo.com').replace(/\/+$/, '');
  const logoUrl = `${appUrl}/logo%20crc.png`;
  const seccionTexto = grado ? `${grado} "${seccion}"` : seccion;
  const tieneMora = typeof montoMora === 'number' && montoMora > 0;

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Estado de Cuenta Escolar - ${nombreColegio}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b1329; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #1e293b;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b1329; padding: 35px 12px;">
        <tr>
          <td align="center">
            
            <!-- CONTENEDOR PRINCIPAL -->
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.4); border: 1px solid #1e293b;">
              
              <!-- CABECERA INSTITUCIONAL CON LOGO LOCAL CRC -->
              <tr>
                <td style="padding: 28px 32px 22px 32px; text-align: center; background: linear-gradient(135deg, #0a1628 0%, #1a3a6b 50%, #0d2347 100%); border-bottom: 3px solid #c9a227;">
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center">
                        <div style="display: inline-block; padding: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 14px; border: 1px solid rgba(201, 162, 39, 0.35); margin-bottom: 12px;">
                          <img src="${logoUrl}" alt="${nombreColegio}" width="62" height="62" style="display: block; width: 62px; height: 62px; object-fit: contain;" />
                        </div>
                        <h1 style="margin: 0; font-size: 19px; font-weight: 800; color: #ffffff; letter-spacing: 0.02em; text-transform: uppercase;">
                          ${nombreColegio}
                        </h1>
                        <div style="margin-top: 5px; display: inline-block; background: rgba(201, 162, 39, 0.15); border: 1px solid rgba(201, 162, 39, 0.4); padding: 3px 12px; border-radius: 20px;">
                          <span style="font-size: 10px; font-weight: 700; color: #f0d060; letter-spacing: 0.12em; text-transform: uppercase;">
                            Departamento de Administración y Cobranzas · Año Escolar 2026–2027
                          </span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- CUERPO PRINCIPAL -->
              <tr>
                <td style="padding: 36px 36px 28px 36px;">
                  
                  <!-- SALUDO FORMAL -->
                  <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1e293b;">
                    Estimado(a) <strong>${nombreRepresentante || 'Representante'}</strong>:
                  </p>
                  
                  <!-- CONTEXTO ESCOLAR -->
                  <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.65; color: #334155;">
                    Nos comunicamos desde la Administración Institucional en relación al estatus administrativo de su representado(a): <strong style="color: #0f172a;">${nombreEstudiante}</strong>, cursante de <strong style="color: #0f172a;">${seccionTexto}</strong>.
                  </p>
                  
                  <!-- TARJETA DESTACADA DE SALDO (ESTILO BENTO) -->
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8faff; border-radius: 16px; border: 1.5px solid #dbeafe; overflow: hidden; margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 16px 20px; background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color: #ffffff;">
                        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #bfdbfe;">
                          📋 Resumen de Obligaciones Escolares
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 20px;">
                        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td style="padding-bottom: 10px; font-size: 13px; color: #64748b; font-weight: 600;">
                              Concepto / Meses:
                            </td>
                            <td style="padding-bottom: 10px; font-size: 13px; color: #0f172a; font-weight: 700; text-align: right;">
                              ${conceptoMeses}
                            </td>
                          </tr>
                          <tr>
                            <td style="padding-bottom: 10px; font-size: 13px; color: #64748b; font-weight: 600;">
                              Subtotal Cuotas:
                            </td>
                            <td style="padding-bottom: 10px; font-size: 14px; color: #0f172a; font-weight: 700; text-align: right; font-family: 'Courier New', Courier, monospace;">
                              $${montoCuotas.toFixed(2)} USD
                            </td>
                          </tr>
                          ${tieneMora ? `
                          <tr>
                            <td style="padding-bottom: 10px; font-size: 13px; color: #dc2626; font-weight: 600;">
                              Recargo / Intereses de Mora:
                            </td>
                            <td style="padding-bottom: 10px; font-size: 14px; color: #dc2626; font-weight: 700; text-align: right; font-family: 'Courier New', Courier, monospace;">
                              +$${montoMora.toFixed(2)} USD
                            </td>
                          </tr>
                          ` : ''}
                          <tr>
                            <td colspan="2" style="padding-top: 12px; border-top: 1.5px dashed #cbd5e1;">
                              <div style="background: linear-gradient(135deg, #0a1628 0%, #1e3a8a 100%); border-radius: 12px; padding: 14px 18px; text-align: center; border: 1px solid #c9a227;">
                                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #f0d060; margin-bottom: 4px;">
                                  Total Pendiente a Cancelar
                                </div>
                                <div style="font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.02em; font-family: 'Courier New', Courier, monospace;">
                                  $${totalPendiente.toFixed(2)} <span style="font-size: 15px; font-weight: 700; color: #cbd5e1;">USD</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </table>
                        
                        ${observacion ? `
                        <div style="margin-top: 14px; padding: 10px 14px; background-color: #fff; border-radius: 8px; border-left: 3px solid #6366f1; font-size: 12px; color: #475569; line-height: 1.5;">
                          <strong style="color: #1e293b;">Nota Administrativa:</strong> ${observacion}
                        </div>
                        ` : ''}
                      </td>
                    </tr>
                  </table>
                  
                  <!-- INSTRUCCIÓN DE PAGO (PROTECCIÓN FINANCIERA ESTRICTA) -->
                  <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 16px 18px; border-radius: 10px; margin-bottom: 26px;">
                    <p style="margin: 0; font-size: 13.5px; line-height: 1.6; color: #78350f; font-weight: 500;">
                      Le recordamos la importancia de mantener al día los compromisos escolares para garantizar la continuidad regular de los servicios educativos. Agradecemos canalizar la cancelación a la brevedad posible a través de nuestros canales administrativos autorizados de manera presencial o habitual.
                    </p>
                  </div>
                  
                  <!-- DESCARGO 24 HORAS -->
                  <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #64748b; font-style: italic;">
                    * Si ya realizó este pago en las últimas 24 horas, por favor desestime esta notificación o remita su soporte correspondiente.
                  </p>
                  
                </td>
              </tr>
              
              <!-- PIE DE PÁGINA FORMAL -->
              <tr>
                <td style="padding: 24px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                  <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                    Administración y Dirección General
                  </div>
                  <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 10px;">
                    ${nombreColegio}
                  </div>
                  <div style="display: inline-block; font-size: 11px; font-weight: 700; color: #4338ca; background-color: #e0e7ff; padding: 3px 10px; border-radius: 6px;">
                    ✦ ASISTO Platform — Gestión Educativa Digital
                  </div>
                </td>
              </tr>
              
            </table>
            
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function enviarCorreoCobranza({
  destinatario,
  datos,
  institucionId,
}: {
  destinatario: string;
  datos: EmailCobranzaData;
  institucionId?: string;
}): Promise<{ ok: boolean; message?: string; emailId?: string; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.warn('[cobranza] RESEND_API_KEY no configurada en las variables de entorno.');
    return { ok: false, error: 'RESEND_API_KEY no configurada en el servidor' };
  }

  const emailLimpio = destinatario.trim().toLowerCase();
  if (!emailLimpio || !emailLimpio.includes('@')) {
    return { ok: false, error: 'Dirección de correo electrónico inválida' };
  }

  // Resolver nombre de la institución si fue suministrado
  let nombreColegio = datos.nombreColegio || 'U.E. Colegio Rafael Castillo';
  if (institucionId) {
    try {
      const { getSupabaseAdmin } = await import('@/lib/supabase/admin');
      const sb = getSupabaseAdmin();
      const { data: inst } = await sb
        .from('instituciones')
        .select('nombre')
        .eq('id', institucionId)
        .maybeSingle();
      if (inst?.nombre) nombreColegio = inst.nombre;
    } catch {
      /* fallback al nombre por defecto */
    }
  }

  datos.nombreColegio = nombreColegio;

  // Marca temporal Venezuela para la referencia del asunto
  const now = new Date();
  const fechaRef = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now);
  const horaRef = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);

  const asunto = `Aviso Administrativo: Saldo Pendiente - ${datos.nombreEstudiante} - Ref: [${fechaRef} - ${horaRef}]`;
  const emailHtml = generarHtmlCorreoCobranza(datos);

  // Message-ID criptográficamente único para aislamiento de bandeja
  const uniqueMessageId = `<cobranza-${Date.now()}-${crypto.randomUUID()}@asisto.local>`;
  const uniqueEntityRef = crypto.randomUUID();

  const { Resend } = await import('resend');
  const resend = new Resend(resendApiKey);
  const primaryFrom =
    process.env.RESEND_FROM_EMAIL || `${nombreColegio} <notificaciones@aulascolegiorafaelcastillo.com>`;

  let emailData: { id: string } | null = null;
  let emailError: { message?: string; name?: string } | null = null;

  try {
    const result1 = await resend.emails.send({
      from: primaryFrom,
      to: emailLimpio,
      subject: asunto,
      html: emailHtml,
      headers: {
        'Message-ID': uniqueMessageId,
        'X-Entity-Ref-ID': uniqueEntityRef,
      },
    });
    emailData = result1.data;
    emailError = result1.error;

    // Fallback a onboarding@resend.dev si el dominio remitente aún no está verificado
    if (
      emailError &&
      (emailError.message?.toLowerCase().includes('domain') ||
        emailError.message?.toLowerCase().includes('verify') ||
        emailError.message?.toLowerCase().includes('onboarding') ||
        emailError.name === 'validation_error')
    ) {
      console.warn('[cobranza] Dominio no verificado. Reintentando con onboarding@resend.dev...');
      const resultFallback = await resend.emails.send({
        from: `${nombreColegio} <onboarding@resend.dev>`,
        to: emailLimpio,
        subject: asunto,
        html: emailHtml,
        headers: {
          'Message-ID': uniqueMessageId,
          'X-Entity-Ref-ID': uniqueEntityRef,
        },
      });
      emailData = resultFallback.data;
      emailError = resultFallback.error;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al despachar correo';
    console.error('[cobranza] Error despachando email:', msg);
    return { ok: false, error: msg };
  }

  if (emailError) {
    console.error('[cobranza] Error Resend:', emailError);
    return { ok: false, error: emailError.message || 'Error al enviar correo' };
  }

  return { ok: true, emailId: emailData?.id };
}

