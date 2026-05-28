import { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator,
         TouchableOpacity, TextInput, Modal } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Brand } from '@/constants/theme';
import { API, fetchJSON } from '@/constants/api';

const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function SeccionHeader({ titulo, icon, color }: { titulo: string; icon: string; color?: string }) {
  const c = color ?? Brand.accent;
  return (
    <View style={styles.seccionHeader}>
      <Ionicons name={icon as any} size={18} color={c} />
      <Text style={[styles.seccionTitulo, { color: c }]}>{titulo}</Text>
    </View>
  );
}

export default function PedidosScreen() {
  const [porPeriodo, setPorPeriodo] = useState<any[]>([]);
  const [porEstatus, setPorEstatus] = useState<any>(null);
  const [tiempos,    setTiempos]    = useState<any[]>([]);
  const [clientes,   setClientes]   = useState<any>(null);
  const [ratio,      setRatio]      = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [meta,         setMeta]         = useState('');
  const [metaGuardada, setMetaGuardada] = useState(0);
  const [modalMeta,    setModalMeta]    = useState(false);
  const [anioSel,      setAnioSel]      = useState(2024);

  useEffect(() => {
    AsyncStorage.getItem('meta_pedidos').then(v => { if (v) setMetaGuardada(parseInt(v)); });
  }, []);

  const guardarMeta = () => {
    const n = parseInt(meta);
    if (n > 0) { AsyncStorage.setItem('meta_pedidos', String(n)); setMetaGuardada(n); }
    setModalMeta(false);
  };

  const cargar = useCallback(() => {
    setLoading(true); setError('');
    Promise.all([
      fetchJSON(`${API}/pedidos/por-periodo`),
      fetchJSON(`${API}/pedidos/por-estatus`),
      fetchJSON(`${API}/pedidos/tiempos`),
      fetchJSON(`${API}/pedidos/clientes-nuevos`),
      fetchJSON(`${API}/pedidos/ratio-envio`),
    ]).then(([pp, pe, ti, cl, ra]) => {
      setPorPeriodo(pp); setPorEstatus(pe); setTiempos(ti);
      setClientes(cl); setRatio(ra); setLoading(false);
    }).catch(() => { setError('Error cargando datos'); setLoading(false); });
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Brand.accent} /></View>;
  if (error)   return <View style={styles.center}><Text style={{ color: Brand.red }}>{error}</Text></View>;

  const porMesAnio = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const rows = porPeriodo.filter(r => r.anio === anioSel && r.mes === mes);
    const total      = rows.reduce((a, r) => a + r.total, 0);
    const entregados = rows.reduce((a, r) => a + r.entregados, 0);
    return { mes, total, entregados, label: MESES[mes] };
  });

  const barDataPedidos = porMesAnio.map(r => ({
    value: r.entregados, label: r.label,
    frontColor: r.entregados >= metaGuardada / 12 ? Brand.green : Brand.blue,
  }));

  const tiemposAnio    = tiempos.filter(t => t.anio === anioSel);
  const lineDataTiempos = tiemposAnio.map(t => ({ value: t.promedio, label: MESES[t.mes] }));

  const ratioAnio    = (ratio?.por_mes ?? []).filter((r: any) => r.anio === anioSel);
  const lineDataRatio = ratioAnio.map((r: any) => ({ value: r.ratio_pct, label: MESES[r.mes] }));

  const totalAnio      = porMesAnio.reduce((a, r) => a + r.total, 0);
  const entregadosAnio = porMesAnio.reduce((a, r) => a + r.entregados, 0);
  const metaPct        = metaGuardada > 0 ? Math.round((entregadosAnio / metaGuardada) * 100) : null;

  const anios = [...new Set(porPeriodo.map(r => r.anio))].sort();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <View style={styles.headerBg}>
        <Text style={styles.titulo}>Pedidos</Text>
        <Text style={styles.subtitulo}>Analisis operativo</Text>
      </View>

      {/* Selector de anio */}
      <View style={styles.chips}>
        {anios.map(a => (
          <TouchableOpacity key={a} onPress={() => setAnioSel(a)}
            style={[styles.chip, anioSel === a && styles.chipActive]}>
            <Text style={[styles.chipText, anioSel === a && styles.chipTextActive]}>{a}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SECCION 1: Total pedidos */}
      <View style={[styles.card, { backgroundColor: Brand.cardBlue }]}>
        <SeccionHeader titulo="Total de pedidos entregados" icon="bar-chart-outline" color={Brand.blue} />
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: Brand.blue }]}>{totalAnio.toLocaleString()}</Text>
            <Text style={styles.statLbl}>Total {anioSel}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: Brand.green }]}>{entregadosAnio.toLocaleString()}</Text>
            <Text style={styles.statLbl}>Entregados</Text>
          </View>
          {metaPct !== null && (
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: metaPct >= 100 ? Brand.green : Brand.accent }]}>
                {metaPct}%
              </Text>
              <Text style={styles.statLbl}>vs Meta</Text>
            </View>
          )}
        </View>

        {metaGuardada > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${Math.min(metaPct ?? 0, 100)}%`,
              backgroundColor: (metaPct ?? 0) >= 100 ? Brand.green : Brand.blue,
            }]} />
          </View>
        )}

        <TouchableOpacity style={styles.metaBtn} onPress={() => setModalMeta(true)}>
          <Ionicons name="flag-outline" size={14} color={Brand.blue} />
          <Text style={[styles.metaBtnText, { color: Brand.blue }]}>
            {metaGuardada > 0 ? `Meta anual: ${metaGuardada.toLocaleString()} pedidos` : 'Establecer meta anual'}
          </Text>
        </TouchableOpacity>

        {barDataPedidos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <BarChart
              data={barDataPedidos}
              barWidth={22}
              spacing={8}
              noOfSections={4}
              yAxisTextStyle={{ color: Brand.subtext, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 10 }}
              hideRules
              barBorderRadius={4}
              height={160}
            />
          </ScrollView>
        )}
      </View>

      {/* SECCION 2: Por estatus */}
      {porEstatus && (
        <View style={[styles.card, { backgroundColor: Brand.cardGreen }]}>
          <SeccionHeader titulo="Pedidos por estatus" icon="layers-outline" color={Brand.green} />
          {porEstatus.resumen.map((r: any, i: number) => (
            <View key={i} style={styles.estatusRow}>
              <Text style={styles.estatusLabel} numberOfLines={1}>{r.estatus}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, {
                  width: `${r.porcentaje}%`,
                  backgroundColor: r.estatus === 'Entregado' ? Brand.green
                    : r.estatus.includes('Cancelado') ? Brand.red : Brand.accent,
                }]} />
              </View>
              <Text style={styles.estatusPct}>{r.porcentaje}%</Text>
            </View>
          ))}

          <Text style={[styles.seccionTitulo, { marginTop: 16, fontSize: 12, color: Brand.green }]}>
            Clientes nuevos este mes
          </Text>
          {clientes && (
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: Brand.green }]}>{clientes.mes_actual.nuevos_clientes}</Text>
                <Text style={styles.statLbl}>Nuevos usuarios</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{clientes.mes_actual.pedidos_de_nuevos}</Text>
                <Text style={styles.statLbl}>Sus pedidos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>${clientes.mes_actual.ticket_promedio_nuevos}</Text>
                <Text style={styles.statLbl}>Ticket prom.</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* SECCION 3: Tiempos de entrega */}
      <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
        <SeccionHeader titulo="Tiempos de entrega (min)" icon="time-outline" color={Brand.accent} />
        {lineDataTiempos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <LineChart
              data={lineDataTiempos}
              height={160}
              spacing={40}
              color={Brand.accent}
              thickness={2}
              dataPointsColor={Brand.accent}
              yAxisTextStyle={{ color: Brand.subtext, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 10 }}
              hideRules
              curved
            />
          </ScrollView>
        ) : <Text style={styles.noData}>Sin datos para {anioSel}</Text>}
      </View>

      {/* SECCION 4: Ratio envio / subtotal */}
      <View style={[styles.card, { backgroundColor: Brand.cardPurple }]}>
        <SeccionHeader titulo="Ratio costo envio / subtotal" icon="trending-up-outline" color={Brand.purple} />
        <Text style={styles.sub}>Porcentaje que representa el envio sobre el pedido</Text>
        {lineDataRatio.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <LineChart
              data={lineDataRatio}
              height={160}
              spacing={40}
              color={Brand.purple}
              thickness={2}
              dataPointsColor={Brand.purple}
              yAxisTextStyle={{ color: Brand.subtext, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 10 }}
              hideRules
              curved
            />
          </ScrollView>
        ) : <Text style={styles.noData}>Sin datos para {anioSel}</Text>}

        {ratio?.por_zona?.slice(0, 5).map((z: any, i: number) => (
          <View key={i} style={[styles.alertaRow, {
            borderLeftColor: z.ratio_pct > 30 ? Brand.red : Brand.green,
          }]}>
            <Text style={styles.alertaTexto}>
              {z.colonia} — envio prom. ${z.envio_promedio} ({z.ratio_pct}% del subtotal)
            </Text>
          </View>
        ))}

        <View style={[styles.alertaRow, { borderLeftColor: Brand.purple, marginTop: 8 }]}>
          <View style={styles.alertaLabel}>
            <Text style={styles.alertaLabelText}>SUGERENCIA</Text>
          </View>
          <Text style={styles.alertaTexto}>
            Pedidos mayores a $300 con envio maximo del 20% del subtotal mejoran la conversion
          </Text>
        </View>
      </View>

      {/* Modal meta */}
      <Modal visible={modalMeta} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Meta anual de pedidos</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 70000"
              keyboardType="numeric"
              value={meta}
              onChangeText={setMeta}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={styles.btn} onPress={guardarMeta}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalMeta(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: Brand.subtext, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Brand.bg },
  center:         { flex: 1, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  headerBg:       { backgroundColor: Brand.headerDark, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  titulo:         { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF' },
  subtitulo:      { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  card:           { borderRadius: 16, padding: 16, margin: 16, marginBottom: 0, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  seccionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  seccionTitulo:  { fontSize: 14, fontWeight: '700', color: Brand.text },
  chips:          { flexDirection: 'row', gap: 8, margin: 16, marginBottom: 0 },
  chip:           { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border },
  chipActive:     { backgroundColor: Brand.accent, borderColor: Brand.accent },
  chipText:       { color: Brand.subtext, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  statsRow:       { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  statBox:        { alignItems: 'center' },
  statVal:        { fontSize: 20, fontWeight: 'bold', color: Brand.text },
  statLbl:        { fontSize: 11, color: Brand.subtext, marginTop: 2 },
  progressBar:    { height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill:   { height: 8, borderRadius: 4 },
  metaBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  metaBtnText:    { fontSize: 12, fontWeight: '600' },
  estatusRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  estatusLabel:   { width: 120, fontSize: 11, color: Brand.subtext },
  barTrack:       { flex: 1, height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  barFill:        { height: 8, borderRadius: 4 },
  estatusPct:     { width: 40, fontSize: 11, color: Brand.subtext, textAlign: 'right' },
  alertaRow:      { borderLeftWidth: 3, borderRadius: 6, padding: 10, backgroundColor: Brand.card, marginTop: 6 },
  alertaLabel:    { marginBottom: 4 },
  alertaLabelText:{ fontSize: 9, fontWeight: '800', color: Brand.subtext, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertaTexto:    { fontSize: 12, color: Brand.text, flex: 1 },
  sub:            { fontSize: 11, color: Brand.subtext, marginBottom: 4 },
  noData:         { color: Brand.subtext, textAlign: 'center', padding: 20, fontSize: 13 },
  modalBg:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  modalCard:      { backgroundColor: Brand.card, borderRadius: 16, padding: 24 },
  modalTitulo:    { fontSize: 16, fontWeight: 'bold', color: Brand.text, marginBottom: 16 },
  input:          { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, color: Brand.text, marginBottom: 16, fontSize: 16 },
  btn:            { backgroundColor: Brand.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
});
