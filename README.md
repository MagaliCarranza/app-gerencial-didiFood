# DiDi Food Oaxaca — Dashboard de KPIs

Panel de control gerencial para la operación de DiDi Food en Oaxaca. Permite visualizar KPIs operativos por periodo, analizar restaurantes, conductores, productos y usuarios, y generar reportes PDF por área.

---

## Arquitectura general

```
extraccion/didifood_generador.py
        │  (CSVs)
        ▼
Supabase (PostgreSQL)
        │  (SQL queries vía pg)
        ▼
API Node.js / Express  ──► App React Native / Expo
     (api/index.js)              (app/)
```

---

## Proceso ETL

### Extracción

El archivo `extraccion/didifood_generador.py` simula la operación completa de DiDi Food Oaxaca generando datos sintéticos con distribuciones realistas. Toma como entrada los parámetros de escala definidos en el código y produce archivos CSV listos para importar.

**Parámetros de escala:**

| Parámetro | Valor |
|-----------|-------|
| Periodo cubierto | enero 2020 – mayo 2026 |
| Usuarios | 2,000 |
| Conductores | 500 |
| Restaurantes | 300 |
| Pedidos mínimos por usuario | 80 |
| Pedidos extra (distribución sesgada) | 40,000 |

**CSVs generados y volumen aproximado:**

| Archivo | Registros aprox. | Descripción |
|---------|-----------------|-------------|
| `restaurantes.csv` | 300 | Catálogo de restaurantes con tipo de cocina, colonia, calificación promedio |
| `productos.csv` | ~1,000 | ~3-4 productos por restaurante, con categoría y precio |
| `usuarios.csv` | 2,000 | Clientes con canal de adquisición y dispositivo |
| `conductores.csv` | 500 | Flota con tipo de vehículo, zona y estatus |
| `pedidos.csv` | ~200,000 | Transacciones con propina, distancia, tiempo de preparación y bandera de primera orden |
| `detalle_pedidos.csv` | ~300,000 | 1-3 productos por pedido con cantidad y precio unitario |
| `calificaciones.csv` | ~49,000 | 65% de los pedidos entregados reciben calificación de restaurante y conductor |
| `sanciones_conductores.csv` | ~150 | Historial de sanciones para conductores sancionados e inactivos con antecedentes |
| `combos.csv` | ~240 | Combos con descuento del 10-20%, definidos en el 40% de los restaurantes |
| `combo_productos.csv` | ~600 | Productos que componen cada combo |

---

### Transformación

Una vez ejecutado el generador, los datos pasan por un proceso de limpieza y normalización antes de cargarse en Supabase.

**Normalización estructural**

- La tabla `pedidos` en el generador original incluía los productos en el mismo registro. Se separó en `pedidos` + `detalle_pedidos` para eliminar redundancia y facilitar consultas por producto.
- Cada línea de `detalle_pedidos` contiene `id_pedido`, `id_producto`, `cantidad` y `precio_unitario`. El subtotal por línea se calcula en la API como `cantidad × precio_unitario`.

**Campos calculados en el generador**

- `tiempo_entrega_min`: tiempo total desde la confirmación hasta la entrega.
- `distancia_km`: diferenciada según si la colonia es periférica o central.
- `es_primera_orden`: bandera booleana que indica si es el primer pedido del usuario.
- `calificacion_cond` / `calificacion_rest`: generadas con distribución sesgada hacia la calificación base del conductor o restaurante.
- `gravedad` de sanciones: determinada por tabla de probabilidades según el tipo de falta.

**Tablas derivadas creadas por SQL en Supabase**

Después de importar los CSVs se crean tres tablas adicionales mediante sentencias SQL directamente en Supabase, como paso final de transformación:

| Tabla | Registros aprox. | Descripción |
|-------|-----------------|-------------|
| `metricas_usuario` | ~2,000 | RFM por usuario: recencia, frecuencia y valor monetario acumulado |
| `cohortes_retencion` | ~600 | Retención mensual por cohorte de ingreso |
| `demanda_horaria` | ~120 | Volumen de pedidos por día de semana y hora (patrón histórico) |

