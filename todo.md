# Playtomic Monitor - TODO

## Base de datos
- [x] Tabla `monitored_clubs` - clubes a monitorizar (tenant_id, nombre, etc.)
- [x] Tabla `monitored_courses` - cursos/clases vigilados por club
- [x] Tabla `course_snapshots` - historial de estados de cada curso
- [x] Tabla `alert_history` - historial de alertas enviadas
- [x] Tabla `alert_configs` - configuración de canales de alerta (Telegram, Email)
- [x] Tabla `monitor_settings` - configuración global del monitor (intervalo, activo/inactivo)

## Backend
- [x] Schema Drizzle actualizado con todas las tablas
- [x] Migración SQL aplicada
- [x] Helpers DB en server/db.ts
- [x] Motor de monitorización (polling a la API de Playtomic)
- [x] Integración con API de Playtomic (/v1/lessons y /v1/courses)
- [x] Detección de cambios (0 plazas → >0 plazas)
- [x] Sistema de alertas Telegram (bot)
- [x] Sistema de alertas Email (SMTP/nodemailer)
- [x] Procedimientos tRPC: clubs, courses, alerts, settings, monitor control
- [x] Endpoint para ejecutar monitorización manual
- [x] Tests Vitest para procedimientos clave (15 tests passing)

## Frontend
- [x] Diseño visual elegante (tema oscuro, colores padel/sport)
- [x] Layout con sidebar personalizado
- [x] Página Dashboard: info Rivapadel + estadísticas globales
- [x] Página Monitorización: lista de cursos vigilados con estado en tiempo real
- [x] Página Alertas: historial de notificaciones enviadas
- [x] Página Configuración: canales de alerta (Telegram token, Email SMTP), intervalo de polling
- [x] Indicador de estado del monitor (activo/inactivo, última comprobación)
- [x] Botón de comprobación manual
- [x] Badges de plazas disponibles con colores (verde/rojo/amarillo)

## Integración y pruebas
- [x] Configuración de alertas guardada en DB (sin secrets hardcodeados)
- [x] Test end-to-end del flujo de monitorización (vitest)
- [x] Checkpoint final
