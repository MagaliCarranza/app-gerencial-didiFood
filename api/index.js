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
        TO_CHAR(${ULTIMO_MES}, 'Month YYYY') AS periodo
      FROM pedidos
    `);
    const r = rows[0];
    res.json({
      total_historico: parseInt(r.total_historico),
      mes_actual:      parseInt(r.mes_actual),
      mes_anterior:    parseInt(r.mes_anterior),
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
        ), 0)::NUMERIC, 2) AS total_historico
      FROM pedidos
    `);
    const r = rows[0];
    res.json({
      total_historico: parseFloat(r.total_historico),
      mes_actual:      parseFloat(r.mes_actual),
      mes_anterior:    parseFloat(r.mes_anterior),
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
        ), 0)::NUMERIC, 1) AS promedio_historico
      FROM pedidos
      WHERE tiempo_entrega_min IS NOT NULL
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
    const { rows } = await pool.query(`
      SELECT
        tipo_cocina,
        COUNT(*) AS total_pedidos,
        ROUND(SUM(total)::NUMERIC, 2) AS ingresos,
        ROUND(AVG(subtotal)::NUMERIC, 2) AS ticket_promedio
      FROM pedidos
      WHERE estatus_pedido = 'Entregado'
      GROUP BY tipo_cocina
      ORDER BY ingresos DESC
    `);
    res.json(rows.map(r => ({
      tipo_cocina:     r.tipo_cocina,
      total_pedidos:   parseInt(r.total_pedidos),
      ingresos:        parseFloat(r.ingresos),
      ticket_promedio: parseFloat(r.ticket_promedio),
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
        ROUND(AVG(calificacion_promedio)::NUMERIC, 2)  AS calificacion_promedio
      FROM conductores
    `);
    const r = rows[0];
    res.json({
      total:                parseInt(r.total),
      activos:              parseInt(r.activos),
      inactivos:            parseInt(r.inactivos),
      sancionados:          parseInt(r.sancionados),
      calificacion_promedio: parseFloat(r.calificacion_promedio),
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

// ─── PEDIDOS: CLIENTES NUEVOS (aproximación) ─────────────────────────────────

app.get('/pedidos/clientes-nuevos', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH primer_pedido AS (
        SELECT id_usuario, MIN(fecha_pedido) AS primera_compra
        FROM pedidos GROUP BY id_usuario
      ),
      nuevos AS (
        SELECT id_usuario
        FROM primer_pedido
        WHERE DATE_TRUNC('month', primera_compra) = ${ULTIMO_MES}
      )
      SELECT
        COUNT(DISTINCT n.id_usuario) AS nuevos_clientes,
        COUNT(p.id_pedido)           AS pedidos_de_nuevos,
        ROUND(AVG(p.subtotal)::NUMERIC, 2) AS ticket_promedio_nuevos
      FROM nuevos n
      JOIN pedidos p ON p.id_usuario = n.id_usuario
        AND DATE_TRUNC('month', p.fecha_pedido) = ${ULTIMO_MES}
    `);

    const hist = await pool.query(`
      WITH primer_pedido AS (
        SELECT id_usuario, DATE_TRUNC('month', MIN(fecha_pedido)) AS mes_ingreso
        FROM pedidos GROUP BY id_usuario
      )
      SELECT
        mes_ingreso,
        COUNT(*) AS nuevos_clientes
      FROM primer_pedido
      GROUP BY mes_ingreso
      ORDER BY mes_ingreso
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
      LIMIT 15
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
        COUNT(p.id_pedido)               AS pedidos_recibidos
      FROM restaurantes r
      LEFT JOIN pedidos p ON p.id_restaurante = r.id_restaurante
      GROUP BY r.colonia, r.municipio
      ORDER BY restaurantes DESC
    `);
    res.json(rows.map(r => ({
      colonia:              r.colonia,
      municipio:            r.municipio,
      restaurantes:         parseInt(r.restaurantes),
      tipos_cocina:         parseInt(r.tipos_cocina),
      calificacion:         parseFloat(r.calificacion_promedio),
      pedidos_recibidos:    parseInt(r.pedidos_recibidos),
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
      GROUP BY r.id_restaurante, r.nombre, r.tipo_cocina, r.colonia, r.calificacion_promedio
      ORDER BY ingresos DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    const total_ingresos_res = await pool.query(
      `SELECT SUM(total) AS total FROM pedidos WHERE estatus_pedido = 'Entregado'`
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
      if (tasa_cancel > 15)    { sugerencia = 'Alta cancelación — revisar operación';    sugerencia_tipo = 'warn'; }
      else if (ingresos === 0) { sugerencia = 'Sin ingresos registrados';                sugerencia_tipo = 'error'; }
      else if (i >= limit - 3) { sugerencia = 'Marketing prioritario recomendado';       sugerencia_tipo = 'info'; }
      else if (participacion > 2) { sugerencia = 'Candidato a visibilidad premium';      sugerencia_tipo = 'ok'; }

      return {
        posicion:           i + 1,
        id:                 r.id_restaurante,
        nombre:             r.nombre,
        tipo_cocina:        r.tipo_cocina,
        colonia:            r.colonia,
        calificacion:       parseFloat(r.calificacion_promedio),
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
          / NULLIF(SUM(COUNT(*)) OVER(), 0)::NUMERIC, 2) AS participacion_pct
      FROM pedidos
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
        ROUND(AVG(c.calificacion_promedio)::NUMERIC, 2) AS calificacion_promedio,
        COUNT(p.id_pedido) AS pedidos_realizados,
        ROUND(AVG(p.tiempo_entrega_min)::NUMERIC, 1) AS tiempo_entrega_promedio
      FROM conductores c
      LEFT JOIN pedidos p ON p.id_conductor = c.id_conductor
        AND p.estatus_pedido = 'Entregado'
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
        tipo_vehiculo:       r.tipo_vehiculo,
        total:               parseInt(r.total_conductores),
        activos:             parseInt(r.activos),
        calificacion:        parseFloat(r.calificacion_promedio),
        pedidos:             parseInt(r.pedidos_realizados),
        tiempo_promedio:     parseFloat(r.tiempo_entrega_promedio) || 0,
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
      SELECT colonia_entrega AS zona, COUNT(*) AS pedidos
      FROM pedidos WHERE estatus_pedido = 'Entregado'
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
        zona:       r.zona_operacion,
        conductores: parseInt(r.conductores),
        activos:    parseInt(r.activos),
        pedidos_zona,
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

// ─── INICIO ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`API DiDi Food corriendo en http://localhost:${PORT}`);
});
