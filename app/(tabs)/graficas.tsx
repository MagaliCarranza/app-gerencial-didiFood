import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { Brand } from '@/constants/theme';
import { API, fetchJSON } from '@/constants/api';

export default function GraficasScreen() {
  const [topRestaurantes, setTopRestaurantes] = useState<any[]>([]);
  const [cancelaciones,   setCancelaciones]   = useState<any>(null);
  const [tendencia,       setTendencia]       = useState<any[]>([]);
  const [demandaHoraria,  setDemandaHoraria]  = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const cargar = () => {
    setLoading(true); setError('');
    Promise.all([
      fetchJSON(`${API}/kpi/top-restaurantes`),
      fetchJSON(`${API}/kpi/cancelaciones`),
      fetchJSON(`${API}/kpi/tendencia-diaria`),
      fetchJSON(`${API}/productos/demanda-horaria`).catch(() => []),
    ]).then(([rest, cancel, tend, demanda]) => {
      setTopRestaurantes(rest);
      setCancelaciones(cancel);
      setTendencia(tend);
      setDemandaHoraria(demanda);
      setLoading(false);
    }).catch(() => { setError('No se pudo conectar con la API.'); setLoading(false); });
  };

  useEffect(() => { cargar(); }, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Brand.accent} />
      <Text style={{ color: Brand.subtext, marginTop: 12 }}>Cargando graficas...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.center}>
      <Text style={{ color: Brand.red, textAlign: 'center', marginBottom: 20 }}>{error}</Text>
      <TouchableOpacity style={styles.btn} onPress={cargar}>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );

  // Demanda horaria
  const horaPico = demandaHoraria.length > 0
    ? demandaHoraria.reduce((a, b) => a.pedidos > b.pedidos ? a : b)
    : null;
  const barDemanda = demandaHoraria.map(h => ({
    value:      h.pedidos,
    label:      `${h.hora}h`,
    frontColor: h.hora === horaPico?.hora ? Brand.accent
      : h.intensidad_pct > 60 ? Brand.blue : Brand.border,
  }));

  // Tendencia diaria
  const lineData = tendencia.slice(-14).map(d => ({
    value: d.pedidos,
    label: typeof d.fecha === 'string' ? d.fecha.slice(8, 10) : '',
  }));

  // Top restaurantes
  const barRest = topRestaurantes.slice(0, 6).map((r, i) => ({
    value:      r.total_pedidos,
    label:      r.nombre.substring(0, 6),
    frontColor: i === 0 ? Brand.accent : Brand.blue,
  }));

  // Cancelaciones pie
  const tasa    = cancelaciones?.tasa_actual ?? 0;
  const pieData = [
    { value: parseFloat((100 - tasa).toFixed(1)), color: Brand.green },
    { value: tasa,                                color: Brand.red },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <View style={styles.headerBg}>
        <Text style={styles.titulo}>Graficas</Text>
        <Text style={styles.subtitulo}>Visualizacion de KPIs</Text>
      </View>

      {/* Demanda horaria */}
      <View style={[styles.card, { backgroundColor: Brand.cardBlue }]}>
        <View style={styles.hdr}>
          <Ionicons name="time-outline" size={18} color={Brand.blue} />
          <Text style={[styles.hdrTxt, { color: Brand.blue }]}>Demanda por hora del dia</Text>
        </View>
        {horaPico && (
          <Text style={styles.sub}>
            Hora pico: {horaPico.hora}:00 h — {horaPico.pedidos.toLocaleString()} pedidos
          </Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <BarChart
            data={barDemanda}
            barWidth={18}
            spacing={4}
            noOfSections={4}
            yAxisTextStyle={{ color: Brand.subtext, fontSize: 9 }}
            xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 9 }}
            hideRules
            barBorderRadius={3}
            height={150}
          />
        </ScrollView>
        <View style={[styles.nota, { borderLeftColor: Brand.blue }]}>
          <Text style={styles.notaLbl}>INSIGHT</Text>
          <Text style={styles.notaTxt}>
            Concentrar conductores en la hora pico reduce tiempos y cancelaciones por demora
          </Text>
        </View>
      </View>

      {/* Tendencia diaria */}
      <View style={[styles.card, { backgroundColor: Brand.cardGreen }]}>
        <View style={styles.hdr}>
          <Ionicons name="trending-up-outline" size={18} color={Brand.green} />
          <Text style={[styles.hdrTxt, { color: Brand.green }]}>Tendencia — ultimos 14 dias</Text>
        </View>
        <Text style={styles.sub}>Pedidos entregados por dia</Text>
        {lineData.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <LineChart
              data={lineData}
              height={160}
              spacing={38}
              color={Brand.green}
              thickness={2}
              dataPointsColor={Brand.green}
              yAxisTextStyle={{ color: Brand.subtext, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 10 }}
              hideRules
              curved
              areaChart
              startFillColor={Brand.green}
              startOpacity={0.2}
              endOpacity={0}
            />
          </ScrollView>
        ) : <Text style={styles.noData}>Sin datos de tendencia</Text>}
      </View>

      {/* Top restaurantes */}
      <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
        <View style={styles.hdr}>
          <Ionicons name="trophy-outline" size={18} color={Brand.accent} />
          <Text style={[styles.hdrTxt, { color: Brand.accent }]}>Top 6 restaurantes por pedidos</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <BarChart
            data={barRest}
            barWidth={30}
            spacing={12}
            noOfSections={4}
            yAxisTextStyle={{ color: Brand.subtext, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 9 }}
            hideRules
            barBorderRadius={4}
            height={160}
          />
        </ScrollView>
        {topRestaurantes[0] && (
          <View style={[styles.nota, { borderLeftColor: Brand.accent }]}>
            <Text style={styles.notaLbl}>LIDER</Text>
            <Text style={styles.notaTxt}>
              {topRestaurantes[0].nombre} — {topRestaurantes[0].total_pedidos.toLocaleString()} pedidos
              · ${topRestaurantes[0].ticket_promedio} ticket promedio
            </Text>
          </View>
        )}
      </View>

      {/* Cancelaciones */}
      <View style={[styles.card, { backgroundColor: Brand.cardPurple }]}>
        <View style={styles.hdr}>
          <Ionicons name="pie-chart-outline" size={18} color={Brand.purple} />
          <Text style={[styles.hdrTxt, { color: Brand.purple }]}>Tasa de cancelacion</Text>
        </View>
        <View style={styles.pieRow}>
          <PieChart
            data={pieData}
            donut
            radius={80}
            innerRadius={50}
            innerCircleColor={Brand.cardPurple}
            centerLabelComponent={() => (
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: tasa > 15 ? Brand.red : Brand.green }}>
                  {tasa}%
                </Text>
                <Text style={{ fontSize: 9, color: Brand.subtext }}>cancel.</Text>
              </View>
            )}
          />
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: Brand.green }]} />
              <View>
                <Text style={styles.legendLbl}>Completados</Text>
                <Text style={[styles.legendVal, { color: Brand.green }]}>{(100 - tasa).toFixed(1)}%</Text>
              </View>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.dot, { backgroundColor: Brand.red }]} />
              <View>
                <Text style={styles.legendLbl}>Cancelados</Text>
                <Text style={[styles.legendVal, { color: Brand.red }]}>{tasa}%</Text>
              </View>
            </View>
            {cancelaciones && (
              <Text style={[styles.sub, { marginTop: 8 }]}>
                Cliente: {cancelaciones.por_cliente?.toLocaleString()}{'\n'}
                Restaurante: {cancelaciones.por_restaurante?.toLocaleString()}{'\n'}
                Conductor: {cancelaciones.por_conductor?.toLocaleString()}
              </Text>
            )}
          </View>
        </View>
        {tasa > 15 && (
          <View style={[styles.nota, { borderLeftColor: Brand.red }]}>
            <Text style={styles.notaLbl}>ALERTA</Text>
            <Text style={styles.notaTxt}>
              Cancelaciones por encima del 15% — revisar operacion por zona
            </Text>
          </View>
        )}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Brand.bg },
  center:     { flex: 1, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerBg:   { backgroundColor: Brand.headerDark, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  titulo:     { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF' },
  subtitulo:  { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  card:       { borderRadius: 16, padding: 16, margin: 16, marginBottom: 0, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  hdr:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hdrTxt:     { fontSize: 14, fontWeight: '700', color: Brand.text },
  sub:        { fontSize: 11, color: Brand.subtext, lineHeight: 16 },
  noData:     { color: Brand.subtext, textAlign: 'center', padding: 20 },
  nota:       { borderLeftWidth: 3, borderRadius: 6, padding: 10, backgroundColor: Brand.card, marginTop: 10 },
  notaLbl:    { fontSize: 9, fontWeight: '800', color: Brand.subtext, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  notaTxt:    { fontSize: 12, color: Brand.text, lineHeight: 18 },
  pieRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginVertical: 8 },
  legend:     { gap: 12 },
  legendRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:        { width: 12, height: 12, borderRadius: 6 },
  legendLbl:  { fontSize: 11, color: Brand.subtext },
  legendVal:  { fontSize: 14, fontWeight: 'bold', color: Brand.text },
  btn:        { backgroundColor: Brand.accent, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
});
