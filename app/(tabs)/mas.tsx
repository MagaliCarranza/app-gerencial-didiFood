import { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Alert, TextInput, Modal } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [topVendidos,  setTopVendidos]  = useState<any[]>([]);
  const [oportunidades, setOportunidades] = useState<{ horas: any[], productos: any[] }>({ horas: [], productos: [] });
  const [rfm,          setRfm]          = useState<any[]>([]);
  const [adquisicion,  setAdquisicion]  = useState<any[]>([]);
  const [loading,             setLoading]             = useState(true);
  const [generando,           setGenerando]           = useState<string | null>(null);
  const [error,               setError]               = useState('');
  const [seccion,             setSeccion]             = useState<'productos' | 'usuarios' | 'reporte'>('productos');
  const [cantidadPremium,     setCantidadPremium]     = useState(8);
  const [cantidadPremiumInput,setCantidadPremiumInput]= useState('8');
  const [modalPremium,        setModalPremium]        = useState(false);
  const [cantidadCat,         setCantidadCat]         = useState(0);
  const [cantidadCatInput,    setCantidadCatInput]    = useState('');
  const [modalCat,            setModalCat]            = useState(false);
  const [cantidadIngCocina,   setCantidadIngCocina]   = useState(8);
  const [cantidadIngInput,    setCantidadIngInput]    = useState('8');
  const [modalIngCocina,      setModalIngCocina]      = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('mas_premium_cantidad').then(v => {
      if (v) { setCantidadPremium(parseInt(v)); setCantidadPremiumInput(v); }
    });
    AsyncStorage.getItem('mas_cat_cantidad').then(v => {
      if (v) { setCantidadCat(parseInt(v)); setCantidadCatInput(v); }
    });
    AsyncStorage.getItem('mas_ingcocina_cantidad').then(v => {
      if (v) { setCantidadIngCocina(parseInt(v)); setCantidadIngInput(v); }
    });
  }, []);

  const aplicarPremium = () => {
    const n = parseInt(cantidadPremiumInput);
    if (n > 0) { AsyncStorage.setItem('mas_premium_cantidad', String(n)); setCantidadPremium(n); }
    setModalPremium(false);
  };
  const aplicarCat = () => {
    const n = parseInt(cantidadCatInput);
    if (n > 0) { AsyncStorage.setItem('mas_cat_cantidad', String(n)); setCantidadCat(n); }
    else { AsyncStorage.removeItem('mas_cat_cantidad'); setCantidadCat(0); }
    setModalCat(false);
  };
  const aplicarIngCocina = () => {
    const n = parseInt(cantidadIngInput);
    if (n > 0) { AsyncStorage.setItem('mas_ingcocina_cantidad', String(n)); setCantidadIngCocina(n); }
    setModalIngCocina(false);
  };

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
      fetchJSON(`${API}/productos/top-vendidos?limit=10`).catch(() => []),
      fetchJSON(`${API}/usuarios/segmentos`).catch(() => []),
      fetchJSON(`${API}/usuarios/adquisicion`).catch(() => []),
      fetchJSON(`${API}/oportunidades/horario`).catch(() => ({ horas: [], productos: [] })),
    ]).then(([mp, cat, prem, ing, ped, ingr, cancel, tiempo, rest, coc, cond, reac, tv, rfmData, adq, opor]) => {
      setMetodosPago(mp); setCategorias(cat); setPremium(prem); setIngCocina(ing);
      setKpisResumen({ pedidos: ped, ingresos: ingr, cancelaciones: cancel, tiempo });
      setTopRest(rest); setPorCocina(coc); setConductores(cond);
      setReactivacion(reac.slice(0, 10));
      setTopVendidos(Array.isArray(tv) ? tv : []);
      setRfm(Array.isArray(rfmData) ? rfmData : []);
      setAdquisicion(Array.isArray(adq) ? adq : []);
      setOportunidades(opor?.horas ? opor : { horas: [], productos: [] });
      setLoading(false);
    }).catch(() => { setError('Error cargando datos'); setLoading(false); });
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const fecha = () => new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  const descargar = async (html: string, nombre: string) => {
    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: nombre, UTI: 'com.adobe.pdf' });
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
    const { pedidos, ingresos, cancelaciones, tiempo } = kpisResumen;
    const ticketPromedio = pedidos.mes_actual > 0
      ? (ingresos.mes_actual / pedidos.mes_actual).toFixed(2)
      : '0.00';
    const totalCancelados = cancelaciones.por_cliente + cancelaciones.por_restaurante + cancelaciones.por_conductor;
    const pctCliente     = totalCancelados > 0 ? ((cancelaciones.por_cliente     / totalCancelados) * 100).toFixed(1) : '0';
    const pctRestaurante = totalCancelados > 0 ? ((cancelaciones.por_restaurante / totalCancelados) * 100).toFixed(1) : '0';
    const pctConductor   = totalCancelados > 0 ? ((cancelaciones.por_conductor   / totalCancelados) * 100).toFixed(1) : '0';
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>${CSS_BASE}</style></head><body>
<div class="hdr" style="background:#2563eb;">
  <h1>Reporte de Pedidos</h1>
  <p>DiDi Food Oaxaca · ${pedidos.periodo} · Generado el ${fecha()}</p>
