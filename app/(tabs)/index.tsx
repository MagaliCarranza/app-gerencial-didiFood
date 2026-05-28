import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Brand } from '@/constants/theme';
import { API, fetchJSON } from '@/constants/api';

function Tendencia({ v, inv = false }: { v: number; inv?: boolean }) {
  if (!v || v === 0) return null;
  const bueno = inv ? v < 0 : v > 0;
  return (
    <Text style={{ fontSize: 11, marginTop: 4, color: bueno ? Brand.green : Brand.red, fontWeight: '600' }}>
      {v > 0 ? '▲' : '▼'} {Math.abs(v)}% vs mes anterior
    </Text>
  );
}

function KpiCard({ label, value, sub, variacion, inv, color, icon, bg }:
  { label: string; value: string; sub?: string; variacion?: number; inv?: boolean; color?: string; icon: string; bg?: string }) {
  return (
    <View style={[styles.card, bg ? { backgroundColor: bg } : {}]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon as any} size={18} color={color ?? Brand.accent} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={styles.sub}>{sub}</Text>}
      {variacion !== undefined && <Tendencia v={variacion} inv={inv} />}
    </View>
  );
}

function AlertaCard({ texto, tipo }: { texto: string; tipo: 'warn' | 'ok' | 'info' }) {
  const colores = { warn: Brand.red, ok: Brand.green, info: Brand.blue };
  const iconos  = { warn: 'warning-outline', ok: 'checkmark-circle-outline', info: 'information-circle-outline' };
  return (
    <View style={[styles.alerta, { borderLeftColor: colores[tipo] }]}>
      <Ionicons name={iconos[tipo] as any} size={16} color={colores[tipo]} style={{ marginRight: 8 }} />
      <Text style={[styles.alertaTexto, { color: colores[tipo] }]}>{texto}</Text>
    </View>
  );
}