Estas tablas precalculan agregaciones costosas que de otro modo se recalcularían en cada consulta.

---

### Carga

La carga tiene dos etapas:

**1. Importación a Supabase**

Los CSVs se importan a PostgreSQL mediante el panel de importación de Supabase (Table Editor → Import data). Cada archivo corresponde a una tabla del mismo nombre. Las tablas derivadas se crean ejecutando las sentencias SQL correspondientes en el SQL Editor de Supabase.

**2. Consumo — API y aplicación**

La API (`api/index.js`) expone ~40 endpoints REST que consultan la base de datos. La app React Native consume esos endpoints y presenta los datos como KPIs, gráficas y tablas interactivas, con la posibilidad de exportar reportes en PDF.

**Lógica de periodo activo (`ULTIMO_MES`)**

Para que los indicadores del "mes actual" siempre apunten al último mes con datos completos, la API utiliza una subconsulta SQL constante:

```sql
(SELECT mes FROM (
  SELECT DATE_TRUNC('month', fecha_pedido) AS mes
  FROM pedidos
  GROUP BY 1
  HAVING COUNT(*) > 1000
  ORDER BY mes DESC
  LIMIT 1
) t)
```

Esto evita mostrar datos parciales si el mes en curso todavía no tiene suficientes pedidos.

---

## Esquema de base de datos

### Tablas transaccionales (importadas desde CSV)

| Tabla | Descripción | Columnas clave |
|-------|-------------|----------------|
| `restaurantes` | Catálogo de restaurantes | `id_restaurante`, `nombre`, `tipo_cocina`, `colonia`, `calificacion_promedio` |
| `productos` | Catálogo de productos | `id_producto`, `id_restaurante`, `nombre_producto`, `categoria`, `precio` |
| `usuarios` | Clientes registrados | `id_usuario`, `canal_adquisicion`, `dispositivo`, `fecha_registro` |
| `conductores` | Flota de conductores | `id_conductor`, `tipo_vehiculo`, `zona_operacion`, `estatus`, `calificacion_promedio` |
| `pedidos` | Órdenes (tabla principal) | `id_pedido`, `id_usuario`, `id_restaurante`, `id_conductor`, `fecha_pedido`, `estatus_pedido`, `total`, `subtotal`, `propina`, `distancia_km`, `tiempo_entrega_min`, `es_primera_orden` |
| `detalle_pedidos` | Líneas de cada pedido | `id_detalle`, `id_pedido`, `id_producto`, `cantidad`, `precio_unitario` |
| `calificaciones` | Reseñas por pedido entregado | `id_calificacion`, `id_pedido`, `id_restaurante`, `id_conductor`, `calificacion_rest`, `calificacion_cond`, `fecha` |
| `sanciones_conductores` | Historial de sanciones | `id_sancion`, `id_conductor`, `tipo_sancion`, `gravedad`, `estatus_sancion`, `fecha_sancion` |
| `combos` | Combos con descuento | `id_combo`, `id_restaurante`, `nombre_combo`, `precio_combo`, `ahorro_pct` |
| `combo_productos` | Composición de combos | `id_combo`, `id_producto`, `cantidad` |

### Tablas derivadas (creadas por SQL en Supabase)

| Tabla | Descripción |
|-------|-------------|
| `metricas_usuario` | Segmentación RFM: recencia, frecuencia, valor monetario por usuario |
| `cohortes_retencion` | Retención mensual agrupada por cohorte de primer pedido |
| `demanda_horaria` | Promedio de pedidos por hora y día de la semana (histórico) |

---

## Módulos de la aplicación

### Login (`app/login.tsx`)
Pantalla de acceso al panel. Valida credenciales llamando al endpoint `POST /auth/login` de la API, que las compara contra las variables de entorno `GERENTE_EMAIL` y `GERENTE_PASSWORD` definidas en `api/.env`. Incluye toggle para mostrar u ocultar la contraseña.

**Credenciales de acceso:**
```
Usuario:    didifood@gmail.com
Contraseña: didi123
```

