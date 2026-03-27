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

## Limpieza: eliminar módulo de Cursos
- [x] Eliminar enlace "Cursos" del sidebar
- [x] Eliminar enlace "Alertas" del sidebar (solo relevante para cursos)
- [x] Eliminar ruta /monitor del App.tsx
- [x] Simplificar Dashboard eliminando métricas de cursos

## Bug: Monitor deja de ejecutarse
- [x] Diagnosticar: scheduler en memoria se pierde al reiniciar el servidor (hot-reload)
- [x] Corregir: persistir estado del scheduler en tabla court_scheduler_state
- [x] Auto-arranque al iniciar el servidor si estaba activo antes del reinicio
- [x] Tests: 31/31 passing
- [x] Checkpoint

## Bug: Registros de actividad quedan en estado "Ejecutando"
- [x] Diagnosticar: faltaba try/catch global en runCourtMonitorCycle
- [x] Corregir: envolver todo el ciclo en try/catch para garantizar finishMonitorRun siempre se llama
- [x] Limpiar registros históricos atascados en 'running'
- [x] Tests: 31/31 passing
- [x] Checkpoint

## Bug crítico: Scheduler se detiene por ECONNRESET en MySQL
- [x] Diagnosticar: causa raíz es ECONNRESET en conexión MySQL inactiva tras horas sin uso
- [x] Capa 1: wrapper withDbRetry que detecta ECONNRESET, resetea el pool y reintenta automáticamente
- [x] Capa 2: createMonitorRun y finishMonitorRun usan withDbRetry; fallback sin DB en el ciclo
- [x] Capa 3: Watchdog del scheduler (comprueba cada minuto si lleva >2×intervalo sin ejecutar)
- [x] Migrar a mysql2/promise para mejor compatibilidad con Drizzle y async/await
- [x] Tests de resiliencia: 9 nuevos tests (withDbRetry, fallback sin DB, watchdog) → 40/40 passing
- [x] Prueba en vivo: ECONNRESET → reintento exitoso, fallback -1, watchdog detecta atasco
- [x] Checkpoint

## Bug UX: Incoherencia entre controles del scheduler
- [x] Diagnosticar duplicidad: Configuración controlaba el scheduler de Cursos (obsoleto), Dashboard el de Pistas (activo)
- [x] Eliminar el panel "Control del Monitor" de Configuración (queda solo en Dashboard)
- [x] Mover el selector de intervalo (1/2/5/10/15/30m) al header del Dashboard junto a los botones
- [x] Sincronizar: guardar intervalo llama a courts.updateInterval que reinicia el scheduler si está activo
- [x] Tests: 40/40 passing
- [x] Checkpoint

## Bug: Vigilancia de pistas no guarda los horarios
- [x] Diagnosticar: los horarios sí se guardaban en DB, pero el formulario no reseteaba el estado al cerrarse (los valores anteriores persistían)
- [x] Corregir: añadir handleOpenChange que resetea todos los campos al cerrar el diálogo
- [x] Mejorar UX: reemplazar inputs de texto libre por Select con opciones cada 30 min (07:00–22:30), filtrado dinámico (hora hasta > hora desde)
- [x] Añadir validación: nombre obligatorio, hora mínima < máxima
- [x] Tests: 40/40 passing
- [x] Checkpoint
