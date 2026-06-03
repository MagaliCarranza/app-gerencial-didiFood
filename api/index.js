require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── UTILIDADES ───────────────────────────────────────────────────────────────

// Último mes con datos completos (ignora meses con menos de 1000 pedidos)
const ULTIMO_MES = `
  (SELECT mes FROM (
    SELECT DATE_TRUNC('month', fecha_pedido) AS mes
    FROM pedidos
    GROUP BY 1
    HAVING COUNT(*) > 1000
    ORDER BY mes DESC
    LIMIT 1
  ) t)
`;

function variacion(actual, anterior) {
  if (!anterior || anterior === 0) return 0;
  return parseFloat(((actual - anterior) / anterior * 100).toFixed(1));
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ status: 'ok', mensaje: 'API KPIs DiDi Food Oaxaca' });
});

// ─── KPI: TOTAL PEDIDOS ───────────────────────────────────────────────────────

app.get('/kpi/total-pedidos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total_historico,
        COUNT(*) FILTER (
          WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
        ) AS mes_actual,
        COUNT(*) FILTER (
          WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES} - INTERVAL '1 month'
        ) AS mes_anterior,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo,
        (SELECT MAX(cnt) FROM (
          SELECT COUNT(*) AS cnt FROM pedidos GROUP BY DATE_TRUNC('month', fecha_pedido)
        ) t) AS mejor_mes
      FROM pedidos
    `);
    const r = rows[0];
    res.json({
      total_historico: parseInt(r.total_historico),
      mes_actual:      parseInt(r.mes_actual),
      mes_anterior:    parseInt(r.mes_anterior),
      mejor_mes:       parseInt(r.mejor_mes) || 0,
      variacion:       variacion(r.mes_actual, r.mes_anterior),
      periodo:         r.periodo.trim(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: INGRESOS ────────────────────────────────────────────────────────────

app.get('/kpi/ingresos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ROUND(COALESCE(SUM(total) FILTER (
          WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
            AND estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 2) AS mes_actual,
        ROUND(COALESCE(SUM(total) FILTER (
          WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES} - INTERVAL '1 month'
            AND estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 2) AS mes_anterior,
        ROUND(COALESCE(SUM(total) FILTER (
          WHERE estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 2) AS total_historico,
        (SELECT ROUND(MAX(s)::NUMERIC, 2) FROM (
          SELECT SUM(total) AS s FROM pedidos
          WHERE estatus_pedido = 'Entregado'
          GROUP BY DATE_TRUNC('month', fecha_pedido)
        ) t) AS mejor_mes
      FROM pedidos
    `);
    const r = rows[0];
    res.json({
      total_historico: parseFloat(r.total_historico),
      mes_actual:      parseFloat(r.mes_actual),
      mes_anterior:    parseFloat(r.mes_anterior),
      mejor_mes:       parseFloat(r.mejor_mes) || 0,
      variacion:       variacion(r.mes_actual, r.mes_anterior),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: TICKET PROMEDIO ─────────────────────────────────────────────────────

app.get('/kpi/ticket-promedio', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ROUND(COALESCE(AVG(subtotal) FILTER (
          WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
            AND estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 2) AS mes_actual,
        ROUND(COALESCE(AVG(subtotal) FILTER (
          WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES} - INTERVAL '1 month'
            AND estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 2) AS mes_anterior,
        ROUND(COALESCE(AVG(subtotal) FILTER (
          WHERE estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 2) AS promedio_historico
      FROM pedidos
    `);
    const r = rows[0];
    res.json({
      promedio_historico: parseFloat(r.promedio_historico),
      mes_actual:         parseFloat(r.mes_actual),
      mes_anterior:       parseFloat(r.mes_anterior),
      variacion:          variacion(r.mes_actual, r.mes_anterior),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: TIEMPO DE ENTREGA ───────────────────────────────────────────────────

app.get('/kpi/tiempo-entrega', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ROUND(COALESCE(AVG(tiempo_entrega_min) FILTER (
          WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
            AND estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 1) AS mes_actual,
        ROUND(COALESCE(AVG(tiempo_entrega_min) FILTER (
          WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES} - INTERVAL '1 month'
            AND estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 1) AS mes_anterior,
        ROUND(COALESCE(AVG(tiempo_entrega_min) FILTER (
          WHERE estatus_pedido = 'Entregado'
        ), 0)::NUMERIC, 1) AS promedio_historico,
        (SELECT ROUND(MIN(a)::NUMERIC, 1) FROM (
          SELECT AVG(tiempo_entrega_min) AS a FROM pedidos
          WHERE estatus_pedido = 'Entregado' AND tiempo_entrega_min IS NOT NULL
          GROUP BY DATE_TRUNC('month', fecha_pedido)
          HAVING COUNT(*) > 10
        ) t) AS mejor_mes
      FROM pedidos
      WHERE tiempo_entrega_min IS NOT NULL
    `);
    const r = rows[0];
    res.json({
      promedio_historico: parseFloat(r.promedio_historico),
      mejor_mes:          parseFloat(r.mejor_mes) || 0,
      mes_actual:         parseFloat(r.mes_actual),
      mes_anterior:       parseFloat(r.mes_anterior),
      variacion:          variacion(r.mes_actual, r.mes_anterior),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: CANCELACIONES ───────────────────────────────────────────────────────

app.get('/kpi/cancelaciones', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estatus_pedido LIKE 'Cancelado%') AS total_cancelados,
        COUNT(*) AS total_pedidos,
        ROUND(
          100.0 * COUNT(*) FILTER (
            WHERE estatus_pedido LIKE 'Cancelado%'
              AND DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
          ) / NULLIF(COUNT(*) FILTER (
            WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
          ), 0)::NUMERIC, 1
        ) AS tasa_actual,
        ROUND(
          100.0 * COUNT(*) FILTER (
            WHERE estatus_pedido LIKE 'Cancelado%'
              AND DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES} - INTERVAL '1 month'
          ) / NULLIF(COUNT(*) FILTER (
            WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES} - INTERVAL '1 month'
          ), 0)::NUMERIC, 1
        ) AS tasa_anterior,
        COUNT(*) FILTER (WHERE estatus_pedido = 'Cancelado por el cliente')    AS cancelado_cliente,
        COUNT(*) FILTER (WHERE estatus_pedido = 'Cancelado por el restaurante') AS cancelado_restaurante,
        COUNT(*) FILTER (WHERE estatus_pedido = 'Cancelado por el conductor')   AS cancelado_conductor
      FROM pedidos
    `);
    const r = rows[0];
    res.json({
      total_cancelados:       parseInt(r.total_cancelados),
      total_pedidos:          parseInt(r.total_pedidos),
      tasa_actual:            parseFloat(r.tasa_actual),
      tasa_anterior:          parseFloat(r.tasa_anterior),
      variacion:              variacion(r.tasa_actual, r.tasa_anterior),
      por_cliente:            parseInt(r.cancelado_cliente),
      por_restaurante:        parseInt(r.cancelado_restaurante),
      por_conductor:          parseInt(r.cancelado_conductor),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: TOP RESTAURANTES ────────────────────────────────────────────────────

app.get('/kpi/top-restaurantes', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        nombre_restaurante,
        tipo_cocina,
        COUNT(*) AS total_pedidos,
        ROUND(SUM(total)::NUMERIC, 2) AS ingresos_total,
        ROUND(AVG(subtotal)::NUMERIC, 2) AS ticket_promedio
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
      GROUP BY nombre_restaurante, tipo_cocina
      ORDER BY total_pedidos DESC
      LIMIT 10
    `);
    res.json(rows.map(r => ({
      nombre:         r.nombre_restaurante,
      tipo_cocina:    r.tipo_cocina,
      total_pedidos:  parseInt(r.total_pedidos),
      ingresos:       parseFloat(r.ingresos_total),
      ticket_promedio: parseFloat(r.ticket_promedio),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: PEDIDOS POR COLONIA ─────────────────────────────────────────────────

app.get('/kpi/pedidos-colonia', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        colonia_entrega,
        municipio_entrega,
        COUNT(*) AS total_pedidos,
        ROUND(AVG(tiempo_entrega_min)::NUMERIC, 1) AS tiempo_promedio,
        ROUND(SUM(total)::NUMERIC, 2) AS ingresos
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
      GROUP BY colonia_entrega, municipio_entrega
      ORDER BY total_pedidos DESC
      LIMIT 15
    `);
    res.json(rows.map(r => ({
      colonia:         r.colonia_entrega,
      municipio:       r.municipio_entrega,
      total_pedidos:   parseInt(r.total_pedidos),
      tiempo_promedio: parseFloat(r.tiempo_promedio),
      ingresos:        parseFloat(r.ingresos),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: INGRESOS POR TIPO DE COCINA ────────────────────────────────────────

app.get('/kpi/ingresos-cocina', async (req, res) => {
  try {
    const ULTIMO_MES = `(SELECT DATE_TRUNC('month', fecha_pedido) FROM pedidos GROUP BY 1 HAVING COUNT(*) > 1000 ORDER BY 1 DESC LIMIT 1)`;
    const { rows } = await pool.query(`
      SELECT
        tipo_cocina,
        COUNT(*) AS total_pedidos,
        ROUND(SUM(total)::NUMERIC, 2) AS ingresos,
        ROUND(AVG(subtotal)::NUMERIC, 2) AS ticket_promedio,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
        AND DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
      GROUP BY tipo_cocina
      ORDER BY ingresos DESC
    `);
    res.json(rows.map(r => ({
      tipo_cocina:     r.tipo_cocina,
      total_pedidos:   parseInt(r.total_pedidos),
      ingresos:        parseFloat(r.ingresos),
      ticket_promedio: parseFloat(r.ticket_promedio),
      periodo:         r.periodo?.trim() ?? '',
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: MÉTODOS DE PAGO ─────────────────────────────────────────────────────

app.get('/kpi/metodos-pago', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        metodo_pago,
        COUNT(*) AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS porcentaje
      FROM pedidos
      GROUP BY metodo_pago
      ORDER BY total DESC
    `);
    res.json(rows.map(r => ({
      metodo:     r.metodo_pago,
      total:      parseInt(r.total),
      porcentaje: parseFloat(r.porcentaje),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: TENDENCIA DIARIA (últimos 30 días del dataset) ─────────────────────

app.get('/kpi/tendencia-diaria', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH ultimo_dia AS (
        SELECT MAX(fecha_pedido)::DATE AS dia FROM pedidos
      )
      SELECT
        fecha_pedido::DATE AS fecha,
        COUNT(*) AS pedidos,
        ROUND(SUM(total)::NUMERIC, 2) AS ingresos
      FROM pedidos, ultimo_dia
      WHERE fecha_pedido::DATE > dia - 30
        AND estatus_pedido = 'Entregado'
      GROUP BY fecha_pedido::DATE
      ORDER BY fecha
    `);
    res.json(rows.map(r => ({
      fecha:    r.fecha,
      pedidos:  parseInt(r.pedidos),
      ingresos: parseFloat(r.ingresos),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── KPI: CONDUCTORES ────────────────────────────────────────────────────────

app.get('/kpi/conductores', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estatus = 'Activo')     AS activos,
        COUNT(*) FILTER (WHERE estatus = 'Inactivo')   AS inactivos,
        COUNT(*) FILTER (WHERE estatus = 'Sancionado') AS sancionados,
        (SELECT ROUND(AVG(calificacion_conductor)::NUMERIC, 2)
         FROM calificaciones
         WHERE DATE_TRUNC('month', fecha) = ${ULTIMO_MES}
           AND calificacion_conductor IS NOT NULL
        ) AS calificacion_mes_actual
      FROM conductores
    `);
    const r = rows[0];
    res.json({
      total:                  parseInt(r.total),
      activos:                parseInt(r.activos),
      inactivos:              parseInt(r.inactivos),
      sancionados:            parseInt(r.sancionados),
      calificacion_promedio:  parseFloat(r.calificacion_mes_actual) || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PEDIDOS: POR PERIODO (año/mes + colonia) ────────────────────────────────

app.get('/pedidos/por-periodo', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        EXTRACT(YEAR  FROM fecha_pedido)::INT AS anio,
        EXTRACT(MONTH FROM fecha_pedido)::INT AS mes,
        municipio_entrega,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estatus_pedido = 'Entregado') AS entregados
      FROM pedidos
      GROUP BY 1, 2, 3
      ORDER BY 1, 2, 3
    `);
    res.json(rows.map(r => ({
      anio:       r.anio,
      mes:        r.mes,
      municipio:  r.municipio_entrega,
      total:      parseInt(r.total),
      entregados: parseInt(r.entregados),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PEDIDOS: POR ESTATUS ────────────────────────────────────────────────────

app.get('/pedidos/por-estatus', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        estatus_pedido,
        tipo_cocina,
        COUNT(*) AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY estatus_pedido), 1) AS pct_cocina
      FROM pedidos
      GROUP BY estatus_pedido, tipo_cocina
      ORDER BY estatus_pedido, total DESC
    `);

    const resumen = await pool.query(`
      SELECT
        estatus_pedido,
        COUNT(*) AS total,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) AS porcentaje
      FROM pedidos
      GROUP BY estatus_pedido
      ORDER BY total DESC
    `);

    res.json({
      resumen: resumen.rows.map(r => ({
        estatus:    r.estatus_pedido,
        total:      parseInt(r.total),
        porcentaje: parseFloat(r.porcentaje),
      })),
      por_cocina: rows.map(r => ({
        estatus:    r.estatus_pedido,
        tipo_cocina: r.tipo_cocina,
        total:      parseInt(r.total),
        pct_cocina: parseFloat(r.pct_cocina),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PEDIDOS: CLIENTES NUEVOS (usa es_primera_orden) ─────────────────────────

app.get('/pedidos/clientes-nuevos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH nuevos AS (
        SELECT DISTINCT id_usuario
        FROM pedidos
        WHERE es_primera_orden = TRUE
          AND DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
      )
      SELECT
        COUNT(DISTINCT n.id_usuario) AS nuevos_clientes,
        COUNT(p.id_pedido)           AS pedidos_de_nuevos,
        ROUND(COALESCE(AVG(p.subtotal), 0)::NUMERIC, 2) AS ticket_promedio_nuevos
      FROM nuevos n
      JOIN pedidos p ON p.id_usuario = n.id_usuario
        AND DATE_TRUNC('month', p.fecha_pedido) = ${ULTIMO_MES}
    `);

    const hist = await pool.query(`
      SELECT
        DATE_TRUNC('month', fecha_pedido) AS mes_ingreso,
        COUNT(*) AS nuevos_clientes
      FROM pedidos
      WHERE es_primera_orden = TRUE
      GROUP BY 1
      ORDER BY 1
    `);

    const r = rows[0];
    res.json({
      mes_actual: {
        nuevos_clientes:        parseInt(r.nuevos_clientes),
        pedidos_de_nuevos:      parseInt(r.pedidos_de_nuevos),
        ticket_promedio_nuevos: parseFloat(r.ticket_promedio_nuevos),
      },
      historico: hist.rows.map(h => ({
        mes:            h.mes_ingreso,
        nuevos_clientes: parseInt(h.nuevos_clientes),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PEDIDOS: TIEMPOS DE ENTREGA POR AÑO ────────────────────────────────────

app.get('/pedidos/tiempos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        EXTRACT(YEAR  FROM fecha_pedido)::INT AS anio,
        EXTRACT(MONTH FROM fecha_pedido)::INT AS mes,
        ROUND(AVG(tiempo_entrega_min)::NUMERIC, 1) AS promedio,
        MIN(tiempo_entrega_min) AS minimo,
        MAX(tiempo_entrega_min) AS maximo,
        COUNT(*) AS total_entregas
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
        AND tiempo_entrega_min IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);
    res.json(rows.map(r => ({
      anio:           r.anio,
      mes:            r.mes,
      promedio:       parseFloat(r.promedio),
      minimo:         parseInt(r.minimo),
      maximo:         parseInt(r.maximo),
      total_entregas: parseInt(r.total_entregas),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PEDIDOS: RATIO ENVÍO / SUBTOTAL ─────────────────────────────────────────

app.get('/pedidos/ratio-envio', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        EXTRACT(YEAR  FROM fecha_pedido)::INT AS anio,
        EXTRACT(MONTH FROM fecha_pedido)::INT AS mes,
        ROUND(AVG(costo_envio / NULLIF(subtotal, 0) * 100)::NUMERIC, 2) AS ratio_pct,
        ROUND(AVG(costo_envio)::NUMERIC, 2)  AS envio_promedio,
        ROUND(AVG(subtotal)::NUMERIC, 2)     AS subtotal_promedio,
        COUNT(*) FILTER (WHERE estatus_pedido = 'Pendiente') AS pendientes
      FROM pedidos
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);

    const zonas = await pool.query(`
      SELECT
        colonia_entrega,
        municipio_entrega,
        ROUND(AVG(costo_envio)::NUMERIC, 2) AS envio_promedio,
        ROUND(AVG(costo_envio / NULLIF(subtotal,0) * 100)::NUMERIC, 2) AS ratio_pct,
        COUNT(*) AS pedidos
      FROM pedidos
      GROUP BY colonia_entrega, municipio_entrega
      ORDER BY envio_promedio DESC
    `);

    res.json({
      por_mes: rows.map(r => ({
        anio:               r.anio,
        mes:                r.mes,
        ratio_pct:          parseFloat(r.ratio_pct),
        envio_promedio:     parseFloat(r.envio_promedio),
        subtotal_promedio:  parseFloat(r.subtotal_promedio),
        pendientes:         parseInt(r.pendientes),
      })),
      por_zona: zonas.rows.map(r => ({
        colonia:        r.colonia_entrega,
        municipio:      r.municipio_entrega,
        envio_promedio: parseFloat(r.envio_promedio),
        ratio_pct:      parseFloat(r.ratio_pct),
        pedidos:        parseInt(r.pedidos),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RESTAURANTES: DISTRIBUCIÓN POR CIUDAD ───────────────────────────────────

app.get('/restaurantes/distribucion', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        r.colonia,
        r.municipio,
        COUNT(DISTINCT r.id_restaurante) AS restaurantes,
        COUNT(DISTINCT r.tipo_cocina)    AS tipos_cocina,
        ROUND(AVG(r.calificacion_promedio)::NUMERIC, 2) AS calificacion_promedio,
        COUNT(p.id_pedido)               AS pedidos_recibidos,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo
      FROM restaurantes r
      LEFT JOIN pedidos p ON p.id_restaurante = r.id_restaurante
        AND DATE_TRUNC('month', p.fecha_pedido) = ${ULTIMO_MES}
      GROUP BY r.colonia, r.municipio
      ORDER BY pedidos_recibidos DESC
    `);
    const periodo = rows[0]?.periodo?.trim() ?? '';
    res.json(rows.map(r => ({
      colonia:           r.colonia,
      municipio:         r.municipio,
      restaurantes:      parseInt(r.restaurantes),
      tipos_cocina:      parseInt(r.tipos_cocina),
      calificacion:      parseFloat(r.calificacion_promedio),
      pedidos_recibidos: parseInt(r.pedidos_recibidos),
      periodo,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RESTAURANTES: RANKING CON SUGERENCIAS ───────────────────────────────────

app.get('/restaurantes/ranking', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { rows } = await pool.query(`
      SELECT
        r.id_restaurante,
        r.nombre,
        r.tipo_cocina,
        r.colonia,
        r.calificacion_promedio,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo,
        COUNT(p.id_pedido)                                           AS total_pedidos,
        COUNT(p.id_pedido) FILTER (WHERE p.estatus_pedido = 'Entregado') AS entregados,
        ROUND(SUM(p.total) FILTER (WHERE p.estatus_pedido = 'Entregado')::NUMERIC, 2) AS ingresos,
        ROUND(AVG(p.subtotal) FILTER (WHERE p.estatus_pedido = 'Entregado')::NUMERIC, 2) AS ticket_promedio,
        COUNT(p.id_pedido) FILTER (WHERE p.estatus_pedido LIKE 'Cancelado%') AS cancelados,
        ROUND(
          100.0 * COUNT(p.id_pedido) FILTER (WHERE p.estatus_pedido LIKE 'Cancelado%')
          / NULLIF(COUNT(p.id_pedido), 0)::NUMERIC, 1
        ) AS tasa_cancelacion
      FROM restaurantes r
      LEFT JOIN pedidos p ON p.id_restaurante = r.id_restaurante
        AND DATE_TRUNC('month', p.fecha_pedido) = ${ULTIMO_MES}
      GROUP BY r.id_restaurante, r.nombre, r.tipo_cocina, r.colonia, r.calificacion_promedio
      ORDER BY ingresos DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    const total_ingresos_res = await pool.query(
      `SELECT SUM(total) AS total FROM pedidos
       WHERE estatus_pedido = 'Entregado'
         AND DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}`
    );
    const total_ing = parseFloat(total_ingresos_res.rows[0].total) || 1;

    res.json(rows.map((r, i) => {
      const ingresos    = parseFloat(r.ingresos) || 0;
      const tasa_cancel = parseFloat(r.tasa_cancelacion) || 0;
      const participacion = parseFloat(((ingresos / total_ing) * 100).toFixed(2));

      let comision_sugerida = 18;
      if (participacion > 2)     comision_sugerida = 12;
      else if (participacion > 1) comision_sugerida = 14;
      else if (participacion < 0.1) comision_sugerida = 22;

      let sugerencia = '';
      let sugerencia_tipo = '';
      if (tasa_cancel > 15)       { sugerencia = 'Alta cancelacion — revisar operacion'; sugerencia_tipo = 'warn'; }
      else if (ingresos === 0)    { sugerencia = 'Sin ingresos en el periodo';           sugerencia_tipo = 'warn'; }
      else if (participacion > 2) { sugerencia = 'Candidato a visibilidad premium';      sugerencia_tipo = 'ok'; }

      return {
        posicion:           i + 1,
        id:                 r.id_restaurante,
        nombre:             r.nombre,
        tipo_cocina:        r.tipo_cocina,
        colonia:            r.colonia,
        calificacion:       parseFloat(r.calificacion_promedio),
        periodo:            r.periodo?.trim() ?? '',
        total_pedidos:      parseInt(r.total_pedidos),
        entregados:         parseInt(r.entregados),
        ingresos,
        ticket_promedio:    parseFloat(r.ticket_promedio) || 0,
        tasa_cancelacion:   tasa_cancel,
        participacion_pct:  participacion,
        comision_sugerida,
        sugerencia,
        sugerencia_tipo,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RESTAURANTES: POR TIPO DE COCINA CON MARKETING ─────────────────────────

app.get('/restaurantes/por-cocina', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        tipo_cocina,
        COUNT(DISTINCT id_restaurante) AS restaurantes,
        COUNT(*) FILTER (WHERE estatus_pedido = 'Entregado') AS pedidos_entregados,
        ROUND(SUM(total) FILTER (WHERE estatus_pedido = 'Entregado')::NUMERIC, 2) AS ingresos,
        ROUND(100.0 * COUNT(*) FILTER (WHERE estatus_pedido = 'Entregado')
          / NULLIF(SUM(COUNT(*)) OVER(), 0)::NUMERIC, 2) AS participacion_pct,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo
      FROM pedidos
      WHERE DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
      GROUP BY tipo_cocina
      ORDER BY ingresos DESC
    `);

    const max_pedidos = Math.max(...rows.map(r => parseInt(r.pedidos_entregados)));

    res.json(rows.map(r => {
      const participacion = parseFloat(r.participacion_pct);
      let marketing = '';
      let marketing_tipo = '';
      if (participacion < 3)      { marketing = 'Urgente — campaña de visibilidad necesaria'; marketing_tipo = 'warn'; }
      else if (participacion < 6)  { marketing = 'Recomendado impulsar con promociones';       marketing_tipo = 'info'; }
      else if (participacion > 12) { marketing = 'Alta demanda — mantener estrategia';          marketing_tipo = 'ok'; }

      return {
        tipo_cocina:      r.tipo_cocina,
        restaurantes:     parseInt(r.restaurantes),
        pedidos:          parseInt(r.pedidos_entregados),
        ingresos:         parseFloat(r.ingresos),
        participacion_pct: participacion,
        marketing,
        marketing_tipo,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONDUCTORES: POR VEHÍCULO Y ZONA ────────────────────────────────────────

app.get('/conductores/por-vehiculo', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.tipo_vehiculo,
        COUNT(*) AS total_conductores,
        COUNT(*) FILTER (WHERE c.estatus = 'Activo') AS activos,
        COUNT(p.id_pedido) AS pedidos_realizados,
        ROUND(AVG(p.tiempo_entrega_min)::NUMERIC, 1) AS tiempo_entrega_promedio,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo
      FROM conductores c
      LEFT JOIN pedidos p ON p.id_conductor = c.id_conductor
        AND p.estatus_pedido = 'Entregado'
        AND DATE_TRUNC('month', p.fecha_pedido) = ${ULTIMO_MES}
      GROUP BY c.tipo_vehiculo
      ORDER BY pedidos_realizados DESC
    `);

    const max_pedidos = Math.max(...rows.map(r => parseInt(r.pedidos_realizados) || 0));

    res.json(rows.map(r => {
      const volumen_pct = max_pedidos > 0
        ? parseFloat(((parseInt(r.pedidos_realizados) / max_pedidos) * 100).toFixed(1))
        : 0;
      let sugerencia = '';
      if (volumen_pct > 80)       sugerencia = 'Vehículo con mayor demanda — priorizar en reclutamiento';
      else if (volumen_pct < 30)  sugerencia = 'Bajo volumen — evaluar necesidad en la flota';

      return {
        tipo_vehiculo:   r.tipo_vehiculo,
        total:           parseInt(r.total_conductores),
        activos:         parseInt(r.activos),
        pedidos:         parseInt(r.pedidos_realizados),
        tiempo_promedio: parseFloat(r.tiempo_entrega_promedio) || 0,
        periodo:         r.periodo?.trim() ?? '',
        volumen_pct,
        sugerencia,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONDUCTORES: POR ZONA ───────────────────────────────────────────────────

app.get('/conductores/por-zona', async (req, res) => {
  try {
    const conductores = await pool.query(`
      SELECT zona_operacion, COUNT(*) AS conductores,
        COUNT(*) FILTER (WHERE estatus = 'Activo') AS activos
      FROM conductores
      GROUP BY zona_operacion ORDER BY conductores DESC
    `);

    const demanda = await pool.query(`
      SELECT colonia_entrega AS zona, COUNT(*) AS pedidos,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
        AND DATE_TRUNC('month', fecha_pedido) = ${ULTIMO_MES}
      GROUP BY colonia_entrega ORDER BY pedidos DESC
    `);

    const demanda_map = {};
    demanda.rows.forEach(r => { demanda_map[r.zona] = parseInt(r.pedidos); });

    res.json(conductores.rows.map(r => {
      const pedidos_zona = demanda_map[r.zona_operacion] || 0;
      const ratio        = r.activos > 0 ? Math.round(pedidos_zona / r.activos) : 0;
      let nivel = 'Bien abastecida';
      let nivel_tipo = 'ok';
      if (ratio > 800)      { nivel = 'Zona con escasez — agregar conductores'; nivel_tipo = 'warn'; }
      else if (ratio > 500) { nivel = 'Zona con presion — monitorear';          nivel_tipo = 'alert'; }

      return {
        zona:        r.zona_operacion,
        conductores: parseInt(r.conductores),
        activos:     parseInt(r.activos),
        pedidos_zona,
        periodo:     demanda.rows[0]?.periodo?.trim() ?? '',
        ratio_pedidos_por_conductor: ratio,
        nivel,
        nivel_tipo,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONDUCTORES: REACTIVACIÓN SUGERIDA ──────────────────────────────────────

app.get('/conductores/reactivacion', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id_conductor,
        c.nombre || ' ' || c.apellido_paterno AS nombre,
        c.tipo_vehiculo,
        c.zona_operacion,
        c.calificacion_promedio,
        c.estatus,
        c.fecha_ingreso,
        COUNT(p.id_pedido) AS pedidos_historicos
      FROM conductores c
      LEFT JOIN pedidos p ON p.id_conductor = c.id_conductor
        AND p.estatus_pedido = 'Entregado'
      WHERE c.estatus IN ('Inactivo', 'Sancionado')
      GROUP BY c.id_conductor, c.nombre, c.apellido_paterno,
               c.tipo_vehiculo, c.zona_operacion, c.calificacion_promedio,
               c.estatus, c.fecha_ingreso
      ORDER BY c.calificacion_promedio DESC, pedidos_historicos DESC
      LIMIT 30
    `);

    res.json(rows.map((r, i) => {
      let bono = '';
      if (r.estatus === 'Inactivo') {
        if (r.calificacion_promedio >= 4.5)
          bono = 'Bono sugerido: $200 por 20 entregas en 7 dias';
        else
          bono = 'Bono sugerido: $100 por 15 entregas en 10 dias';
      } else {
        bono = 'Requiere revision de sancion antes de reactivar';
      }

      return {
        posicion:            i + 1,
        id:                  r.id_conductor,
        nombre:              r.nombre,
        tipo_vehiculo:       r.tipo_vehiculo,
        zona:                r.zona_operacion,
        calificacion:        parseFloat(r.calificacion_promedio),
        estatus:             r.estatus,
        pedidos_historicos:  parseInt(r.pedidos_historicos),
        bono_sugerido:       bono,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTOS: POR CATEGORÍA ─────────────────────────────────────────────────

app.get('/productos/categorias', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        categoria,
        COUNT(*) AS total_productos,
        ROUND(AVG(precio)::NUMERIC, 2) AS precio_promedio,
        MIN(precio) AS precio_minimo,
        MAX(precio) AS precio_maximo,
        COUNT(*) FILTER (WHERE precio >= 200) AS candidatos_premium
      FROM productos
      WHERE estatus = 'Disponible'
      GROUP BY categoria
      ORDER BY precio_promedio DESC
    `);

    res.json(rows.map(r => ({
      categoria:          r.categoria,
      total_productos:    parseInt(r.total_productos),
      precio_promedio:    parseFloat(r.precio_promedio),
      precio_minimo:      parseFloat(r.precio_minimo),
      precio_maximo:      parseFloat(r.precio_maximo),
      candidatos_premium: parseInt(r.candidatos_premium),
      sugerencia: parseInt(r.candidatos_premium) > 0
        ? `${r.candidatos_premium} producto(s) candidatos a seccion premium`
        : 'Considerar incorporar productos de mayor valor',
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTOS: CANDIDATOS PREMIUM ───────────────────────────────────────────

app.get('/productos/premium', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.nombre_producto,
        p.categoria,
        p.precio,
        r.nombre AS restaurante,
        r.tipo_cocina,
        r.colonia,
        r.calificacion_promedio AS calificacion_restaurante
      FROM productos p
      JOIN restaurantes r ON r.id_restaurante = p.id_restaurante
      WHERE p.precio >= 200 AND p.estatus = 'Disponible'
      ORDER BY p.precio DESC
      LIMIT 20
    `);

    res.json(rows.map(r => ({
      producto:              r.nombre_producto,
      categoria:             r.categoria,
      precio:                parseFloat(r.precio),
      restaurante:           r.restaurante,
      tipo_cocina:           r.tipo_cocina,
      colonia:               r.colonia,
      calificacion_restaurante: parseFloat(r.calificacion_restaurante),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONDUCTORES: SANCIONADOS CON RECOMENDACIÓN ──────────────────────────────

app.get('/conductores/sancionados', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id_conductor,
        c.nombre || ' ' || c.apellido_paterno AS nombre,
        c.tipo_vehiculo,
        c.zona_operacion,
        c.calificacion_promedio,
        c.estatus,
        c.fecha_ingreso,
        COUNT(p.id_pedido) AS pedidos_historicos,
        COUNT(p.id_pedido) FILTER (WHERE p.estatus_pedido LIKE 'Cancelado%') AS cancelados_historicos
      FROM conductores c
      LEFT JOIN pedidos p ON p.id_conductor = c.id_conductor
      WHERE c.estatus = 'Sancionado'
      GROUP BY c.id_conductor, c.nombre, c.apellido_paterno,
               c.tipo_vehiculo, c.zona_operacion, c.calificacion_promedio,
               c.estatus, c.fecha_ingreso
      ORDER BY c.calificacion_promedio DESC, pedidos_historicos DESC
    `);

    res.json(rows.map((r, i) => {
      const calificacion = parseFloat(r.calificacion_promedio);
      const pedidos      = parseInt(r.pedidos_historicos);
      const cancelados   = parseInt(r.cancelados_historicos);
      const tasa_cancelacion = pedidos > 0
        ? parseFloat(((cancelados / pedidos) * 100).toFixed(1))
        : 0;

      let recomendacion, razon, accion;
      if (calificacion >= 4.5 && pedidos >= 100 && tasa_cancelacion < 10) {
        recomendacion = 'reactivar';
        razon  = `Calificacion alta (${calificacion}) y buen historial de ${pedidos} entregas con ${tasa_cancelacion}% cancelaciones`;
        accion = 'Levantar sancion con advertencia formal y seguimiento durante 30 dias';
      } else if (calificacion >= 4.0 && pedidos >= 30 && tasa_cancelacion < 20) {
        recomendacion = 'evaluar';
        razon  = `Perfil moderado — calificacion ${calificacion}, ${tasa_cancelacion}% cancelaciones`;
        accion = 'Revisar motivo de sancion y aplicar programa de re-certificacion antes de reactivar';
      } else {
        recomendacion = 'no_reactivar';
        razon  = `Calificacion insuficiente (${calificacion}) o alta tasa de cancelacion (${tasa_cancelacion}%)`;
        accion = 'No reactivar — el conductor no cumple los criterios minimos de calidad del servicio';
      }

      return {
        posicion: i + 1,
        id:                 r.id_conductor,
        nombre:             r.nombre,
        tipo_vehiculo:      r.tipo_vehiculo,
        zona:               r.zona_operacion,
        calificacion,
        pedidos_historicos: pedidos,
        tasa_cancelacion,
        recomendacion,
        razon,
        accion,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PEDIDOS: TIEMPOS POR ZONA ────────────────────────────────────────────────

app.get('/pedidos/tiempos-por-zona', async (req, res) => {
  try {
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    const { rows } = await pool.query(`
      SELECT
        colonia_entrega   AS zona,
        municipio_entrega AS municipio,
        ROUND(AVG(tiempo_entrega_min)::NUMERIC, 1) AS tiempo_promedio,
        MIN(tiempo_entrega_min) AS tiempo_minimo,
        MAX(tiempo_entrega_min) AS tiempo_maximo,
        COUNT(*) AS total_pedidos
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
        AND tiempo_entrega_min IS NOT NULL
        AND EXTRACT(YEAR FROM fecha_pedido)::INT = $1
      GROUP BY colonia_entrega, municipio_entrega
      HAVING COUNT(*) >= 20
      ORDER BY tiempo_promedio DESC
      LIMIT 15
    `, [anio]);

    res.json(rows.map(r => ({
      zona:            r.zona,
      municipio:       r.municipio,
      tiempo_promedio: parseFloat(r.tiempo_promedio),
      tiempo_minimo:   parseInt(r.tiempo_minimo),
      tiempo_maximo:   parseInt(r.tiempo_maximo),
      total_pedidos:   parseInt(r.total_pedidos),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CONDUCTORES: TIEMPOS POR ZONA ───────────────────────────────────────────

app.get('/conductores/tiempos-por-zona', async (req, res) => {
  try {
    const anio = parseInt(req.query.anio) || new Date().getFullYear();
    const { rows } = await pool.query(`
      SELECT
        p.colonia_entrega AS zona,
        c.nombre || ' ' || c.apellido_paterno AS conductor,
        c.tipo_vehiculo,
        ROUND(AVG(p.tiempo_entrega_min)::NUMERIC, 1) AS tiempo_promedio,
        COUNT(p.id_pedido) AS total_entregas
      FROM pedidos p
      JOIN conductores c ON c.id_conductor = p.id_conductor
      WHERE p.estatus_pedido = 'Entregado'
        AND p.tiempo_entrega_min IS NOT NULL
        AND p.id_conductor IS NOT NULL
        AND EXTRACT(YEAR FROM p.fecha_pedido)::INT = $1
      GROUP BY p.colonia_entrega, c.id_conductor, c.nombre, c.apellido_paterno, c.tipo_vehiculo
      HAVING COUNT(p.id_pedido) >= 1
      ORDER BY p.colonia_entrega, tiempo_promedio ASC
    `, [anio]);

    const porZona = {};
    rows.forEach(r => {
      if (!porZona[r.zona]) porZona[r.zona] = [];
      porZona[r.zona].push({
        conductor:       r.conductor,
        tipo_vehiculo:   r.tipo_vehiculo,
        tiempo_promedio: parseFloat(r.tiempo_promedio),
        total_entregas:  parseInt(r.total_entregas),
      });
    });

    res.json(
      Object.entries(porZona).map(([zona, conductores]) => ({
        zona,
        conductores: conductores.slice(0, 5),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTOS: TOP VENDIDOS (detalle_pedidos) ───────────────────────────────

app.get('/productos/top-vendidos', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 15;
    const ULTIMO_MES = `(SELECT DATE_TRUNC('month', fecha_pedido) FROM pedidos GROUP BY 1 HAVING COUNT(*) > 1000 ORDER BY 1 DESC LIMIT 1)`;
    const { rows } = await pool.query(`
      SELECT
        pr.nombre_producto,
        pr.categoria,
        r.nombre        AS restaurante,
        r.tipo_cocina,
        SUM(dp.cantidad)::INT            AS unidades_vendidas,
        COUNT(DISTINCT dp.id_pedido)     AS pedidos_con_producto,
        ROUND(AVG(dp.precio_unitario)::NUMERIC, 2) AS precio_promedio,
        ROUND(SUM(dp.subtotal_linea)::NUMERIC, 2)  AS ingreso_total,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo
      FROM detalle_pedidos dp
      JOIN productos   pr ON pr.id_producto    = dp.id_producto
      JOIN pedidos     p  ON p.id_pedido       = dp.id_pedido
      JOIN restaurantes r  ON r.id_restaurante = pr.id_restaurante
      WHERE p.estatus_pedido = 'Entregado'
        AND DATE_TRUNC('month', p.fecha_pedido) = ${ULTIMO_MES}
      GROUP BY pr.id_producto, pr.nombre_producto, pr.categoria, r.nombre, r.tipo_cocina
      ORDER BY unidades_vendidas DESC
      LIMIT $1
    `, [limit]);

    res.json(rows.map((r, i) => ({
      posicion:           i + 1,
      producto:           r.nombre_producto,
      categoria:          r.categoria,
      restaurante:        r.restaurante,
      tipo_cocina:        r.tipo_cocina,
      unidades_vendidas:  r.unidades_vendidas,
      pedidos:            parseInt(r.pedidos_con_producto),
      precio_promedio:    parseFloat(r.precio_promedio),
      ingreso_total:      parseFloat(r.ingreso_total),
      periodo:            r.periodo?.trim() ?? '',
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTOS: COMBOS SUGERIDOS (restaurantes con menos ventas) ──────────────

app.get('/productos/combos-sugeridos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH ventas_restaurante AS (
        SELECT
          r.id_restaurante,
          r.nombre       AS restaurante,
          r.tipo_cocina,
          COALESCE(ROUND(SUM(p.total) FILTER (WHERE p.estatus_pedido = 'Entregado')::NUMERIC, 2), 0) AS ingresos_total,
          COUNT(p.id_pedido) FILTER (WHERE p.estatus_pedido = 'Entregado')::INT AS total_pedidos
        FROM restaurantes r
        LEFT JOIN pedidos p ON p.id_restaurante = r.id_restaurante
        GROUP BY r.id_restaurante, r.nombre, r.tipo_cocina
      ),
      ventas_producto AS (
        SELECT
          pr.id_producto,
          pr.nombre_producto AS producto,
          pr.categoria,
          pr.precio,
          pr.id_restaurante,
          COUNT(DISTINCT CASE WHEN ped.estatus_pedido = 'Entregado' THEN ped.id_pedido END)::INT AS pedidos_con_producto
        FROM productos pr
        LEFT JOIN detalle_pedidos dp ON dp.id_producto = pr.id_producto
        LEFT JOIN pedidos ped        ON ped.id_pedido  = dp.id_pedido
        GROUP BY pr.id_producto, pr.nombre_producto, pr.categoria, pr.precio, pr.id_restaurante
        HAVING COUNT(DISTINCT CASE WHEN ped.estatus_pedido = 'Entregado' THEN ped.id_pedido END) > 0
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY id_restaurante ORDER BY pedidos_con_producto DESC) AS rank_mejor,
          ROW_NUMBER() OVER (PARTITION BY id_restaurante ORDER BY pedidos_con_producto ASC)  AS rank_peor
        FROM ventas_producto
      ),
      estrella    AS (SELECT * FROM ranked WHERE rank_mejor = 1),
      complemento AS (SELECT * FROM ranked WHERE rank_peor  = 1),
      bottom_rest AS (
        SELECT vr.*, ROW_NUMBER() OVER (ORDER BY vr.ingresos_total ASC) AS rn
        FROM ventas_restaurante vr
        WHERE vr.total_pedidos > 0
          AND EXISTS (SELECT 1 FROM estrella e WHERE e.id_restaurante = vr.id_restaurante)
        ORDER BY vr.ingresos_total ASC
        LIMIT 5
      )
      SELECT
        br.rn AS combo_num,
        br.restaurante,
        br.tipo_cocina,
        br.ingresos_total AS ingresos_restaurante,
        br.total_pedidos  AS pedidos_restaurante,
        e.producto             AS estrella,
        e.categoria            AS cat_estrella,
        e.precio               AS precio_estrella,
        e.pedidos_con_producto AS pedidos_estrella,
        c.producto             AS complemento,
        c.categoria            AS cat_complemento,
        c.precio               AS precio_complemento,
        c.pedidos_con_producto AS pedidos_complemento,
        ROUND(((e.precio + COALESCE(c.precio, 0)) * 0.85)::NUMERIC, 2) AS precio_combo_sugerido,
        15 AS descuento_pct
      FROM bottom_rest br
      JOIN estrella    e ON e.id_restaurante = br.id_restaurante
      LEFT JOIN complemento c ON c.id_restaurante = br.id_restaurante
        AND c.id_producto != e.id_producto
      ORDER BY combo_num
    `);

    res.json(rows.map(r => ({
      combo_num:             parseInt(r.combo_num) || 0,
      restaurante:           r.restaurante ?? '',
      tipo_cocina:           r.tipo_cocina ?? '',
      ingresos_restaurante:  parseFloat(r.ingresos_restaurante) || 0,
      pedidos_restaurante:   parseInt(r.pedidos_restaurante) || 0,
      estrella:              r.estrella ?? null,
      cat_estrella:          r.cat_estrella ?? '',
      precio_estrella:       parseFloat(r.precio_estrella) || 0,
      pedidos_estrella:      parseInt(r.pedidos_estrella) || 0,
      complemento:           r.complemento ?? null,
      cat_complemento:       r.cat_complemento ?? '',
      precio_complemento:    parseFloat(r.precio_complemento) || 0,
      pedidos_complemento:   parseInt(r.pedidos_complemento) || 0,
      precio_combo_sugerido: parseFloat(r.precio_combo_sugerido) || 0,
      descuento_pct:         parseInt(r.descuento_pct) || 15,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── OPORTUNIDADES DE HORARIO ────────────────────────────────────────────────

app.get('/oportunidades/horario', async (req, res) => {
  try {
    const DIAS = ['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];

    const [horasRes, prodRes] = await Promise.all([
      pool.query(`
        WITH demanda AS (
          SELECT
            EXTRACT(DOW  FROM fecha_pedido)::INT AS dia_num,
            EXTRACT(HOUR FROM fecha_pedido)::INT AS hora,
            COUNT(*) FILTER (WHERE estatus_pedido = 'Entregado')::INT AS pedidos
          FROM pedidos
          WHERE EXTRACT(HOUR FROM fecha_pedido) BETWEEN 7 AND 23
          GROUP BY 1, 2
        ),
        prom AS (SELECT ROUND(AVG(pedidos)::NUMERIC, 1) AS promedio FROM demanda)
        SELECT d.dia_num, d.hora, d.pedidos, p.promedio,
          ROUND((d.pedidos::NUMERIC / NULLIF(p.promedio, 0) * 100)::NUMERIC, 1) AS pct_del_promedio
        FROM demanda d, prom p
        ORDER BY d.pedidos ASC
        LIMIT 3
      `),
      pool.query(`
        SELECT
          pr.nombre_producto,
          pr.categoria,
          pr.precio,
          r.nombre      AS restaurante,
          r.tipo_cocina,
          r.colonia,
          COUNT(DISTINCT CASE WHEN ped.estatus_pedido = 'Entregado' THEN ped.id_pedido END)::INT AS pedidos_entregados
        FROM productos pr
        JOIN restaurantes r ON r.id_restaurante = pr.id_restaurante
        LEFT JOIN detalle_pedidos dp ON dp.id_producto = pr.id_producto
        LEFT JOIN pedidos ped        ON ped.id_pedido  = dp.id_pedido
        GROUP BY pr.id_producto, pr.nombre_producto, pr.categoria, pr.precio, r.nombre, r.tipo_cocina, r.colonia
        HAVING COUNT(DISTINCT CASE WHEN ped.estatus_pedido = 'Entregado' THEN ped.id_pedido END) > 0
        ORDER BY pedidos_entregados ASC
        LIMIT 5
      `),
    ]);

    res.json({
      horas: horasRes.rows.map(r => {
        const diaNum = parseInt(r.dia_num);
        const hora   = parseInt(r.hora);
        return {
          dia:              DIAS[diaNum] ?? `Dia ${diaNum}`,
          hora,
          label:            `${String(hora).padStart(2,'0')}:00 – ${String(hora+1).padStart(2,'0')}:00`,
          pedidos:          parseInt(r.pedidos) || 0,
          promedio:         parseFloat(r.promedio) || 0,
          pct_del_promedio: parseFloat(r.pct_del_promedio) || 0,
        };
      }),
      productos: prodRes.rows.map(r => ({
        nombre_producto:    r.nombre_producto ?? '',
        categoria:          r.categoria ?? '',
        precio:             parseFloat(r.precio) || 0,
        restaurante:        r.restaurante ?? '',
        tipo_cocina:        r.tipo_cocina ?? '',
        colonia:            r.colonia ?? '',
        pedidos_entregados: parseInt(r.pedidos_entregados) || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTOS: DEMANDA HORARIA ───────────────────────────────────────────────

app.get('/productos/demanda-horaria', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM p.fecha_pedido)::INT AS hora,
        COUNT(DISTINCT p.id_pedido)            AS total_pedidos,
        SUM(dp.cantidad)::INT                  AS unidades_vendidas,
        ROUND(AVG(p.subtotal)::NUMERIC, 2)     AS ticket_promedio,
        ROUND(SUM(p.total)::NUMERIC, 2)        AS ingresos
      FROM pedidos p
      JOIN detalle_pedidos dp ON dp.id_pedido = p.id_pedido
      WHERE p.estatus_pedido = 'Entregado'
      GROUP BY hora
      ORDER BY hora
    `);

    const max_pedidos = Math.max(...rows.map(r => r.total_pedidos));
    res.json(rows.map(r => ({
      hora:             r.hora,
      label:            `${String(r.hora).padStart(2,'0')}:00`,
      pedidos:          r.total_pedidos,
      unidades:         r.unidades_vendidas,
      ticket_promedio:  parseFloat(r.ticket_promedio),
      ingresos:         parseFloat(r.ingresos),
      intensidad_pct:   parseFloat(((r.total_pedidos / max_pedidos) * 100).toFixed(1)),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CALIFICACIONES: POR RESTAURANTE (tabla calificaciones) ──────────────────

app.get('/calificaciones/restaurantes', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { rows } = await pool.query(`
      SELECT
        r.id_restaurante,
        r.nombre,
        r.tipo_cocina,
        r.colonia,
        COUNT(c.id_calificacion)                           AS total_reseñas,
        ROUND(AVG(c.calificacion_restaurante)::NUMERIC, 2) AS calificacion_real,
        COUNT(*) FILTER (WHERE c.calificacion_restaurante >= 4) AS reseñas_positivas,
        COUNT(*) FILTER (WHERE c.calificacion_restaurante <= 2) AS reseñas_negativas,
        COUNT(*) FILTER (WHERE c.comentario IS NOT NULL)        AS con_comentario
      FROM restaurantes r
      JOIN calificaciones c ON c.id_restaurante = r.id_restaurante
        AND DATE_TRUNC('month', c.fecha) = ${ULTIMO_MES}
      GROUP BY r.id_restaurante, r.nombre, r.tipo_cocina, r.colonia
      HAVING COUNT(c.id_calificacion) >= 1
      ORDER BY calificacion_real DESC
      LIMIT $1
    `, [limit]);

    res.json(rows.map(r => {
      const total = parseInt(r['total_reseñas']);
      const pos   = parseInt(r['reseñas_positivas']);
      const neg   = parseInt(r['reseñas_negativas']);
      const cal   = parseFloat(r.calificacion_real);
      let nivel = 'ok', sugerencia = '';
      if (cal < 3.5) { nivel = 'warn'; sugerencia = 'Calificacion critica — plan de mejora urgente'; }
      else if (cal < 4.0) { nivel = 'info'; sugerencia = 'Por debajo del promedio — revisar comentarios'; }
      else if (cal >= 4.5) { sugerencia = 'Excelente desempeno — candidato a destacado'; }
      return {
        id:                 r.id_restaurante,
        nombre:             r.nombre,
        tipo_cocina:        r.tipo_cocina,
        colonia:            r.colonia,
        total_reseñas:      total,
        calificacion_real:  cal,
        pct_positivas:      total > 0 ? parseFloat(((pos/total)*100).toFixed(1)) : 0,
        pct_negativas:      total > 0 ? parseFloat(((neg/total)*100).toFixed(1)) : 0,
        con_comentario:     parseInt(r.con_comentario),
        nivel,
        sugerencia,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── CALIFICACIONES: POR CONDUCTOR ───────────────────────────────────────────

app.get('/calificaciones/conductores', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const { rows } = await pool.query(`
      SELECT
        c.id_conductor,
        c.nombre || ' ' || c.apellido_paterno AS nombre,
        c.tipo_vehiculo,
        c.zona_operacion,
        c.estatus,
        COUNT(cal.id_calificacion)                         AS total_reseñas,
        ROUND(AVG(cal.calificacion_conductor)::NUMERIC, 2) AS calificacion_real,
        COUNT(*) FILTER (WHERE cal.calificacion_conductor >= 4) AS reseñas_positivas,
        COUNT(*) FILTER (WHERE cal.calificacion_conductor <= 2) AS reseñas_negativas,
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo
      FROM conductores c
      JOIN calificaciones cal ON cal.id_conductor = c.id_conductor
        AND DATE_TRUNC('month', cal.fecha) = ${ULTIMO_MES}
      WHERE c.estatus = 'Activo'
      GROUP BY c.id_conductor, c.nombre, c.apellido_paterno, c.tipo_vehiculo, c.zona_operacion, c.estatus
      HAVING COUNT(cal.id_calificacion) >= 1
      ORDER BY calificacion_real DESC
      LIMIT $1
    `, [limit]);

    res.json(rows.map(r => {
      const cal   = parseFloat(r.calificacion_real);
      const total = parseInt(r['total_reseñas']);
      const pos   = parseInt(r['reseñas_positivas']);
      const neg   = parseInt(r['reseñas_negativas']);
      let nivel = 'ok', sugerencia = '';
      if (cal < 3.5)      { nivel = 'warn'; sugerencia = 'Calificacion critica — considerar capacitacion'; }
      else if (cal < 4.0) { nivel = 'info'; sugerencia = 'Mejorable — monitorear en las proximas semanas'; }
      else if (cal >= 4.7) { sugerencia = 'Top performer — candidato a incentivos'; }
      return {
        id:                r.id_conductor,
        nombre:            r.nombre,
        tipo_vehiculo:     r.tipo_vehiculo,
        zona:              r.zona_operacion,
        periodo:           r.periodo?.trim() ?? '',
        total_reseñas:     total,
        calificacion_real: cal,
        pct_positivas:     total > 0 ? parseFloat(((pos/total)*100).toFixed(1)) : 0,
        pct_negativas:     total > 0 ? parseFloat(((neg/total)*100).toFixed(1)) : 0,
        nivel,
        sugerencia,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SANCIONES: RESUMEN Y DETALLE ────────────────────────────────────────────

app.get('/conductores/sanciones', async (req, res) => {
  try {
    const resumen = await pool.query(`
      SELECT
        tipo,
        gravedad,
        estatus_sancion,
        COUNT(*) AS total
      FROM sanciones_conductores
      GROUP BY tipo, gravedad, estatus_sancion
      ORDER BY total DESC
    `);

    const detalle = await pool.query(`
      SELECT
        s.id_sancion,
        c.nombre || ' ' || c.apellido_paterno AS conductor,
        c.tipo_vehiculo,
        c.zona_operacion,
        s.tipo,
        s.descripcion,
        s.gravedad,
        s.estatus_sancion,
        s.fecha_sancion,
        s.fecha_resolucion
      FROM sanciones_conductores s
      JOIN conductores c ON c.id_conductor = s.id_conductor
      ORDER BY s.fecha_sancion DESC
      LIMIT 50
    `);

    const porGravedad = {};
    resumen.rows.forEach(r => {
      if (!porGravedad[r.gravedad]) porGravedad[r.gravedad] = 0;
      porGravedad[r.gravedad] += parseInt(r.total);
    });

    res.json({
      por_tipo:     resumen.rows.map(r => ({
        tipo:           r.tipo,
        gravedad:       r.gravedad,
        estatus:        r.estatus_sancion,
        total:          parseInt(r.total),
      })),
      por_gravedad: Object.entries(porGravedad).map(([g, t]) => ({ gravedad: g, total: t })),
      recientes:    detalle.rows.map(r => ({
        id:              r.id_sancion,
        conductor:       r.conductor,
        tipo_vehiculo:   r.tipo_vehiculo,
        zona:            r.zona_operacion,
        tipo:            r.tipo,
        descripcion:     r.descripcion,
        gravedad:        r.gravedad,
        estatus:         r.estatus_sancion,
        fecha_sancion:   r.fecha_sancion,
        fecha_resolucion: r.fecha_resolucion,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── COMBOS: RENDIMIENTO ──────────────────────────────────────────────────────

app.get('/combos/rendimiento', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        cb.id_combo,
        cb.nombre_combo,
        cb.precio_combo,
        cb.precio_sin_descuento,
        cb.descuento_pct,
        r.nombre     AS restaurante,
        r.tipo_cocina,
        COUNT(cp.id_producto) AS productos_en_combo
      FROM combos cb
      JOIN restaurantes   r  ON r.id_restaurante  = cb.id_restaurante
      JOIN combo_productos cp ON cp.id_combo       = cb.id_combo
      WHERE cb.activo = TRUE
      GROUP BY cb.id_combo, cb.nombre_combo, cb.precio_combo,
               cb.precio_sin_descuento, cb.descuento_pct, r.nombre, r.tipo_cocina
      ORDER BY cb.descuento_pct DESC
    `);

    res.json(rows.map(r => ({
      id:                   r.id_combo,
      nombre:               r.nombre_combo,
      restaurante:          r.restaurante,
      tipo_cocina:          r.tipo_cocina,
      precio_combo:         parseFloat(r.precio_combo),
      precio_sin_descuento: parseFloat(r.precio_sin_descuento),
      descuento_pct:        parseFloat(r.descuento_pct),
      ahorro:               parseFloat((r.precio_sin_descuento - r.precio_combo).toFixed(2)),
      productos_incluidos:  parseInt(r.productos_en_combo),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USUARIOS: SEGMENTACIÓN RFM ──────────────────────────────────────────────

app.get('/usuarios/segmentos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH rfm AS (
        SELECT
          id_usuario,
          MAX(fecha_pedido)                              AS ultima_compra,
          COUNT(*) FILTER (WHERE estatus_pedido = 'Entregado') AS frecuencia,
          ROUND(SUM(total) FILTER (WHERE estatus_pedido = 'Entregado')::NUMERIC, 2) AS monetario,
          (SELECT MAX(fecha_pedido) FROM pedidos) - MAX(fecha_pedido) AS recencia_dias
        FROM pedidos
        GROUP BY id_usuario
      ),
      scored AS (
        SELECT *,
          CASE
            WHEN recencia_dias <= 30  THEN 3
            WHEN recencia_dias <= 90  THEN 2
            ELSE 1
          END AS r_score,
          CASE
            WHEN frecuencia >= 20 THEN 3
            WHEN frecuencia >= 8  THEN 2
            ELSE 1
          END AS f_score,
          CASE
            WHEN monetario >= 5000 THEN 3
            WHEN monetario >= 1500 THEN 2
            ELSE 1
          END AS m_score
        FROM rfm
      ),
      segmentos AS (
        SELECT *,
          CASE
            WHEN r_score=3 AND f_score=3 AND m_score=3 THEN 'Champions'
            WHEN r_score>=2 AND f_score>=2 AND m_score>=2 THEN 'Leales'
            WHEN r_score=3 AND f_score<=2 THEN 'Recientes'
            WHEN r_score=1 AND f_score>=2 THEN 'En riesgo'
            WHEN r_score=1 AND f_score=3  THEN 'Perdidos VIP'
            ELSE 'Ocasionales'
          END AS segmento
        FROM scored
      )
      SELECT
        segmento,
        COUNT(*)                                AS usuarios,
        ROUND(AVG(frecuencia)::NUMERIC, 1)      AS frecuencia_promedio,
        ROUND(AVG(monetario)::NUMERIC, 2)       AS ltv_promedio,
        ROUND(AVG(recencia_dias)::NUMERIC, 0)   AS recencia_promedio_dias,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER()::NUMERIC, 1) AS porcentaje
      FROM segmentos
      GROUP BY segmento
      ORDER BY ltv_promedio DESC
    `);

    const acciones = {
      'Champions':    { prioridad: 'alta',  accion: 'Programa de lealtad exclusivo y referidos con beneficios premium' },
      'Leales':       { prioridad: 'alta',  accion: 'Descuentos personalizados y acceso anticipado a nuevos restaurantes' },
      'Recientes':    { prioridad: 'media', accion: 'Campana de segundo pedido en los proximos 7 dias con cupon' },
      'En riesgo':    { prioridad: 'alta',  accion: 'Reactivacion urgente: cupon de rescate y recordatorio personalizado' },
      'Perdidos VIP': { prioridad: 'alta',  accion: 'Campana de winback con oferta exclusiva — alto valor historico' },
      'Ocasionales':  { prioridad: 'media', accion: 'Notificaciones de promociones generales para aumentar frecuencia' },
    };

    res.json(rows.map(r => ({
      segmento:               r.segmento,
      usuarios:               parseInt(r.usuarios),
      porcentaje:             parseFloat(r.porcentaje),
      frecuencia_promedio:    parseFloat(r.frecuencia_promedio),
      ltv_promedio:           parseFloat(r.ltv_promedio),
      recencia_promedio_dias: parseInt(r.recencia_promedio_dias),
      ...(acciones[r.segmento] || { prioridad: 'baja', accion: '' }),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USUARIOS: CANAL DE ADQUISICIÓN ──────────────────────────────────────────

app.get('/usuarios/adquisicion', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        u.canal_adquisicion,
        u.dispositivo,
        COUNT(DISTINCT u.id_usuario)    AS usuarios_registrados,
        COUNT(p.id_pedido) FILTER (WHERE p.estatus_pedido = 'Entregado') AS pedidos_entregados,
        ROUND(AVG(p.total) FILTER (WHERE p.estatus_pedido = 'Entregado')::NUMERIC, 2) AS ticket_promedio,
        COUNT(p.id_pedido) FILTER (WHERE p.es_primera_orden = TRUE) AS primeras_ordenes
      FROM usuarios u
      LEFT JOIN pedidos p ON p.id_usuario = u.id_usuario
      GROUP BY u.canal_adquisicion, u.dispositivo
      ORDER BY usuarios_registrados DESC
    `);

    res.json(rows.map(r => ({
      canal:                r.canal_adquisicion,
      dispositivo:          r.dispositivo,
      usuarios_registrados: parseInt(r.usuarios_registrados),
      pedidos_entregados:   parseInt(r.pedidos_entregados),
      ticket_promedio:      parseFloat(r.ticket_promedio) || 0,
      primeras_ordenes:     parseInt(r.primeras_ordenes),
      conversion_pct:       r.usuarios_registrados > 0
        ? parseFloat(((parseInt(r.primeras_ordenes) / parseInt(r.usuarios_registrados)) * 100).toFixed(1))
        : 0,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PEDIDOS: ANÁLISIS DE PROPINAS ───────────────────────────────────────────

app.get('/pedidos/propinas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        EXTRACT(YEAR  FROM fecha_pedido)::INT AS anio,
        EXTRACT(MONTH FROM fecha_pedido)::INT AS mes,
        COUNT(*) FILTER (WHERE propina > 0)          AS pedidos_con_propina,
        COUNT(*) FILTER (WHERE estatus_pedido = 'Entregado') AS total_entregados,
        ROUND(AVG(propina) FILTER (WHERE propina > 0)::NUMERIC, 2) AS propina_promedio,
        ROUND(SUM(propina)::NUMERIC, 2)               AS propinas_total,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE propina > 0)
          / NULLIF(COUNT(*) FILTER (WHERE estatus_pedido = 'Entregado'), 0)::NUMERIC, 1
        ) AS tasa_propina_pct
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);

    const global = await pool.query(`
      SELECT
        ROUND(AVG(propina) FILTER (WHERE propina > 0)::NUMERIC, 2) AS propina_promedio_global,
        ROUND(SUM(propina)::NUMERIC, 2)                             AS propinas_total_global,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE propina > 0)
          / NULLIF(COUNT(*) FILTER (WHERE estatus_pedido = 'Entregado'), 0)::NUMERIC, 1
        ) AS tasa_global_pct
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
    `);

    const g = global.rows[0];
    res.json({
      global: {
        propina_promedio: parseFloat(g.propina_promedio_global) || 0,
        propinas_total:   parseFloat(g.propinas_total_global) || 0,
        tasa_pct:         parseFloat(g.tasa_global_pct) || 0,
      },
      por_mes: rows.map(r => ({
        anio:                 r.anio,
        mes:                  r.mes,
        pedidos_con_propina:  parseInt(r.pedidos_con_propina),
        total_entregados:     parseInt(r.total_entregados),
        propina_promedio:     parseFloat(r.propina_promedio) || 0,
        propinas_total:       parseFloat(r.propinas_total) || 0,
        tasa_propina_pct:     parseFloat(r.tasa_propina_pct) || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PEDIDOS: PRIMERAS ÓRDENES / RETENCIÓN ───────────────────────────────────

app.get('/pedidos/retencion', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH cohort AS (
        SELECT
          DATE_TRUNC('month', MIN(fecha_pedido)) AS mes_ingreso,
          id_usuario
        FROM pedidos
        WHERE estatus_pedido = 'Entregado'
        GROUP BY id_usuario
      ),
      actividad AS (
        SELECT
          c.mes_ingreso,
          DATE_TRUNC('month', p.fecha_pedido) AS mes_actividad,
          COUNT(DISTINCT p.id_usuario) AS usuarios_activos
        FROM cohort c
        JOIN pedidos p ON p.id_usuario = c.id_usuario
          AND p.estatus_pedido = 'Entregado'
        GROUP BY c.mes_ingreso, DATE_TRUNC('month', p.fecha_pedido)
      ),
      cohort_size AS (
        SELECT mes_ingreso, COUNT(*) AS total_usuarios FROM cohort GROUP BY mes_ingreso
      )
      SELECT
        TO_CHAR(a.mes_ingreso, 'YYYY-MM')  AS cohorte,
        cs.total_usuarios                   AS usuarios_cohorte,
        EXTRACT(MONTH FROM AGE(a.mes_actividad, a.mes_ingreso))::INT AS mes_retencion,
        a.usuarios_activos,
        ROUND(100.0 * a.usuarios_activos / cs.total_usuarios::NUMERIC, 1) AS tasa_retencion_pct
      FROM actividad a
      JOIN cohort_size cs ON cs.mes_ingreso = a.mes_ingreso
      WHERE a.mes_ingreso >= NOW() - INTERVAL '12 months'
      ORDER BY a.mes_ingreso, mes_retencion
    `);

    const cohorts = {};
    rows.forEach(r => {
      if (!cohorts[r.cohorte]) {
        cohorts[r.cohorte] = { cohorte: r.cohorte, usuarios: r.usuarios_cohorte, meses: [] };
      }
      cohorts[r.cohorte].meses.push({
        mes:           r.mes_retencion,
        activos:       parseInt(r.usuarios_activos),
        retencion_pct: parseFloat(r.tasa_retencion_pct),
      });
    });

    res.json(Object.values(cohorts));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INICIO ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`API DiDi Food corriendo en http://localhost:${PORT}`);
});