</div>
<div class="grid2">
  <div class="kpi" style="border-color:#2563eb;">
    <div class="lbl">Pedidos este mes</div>
    <div class="val" style="color:#2563eb;">${pedidos.mes_actual.toLocaleString()}</div>
    <div class="tr" style="color:${pedidos.variacion >= 0 ? '#16a34a' : '#dc2626'}">
      ${pedidos.variacion >= 0 ? '▲' : '▼'} ${Math.abs(pedidos.variacion)}% vs mes anterior (${pedidos.mes_anterior.toLocaleString()})
    </div>
  </div>
  <div class="kpi" style="border-color:#16a34a;">
    <div class="lbl">Ingresos este mes</div>
    <div class="val" style="color:#16a34a;">$${ingresos.mes_actual.toLocaleString()}</div>
    <div class="tr" style="color:${ingresos.variacion >= 0 ? '#16a34a' : '#dc2626'}">
      ${ingresos.variacion >= 0 ? '▲' : '▼'} ${Math.abs(ingresos.variacion)}% vs mes anterior
    </div>
  </div>
  <div class="kpi" style="border-color:#7C3AED;">
    <div class="lbl">Ticket promedio</div>
    <div class="val" style="color:#7C3AED;">$${ticketPromedio}</div>
    <div class="tr">Ingreso por pedido entregado</div>
  </div>
  <div class="kpi" style="border-color:${cancelaciones.tasa_actual > 15 ? '#dc2626' : '#16a34a'};">
    <div class="lbl">Tasa de cancelacion</div>
    <div class="val" style="color:${cancelaciones.tasa_actual > 15 ? '#dc2626' : '#16a34a'};">${cancelaciones.tasa_actual}%</div>
    <div class="tr">${cancelaciones.variacion >= 0 ? '+' : ''}${cancelaciones.variacion}% vs mes anterior</div>
  </div>
  <div class="kpi" style="border-color:${tiempo.mes_actual > 50 ? '#dc2626' : '#FF6B35'};">
    <div class="lbl">Tiempo entrega promedio</div>
    <div class="val" style="color:${tiempo.mes_actual > 50 ? '#dc2626' : '#FF6B35'};">${tiempo.mes_actual} min</div>
    <div class="tr">Historico: ${tiempo.promedio_historico} min · Mes ant: ${tiempo.mes_anterior} min</div>
  </div>
  <div class="kpi" style="border-color:#64748B;">
    <div class="lbl">Total historico</div>
    <div class="val" style="color:#64748B;">${pedidos.total_historico.toLocaleString()}</div>
    <div class="tr">Pedidos acumulados desde inicio</div>
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#2563eb; color:#2563eb;">Analisis del periodo</h2>
  <p style="color:#64748B;font-size:11px;margin-bottom:10px;">Comparacion entre el mes actual y el mes anterior. La variacion indica si el negocio crece o retrocede en cada dimension clave.</p>
  <table>
    <tr style="background:#2563eb;"><th>Indicador</th><th>Este mes</th><th>Mes anterior</th><th>Variacion</th><th>Estado</th></tr>
    <tr><td>Pedidos</td><td>${pedidos.mes_actual.toLocaleString()}</td>
      <td>${pedidos.mes_anterior.toLocaleString()}</td>
      <td style="color:${pedidos.variacion >= 0 ? '#16a34a' : '#dc2626'}">${pedidos.variacion >= 0 ? '+' : ''}${pedidos.variacion}%</td>
      <td><span class="tag" style="background:${pedidos.variacion >= 0 ? '#DCFCE7' : '#FEE2E2'};color:${pedidos.variacion >= 0 ? '#166534' : '#991b1b'};">${pedidos.variacion >= 0 ? 'CRECIMIENTO' : 'BAJA'}</span></td>
    </tr>
    <tr><td>Ingresos</td><td>$${ingresos.mes_actual.toLocaleString()}</td>
      <td>$${ingresos.mes_anterior.toLocaleString()}</td>
      <td style="color:${ingresos.variacion >= 0 ? '#16a34a' : '#dc2626'}">${ingresos.variacion >= 0 ? '+' : ''}${ingresos.variacion}%</td>
      <td><span class="tag" style="background:${ingresos.variacion >= 0 ? '#DCFCE7' : '#FEE2E2'};color:${ingresos.variacion >= 0 ? '#166534' : '#991b1b'};">${ingresos.variacion >= 0 ? 'CRECIMIENTO' : 'BAJA'}</span></td>
    </tr>
    <tr><td>Tasa cancelacion</td><td>${cancelaciones.tasa_actual}%</td>
      <td>${cancelaciones.tasa_anterior}%</td>
      <td style="color:${cancelaciones.variacion <= 0 ? '#16a34a' : '#dc2626'}">${cancelaciones.variacion >= 0 ? '+' : ''}${cancelaciones.variacion}%</td>
      <td><span class="tag" style="background:${cancelaciones.tasa_actual > 15 ? '#FEE2E2' : '#DCFCE7'};color:${cancelaciones.tasa_actual > 15 ? '#991b1b' : '#166534'};">${cancelaciones.tasa_actual > 15 ? 'REVISAR' : 'NORMAL'}</span></td>
    </tr>
    <tr><td>Tiempo entrega</td><td>${tiempo.mes_actual} min</td>
      <td>${tiempo.mes_anterior} min</td>
      <td style="color:${tiempo.mes_actual <= tiempo.mes_anterior ? '#16a34a' : '#dc2626'}">${tiempo.mes_actual <= tiempo.mes_anterior ? '▼ mejoro' : '▲ subio'}</td>
      <td><span class="tag" style="background:${tiempo.mes_actual > 50 ? '#FEE2E2' : '#DCFCE7'};color:${tiempo.mes_actual > 50 ? '#991b1b' : '#166534'};">${tiempo.mes_actual > 50 ? 'ELEVADO' : 'NORMAL'}</span></td>
    </tr>
  </table>
</div>
<div class="sec">
  <h2 style="border-color:#dc2626; color:#dc2626;">Desglose de cancelaciones <span style="font-size:11px;font-weight:normal;color:#64748B;">— acumulado historico</span></h2>
  <p style="color:#64748B;font-size:11px;margin-bottom:10px;">Totales acumulados desde el inicio de operaciones. Saber quien cancela indica donde esta el problema operativo: por restaurante apunta a fallas de capacidad; por conductor, a logistica; por cliente, a experiencia de usuario.</p>
  <table>
    <tr style="background:#dc2626;"><th>Origen</th><th>Cancelaciones (hist.)</th><th>Distribucion</th><th>Accion sugerida</th></tr>
    <tr><td>Por el cliente</td><td>${cancelaciones.por_cliente.toLocaleString()}</td>
      <td>${pctCliente}%</td>
      <td>Revisar tiempos estimados mostrados en la app y claridad de los menus</td>
    </tr>
    <tr><td>Por el restaurante</td><td>${cancelaciones.por_restaurante.toLocaleString()}</td>
      <td>${pctRestaurante}%</td>
      <td>Auditar restaurantes con mayor frecuencia de rechazo; pueden tener problemas de stock o turnos</td>
    </tr>
    <tr><td>Por el conductor</td><td>${cancelaciones.por_conductor.toLocaleString()}</td>
      <td>${pctConductor}%</td>
      <td>Revisar zonas con baja densidad de conductores y ajustar incentivos en horas pico</td>
    </tr>
  </table>
</div>
<div class="sec">
  <h2 style="border-color:#2563eb; color:#2563eb;">Recomendaciones operativas</h2>
  ${cancelaciones.tasa_actual > 15 ? `<div class="note" style="border-color:#dc2626;background:#FEF2F2;">
    ALERTA: Tasa de cancelacion del ${cancelaciones.tasa_actual}% supera el umbral critico del 15%.
    Accion inmediata: auditar motivos por zona y restaurante. Implementar alertas en tiempo real para conductores con mas de 3 cancelaciones en el dia.
  <\/div>` : ''}
  ${tiempo.mes_actual > 50 ? `<div class="note" style="border-color:#F59E0B;background:#FFFBEB;">
    TIEMPO ELEVADO: ${tiempo.mes_actual} min de entrega promedio afecta la satisfaccion del usuario.
    Accion: revisar distribucion de conductores por zona y ajustar radios de asignacion de pedidos.
  <\/div>` : ''}
  ${pedidos.variacion < 0 && ingresos.variacion < 0 ? `<div class="note" style="border-color:#dc2626;background:#FEF2F2;">
    DOBLE CAIDA: tanto pedidos como ingresos bajaron este mes. Revisar si coincide con eventos externos (feriados, clima) o si refleja una tendencia que requiere accion comercial.
  <\/div>` : ''}
  ${pedidos.variacion >= 0 && ingresos.variacion < 0 ? `<div class="note" style="border-color:#F59E0B;background:#FFFBEB;">
    ALERTA DE TICKET: los pedidos crecieron pero los ingresos bajaron, lo que indica que el ticket promedio cayo. Revisar si hay descuentos excesivos o si el mix de productos cambio hacia opciones de menor valor.
  <\/div>` : ''}
  <div class="note" style="border-color:#2563eb;background:#EFF6FF;">
    META SUGERIDA: mantener cancelaciones por debajo del 10% y tiempo de entrega bajo 45 min.
    Ticket promedio actual $${ticketPromedio} — cada punto porcentual de mejora en cancelaciones equivale a recuperar aproximadamente ${Math.round(pedidos.mes_actual * 0.01 * parseFloat(ticketPromedio))} pesos en ingresos mensuales.
  <\/div>