### Inicio (`app/(tabs)/index.tsx`)
Dashboard principal con 6 KPIs del mes actual: total de pedidos, ingresos, ticket promedio, tiempo de entrega, tasa de cancelación y estado de conductores. Cada indicador muestra la variación porcentual respecto al mes anterior. Sirve como vista rápida para decisiones del día a día.

### Pedidos (`app/(tabs)/pedidos.tsx`)
Análisis mensual de pedidos filtrado por año. Muestra volumen, estatus, clientes nuevos vs. recurrentes, tiempos de entrega por zona, ratio de costo de envío y evolución histórica con opción de fijar metas anuales y mensuales.

### Restaurantes (`app/(tabs)/restaurantes.tsx`)
Tres secciones del mes actual: distribución de pedidos por colonia, participación por tipo de cocina (con sugerencias de marketing), y ranking de restaurantes por ingresos con comisión sugerida y alertas de cancelación. Todos los filtros son ajustables.

### Conductores (`app/(tabs)/conductores.tsx`)
Análisis de la flota: resumen de estado actual (activos, inactivos, sancionados), volumen por tipo de vehículo, saturación por zona, listado de sancionados con historial, calificaciones reales del mes y priorización de conductores para reactivar.

### Más (`app/(tabs)/mas.tsx`)
Concentra tres áreas adicionales:
- **Usuarios**: segmentación RFM, canales de adquisición, métodos de pago y análisis de retención por cohorte.
- **Productos**: top vendidos del mes, combos con menor rendimiento y oportunidades de horario con baja demanda.
- **Reportes PDF**: genera y comparte reportes por sección (Pedidos, Restaurantes, Conductores, Usuarios) con datos etiquetados como mes actual, histórico o estado actual según corresponda.

---

## API — Endpoints por área

| Área | Endpoints |
|------|-----------|
| KPIs generales | `/kpi/total-pedidos`, `/kpi/ingresos`, `/kpi/ticket-promedio`, `/kpi/tiempo-entrega`, `/kpi/cancelaciones`, `/kpi/conductores`, `/kpi/top-restaurantes`, `/kpi/ingresos-cocina`, `/kpi/metodos-pago`, `/kpi/pedidos-colonia`, `/kpi/tendencia-diaria` |
| Pedidos | `/pedidos/por-periodo`, `/pedidos/por-estatus`, `/pedidos/clientes-nuevos`, `/pedidos/tiempos`, `/pedidos/ratio-envio`, `/pedidos/tiempos-por-zona`, `/pedidos/propinas`, `/pedidos/retencion` |
| Restaurantes | `/restaurantes/ranking`, `/restaurantes/distribucion`, `/restaurantes/por-cocina` |
| Conductores | `/conductores/por-vehiculo`, `/conductores/por-zona`, `/conductores/sancionados`, `/conductores/reactivacion`, `/conductores/tiempos-por-zona`, `/conductores/sanciones` |
| Productos | `/productos/top-vendidos`, `/productos/combos-sugeridos`, `/productos/categorias`, `/productos/premium`, `/productos/demanda-horaria` |
| Calificaciones | `/calificaciones/restaurantes`, `/calificaciones/conductores` |
| Usuarios | `/usuarios/segmentos`, `/usuarios/adquisicion` |
| Combos | `/combos/rendimiento` |
| Oportunidades | `/oportunidades/horario` |

---

## Correr el proyecto

### Requisitos
- Node.js 18+
- Python 3.10+ (solo para regenerar datos)
- Cuenta en Supabase con los CSVs importados

### API

```bash
cd api
npm install
node index.js
```

Requiere `api/.env`:
```
DATABASE_URL=postgresql://...
PORT=3000
```

### App

```bash
npm install
npx expo start
```

La app detecta automáticamente la IP del servidor de desarrollo (Metro) y construye la URL de la API como `http://<ip-local>:3000`. Para usar en dispositivo físico, asegurarse de que el teléfono y la computadora estén en la misma red WiFi.

### Regenerar datos (opcional)

```bash
python extraccion/didifood_generador.py
```

Genera los CSVs en la misma carpeta. Luego importarlos en Supabase desde Table Editor → Import data.
