import { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Brand } from '@/constants/theme';
import { API, fetchJSON } from '@/constants/api';

const COLORES_PIE = [Brand.accent, Brand.blue, Brand.green, '#8B5CF6', '#F59E0B', '#EC4899'];

const CSS_BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; background: #F8FAFC; color: #1E293B; padding: 28px; font-size: 13px; }
  .hdr { color: white; padding: 20px 28px; border-radius: 10px; margin-bottom: 20px; }
  .hdr h1 { font-size: 22px; font-weight: bold; }
  .hdr p  { font-size: 12px; opacity: 0.85; margin-top: 3px; }
  .grid2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 18px; }
  .kpi { background: white; border-radius: 8px; padding: 14px; border-left: 4px solid; }
  .kpi .lbl { font-size: 10px; text-transform: uppercase; color: #64748B; margin-bottom: 3px; letter-spacing: 0.5px; }
  .kpi .val { font-size: 22px; font-weight: bold; }
  .kpi .tr  { font-size: 11px; margin-top: 3px; color: #64748B; }
  .sec { background: white; border-radius: 8px; padding: 18px; margin-bottom: 16px; }
  .sec h2 { font-size: 14px; font-weight: bold; border-bottom: 2px solid; padding-bottom: 7px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { color: white; padding: 7px 9px; text-align: left; }
  td { padding: 6px 9px; border-bottom: 1px solid #E2E8F0; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
  .note { border-left: 3px solid; border-radius: 5px; padding: 9px 12px; margin-top: 10px; font-size: 11px; line-height: 1.5; }
  .footer { text-align: center; font-size: 10px; color: #94A3B8; margin-top: 28px; border-top: 1px solid #E2E8F0; padding-top: 12px; }
`;

export default function MasScreen() {
  const [metodosPago,  setMetodosPago]  = useState<any[]>([]);
  const [categorias,   setCategorias]   = useState<any[]>([]);
  const [premium,      setPremium]      = useState<any[]>([]);
  const [ingCocina,    setIngCocina]    = useState<any[]>([]);
  const [kpisResumen,  setKpisResumen]  = useState<any>(null);
  const [topRest,      setTopRest]      = useState<any[]>([]);
  const [porCocina,    setPorCocina]    = useState<any[]>([]);
  const [conductores,  setConductores]  = useState<any>(null);
  const [reactivacion, setReactivacion] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [generando,    setGenerando]    = useState<string | null>(null);
  const [error,        setError]        = useState('');
  const [seccion,      setSeccion]      = useState<'productos' | 'usuarios' | 'reporte'>('productos');

  const cargar = useCallback(() => {
    setLoading(true); setError('');
    Promise.all([
      fetchJSON(`${API}/kpi/metodos-pago`),
      fetchJSON(`${API}/productos/categorias`),
      fetchJSON(`${API}/productos/premium`),
      fetchJSON(`${API}/kpi/ingresos-cocina`),
      fetchJSON(`${API}/kpi/total-pedidos`),
      fetchJSON(`${API}/kpi/ingresos`),
      fetchJSON(`${API}/kpi/cancelaciones`),
      fetchJSON(`${API}/kpi/tiempo-entrega`),
      fetchJSON(`${API}/restaurantes/ranking?limit=8`),
      fetchJSON(`${API}/restaurantes/por-cocina`),
      fetchJSON(`${API}/kpi/conductores`),
      fetchJSON(`${API}/conductores/reactivacion`),
    ]).then(([mp, cat, prem, ing, ped, ingr, cancel, tiempo, rest, coc, cond, reac]) => {
      setMetodosPago(mp); setCategorias(cat); setPremium(prem); setIngCocina(ing);
      setKpisResumen({ pedidos: ped, ingresos: ingr, cancelaciones: cancel, tiempo });
      setTopRest(rest); setPorCocina(coc); setConductores(cond);
      setReactivacion(reac.slice(0, 10));
      setLoading(false);
    }).catch(() => { setError('Error cargando datos'); setLoading(false); });
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const fecha = () => new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  const descargar = async (html: string, nombre: string) => {
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: nombre });
      } else {
        Alert.alert('PDF generado', `Guardado en: ${uri}`);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const reportePedidos = async () => {
    if (!kpisResumen) return;
    setGenerando('pedidos');
    const { pedidos, cancelaciones, tiempo } = kpisResumen;
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>${CSS_BASE}</style></head><body>
<div class="hdr" style="background:#2563eb;">
  <h1>Reporte de Pedidos</h1>
  <p>DiDi Food Oaxaca · ${fecha()}</p>
</div>
<div class="grid2">
  <div class="kpi" style="border-color:#2563eb;">
    <div class="lbl">Pedidos este mes</div>
    <div class="val" style="color:#2563eb;">${pedidos.mes_actual.toLocaleString()}</div>
    <div class="tr" style="color:${pedidos.variacion >= 0 ? '#16a34a' : '#dc2626'}">
      ${pedidos.variacion >= 0 ? '▲' : '▼'} ${Math.abs(pedidos.variacion)}% vs mes anterior
    </div>
  </div>
  <div class="kpi" style="border-color:#16a34a;">
    <div class="lbl">Total historico</div>
    <div class="val" style="color:#16a34a;">${pedidos.total_historico.toLocaleString()}</div>
    <div class="tr">Acumulado desde inicio</div>
  </div>
  <div class="kpi" style="border-color:${cancelaciones.tasa_actual > 15 ? '#dc2626' : '#16a34a'};">
    <div class="lbl">Tasa de cancelacion</div>
    <div class="val" style="color:${cancelaciones.tasa_actual > 15 ? '#dc2626' : '#16a34a'};">${cancelaciones.tasa_actual}%</div>
    <div class="tr">${cancelaciones.total_cancelados.toLocaleString()} cancelados este mes</div>
  </div>
  <div class="kpi" style="border-color:${tiempo.mes_actual > 50 ? '#dc2626' : '#FF6B35'};">
    <div class="lbl">Tiempo entrega promedio</div>
    <div class="val" style="color:${tiempo.mes_actual > 50 ? '#dc2626' : '#FF6B35'};">${tiempo.mes_actual} min</div>
    <div class="tr">Historico: ${tiempo.promedio_historico} min</div>
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#2563eb; color:#2563eb;">Analisis del periodo</h2>
  <table>
    <tr style="background:#2563eb;"><th>Indicador</th><th>Valor actual</th><th>Comparacion</th><th>Estado</th></tr>
    <tr><td>Pedidos del mes</td><td>${pedidos.mes_actual.toLocaleString()}</td>
      <td>${pedidos.variacion >= 0 ? '+' : ''}${pedidos.variacion}% vs mes ant.</td>
      <td><span class="tag" style="background:${pedidos.variacion >= 0 ? '#DCFCE7' : '#FEE2E2'};color:${pedidos.variacion >= 0 ? '#166534' : '#991b1b'};">${pedidos.variacion >= 0 ? 'EN CRECIMIENTO' : 'EN BAJA'}</span></td>
    </tr>
    <tr><td>Cancelaciones</td><td>${cancelaciones.tasa_actual}%</td>
      <td>${cancelaciones.variacion >= 0 ? '+' : ''}${cancelaciones.variacion}% vs mes ant.</td>
      <td><span class="tag" style="background:${cancelaciones.tasa_actual > 15 ? '#FEE2E2' : '#DCFCE7'};color:${cancelaciones.tasa_actual > 15 ? '#991b1b' : '#166534'};">${cancelaciones.tasa_actual > 15 ? 'REVISAR' : 'NORMAL'}</span></td>
    </tr>
    <tr><td>Tiempo entrega</td><td>${tiempo.mes_actual} min</td>
      <td>Historico: ${tiempo.promedio_historico} min</td>
      <td><span class="tag" style="background:${tiempo.mes_actual > 50 ? '#FEE2E2' : '#DCFCE7'};color:${tiempo.mes_actual > 50 ? '#991b1b' : '#166534'};">${tiempo.mes_actual > 50 ? 'ELEVADO' : 'NORMAL'}</span></td>
    </tr>
  </table>
</div>
<div class="sec">
  <h2 style="border-color:#2563eb; color:#2563eb;">Recomendaciones operativas</h2>
  ${cancelaciones.tasa_actual > 15 ? `<div class="note" style="border-color:#dc2626;background:#FEF2F2;">
    ALERTA: Tasa de cancelacion del ${cancelaciones.tasa_actual}% supera el umbral critico del 15%.
    Accion inmediata: auditar motivos de cancelacion por zona y restaurante. Implementar alertas en tiempo real para conductores con mas de 3 cancelaciones en el dia.
  </div>` : ''}
  ${tiempo.mes_actual > 50 ? `<div class="note" style="border-color:#F59E0B;background:#FFFBEB;">
    TIEMPO ELEVADO: ${tiempo.mes_actual} min de entrega promedio afecta la satisfaccion del usuario.
    Accion: revisar distribucion de conductores por zona y ajustar radios de asignacion de pedidos.
  </div>` : ''}
  <div class="note" style="border-color:#2563eb;background:#EFF6FF;">
    META SUGERIDA: mantener cancelaciones por debajo del 10% y tiempo de entrega bajo 45 min para el proximo mes.
    Priorizar zonas con ratio pedidos/conductor menor a 3.
  </div>
</div>
<div class="footer">DiDi Food Oaxaca · Reporte de Pedidos · Generado el ${fecha()}</div>
</body></html>`;
    await descargar(html, 'Reporte Pedidos DiDi Food');
    setGenerando(null);
  };

  const reporteRestaurantes = async () => {
    if (!topRest.length) return;
    setGenerando('restaurantes');
    const htmlRest = topRest.map((r, i) => `
      <tr><td>#${i + 1}</td><td>${r.nombre}</td><td>${r.tipo_cocina}</td>
      <td>$${r.ingresos.toLocaleString()}</td><td>${r.total_pedidos.toLocaleString()}</td>
      <td style="color:${r.tasa_cancelacion > 15 ? '#dc2626' : '#16a34a'}">${r.tasa_cancelacion}%</td>
      <td style="color:#2563eb;font-weight:bold">${r.comision_sugerida}%</td></tr>`).join('');
    const htmlCoc = porCocina.slice(0, 8).map(c => `
      <tr><td>${c.tipo_cocina}</td><td>${c.pedidos.toLocaleString()}</td>
      <td>${c.participacion_pct}%</td>
      <td><span class="tag" style="background:${c.participacion_pct < 3 ? '#FEE2E2' : c.participacion_pct > 10 ? '#DCFCE7' : '#FEF3C7'};
        color:${c.participacion_pct < 3 ? '#991b1b' : c.participacion_pct > 10 ? '#166534' : '#92400E'};">
        ${c.participacion_pct < 3 ? 'BAJA' : c.participacion_pct > 10 ? 'ALTA' : 'MEDIA'}</span></td></tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>${CSS_BASE}</style></head><body>
<div class="hdr" style="background:#16a34a;">
  <h1>Reporte de Restaurantes</h1>
  <p>DiDi Food Oaxaca · ${fecha()}</p>
</div>
<div class="sec">
  <h2 style="border-color:#16a34a;color:#16a34a;">Ranking por ingresos — Top ${topRest.length}</h2>
  <table>
    <tr style="background:#16a34a;"><th>#</th><th>Restaurante</th><th>Cocina</th>
    <th>Ingresos</th><th>Pedidos</th><th>Cancelac.</th><th>Comision sug.</th></tr>
    ${htmlRest}
  </table>
  <div class="note" style="border-color:#16a34a;background:#F0FDF4;">
    Los restaurantes con tasa de cancelacion mayor al 15% requieren auditoria operativa.
    Los de participacion superior al 10% son candidatos a comision preferencial.
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#16a34a;color:#16a34a;">Participacion por tipo de cocina</h2>
  <table>
    <tr style="background:#16a34a;"><th>Tipo de cocina</th><th>Pedidos</th><th>Participacion</th><th>Nivel</th></tr>
    ${htmlCoc}
  </table>
  <div class="note" style="border-color:#F59E0B;background:#FFFBEB;">
    Tipos de cocina con menos del 3% de participacion requieren estrategia de marketing activa.
    Considerar campanas de descuento o destacado en la app para aumentar visibilidad.
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#16a34a;color:#16a34a;">Recomendaciones estrategicas</h2>
  <div class="note" style="border-color:#2563eb;background:#EFF6FF;">
    EXPANSION: priorizar la incorporacion de restaurantes del tipo de cocina lider: ${porCocina[0]?.tipo_cocina ?? 'N/D'}.
    Esto maximiza la oferta en la categoria con mayor demanda de usuarios.
  </div>
  <div class="note" style="border-color:#16a34a;background:#F0FDF4;">
    COMISIONES: revisar las comisiones de los Top 3 restaurantes por ingresos trimestralmente.
    Aplicar escala: hasta $50k ingresos = 15%, de $50k a $100k = 12%, mas de $100k = 10%.
  </div>
</div>
<div class="footer">DiDi Food Oaxaca · Reporte de Restaurantes · Generado el ${fecha()}</div>
</body></html>`;
    await descargar(html, 'Reporte Restaurantes DiDi Food');
    setGenerando(null);
  };

  const reporteConductores = async () => {
    if (!conductores) return;
    setGenerando('conductores');
    const pctActivos = ((conductores.activos / conductores.total) * 100).toFixed(1);
    const htmlReac = reactivacion.slice(0, 10).map((c, i) => `
      <tr><td>${i + 1}</td><td>${c.nombre}</td><td>${c.tipo_vehiculo}</td><td>${c.zona}</td>
      <td><span class="tag" style="background:${c.estatus === 'Inactivo' ? '#FEF3C7' : '#FEE2E2'};
        color:${c.estatus === 'Inactivo' ? '#92400E' : '#991b1b'};">${c.estatus.toUpperCase()}</span></td>
      <td style="color:#854D0E;font-weight:bold">${c.calificacion}</td>
      <td>${c.bono_sugerido}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>${CSS_BASE}</style></head><body>
<div class="hdr" style="background:#7C3AED;">
  <h1>Reporte de Conductores</h1>
  <p>DiDi Food Oaxaca · ${fecha()}</p>
</div>
<div class="grid2">
  <div class="kpi" style="border-color:#16a34a;">
    <div class="lbl">Conductores activos</div>
    <div class="val" style="color:#16a34a;">${conductores.activos}</div>
    <div class="tr">${pctActivos}% de la flota total</div>
  </div>
  <div class="kpi" style="border-color:#64748B;">
    <div class="lbl">Inactivos</div>
    <div class="val" style="color:#64748B;">${conductores.inactivos}</div>
    <div class="tr">Con potencial de reactivacion</div>
  </div>
  <div class="kpi" style="border-color:#dc2626;">
    <div class="lbl">Sancionados</div>
    <div class="val" style="color:#dc2626;">${conductores.sancionados}</div>
    <div class="tr">Requieren revision inmediata</div>
  </div>
  <div class="kpi" style="border-color:#F59E0B;">
    <div class="lbl">Calificacion promedio</div>
    <div class="val" style="color:#92400E;">${conductores.calificacion_promedio}</div>
    <div class="tr">Total: ${conductores.total} conductores</div>
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#7C3AED;color:#7C3AED;">Conductores prioritarios para reactivacion</h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Priorizados por calificacion historica</p>
  <table>
    <tr style="background:#7C3AED;"><th>#</th><th>Nombre</th><th>Vehiculo</th><th>Zona</th>
    <th>Estatus</th><th>Calif.</th><th>Bono sugerido</th></tr>
    ${htmlReac}
  </table>
  <div class="note" style="border-color:#7C3AED;background:#F5F3FF;">
    Conductores con calificacion mayor a 4.5 tienen alta probabilidad de reactivarse con un incentivo economico.
    Se recomienda contacto directo via WhatsApp con oferta de bono por primeras 10 entregas completadas.
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#7C3AED;color:#7C3AED;">Recomendaciones de flota</h2>
  ${conductores.sancionados > 20 ? `<div class="note" style="border-color:#dc2626;background:#FEF2F2;">
    ALERTA: ${conductores.sancionados} conductores sancionados. Revisar causas y aplicar protocolo de reinsercion
    o baja definitiva segun politica vigente.
  </div>` : ''}
  <div class="note" style="border-color:#16a34a;background:#F0FDF4;">
    META DE ACTIVIDAD: mantener al menos el 70% de la flota activa por mes.
    Actividad actual: ${pctActivos}%. ${parseFloat(pctActivos) < 70 ? 'Por debajo del objetivo — activar programa de bonos.' : 'Dentro del objetivo.'}
  </div>
</div>
<div class="footer">DiDi Food Oaxaca · Reporte de Conductores · Generado el ${fecha()}</div>
</body></html>`;
    await descargar(html, 'Reporte Conductores DiDi Food');
    setGenerando(null);
  };

  const reporteUsuarios = async () => {
    if (!metodosPago.length) return;
    setGenerando('usuarios');
    const htmlMp = metodosPago.map(m => `
      <tr><td>${m.metodo}</td><td>${m.total.toLocaleString()}</td>
      <td style="font-weight:bold">${m.porcentaje}%</td></tr>`).join('');
    const htmlCat = categorias.map(c => `
      <tr><td>${c.categoria}</td><td>${c.total_productos}</td>
      <td>$${c.precio_promedio}</td><td>$${c.precio_minimo} – $${c.precio_maximo}</td>
      <td style="color:#FF6B35;font-weight:bold">${c.candidatos_premium}</td></tr>`).join('');
    const htmlPrem = premium.slice(0, 8).map(p => `
      <tr><td>${p.producto}</td><td>${p.restaurante}</td><td>${p.tipo_cocina}</td>
      <td style="color:#854D0E;font-weight:bold">$${p.precio}</td></tr>`).join('');
    const metodoDom = metodosPago[0];
    const metodoEfec = metodosPago.find(m => m.metodo === 'Efectivo');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>${CSS_BASE}</style></head><body>
<div class="hdr" style="background:#FF6B35;">
  <h1>Reporte de Usuarios y Productos</h1>
  <p>DiDi Food Oaxaca · ${fecha()}</p>
</div>
<div class="sec">
  <h2 style="border-color:#FF6B35;color:#FF6B35;">Distribucion de metodos de pago</h2>
  <table>
    <tr style="background:#FF6B35;"><th>Metodo</th><th>Total pedidos</th><th>Participacion</th></tr>
    ${htmlMp}
  </table>
  ${metodoEfec && metodoEfec.porcentaje > 40 ? `<div class="note" style="border-color:#dc2626;background:#FEF2F2;">
    RIESGO: ${metodoEfec.porcentaje}% de pagos en efectivo. Campana sugerida: descuento del 5% en proximo pedido al registrar metodo digital.
    Meta: reducir efectivo a menos del 30% en los proximos 3 meses.
  </div>` : ''}
  <div class="note" style="border-color:#FF6B35;background:#FFF4ED;">
    Metodo dominante: ${metodoDom?.metodo} (${metodoDom?.porcentaje}%). Asegurar infraestructura robusta para este metodo sin interrupciones.
    Meta sugerida: 60% de pagos digitales en 6 meses para reducir costos operativos.
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#FF6B35;color:#FF6B35;">Analisis de categorias de productos</h2>
  <table>
    <tr style="background:#FF6B35;"><th>Categoria</th><th>Productos</th><th>Precio prom.</th><th>Rango</th><th>Premium</th></tr>
    ${htmlCat}
  </table>
  <div class="note" style="border-color:#2563eb;background:#EFF6FF;">
    Las categorias con mayor cantidad de candidatos premium tienen potencial de destacado en la app.
    Agregar descripcion detallada y foto de calidad aumenta el ticket promedio hasta un 18%.
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#FF6B35;color:#FF6B35;">Productos candidatos a seccion premium (precio &gt;= $200)</h2>
  <table>
    <tr style="background:#FF6B35;"><th>Producto</th><th>Restaurante</th><th>Tipo cocina</th><th>Precio</th></tr>
    ${htmlPrem}
  </table>
</div>
<div class="footer">DiDi Food Oaxaca · Reporte de Usuarios y Productos · Generado el ${fecha()}</div>
</body></html>`;
    await descargar(html, 'Reporte Usuarios DiDi Food');
    setGenerando(null);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Brand.accent} /></View>;
  if (error)   return <View style={styles.center}><Text style={{ color: Brand.red }}>{error}</Text></View>;

  const pieData = metodosPago.map((m, i) => ({
    value: m.total, color: COLORES_PIE[i % COLORES_PIE.length], text: `${m.porcentaje}%`,
  }));

  const metodoDigital  = metodosPago.find(m => m.metodo === 'Transferencia');
  const metodoEfectivo = metodosPago.find(m => m.metodo === 'Efectivo');
  const metodoTarjeta  = metodosPago.find(m => m.metodo === 'Tarjeta');
  const totalPedidos   = metodosPago.reduce((a, m) => a + m.total, 0);

  const reportes = [
    {
      id: 'pedidos',
      titulo: 'Reporte de Pedidos',
      sub: 'KPIs del periodo, cancelaciones, tiempos de entrega y recomendaciones operativas',
      icon: 'receipt-outline',
      color: Brand.blue,
      bg: Brand.cardBlue,
      fn: reportePedidos,
    },
    {
      id: 'restaurantes',
      titulo: 'Reporte de Restaurantes',
      sub: 'Ranking de restaurantes, comisiones sugeridas, participacion por tipo de cocina',
      icon: 'restaurant-outline',
      color: Brand.green,
      bg: Brand.cardGreen,
      fn: reporteRestaurantes,
    },
    {
      id: 'conductores',
      titulo: 'Reporte de Conductores',
      sub: 'Estado de la flota, conductores prioritarios para reactivar y bonos sugeridos',
      icon: 'bicycle-outline',
      color: Brand.purple,
      bg: Brand.cardPurple,
      fn: reporteConductores,
    },
    {
      id: 'usuarios',
      titulo: 'Reporte de Usuarios y Productos',
      sub: 'Metodos de pago, categorias, productos premium y estrategia de digitalizacion',
      icon: 'people-outline',
      color: Brand.accent,
      bg: Brand.cardOrange,
      fn: reporteUsuarios,
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <View style={styles.headerBg}>
        <Text style={styles.titulo}>Mas</Text>
        <Text style={styles.subtitulo}>Productos · Usuarios · Reportes</Text>
      </View>

      <View style={styles.tabs}>
        {(['productos', 'usuarios', 'reporte'] as const).map(s => (
          <TouchableOpacity key={s} onPress={() => setSeccion(s)}
            style={[styles.tab, seccion === s && styles.tabActive]}>
            <Text style={[styles.tabText, seccion === s && styles.tabTextActive]}>
              {s === 'reporte' ? 'Reportes' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── PRODUCTOS ── */}
      {seccion === 'productos' && (
        <>
          <View style={[styles.card, { backgroundColor: Brand.cardBlue }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="star-outline" size={18} color={Brand.blue} />
              <Text style={[styles.seccionTitulo, { color: Brand.blue }]}>Candidatos a seccion Premium</Text>
            </View>
            <Text style={styles.sub}>Productos con precio mayor a $200 MXN</Text>
            {premium.slice(0, 8).map((p, i) => (
              <View key={i} style={styles.prodRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodNombre} numberOfLines={1}>{p.producto}</Text>
                  <Text style={styles.prodSub}>{p.restaurante} · {p.tipo_cocina}</Text>
                </View>
                <View style={styles.precioBadge}>
                  <Text style={styles.precioText}>${p.precio}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: Brand.cardYellow }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="grid-outline" size={18} color={Brand.accent} />
              <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Analisis por categoria</Text>
            </View>
            {categorias.map((c, i) => (
              <View key={i} style={styles.catRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.catNombre}>{c.categoria}</Text>
                  <Text style={styles.catSub}>{c.total_productos} productos · prom ${c.precio_promedio}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.catRango}>${c.precio_minimo} – ${c.precio_maximo}</Text>
                  <Text style={styles.catPremium}>{c.candidatos_premium} premium</Text>
                </View>
              </View>
            ))}
            <View style={[styles.alertaRow, { borderLeftColor: Brand.blue, backgroundColor: Brand.card }]}>
              <View style={styles.alertaLabel}>
                <Text style={styles.alertaLabelText}>SUGERENCIA</Text>
              </View>
              <Text style={[styles.alertaTexto, { color: Brand.blue }]}>
                Agregar productos de Bebida y Postre a seccion premium con descripcion destacada aumenta ticket promedio
              </Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: Brand.cardGreen }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="trending-up-outline" size={18} color={Brand.green} />
              <Text style={[styles.seccionTitulo, { color: Brand.green }]}>Ingresos por tipo de cocina</Text>
            </View>
            {ingCocina.slice(0, 8).map((r, i) => (
              <View key={i} style={styles.ingRow}>
                <Text style={styles.ingNombre} numberOfLines={1}>{r.tipo_cocina.substring(0, 9)}</Text>
                <View style={styles.ingBar}>
                  <View style={[styles.ingFill, {
                    width: `${(r.ingresos / ingCocina[0].ingresos) * 100}%`,
                    backgroundColor: COLORES_PIE[i % COLORES_PIE.length],
                  }]} />
                </View>
                <Text style={styles.ingVal}>${(r.ingresos / 1000).toFixed(0)}k</Text>
              </View>
            ))}
            <View style={[styles.alertaRow, { borderLeftColor: Brand.green, backgroundColor: Brand.card }]}>
              <View style={styles.alertaLabel}>
                <Text style={styles.alertaLabelText}>COCINA LIDER</Text>
              </View>
              <Text style={[styles.alertaTexto, { color: Brand.green }]}>
                {ingCocina[0]?.tipo_cocina} — priorizar incorporacion de mas restaurantes de este tipo
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ── USUARIOS ── */}
      {seccion === 'usuarios' && (
        <>
          <View style={[styles.card, { backgroundColor: Brand.cardPurple }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="card-outline" size={18} color={Brand.purple} />
              <Text style={[styles.seccionTitulo, { color: Brand.purple }]}>Metodos de pago</Text>
            </View>
            <View style={{ alignItems: 'center', marginVertical: 16 }}>
              <PieChart
                data={pieData}
                donut
                innerRadius={60}
                radius={90}
                centerLabelComponent={() => (
                  <Text style={{ fontSize: 11, color: Brand.subtext, textAlign: 'center' }}>
                    {totalPedidos.toLocaleString()}{'\n'}pedidos
                  </Text>
                )}
              />
            </View>
            {metodosPago.map((m, i) => (
              <View key={i} style={styles.metodoRow}>
                <View style={[styles.dot, { backgroundColor: COLORES_PIE[i % COLORES_PIE.length] }]} />
                <Text style={styles.metodoNombre}>{m.metodo}</Text>
                <Text style={styles.metodoPct}>{m.porcentaje}%</Text>
                <Text style={styles.metodoTotal}>{m.total.toLocaleString()} pedidos</Text>
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="bulb-outline" size={18} color={Brand.accent} />
              <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Recomendaciones estrategicas</Text>
            </View>

            {metodoEfectivo && metodoEfectivo.porcentaje > 40 && (
              <View style={[styles.alertaRow, { borderLeftColor: Brand.red }]}>
                <View style={styles.alertaLabel}>
                  <Text style={styles.alertaLabelText}>RIESGO OPERATIVO</Text>
                </View>
                <Text style={styles.alertaTexto}>
                  <Text style={{ fontWeight: '700' }}>{metodoEfectivo.porcentaje}% en efectivo</Text> — riesgo operativo alto.{'\n'}
                  Accion: campana "Paga digital, gana puntos" con descuento del 5% en proximo pedido.
                  Meta: reducir efectivo a menos del 30% en 3 meses.
                </Text>
              </View>
            )}

            {metodoDigital && metodoDigital.porcentaje < 25 && (
              <View style={[styles.alertaRow, { borderLeftColor: Brand.blue }]}>
                <View style={styles.alertaLabel}>
                  <Text style={styles.alertaLabelText}>OPORTUNIDAD DIGITAL</Text>
                </View>
                <Text style={[styles.alertaTexto, { color: Brand.blue }]}>
                  <Text style={{ fontWeight: '700' }}>Solo {metodoDigital.porcentaje}% usa transferencia</Text>.{'\n'}
                  Accion: ofrecer primer envio gratis al registrar metodo digital. Reduce costos de manejo de efectivo para conductores.
                </Text>
              </View>
            )}

            {metodoTarjeta && metodoTarjeta.porcentaje > 30 && (
              <View style={[styles.alertaRow, { borderLeftColor: Brand.green }]}>
                <View style={styles.alertaLabel}>
                  <Text style={styles.alertaLabelText}>ADOPCION DIGITAL</Text>
                </View>
                <Text style={[styles.alertaTexto, { color: Brand.green }]}>
                  <Text style={{ fontWeight: '700' }}>{metodoTarjeta.porcentaje}% usa tarjeta</Text> — buen nivel de adopcion digital.{'\n'}
                  Oportunidad: negociar con bancos comisiones preferenciales por volumen de transacciones.
                </Text>
              </View>
            )}

            {metodosPago.length > 0 && (
              <View style={[styles.alertaRow, { borderLeftColor: Brand.accent }]}>
                <View style={styles.alertaLabel}>
                  <Text style={styles.alertaLabelText}>METODO DOMINANTE</Text>
                </View>
                <Text style={styles.alertaTexto}>
                  <Text style={{ fontWeight: '700' }}>{metodosPago[0].metodo} ({metodosPago[0].porcentaje}%)</Text>.{'\n'}
                  Asegurar que la infraestructura soporte el metodo principal sin interrupciones.
                </Text>
              </View>
            )}

            <View style={[styles.alertaRow, { borderLeftColor: Brand.purple }]}>
              <View style={styles.alertaLabel}>
                <Text style={styles.alertaLabelText}>META SUGERIDA</Text>
              </View>
              <Text style={styles.alertaTexto}>
                Lograr que al menos el 60% de pagos sean digitales (tarjeta + transferencia) en 6 meses.
                Reduce costos operativos y mejora trazabilidad de ingresos.
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ── REPORTES ── */}
      {seccion === 'reporte' && (
        <>
          <View style={styles.reporteIntro}>
            <Ionicons name="document-text-outline" size={22} color={Brand.text} />
            <Text style={styles.reporteIntroText}>Descarga el reporte PDF de cada seccion con analisis y recomendaciones</Text>
          </View>
          {reportes.map(r => (
            <View key={r.id} style={[styles.card, { backgroundColor: r.bg }]}>
              <View style={styles.seccionHeader}>
                <Ionicons name={r.icon as any} size={18} color={r.color} />
                <Text style={[styles.seccionTitulo, { color: r.color }]}>{r.titulo}</Text>
              </View>
              <Text style={styles.reporteSub}>{r.sub}</Text>
              <TouchableOpacity
                style={[styles.btnReporte, { backgroundColor: r.color, opacity: generando === r.id ? 0.6 : 1 }]}
                onPress={async () => { await r.fn(); }}
                disabled={generando !== null}
              >
                {generando === r.id
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Ionicons name="download-outline" size={18} color="#fff" />
                }
                <Text style={styles.btnReporteText}>
                  {generando === r.id ? 'Generando PDF...' : 'Descargar PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={[styles.alertaRow, { borderLeftColor: Brand.blue, marginHorizontal: 16, marginTop: 4, backgroundColor: Brand.cardBlue }]}>
            <View style={styles.alertaLabel}>
              <Text style={styles.alertaLabelText}>COMPARTIR</Text>
            </View>
            <Text style={[styles.alertaTexto, { color: Brand.blue }]}>
              Los PDFs se pueden enviar por WhatsApp, correo u otras apps instaladas en el dispositivo
            </Text>
          </View>
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Brand.bg },
  center:          { flex: 1, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  headerBg:        { backgroundColor: Brand.headerDark, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  titulo:          { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF' },
  subtitulo:       { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  tabs:            { flexDirection: 'row', backgroundColor: Brand.card, borderRadius: 12, padding: 4, margin: 16, marginBottom: 0 },
  tab:             { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabActive:       { backgroundColor: Brand.accent },
  tabText:         { fontSize: 13, fontWeight: '600', color: Brand.subtext },
  tabTextActive:   { color: '#fff' },
  card:            { borderRadius: 16, padding: 16, margin: 16, marginBottom: 0, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  seccionHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  seccionTitulo:   { fontSize: 14, fontWeight: '700', color: Brand.text },
  sub:             { fontSize: 11, color: Brand.subtext, marginBottom: 8, lineHeight: 16 },
  alertaRow:       { borderLeftWidth: 3, borderRadius: 6, padding: 10, backgroundColor: Brand.bg, marginBottom: 8 },
  alertaLabel:     { marginBottom: 4 },
  alertaLabelText: { fontSize: 9, fontWeight: '800', color: Brand.subtext, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertaTexto:     { fontSize: 12, color: Brand.text, lineHeight: 18 },
  prodRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Brand.border },
  prodNombre:      { fontSize: 13, fontWeight: '600', color: Brand.text },
  prodSub:         { fontSize: 11, color: Brand.subtext },
  precioBadge:     { backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  precioText:      { fontSize: 13, fontWeight: '700', color: '#92400E' },
  catRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Brand.border },
  catNombre:       { fontSize: 13, fontWeight: '600', color: Brand.text },
  catSub:          { fontSize: 11, color: Brand.subtext },
  catRango:        { fontSize: 11, color: Brand.subtext },
  catPremium:      { fontSize: 11, color: Brand.accent, fontWeight: '600' },
  ingRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  ingNombre:       { width: 80, fontSize: 11, color: Brand.subtext },
  ingBar:          { flex: 1, height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  ingFill:         { height: 8, borderRadius: 4 },
  ingVal:          { width: 44, fontSize: 11, color: Brand.subtext, textAlign: 'right' },
  metodoRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  dot:             { width: 12, height: 12, borderRadius: 6 },
  metodoNombre:    { flex: 1, fontSize: 13, color: Brand.text, fontWeight: '600' },
  metodoPct:       { fontSize: 14, fontWeight: 'bold', color: Brand.text },
  metodoTotal:     { width: 90, fontSize: 11, color: Brand.subtext, textAlign: 'right' },
  reporteIntro:    { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 0 },
  reporteIntroText:{ flex: 1, fontSize: 12, color: Brand.subtext, lineHeight: 18 },
  reporteSub:      { fontSize: 12, color: Brand.subtext, lineHeight: 18, marginBottom: 14 },
  btnReporte:      { borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnReporteText:  { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