</div>
<div class="footer">DiDi Food Oaxaca · Reporte de Pedidos · Generado el ${fecha()}</div>
</body></html>`;
    await descargar(html, 'reporte-pedidos');
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

    const htmlIngCoc = ingCocina.slice(0, 8).map(c => `
      <tr><td>${c.tipo_cocina}</td><td>$${c.ingresos.toLocaleString()}</td>
      <td>${c.total_pedidos.toLocaleString()}</td><td>$${c.ticket_promedio}</td></tr>`).join('');

    const htmlCoc = porCocina.slice(0, 8).map(c => `
      <tr><td>${c.tipo_cocina}</td><td>${c.pedidos.toLocaleString()}</td>
      <td>${c.participacion_pct}%</td>
      <td><span class="tag" style="background:${c.participacion_pct < 3 ? '#FEE2E2' : c.participacion_pct > 10 ? '#DCFCE7' : '#FEF3C7'};
        color:${c.participacion_pct < 3 ? '#991b1b' : c.participacion_pct > 10 ? '#166534' : '#92400E'};">
        ${c.participacion_pct < 3 ? 'BAJA' : c.participacion_pct > 10 ? 'ALTA' : 'MEDIA'}</span></td></tr>`).join('');

    const htmlHoras = oportunidades.horas.map(h => `
      <tr><td><strong>${h.dia}</strong></td><td>${h.label}</td>
      <td>${h.pedidos} pedidos</td>
      <td style="color:#dc2626;font-weight:bold">${Math.round(h.pct_del_promedio)}% del promedio</td></tr>`).join('');

    const htmlOpProd = oportunidades.productos.map(p => `
      <tr><td>${p.nombre_producto}</td><td>${p.categoria}</td><td>$${p.precio}</td>
      <td>${p.restaurante}</td><td>${p.tipo_cocina} · ${p.colonia}</td>
      <td style="color:#dc2626">${p.pedidos_entregados}</td>
      <td><span class="tag" style="background:#FEF3C7;color:#D97706;">20% OFF</span></td></tr>`).join('');

    const cocLider    = porCocina[0];
    const cocSegunda  = porCocina[1];
    const cocinasBaja = porCocina.filter((c: any) => c.participacion_pct < 3).map((c: any) => c.tipo_cocina).slice(0, 4);
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>${CSS_BASE}</style></head><body>
<div class="hdr" style="background:#16a34a;">
  <h1>Reporte de Restaurantes</h1>
  <p>DiDi Food Oaxaca${topRest[0]?.periodo ? ` · ${topRest[0].periodo}` : porCocina[0]?.periodo ? ` · ${porCocina[0].periodo}` : ''} · Generado el ${fecha()}</p>
</div>
<div class="sec">
  <h2 style="border-color:#16a34a;color:#16a34a;">Ranking por ingresos — Top ${topRest.length} <span style="font-size:11px;font-weight:normal;color:#64748B;">— datos del periodo ${topRest[0]?.periodo || ''}</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Ingresos y pedidos del periodo actual (${topRest[0]?.periodo || 'mes en curso'}). La tasa de cancelacion refleja el comportamiento del restaurante en este periodo.</p>
  <table>
    <tr style="background:#16a34a;"><th>#</th><th>Restaurante</th><th>Cocina</th>
    <th>Ingresos (periodo)</th><th>Pedidos (periodo)</th><th>Cancelac.</th><th>Comision sug.</th></tr>
    ${htmlRest}
  </table>
  <div class="note" style="border-color:#16a34a;background:#F0FDF4;">
    Restaurantes con cancelacion mayor al 15% requieren auditoria operativa.
    Los de mayor volumen son candidatos a revision de comision preferencial.
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#16a34a;color:#16a34a;">Ingresos y ticket promedio por tipo de cocina <span style="font-size:11px;font-weight:normal;color:#64748B;">— datos del periodo ${ingCocina[0]?.periodo || ''}</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Ingresos del periodo actual (${ingCocina[0]?.periodo || 'mes en curso'}) por categoria de cocina. El ticket promedio es el ingreso promedio por pedido entregado en este periodo.</p>
  <table>
    <tr style="background:#16a34a;"><th>Tipo de cocina</th><th>Ingresos (periodo)</th><th>Pedidos (periodo)</th><th>Ticket prom.</th></tr>
    ${htmlIngCoc}
  </table>
</div>
<div class="sec">
  <h2 style="border-color:#16a34a;color:#16a34a;">Participacion por tipo de cocina <span style="font-size:11px;font-weight:normal;color:#64748B;">— datos del periodo ${porCocina[0]?.periodo || ''}</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Porcentaje de pedidos del periodo actual que corresponde a cada categoria de cocina.</p>
  <table>
    <tr style="background:#16a34a;"><th>Tipo de cocina</th><th>Pedidos (periodo)</th><th>Participacion</th><th>Nivel</th></tr>
    ${htmlCoc}
  </table>
  <div class="note" style="border-color:#F59E0B;background:#FFFBEB;">
    Tipos de cocina con menos del 3% de participacion requieren estrategia de marketing activa.
    Considerar descuentos o destacado en la app para aumentar visibilidad.
  </div>
</div>
${oportunidades.horas.length > 0 ? `
<div class="sec">
  <h2 style="border-color:#D97706;color:#D97706;">Oportunidades de horario <span style="font-size:11px;font-weight:normal;color:#64748B;">— patron historico acumulado</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">
    Franjas de dia y hora con menor volumen segun el historial acumulado de pedidos, dentro del horario de operacion (7:00–23:00). El porcentaje indica
    que parte de la demanda tipica recibe esa franja — 25% significa 4 veces menos pedidos que el promedio historico.
  </p>
  <table>
    <tr style="background:#D97706;"><th>Dia</th><th>Horario</th><th>Pedidos historicos</th><th>Vs. promedio horario</th></tr>
    ${htmlHoras}
  </table>
  ${oportunidades.productos.length > 0 ? `
  <h2 style="border-color:#D97706;color:#D97706;margin-top:16px;">Productos sugeridos para esas franjas</h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">
    Los menos pedidos de la plataforma. Activar un 20% de descuento en las horas de baja demanda les da visibilidad sin afectar el horario pico.
  </p>
  <table>
    <tr style="background:#D97706;"><th>Producto</th><th>Categoria</th><th>Precio</th>
    <th>Restaurante</th><th>Cocina · Colonia</th><th>Pedidos entregados</th><th>Promo</th></tr>
    ${htmlOpProd}
  </table>
  <div class="note" style="border-color:#D97706;background:#FFFBEB;">
    Configurar promocion de tiempo limitado para estos productos, visible solo en las horas de baja demanda.
    Medir el aumento de pedidos en esas franjas la semana siguiente al lanzamiento.
  </div>` : ''}
