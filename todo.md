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

## Bug: Ciclos atascados en estado "Ejecutando" (huérfanos)
- [x] Diagnosticar: el watchdog reiniciaba el scheduler interrumpiendo ciclos en curso (runId sin finishMonitorRun)
- [x] Correción 1: flag _cycleInProgress evita ciclos solapados y el watchdog no dispara si hay ciclo en curso
- [x] Corrección 2: cleanupOrphanedRuns() marca como 'error' los ciclos running >15min al arrancar
- [x] Corrección 3: el watchdog llama a cleanupOrphanedRuns() antes de reiniciar el scheduler
- [x] Limpiar los ciclos huérfanos existentes en la DB (0 restantes)
- [x] Tests: 40/40 passing
- [x] Checkpoint

## Bug crítico: Slots detectados pero nunca "nuevos" — alertas siempre 0
- [x] Diagnosticar: la ventana de comparación era "hoy" (desde medianoche), por lo que el segundo ciclo del día nunca detectaba nada nuevo
- [x] Corregir: ventana = 2×intervalo+2min (mínimo 12min) — un slot es nuevo si no apareció en el ciclo anterior
- [x] Optimización: guardar snapshot SOLO cuando el slot es nuevo (antes acumulaba millones de filas inútiles)
- [x] Tests: 40/40 passing
- [x] Checkpoint

## Bug: Ciclos "Ejecutando" huérfanos persisten con intervalo 1min y ciclo de 105s
- [x] Diagnosticar: _cycleInProgress sí funciona (logs confirman "omitiendo este tick")
- [x] Los huérfanos eran residuales de sesiones anteriores, ya limpiados
- [x] Tests: 40/40 passing
- [x] Checkpoint

## Bug: Cambiar intervalo en Dashboard no tiene efecto — sigue ejecutando cada minuto
- [x] Diagnosticar: el botón guardar estaba deshabilitado cuando selectedInterval === activeInterval (ambos 1min en memoria)
- [x] Corregir: estado local inicializa a null, se sincroniza con servidor solo la primera vez, selectedInterval es el valor efectivo
- [x] Mejora UX: botón guardar en ámbar cuando hay cambio pendiente, verde cuando está guardado
- [x] Tests: 40/40 passing
- [x] Checkpoint

## Bug crítico: Alertas Telegram nunca se envían — botToken vacío en alert_configs
- [x] Diagnosticar: el toggle de Telegram ocultaba los campos de bot token, guardando botToken="" al hacer clic en Guardar
- [x] Corregir: los campos Bot Token y Chat ID ahora siempre son visibles (no dependen del toggle)
- [x] Añadir indicador visual: borde rojo + aviso si botToken está vacío, borde verde + ✅ si está configurado
- [x] Tests: 40/40 passing
- [x] Checkpoint

## Bug: Botón "Detener" no para el scheduler
- [x] Diagnosticar: el watchdog reactivaba el scheduler inmediatamente después de pararlo (sin distinguir parada manual vs. atasco)
- [x] Corregir: añadir flag _stoppedManually; stopCourtScheduler(manual=true) impide que watchdog y auto-arranque lo reactiven
- [x] El router stopScheduler ahora pasa manual=true
- [x] Tests: 40/40 passing
- [x] Checkpoint

## Bug: Filtro de horario no se aplica — slots cuenta todos los huecos del día
- [x] Verificado: el filtro sí se aplicaba correctamente (solo slots entre startTimeMin y startTimeMax)
- [x] El problema real era la lógica de "nuevo" — resuelto con la mejora de transición 0→>0

## Mejora: Alertas solo cuando se pasa de 0 a >0 slots
- [x] Añadir columna lastSlotCount a court_watch_configs (migración aplicada)
- [x] Nueva lógica: guardar conteo actual al final de cada ciclo; alertar SOLO en transición 0→>0
- [x] Primera ejecución (lastSlotCount=-1): no alerta, solo registra la línea base
- [x] Tests: 40/40 passing
- [x] Checkpoint

## Bug persistente: Ciclos huérfanos "Ejecutando" y ciclos de 1-3s
- [ ] Diagnosticar por qué siguen apareciendo ciclos huérfanos con intervalo de 5min
- [ ] Diagnosticar por qué algunos ciclos terminan en 1-3s (antes tardaban 30-90s)
- [ ] Corregir causa raíz definitivamente
- [ ] Tests y checkpoint

## Feature: Soporte para múltiples clubs
- [x] Revisar schema actual y cómo está hardcodeado el club único
- [x] Tabla monitored_clubs ya existía con id, tenantId, name, city, country, isActive
- [x] court_watch_configs ya tenía columna clubId FK
- [x] El scheduler ya itera por todos los clubs activos y sus vigilancias
- [x] Backend: searchPlaytomicClubs() en courtMonitor.ts (búsqueda en API de Playtomic)
- [x] Backend: addMonitoredClub / removeMonitoredClub / getMonitoredClubs en db.ts
- [x] tRPC: courts.searchClubs, courts.monitoredClubs, courts.addClub, courts.removeClub
- [x] Frontend: diálogo "Gestionar clubs" con búsqueda en tiempo real + lista de clubs monitorizados
- [x] Frontend: selector de club al crear una vigilancia (NewWatchForm)
- [x] Frontend: tabs de selección de club en consulta rápida cuando hay múltiples clubs
- [x] Tests: 40/40 passing
- [x] Checkpoint