export default function InicioScreen() {
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cargar = () => {
    setLoading(true); setError('');
    Promise.all([
      fetchJSON(`${API}/kpi/total-pedidos`),
      fetchJSON(`${API}/kpi/ingresos`),
      fetchJSON(`${API}/kpi/ticket-promedio`),
      fetchJSON(`${API}/kpi/tiempo-entrega`),
      fetchJSON(`${API}/kpi/cancelaciones`),
      fetchJSON(`${API}/kpi/conductores`),
    ]).then(([pedidos, ingresos, ticket, tiempo, cancel, conductores]) => {
      setData({ pedidos, ingresos, ticket, tiempo, cancel, conductores });
      setLoading(false);
    }).catch(() => { setError(`Sin conexion con la API.\n${API}`); setLoading(false); });
  };

  useEffect(() => { cargar(); }, []);

  if (loading) return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={Brand.accent} />
      <Text style={{ color: Brand.subtext, marginTop: 12 }}>Cargando panel gerencial...</Text>
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

  const { pedidos, ingresos, ticket, tiempo, cancel, conductores } = data;

  const alertas: { texto: string; tipo: 'warn' | 'ok' | 'info' }[] = [];
  if (cancel.tasa_actual > 15)
    alertas.push({ texto: `Tasa de cancelacion en ${cancel.tasa_actual}% — revisar operacion`, tipo: 'warn' });
  if (cancel.tasa_actual <= 10)
    alertas.push({ texto: `Cancelaciones bajo control (${cancel.tasa_actual}%)`, tipo: 'ok' });
  if (tiempo.mes_actual > 50)
    alertas.push({ texto: `Tiempo de entrega elevado: ${tiempo.mes_actual} min promedio`, tipo: 'warn' });
  if (conductores.sancionados > 20)
    alertas.push({ texto: `${conductores.sancionados} conductores sancionados requieren revision`, tipo: 'warn' });
  if (conductores.inactivos > 100)
    alertas.push({ texto: `${conductores.inactivos} conductores inactivos — evaluar reactivacion`, tipo: 'info' });
  if (pedidos.variacion > 5)
    alertas.push({ texto: `Pedidos creciendo ${pedidos.variacion}% vs mes anterior`, tipo: 'ok' });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerBg}>
        <Text style={styles.titulo}>DiDi Food</Text>
        <Text style={styles.subtitulo}>Panel gerencial · DiDi Food Oaxaca</Text>
      </View>

      {/* Alertas automaticas */}
      {alertas.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alertas del periodo</Text>
          {alertas.map((a, i) => <AlertaCard key={i} {...a} />)}
        </View>
      )}

      {/* KPIs principales — fila 1 */}
      <View style={styles.grid2}>
        <View style={{ flex: 1 }}>
          <KpiCard
            label="Pedidos este mes"
            value={pedidos.mes_actual.toLocaleString()}
            sub={`${pedidos.total_historico.toLocaleString()} historico`}
            variacion={pedidos.variacion}
            icon="receipt-outline"
            color={Brand.blue}
            bg={Brand.cardBlue}
          />
        </View>
        <View style={{ flex: 1 }}>
          <KpiCard
            label="Tiempo entrega"
            value={`${tiempo.mes_actual} min`}
            sub={`Historico: ${tiempo.promedio_historico} min`}
            variacion={tiempo.variacion}
            inv
            icon="time-outline"
            color={tiempo.mes_actual > 50 ? Brand.red : Brand.green}
            bg={Brand.cardGreen}
          />
        </View>
      </View>

      {/* KPIs principales — fila 2 */}
      <KpiCard
        label="Ingresos del mes"
        value={`$${ingresos.mes_actual.toLocaleString()}`}
        sub={`Historico total: $${ingresos.total_historico.toLocaleString()}`}
        variacion={ingresos.variacion}
        icon="cash-outline"
        color={Brand.accent}
        bg={Brand.cardOrange}
      />

      <View style={styles.grid2}>
        <View style={{ flex: 1 }}>
          <KpiCard
            label="Ticket promedio"
            value={`$${ticket.mes_actual}`}
            variacion={ticket.variacion}
            icon="pricetag-outline"
            bg={Brand.cardYellow}
          />
        </View>
        <View style={{ flex: 1 }}>
          <KpiCard
            label="Cancelaciones"
            value={`${cancel.tasa_actual}%`}
            sub={`${cancel.total_cancelados.toLocaleString()} cancelados`}
            variacion={cancel.variacion}
            inv
            icon="close-circle-outline"
            color={cancel.tasa_actual > 15 ? Brand.red : Brand.text}
          />
        </View>
      </View>

      {/* Conductores */}
      <View style={[styles.card, { backgroundColor: Brand.cardPurple }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="bicycle-outline" size={18} color={Brand.purple} />
          <Text style={[styles.label, { color: Brand.purple }]}>Conductores</Text>
        </View>
        <View style={styles.grid3}>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: Brand.green }]}>{conductores.activos}</Text>
            <Text style={styles.statLbl}>Activos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: Brand.subtext }]}>{conductores.inactivos}</Text>
            <Text style={styles.statLbl}>Inactivos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: Brand.red }]}>{conductores.sancionados}</Text>
            <Text style={styles.statLbl}>Sancionados</Text>
          </View>
        </View>
        <Text style={styles.sub}>Calificacion promedio: {conductores.calificacion_promedio}</Text>
      </View>

      <Text style={styles.hint}>Usa las pestanas para ver el analisis detallado por seccion</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: Brand.bg },
  center:       { flex: 1, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerBg:     { backgroundColor: Brand.headerDark, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 16, marginBottom: 16 },
  titulo:       { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  subtitulo:    { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  section:      { marginBottom: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Brand.text, marginBottom: 8, textTransform: 'uppercase' },
  card:         { backgroundColor: Brand.card, borderRadius: 16, padding: 16, marginBottom: 12, marginHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  label:        { fontSize: 11, color: Brand.subtext, textTransform: 'uppercase', fontWeight: '600' },
  value:        { fontSize: 26, fontWeight: 'bold', color: Brand.text },
  sub:          { fontSize: 11, color: Brand.subtext, marginTop: 4 },
  grid2:        { flexDirection: 'row', gap: 0, marginBottom: 0, paddingHorizontal: 16 },
  grid3:        { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, marginBottom: 8 },
  statBox:      { alignItems: 'center' },
  statVal:      { fontSize: 22, fontWeight: 'bold' },
  statLbl:      { fontSize: 11, color: Brand.subtext, marginTop: 2 },
  alerta:       { flexDirection: 'row', alignItems: 'center', backgroundColor: Brand.card, borderLeftWidth: 4, borderRadius: 8, padding: 10, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  alertaTexto:  { fontSize: 12, flex: 1, fontWeight: '500' },
  btn:          { backgroundColor: Brand.accent, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  hint:         { fontSize: 11, color: Brand.subtext, textAlign: 'center', marginVertical: 24 },
});