</div>` : ''}
<div class="sec">
  <h2 style="border-color:#16a34a;color:#16a34a;">Recomendaciones estrategicas</h2>
  <div class="note" style="border-color:#2563eb;background:#EFF6FF;">
    <strong>EXPANSION — COCINAS PRIORITARIAS</strong><br/>
    &bull; <strong>${cocLider?.tipo_cocina ?? 'N/D'}</strong> — cocina lider con el ${cocLider?.participacion_pct ?? '?'}% del total de pedidos (${(cocLider?.pedidos ?? 0).toLocaleString()} pedidos). Incorporar al menos 3 restaurantes adicionales de este tipo para sostener la demanda sin saturar la oferta existente. Priorizar colonias con menos de 3 restaurantes registrados.<br/>
    ${cocSegunda ? `&bull; <strong>${cocSegunda.tipo_cocina}</strong> — segunda categoria con ${cocSegunda.participacion_pct}% de participacion. Reforzar con 1–2 restaurantes nuevos para capturar demanda que hoy se pierde por falta de opciones.<br/>` : ''}
    ${cocinasBaja.length > 0 ? `&bull; Categorias con menos del 3% de participacion: <strong>${cocinasBaja.join(', ')}</strong>. Evaluar si existe demanda latente antes de invertir en incorporacion; si no la hay, no forzar oferta en esas categorias.` : ''}
  </div>
  <div class="note" style="border-color:#16a34a;background:#F0FDF4;">
    <strong>ESCALA DE COMISIONES SUGERIDA</strong> (revision trimestral)<br/>
    <em style="color:#64748B;font-size:10px;">Base: ingresos generados por el restaurante en el periodo ${topRest[0]?.periodo || 'actual'} (pedidos entregados). El porcentaje es la comision que el restaurante paga a DiDi Food sobre cada pedido entregado. La escala se revisa trimestralmente con base en el historial acumulado.</em><br/><br/>
    &bull; Hasta $10,000 en ingresos del periodo → <strong>15% de comision a DiDi Food</strong>: restaurantes en etapa inicial. La comision cubre el soporte de incorporacion y la visibilidad en la app durante el arranque.<br/>
    &bull; $10,001 – $30,000 en ingresos del periodo → <strong>12% de comision a DiDi Food</strong>: restaurantes consolidados con flujo estable. La reduccion incentiva mayor volumen sin afectar la rentabilidad de la plataforma.<br/>
    &bull; $30,001 – $50,000 en ingresos del periodo → <strong>10% de comision a DiDi Food</strong>: restaurantes de alto rendimiento. Comision preferencial como reconocimiento al volumen generado.<br/>
    &bull; Mas de $50,000 en ingresos del periodo → <strong>8% de comision a DiDi Food</strong>: socios estrategicos. Se pueden negociar condiciones adicionales como posicion destacada en la app o participacion en campanas.<br/>
  </div>
</div>
<div class="footer">DiDi Food Oaxaca · Reporte de Restaurantes · Generado el ${fecha()}</div>
</body></html>`;
    await descargar(html, 'reporte-restaurantes');
    setGenerando(null);
  };

  const reporteConductores = async () => {
    if (!conductores) return;
    setGenerando('conductores');
    const [porVehiculo, porZona] = await Promise.all([
      fetchJSON(`${API}/conductores/por-vehiculo`).catch(() => []),
      fetchJSON(`${API}/conductores/por-zona`).catch(() => []),
    ]);
    const pctActivos = ((conductores.activos / conductores.total) * 100).toFixed(1);
    const htmlReac = reactivacion.slice(0, 10).map((c, i) => `
      <tr><td>${i + 1}</td><td>${c.nombre}</td><td>${c.tipo_vehiculo}</td><td>${c.zona}</td>
      <td><span class="tag" style="background:${c.estatus === 'Inactivo' ? '#FEF3C7' : '#FEE2E2'};
        color:${c.estatus === 'Inactivo' ? '#92400E' : '#991b1b'};">${c.estatus.toUpperCase()}</span></td>
      <td style="color:#854D0E;font-weight:bold">${c.calificacion}</td>
      <td>${c.bono_sugerido}</td></tr>`).join('');
    const htmlVehiculo = porVehiculo.map((v: any) => `
      <tr><td>${v.tipo_vehiculo}</td><td>${v.total}</td><td>${v.activos}</td>
      <td>${v.pedidos.toLocaleString()}</td>
      <td>${v.tiempo_promedio > 0 ? v.tiempo_promedio + ' min' : 'Sin datos'}</td></tr>`).join('');
    const htmlZona = porZona.map((z: any) => `
      <tr><td>${z.zona}</td><td>${z.conductores}</td><td>${z.activos}</td>
      <td>${z.pedidos_zona.toLocaleString()}</td><td>${z.ratio_pedidos_por_conductor}</td>
      <td><span class="tag" style="background:${z.nivel_tipo === 'warn' ? '#FEE2E2' : z.nivel_tipo === 'alert' ? '#FEF3C7' : '#DCFCE7'};
        color:${z.nivel_tipo === 'warn' ? '#991b1b' : z.nivel_tipo === 'alert' ? '#92400E' : '#166534'};">${z.nivel}</span></td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>${CSS_BASE}</style></head><body>
<div class="hdr" style="background:#7C3AED;">
  <h1>Reporte de Conductores</h1>
  <p>DiDi Food Oaxaca${porVehiculo[0]?.periodo ? ` · ${porVehiculo[0].periodo}` : porZona[0]?.periodo ? ` · ${porZona[0].periodo}` : ''} · Generado el ${fecha()}</p>
</div>
<div class="grid2">
  <div class="kpi" style="border-color:#16a34a;">
    <div class="lbl">Conductores activos</div>
    <div class="val" style="color:#16a34a;">${conductores.activos}</div>
    <div class="tr">${pctActivos}% de la flota · <em>Estado actual</em></div>
  </div>
  <div class="kpi" style="border-color:#64748B;">
    <div class="lbl">Inactivos</div>
    <div class="val" style="color:#64748B;">${conductores.inactivos}</div>
    <div class="tr">Con potencial de reactivacion · <em>Estado actual</em></div>
  </div>
  <div class="kpi" style="border-color:#dc2626;">
    <div class="lbl">Sancionados</div>
    <div class="val" style="color:#dc2626;">${conductores.sancionados}</div>
    <div class="tr">Requieren revision inmediata · <em>Estado actual</em></div>
  </div>
  <div class="kpi" style="border-color:#F59E0B;">
    <div class="lbl">Calificacion promedio</div>
    <div class="val" style="color:#92400E;">${conductores.calificacion_promedio}</div>
    <div class="tr">Total: ${conductores.total} conductores · <em>Mes actual</em></div>
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#7C3AED;color:#7C3AED;">Rendimiento por tipo de vehiculo <span style="font-size:11px;font-weight:normal;color:#64748B;">— datos del periodo ${porVehiculo[0]?.periodo || ''}</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Pedidos y tiempo de entrega del periodo actual (${porVehiculo[0]?.periodo || 'mes en curso'}) por tipo de vehiculo. "Activos hoy" refleja el estado actual de la flota. Permite decidir en que perfil conviene enfocar el reclutamiento.</p>
  <table>
    <tr style="background:#7C3AED;"><th>Vehiculo</th><th>Total</th><th>Activos hoy</th><th>Pedidos (periodo)</th><th>T. entrega prom.</th></tr>
    ${htmlVehiculo}
  </table>
</div>
<div class="sec">
  <h2 style="border-color:#7C3AED;color:#7C3AED;">Saturacion por zona <span style="font-size:11px;font-weight:normal;color:#64748B;">— estado actual + pedidos del periodo ${porZona[0]?.periodo || ''}</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Pedidos del periodo actual por zona. El ratio pedidos/conductor indica la presion de cada zona en el mes en curso. Un ratio alto significa que hay mas demanda de la que los conductores activos pueden absorber — estas zonas necesitan refuerzo prioritario.</p>
  <table>
    <tr style="background:#7C3AED;"><th>Zona</th><th>Conductores</th><th>Activos hoy</th><th>Pedidos (periodo)</th><th>Ratio ped/cond</th><th>Estado</th></tr>
    ${htmlZona}
  </table>
</div>
<div class="sec">
  <h2 style="border-color:#7C3AED;color:#7C3AED;">Conductores prioritarios para reactivacion <span style="font-size:11px;font-weight:normal;color:#64748B;">— calificacion historica</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Conductores inactivos o sancionados priorizados por su calificacion acumulada historica. Reactivar conductores con buen historial es mas economico que reclutar nuevos.</p>
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
  <\/div>` : ''}
  ${parseFloat(pctActivos) < 70 ? `<div class="note" style="border-color:#F59E0B;background:#FFFBEB;">
    FLOTA POR DEBAJO DEL OBJETIVO: solo el ${pctActivos}% de los conductores esta activo (meta: 70%).
    Activar programa de bonos de actividad para los inactivos con mejor calificacion.
  <\/div>` : ''}
  <div class="note" style="border-color:#16a34a;background:#F0FDF4;">
    META DE ACTIVIDAD: mantener al menos el 70% de la flota activa por mes.
    Actividad actual: ${pctActivos}%. ${parseFloat(pctActivos) >= 70 ? 'Dentro del objetivo.' : 'Requiere accion.'}
  </div>
</div>
<div class="footer">DiDi Food Oaxaca · Reporte de Conductores · Generado el ${fecha()}</div>
</body></html>`;
    await descargar(html, 'reporte-conductores');
    setGenerando(null);
  };

  const reporteUsuarios = async () => {
    if (!metodosPago.length && !rfm.length) return;
    setGenerando('usuarios');

    const coloresRfm: Record<string, string> = {
      'Champions': '#166534', 'Leales': '#1D4ED8', 'Recientes': '#FF6B35',
      'En riesgo': '#dc2626', 'Perdidos VIP': '#7C3AED', 'Ocasionales': '#64748B',
    };
    const htmlRfm = rfm.map(seg => `
      <tr>
        <td><strong style="color:${coloresRfm[seg.segmento] || '#333'}">${seg.segmento}</strong></td>
        <td>${seg.usuarios.toLocaleString()}</td><td>${seg.porcentaje}%</td>
        <td>${seg.frecuencia_promedio} pedidos</td>
        <td>$${seg.ltv_promedio}</td>
        <td>${seg.recencia_promedio_dias} dias</td>
        <td style="font-size:10px;color:#64748B">${seg.accion}</td>
      </tr>`).join('');

    const htmlAdq = adquisicion.map(a => `
      <tr>
        <td>${a.canal}</td><td>${a.dispositivo}</td>
        <td>${a.usuarios_registrados.toLocaleString()}</td>
        <td>${a.primeras_ordenes.toLocaleString()}</td>
        <td style="font-weight:bold;color:${a.conversion_pct >= 70 ? '#16a34a' : a.conversion_pct >= 40 ? '#D97706' : '#dc2626'}">${a.conversion_pct}%</td>
        <td>$${a.ticket_promedio}</td>
      </tr>`).join('');

    const htmlMp = metodosPago.map(m => `
      <tr><td>${m.metodo}</td><td>${m.total.toLocaleString()}</td>
      <td style="font-weight:bold">${m.porcentaje}%</td></tr>`).join('');

    const metodoDom = metodosPago[0];
    const metodoEfec = metodosPago.find(m => m.metodo === 'Efectivo');
    const canalTop = adquisicion[0];
    const segCritico = rfm.find(s => s.prioridad === 'alta');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<style>${CSS_BASE}</style></head><body>
<div class="hdr" style="background:#FF6B35;">
  <h1>Reporte de Usuarios</h1>
  <p>DiDi Food Oaxaca · ${fecha()}</p>
</div>
${rfm.length > 0 ? `
<div class="sec">
  <h2 style="border-color:#FF6B35;color:#FF6B35;">Segmentacion de clientes (RFM) <span style="font-size:11px;font-weight:normal;color:#64748B;">— comportamiento acumulado historico</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">
    Clasificacion por Recencia (dias desde el ultimo pedido), Frecuencia (pedidos realizados) y Valor economico (LTV = gasto total historico por cliente). Permite priorizar acciones de retencion y reactivacion por segmento.
  </p>
  <table>
    <tr style="background:#FF6B35;"><th>Segmento</th><th>Clientes</th><th>%</th>
    <th>Frecuencia prom.</th><th>LTV prom. (hist.)</th><th>Recencia (dias)</th><th>Accion sugerida</th></tr>
    ${htmlRfm}
  </table>
  ${segCritico ? `<div class="note" style="border-color:#dc2626;background:#FEF2F2;">
    PRIORIDAD ALTA: el segmento "${segCritico.segmento}" (${segCritico.usuarios.toLocaleString()} clientes) requiere accion inmediata.
    ${segCritico.accion}
  </div>` : ''}
</div>` : ''}
${adquisicion.length > 0 ? `
<div class="sec">
  <h2 style="border-color:#FF6B35;color:#FF6B35;">Canales de adquisicion <span style="font-size:11px;font-weight:normal;color:#64748B;">— registros acumulados historicos</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">
    De donde llegaron los usuarios que se registraron en la plataforma y que porcentaje realizo al menos un pedido (conversion). Registros y conversiones acumulados desde el inicio de operaciones.
  </p>
  <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:10px;margin-bottom:12px;font-size:11px;color:#475569;">
    <strong>Glosario de canales:</strong><br/>
    &bull; <strong>organico</strong> — usuario que encontro la app por busqueda propia en la tienda de apps (App Store / Google Play), sin ningun anuncio o referencia externa.<br/>
    &bull; <strong>referido</strong> — llego por recomendacion directa de otro usuario. Canal de menor costo de adquisicion y mayor fidelidad historica.<br/>
    &bull; <strong>promocion</strong> — captado mediante una campana activa con descuento, codigo o beneficio de bienvenida.<br/>
    &bull; <strong>red_social</strong> — llego desde un anuncio o publicacion en redes sociales (Facebook, Instagram, TikTok, etc.).<br/>
    <strong>Dispositivo:</strong> android / ios = app movil · web = acceso desde navegador de escritorio o movil.
  </div>
  <table>
    <tr style="background:#FF6B35;"><th>Canal</th><th>Dispositivo</th><th>Registrados</th>
    <th>Primeros pedidos</th><th>Conversion</th><th>Ticket prom.</th></tr>
    ${htmlAdq}
  </table>
  ${canalTop ? `<div class="note" style="border-color:#2563eb;background:#EFF6FF;">
    Canal lider: <strong>${canalTop.canal}</strong> con ${canalTop.conversion_pct}% de conversion.
    Priorizar inversion publicitaria en este canal para maximizar el retorno sobre el costo de adquisicion.
  </div>` : ''}
</div>` : ''}
<div class="sec">
  <h2 style="border-color:#FF6B35;color:#FF6B35;">Metodos de pago <span style="font-size:11px;font-weight:normal;color:#64748B;">— pedidos acumulados historicos</span></h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Distribucion de pedidos por metodo de pago desde el inicio de operaciones.</p>
  <table>
    <tr style="background:#FF6B35;"><th>Metodo</th><th>Pedidos (hist.)</th><th>Participacion</th></tr>
    ${htmlMp}
  </table>
  ${metodoEfec && metodoEfec.porcentaje > 40 ? `<div class="note" style="border-color:#dc2626;background:#FEF2F2;">
    RIESGO: ${metodoEfec.porcentaje}% de pagos en efectivo. Campana sugerida: 5% de descuento en el siguiente pedido al registrar metodo digital.
    Meta: reducir efectivo a menos del 30% en los proximos 3 meses.
  </div>` : ''}
  <div class="note" style="border-color:#FF6B35;background:#FFF4ED;">
    Metodo dominante: ${metodoDom?.metodo ?? 'N/D'} (${metodoDom?.porcentaje ?? 0}%).
    Meta: 60% de pagos digitales en 6 meses para reducir costos operativos.
  </div>
</div>
<div class="sec">
  <h2 style="border-color:#64748B;color:#64748B;">Costos operativos asociados a pagos y canales</h2>
  <p style="color:#64748B;margin-bottom:10px;font-size:11px;">Referencia de impacto operativo segun el metodo de pago y el canal de adquisicion. Estos factores afectan directamente el margen neto de la plataforma.</p>
  <table>
    <tr style="background:#64748B;"><th>Factor</th><th>Nivel de costo</th><th>Impacto operativo</th><th>Accion recomendada</th></tr>
    <tr><td>Pago en efectivo</td><td style="color:#dc2626;font-weight:bold">Alto</td>
      <td>Riesgo de robo para conductores, tiempo adicional de cambio, sin trazabilidad contable automatica</td>
      <td>Incentivar migracion a digital; meta menos del 30%</td></tr>
    <tr><td>Tarjeta de credito/debito</td><td style="color:#D97706;font-weight:bold">Medio</td>
      <td>Comision bancaria por transaccion (tipicamente 2–3.5%). Mayor trazabilidad y menor riesgo logistico</td>
      <td>Negociar tarifas preferenciales por volumen con el banco procesador</td></tr>
    <tr><td>Transferencia / digital</td><td style="color:#16a34a;font-weight:bold">Bajo</td>
      <td>Sin comision de terceros, liquidacion inmediata, trazabilidad total. Menor friccion para conductores</td>
      <td>Promover activamente como metodo preferido; ofrecer beneficio al primer uso</td></tr>
    <tr><td>Canal referido</td><td style="color:#16a34a;font-weight:bold">Muy bajo</td>
      <td>Costo de adquisicion casi nulo; el usuario existente hace el trabajo de captacion</td>
      <td>Activar programa de referidos con incentivo para quien refiere y para el nuevo usuario</td></tr>
    <tr><td>Canal red_social / promocion</td><td style="color:#dc2626;font-weight:bold">Alto</td>
      <td>Inversion publicitaria mas descuento de bienvenida. Rentable solo si la conversion y el LTV son altos</td>
      <td>Medir LTV por canal; pausar canales donde el costo supere el LTV a 6 meses</td></tr>
    <tr><td>Canal organico</td><td style="color:#16a34a;font-weight:bold">Bajo</td>
      <td>Sin costo de adquisicion directo. Suele indicar buena reputacion de marca o posicionamiento en tienda</td>
      <td>Mantener calificacion alta en App Store / Google Play; responder resenas publicas</td></tr>
  </table>
</div>
<div class="footer">DiDi Food Oaxaca · Reporte de Usuarios · Generado el ${fecha()}</div>
</body></html>`;
    await descargar(html, 'reporte-usuarios');
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
      titulo: 'Reporte de Usuarios',
      sub: 'Segmentacion RFM, canales de adquisicion, metodos de pago y recomendaciones de retencion',
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
          {/* Top productos vendidos */}
          {topVendidos.length > 0 && (
            <View style={[styles.card, { backgroundColor: Brand.cardGreen }]}>
              <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
                <View style={styles.seccionHeader}>
                  <Ionicons name="flame-outline" size={18} color={Brand.green} />
                  <Text style={[styles.seccionTitulo, { color: Brand.green }]}>Top productos mas vendidos</Text>
                </View>
                <View style={{backgroundColor:'#DCFCE7',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                  <Text style={{fontSize:9,color:'#166534',fontWeight:'700'}}>MES ACTUAL</Text>
                </View>
              </View>
              {topVendidos[0]?.periodo ? (
                <Text style={[styles.sub, { color: Brand.green, fontWeight: '600', marginBottom: 2 }]}>
                  Periodo: {topVendidos[0].periodo}
                </Text>
              ) : null}
              <Text style={styles.sub}>Productos con mas unidades vendidas en el periodo actual. Garantizar su disponibilidad permanente evita pedidos cancelados por falta de stock y maximiza ingresos.</Text>
              {topVendidos.map((p, i) => (
                <View key={i} style={styles.prodRow}>
                  <View style={[styles.precioBadge, {
                    backgroundColor: i < 3 ? '#DCFCE7' : Brand.card,
                    marginRight: 8, minWidth: 28, alignItems: 'center',
                  }]}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: i < 3 ? '#166534' : Brand.subtext }}>
                      #{p.posicion}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodNombre} numberOfLines={1}>{p.producto}</Text>
                    <Text style={styles.prodSub}>{p.restaurante} · {p.categoria}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Brand.green }}>
                      {p.unidades_vendidas.toLocaleString()} uds
                    </Text>
                    <Text style={styles.sub}>${(p.ingreso_total / 1000).toFixed(1)}k ingresos</Text>
                  </View>
                </View>
              ))}
              <View style={[styles.alertaRow, { borderLeftColor: Brand.green, backgroundColor: Brand.card }]}>
                <View style={styles.alertaLabel}>
                  <Text style={styles.alertaLabelText}>ACCION SUGERIDA</Text>
                </View>
                <Text style={[styles.alertaTexto, { color: Brand.green }]}>
                  {topVendidos[0]?.producto} lidera con {topVendidos[0]?.unidades_vendidas?.toLocaleString()} unidades —
                  asegurar disponibilidad permanente y considerar destacarlo en la portada de la app
                </Text>
              </View>
            </View>
          )}

          {/* Oportunidades de horario */}
          {oportunidades.horas.length > 0 && (
            <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
              <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
                <View style={styles.seccionHeader}>
                  <Ionicons name="time-outline" size={18} color={Brand.accent} />
                  <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Oportunidades de horario</Text>
                </View>
                <View style={{backgroundColor:'#F1F5F9',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                  <Text style={{fontSize:9,color:'#64748B',fontWeight:'700'}}>HISTÓRICO</Text>
                </View>
              </View>
              <Text style={styles.sub}>
                Las 3 combinaciones de dia y hora con menor volumen de pedidos entregados, considerando solo horario de operacion (7:00 a 23:00). Calculado sobre todo el historial de la plataforma.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                {oportunidades.horas.map((h, i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>{h.dia}</Text>
                    <Text style={{ fontSize: 10, color: '#B45309', marginTop: 1 }}>{h.label}</Text>
                    <View style={{ width: '100%', height: 1, backgroundColor: '#FDE68A', marginVertical: 5 }} />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#D97706' }}>{h.pedidos}</Text>
                    <Text style={{ fontSize: 9, color: '#92400E' }}>pedidos</Text>
                    <Text style={{ fontSize: 9, color: Brand.red, marginTop: 3, fontWeight: '700' }}>{Math.round(h.pct_del_promedio)}% del prom.</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 10, color: Brand.subtext, fontStyle: 'italic', marginBottom: 14 }}>
                % del promedio: que parte de la demanda tipica recibe esa franja. 25% significa que tiene 4 veces menos pedidos que una hora normal de operacion.
              </Text>

              <Text style={{ fontSize: 11, fontWeight: '800', color: Brand.accent, textTransform: 'uppercase', marginBottom: 4 }}>
                Productos para promover en esas horas
              </Text>
              <Text style={[styles.sub, { marginBottom: 10 }]}>
                Los menos pedidos de la plataforma con al menos un pedido entregado. Un 20% de descuento en las horas de baja demanda les da visibilidad sin impactar el horario pico.
              </Text>

              {oportunidades.productos.map((p, i) => (
                <View key={i} style={[styles.alertaRow, { borderLeftColor: Brand.accent, backgroundColor: Brand.card, marginBottom: 8 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: Brand.text }} numberOfLines={1}>{p.nombre_producto}</Text>
                      <Text style={{ fontSize: 11, color: Brand.subtext, marginTop: 1 }}>{p.categoria}</Text>
                      <Text style={{ fontSize: 11, color: Brand.subtext, marginTop: 1 }}>{p.restaurante} · {p.tipo_cocina}</Text>
                      <Text style={{ fontSize: 10, color: Brand.subtext }}>{p.colonia}</Text>
                      <Text style={{ fontSize: 10, color: Brand.red, marginTop: 3, fontWeight: '600' }}>Solo {p.pedidos_entregados} pedidos entregados</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: Brand.text }}>${p.precio}</Text>
                      <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginTop: 4 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#D97706' }}>20% OFF</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              <View style={[styles.alertaRow, { borderLeftColor: Brand.accent, backgroundColor: Brand.bg }]}>
                <View style={styles.alertaLabel}>
                  <Text style={styles.alertaLabelText}>COMO ACTIVARLO</Text>
                </View>
                <Text style={[styles.alertaTexto, { color: Brand.accent }]}>
                  Configurar una promocion de tiempo limitado para estos productos, visible solo en las horas de baja demanda. Coordinar con los restaurantes y medir el aumento de pedidos la semana siguiente.
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: Brand.cardBlue }]}>
            <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
              <View style={styles.seccionHeader}>
                <Ionicons name="star-outline" size={18} color={Brand.blue} />
                <Text style={[styles.seccionTitulo, { color: Brand.blue }]}>Candidatos Premium</Text>
                <View style={{backgroundColor:'#F3E8FF',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                  <Text style={{fontSize:9,color:'#7C3AED',fontWeight:'700'}}>CATÁLOGO</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalPremium(true)} style={[styles.chipFiltro, { borderColor: Brand.blue }]}>
                <Ionicons name="options-outline" size={13} color={Brand.blue} />
                <Text style={[styles.chipFiltroTxt, { color: Brand.blue }]}>Ver: {cantidadPremium}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sub}>Productos con precio mayor a $200 MXN que podrian destacarse en una seccion especial de la app. Mostrarlos con foto y descripcion detallada aumenta el ticket promedio hasta un 18%.</Text>
            {premium.slice(0, cantidadPremium).map((p, i) => (
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
            <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
              <View style={styles.seccionHeader}>
                <Ionicons name="grid-outline" size={18} color={Brand.accent} />
                <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Analisis por categoria</Text>
                <View style={{backgroundColor:'#F3E8FF',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                  <Text style={{fontSize:9,color:'#7C3AED',fontWeight:'700'}}>CATÁLOGO</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { setCantidadCatInput(cantidadCat > 0 ? String(cantidadCat) : String(categorias.length)); setModalCat(true); }} style={styles.chipFiltro}>
                <Ionicons name="options-outline" size={13} color={Brand.accent} />
                <Text style={styles.chipFiltroTxt}>{cantidadCat > 0 ? `Ver: ${cantidadCat}` : `Todas (${categorias.length})`}</Text>
              </TouchableOpacity>
            </View>
            {(cantidadCat > 0 ? categorias.slice(0, cantidadCat) : categorias).map((c, i) => (
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
            <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
              <View style={styles.seccionHeader}>
                <Ionicons name="trending-up-outline" size={18} color={Brand.green} />
                <Text style={[styles.seccionTitulo, { color: Brand.green }]}>Ingresos por cocina</Text>
                <View style={{backgroundColor:'#DCFCE7',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                  <Text style={{fontSize:9,color:'#166534',fontWeight:'700'}}>MES ACTUAL</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalIngCocina(true)} style={[styles.chipFiltro, { borderColor: Brand.green }]}>
                <Ionicons name="options-outline" size={13} color={Brand.green} />
                <Text style={[styles.chipFiltroTxt, { color: Brand.green }]}>Ver: {cantidadIngCocina}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sub}>Ingresos generados por cada tipo de cocina. La cocina lider es donde mas conviene incorporar nuevos restaurantes para capitalizar la demanda existente.</Text>
            {ingCocina.slice(0, cantidadIngCocina).map((r, i) => (
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
          {/* Segmentacion RFM */}
          {rfm.length > 0 && (
            <View style={[styles.card, { backgroundColor: Brand.cardBlue }]}>
              <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
                <View style={styles.seccionHeader}>
                  <Ionicons name="people-circle-outline" size={18} color={Brand.blue} />
                  <Text style={[styles.seccionTitulo, { color: Brand.blue }]}>Segmentacion RFM de usuarios</Text>
                </View>
                <View style={{backgroundColor:'#F1F5F9',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                  <Text style={{fontSize:9,color:'#64748B',fontWeight:'700'}}>HISTÓRICO</Text>
                </View>
              </View>
              <Text style={styles.sub}>
                Clasifica a los usuarios segun tres factores: hace cuanto hicieron su ultimo pedido (Recencia), con que frecuencia piden (Frecuencia) y cuanto gastan (Monetario). Cada segmento requiere una estrategia diferente.
              </Text>
              {rfm.map((seg, i) => {
                const segColor: Record<string, string> = {
                  'Champions': Brand.green, 'Leales': Brand.blue,
                  'Recientes': Brand.accent, 'En riesgo': Brand.red,
                  'Perdidos VIP': '#7C3AED', 'Ocasionales': Brand.subtext,
                };
                const color = segColor[seg.segmento] ?? Brand.subtext;
                return (
                  <View key={i} style={[styles.alertaRow, { borderLeftColor: color, backgroundColor: Brand.card, marginBottom: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={[styles.alertaLabelText, { color }]}>
                        {seg.segmento.toUpperCase()} — {seg.usuarios.toLocaleString()} usuarios ({seg.porcentaje}%)
                      </Text>
                      <Text style={[styles.alertaLabelText, {
                        color: seg.prioridad === 'alta' ? Brand.red : Brand.subtext,
                      }]}>
                        {seg.prioridad === 'alta' ? 'PRIORIDAD ALTA' : 'PRIORIDAD MEDIA'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16, marginBottom: 4 }}>
                      <Text style={styles.sub}>LTV prom: ${seg.ltv_promedio.toLocaleString()}</Text>
                      <Text style={styles.sub}>Frec. prom: {seg.frecuencia_promedio}x</Text>
                      <Text style={styles.sub}>Recencia: {seg.recencia_promedio_dias}d</Text>
                    </View>
                    <Text style={[styles.alertaTexto, { color: Brand.subtext, fontSize: 11 }]}>{seg.accion}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Canal de adquisicion */}
          {adquisicion.length > 0 && (
            <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
              <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
                <View style={styles.seccionHeader}>
                  <Ionicons name="funnel-outline" size={18} color={Brand.accent} />
                  <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Canal de adquisicion</Text>
                </View>
                <View style={{backgroundColor:'#F1F5F9',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                  <Text style={{fontSize:9,color:'#64748B',fontWeight:'700'}}>HISTÓRICO</Text>
                </View>
              </View>
              <Text style={styles.sub}>De donde vienen los usuarios que se registran y que porcentaje realiza su primera compra (conversion). Un canal con alta conversion es donde mas conviene invertir presupuesto de marketing.</Text>
              <View style={{ backgroundColor: Brand.card, borderRadius: 8, padding: 10, marginBottom: 8 }}>
                <Text style={[styles.catSub, { fontWeight: '600', marginBottom: 4 }]}>Canales:</Text>
                <Text style={styles.catSub}>• <Text style={{ fontWeight: '600' }}>organico</Text> — usuario que encontro la app por busqueda propia en tienda de apps</Text>
                <Text style={styles.catSub}>• <Text style={{ fontWeight: '600' }}>referido</Text> — llego por recomendacion directa de otro usuario</Text>
                <Text style={styles.catSub}>• <Text style={{ fontWeight: '600' }}>promocion</Text> — captado mediante una campana con descuento o codigo</Text>
                <Text style={styles.catSub}>• <Text style={{ fontWeight: '600' }}>red_social</Text> — llego desde un anuncio o publicacion en redes sociales</Text>
                <Text style={[styles.catSub, { fontWeight: '600', marginTop: 6, marginBottom: 4 }]}>Dispositivo:</Text>
                <Text style={styles.catSub}>• <Text style={{ fontWeight: '600' }}>android / ios</Text> — uso la app movil</Text>
                <Text style={styles.catSub}>• <Text style={{ fontWeight: '600' }}>web</Text> — accedio desde un navegador</Text>
              </View>
              {adquisicion.map((a, i) => (
                <View key={i} style={styles.catRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catNombre}>{a.canal} · {a.dispositivo}</Text>
                    <Text style={styles.catSub}>
                      {a.usuarios_registrados.toLocaleString()} registrados · {a.primeras_ordenes.toLocaleString()} compraron
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.catPremium, {
                      color: a.conversion_pct > 60 ? Brand.green : a.conversion_pct > 30 ? '#D97706' : Brand.red,
                    }]}>
                      {a.conversion_pct}% conv.
                    </Text>
                    <Text style={styles.catRango}>${a.ticket_promedio} ticket</Text>
                  </View>
                </View>
              ))}
              <View style={[styles.alertaRow, { borderLeftColor: Brand.accent, backgroundColor: Brand.card, marginTop: 8 }]}>
                <View style={styles.alertaLabel}>
                  <Text style={styles.alertaLabelText}>INSIGHT</Text>
                </View>
                <Text style={styles.alertaTexto}>
                  {adquisicion.sort((a, b) => b.conversion_pct - a.conversion_pct)[0]?.canal} tiene la mayor tasa de conversion.
                  Invertir mas en ese canal reduce el costo de adquisicion por cliente activo.
                </Text>
              </View>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: Brand.cardPurple }]}>
            <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
              <View style={styles.seccionHeader}>
                <Ionicons name="card-outline" size={18} color={Brand.purple} />
                <Text style={[styles.seccionTitulo, { color: Brand.purple }]}>Metodos de pago</Text>
              </View>
              <View style={{backgroundColor:'#F1F5F9',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                <Text style={{fontSize:9,color:'#64748B',fontWeight:'700'}}>HISTÓRICO</Text>
              </View>
            </View>
            <Text style={styles.sub}>Como prefieren pagar los usuarios. Un alto porcentaje en efectivo implica mayor riesgo operativo para conductores y costos de manejo. Meta recomendada: menos del 30% en efectivo.</Text>
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
                  Accion: campaña "Paga digital, gana puntos" con descuento del 5% en proximo pedido.
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

      {/* Modal premium */}
      <Modal visible={modalPremium} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Productos premium a mostrar</Text>
            <Text style={styles.modalSub}>Cantidad de candidatos premium visibles ({premium.length} en total)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={`Max: ${premium.length}`}
              keyboardType="numeric"
              value={cantidadPremiumInput}
              onChangeText={setCantidadPremiumInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Brand.blue }]} onPress={aplicarPremium}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalPremium(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: Brand.subtext, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal categorias */}
      <Modal visible={modalCat} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Categorias a mostrar</Text>
            <Text style={styles.modalSub}>Cuantas categorias ver. Deja en blanco para mostrar todas ({categorias.length}).</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={`Todas (${categorias.length})`}
              keyboardType="numeric"
              value={cantidadCatInput}
              onChangeText={setCantidadCatInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={styles.modalBtn} onPress={aplicarCat}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalCat(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: Brand.subtext, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal ingresos por cocina */}
      <Modal visible={modalIngCocina} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Tipos de cocina a mostrar</Text>
            <Text style={styles.modalSub}>Cantidad de tipos de cocina en el ranking de ingresos ({ingCocina.length} en total)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={`Max: ${ingCocina.length}`}
              keyboardType="numeric"
              value={cantidadIngInput}
              onChangeText={setCantidadIngInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: Brand.green }]} onPress={aplicarIngCocina}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalIngCocina(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: Brand.subtext, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  chipFiltro:      { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: Brand.accent },
  chipFiltroTxt:   { fontSize: 11, color: Brand.accent, fontWeight: '600' },
  modalBg:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  modalCard:       { backgroundColor: Brand.card, borderRadius: 16, padding: 24 },
  modalTitulo:     { fontSize: 16, fontWeight: 'bold', color: Brand.text, marginBottom: 6 },
  modalSub:        { fontSize: 12, color: Brand.subtext, marginBottom: 16, lineHeight: 18 },
  modalInput:      { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, color: Brand.text, marginBottom: 16, fontSize: 16 },
  modalBtn:        { backgroundColor: Brand.accent, borderRadius: 10, padding: 14, alignItems: 'center' as const },
});
