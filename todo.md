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

## Monitor de Pistas (nueva funcionalidad)
- [x] Migración DB: tablas court_watch_configs y court_availability_snapshots
- [x] Backend: fetchCourtAvailability() usando /v1/availability + /v1/tenants/{id}/resources
- [x] Backend: runCourtMonitorCycle() con filtro miércoles 18:30-20:30
- [x] tRPC: router courts con CRUD de configuraciones y snapshots
- [x] Frontend: página Courts con tabla de disponibilidad en tiempo real
- [x] Frontend: formulario para configurar día/hora/duración a vigilar
- [x] Alertas: notificación cuando aparece slot disponible en el rango configurado
- [x] Tests: 31 tests passing (16 courtMonitor + 14 monitor + 1 auth)
- [x] Checkpoint

## Mejoras Pistas
- [x] Panel rápido: mostrar disponibilidad de los 2 próximos miércoles (no solo el primero)

## Selector de días en Pistas
- [x] Selector de calendario (hasta 2 días) en lugar del panel fijo de miércoles
- [x] Mostrar disponibilidad de los 2 días seleccionados en paralelo
- [x] Persistir la selección en localStorage para no perderla al recargar

## Rediseño sistema de monitorización y alertas
- [x] DB: tabla telegram_contacts (id, name, chat_id, isActive, notes)
- [x] Motor: polling cada 5 min, detectar primera aparición de slots (apertura del día)
- [x] Motor: generar enlace directo a Playtomic por club/fecha
- [x] Motor: enviar alerta a TODOS los contactos Telegram activos cuando se detecta apertura
- [x] Página Contactos: lista gestionable con nombre, chat_id, activar/desactivar, test de mensaje
- [x] Alertas Telegram: mensaje enriquecido con pistas disponibles + enlace directo
- [x] Sidebar: enlace a Contactos
- [x] Tests: 31 tests passing
- [x] Checkpoint

## Registro de Actividad del Monitor
- [ ] DB: tabla monitor_runs (fecha, días consultados, slots encontrados, nuevas aperturas, alertas enviadas, duración ms, estado, error)
- [ ] Backend: helpers insertMonitorRun() y getMonitorRuns() en db.ts
- [ ] Backend: instrumentar runCourtMonitorCycle() para guardar cada ciclo
- [ ] tRPC: endpoint activity.list con paginación
- [ ] Frontend: página Actividad con historial de ejecuciones, badges de estado, estadísticas
- [ ] Sidebar: enlace a Actividad
- [ ] Tests y checkpoint
