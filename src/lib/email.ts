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
