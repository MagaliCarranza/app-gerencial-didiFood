import { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator,
         TouchableOpacity, TextInput, Modal } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Brand } from '@/constants/theme';
import { API, fetchJSON } from '@/constants/api';

const tipoColor = (tipo: string) => {
  if (tipo === 'warn')  return Brand.red;
  if (tipo === 'alert') return Brand.accent;
  return Brand.green;
};

export default function RestaurantesScreen() {
  const [ranking,      setRanking]      = useState<any[]>([]);
  const [distribucion, setDistribucion] = useState<any[]>([]);
  const [porCocina,    setPorCocina]    = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [limitModal,   setLimitModal]   = useState(false);
  const [limitInput,   setLimitInput]   = useState('10');
  const [limit,        setLimit]        = useState(10);

  useEffect(() => {
    AsyncStorage.getItem('ranking_limit').then(v => {
      if (v) { setLimit(parseInt(v)); setLimitInput(v); }
    });
  }, []);

  const cargar = useCallback((lim = limit) => {
    setLoading(true); setError('');
    Promise.all([
      fetchJSON(`${API}/restaurantes/ranking?limit=${lim}`),
      fetchJSON(`${API}/restaurantes/distribucion`),
      fetchJSON(`${API}/restaurantes/por-cocina`),
    ]).then(([rk, di, co]) => {
      setRanking(rk); setDistribucion(di); setPorCocina(co); setLoading(false);
    }).catch(() => { setError('Error cargando datos'); setLoading(false); });
  }, [limit]);

  useEffect(() => { cargar(); }, [cargar]);

  const aplicarLimit = () => {
    const n = parseInt(limitInput);
    if (n > 0) { AsyncStorage.setItem('ranking_limit', String(n)); setLimit(n); cargar(n); }
    setLimitModal(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Brand.accent} /></View>;
  if (error)   return <View style={styles.center}><Text style={{ color: Brand.red }}>{error}</Text></View>;

  const barDataCocina = porCocina.slice(0, 8).map(r => ({
    value:      r.pedidos,
    label:      r.tipo_cocina.substring(0, 6),
    frontColor: r.participacion_pct < 3 ? Brand.red : r.participacion_pct > 10 ? Brand.green : Brand.accent,
  }));

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <View style={styles.headerBg}>
        <Text style={styles.titulo}>Restaurantes</Text>
        <Text style={styles.subtitulo}>Analisis y sugerencias</Text>
      </View>

      {/* SECCION 1: Distribucion por ciudad */}
      <View style={[styles.card, { backgroundColor: Brand.cardBlue }]}>
        <View style={styles.seccionHeader}>
          <Ionicons name="map-outline" size={18} color={Brand.blue} />
          <Text style={[styles.seccionTitulo, { color: Brand.blue }]}>Distribucion por la ciudad</Text>
        </View>
        {distribucion.slice(0, 8).map((d, i) => (
          <View key={i} style={styles.distRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.distColonia}>{d.colonia}</Text>
              <Text style={styles.distMun}>{d.municipio}</Text>
            </View>
            <View style={styles.distStats}>
              <Text style={styles.distNum}>{d.restaurantes}</Text>
              <Text style={styles.distLbl}>rests.</Text>
            </View>
            <View style={styles.distStats}>
              <Text style={styles.distNum}>{d.pedidos_recibidos.toLocaleString()}</Text>
              <Text style={styles.distLbl}>pedidos</Text>
            </View>
            <View style={[styles.distBadge, {
              backgroundColor: d.restaurantes < 3 ? '#FEF3C7' : '#DCFCE7',
            }]}>
              <Text style={{ fontSize: 10, color: d.restaurantes < 3 ? '#92400E' : '#166534' }}>
                {d.restaurantes < 3 ? 'Poca cobertura' : 'OK'}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* SECCION 2: Por tipo de cocina + marketing */}
      <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
        <View style={styles.seccionHeader}>
          <Ionicons name="stats-chart-outline" size={18} color={Brand.accent} />
          <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Pedidos por tipo de cocina</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <BarChart
            data={barDataCocina}
            barWidth={28}
            spacing={10}
            noOfSections={4}
            yAxisTextStyle={{ color: Brand.subtext, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 9 }}
            hideRules
            barBorderRadius={4}
            height={160}
          />
        </ScrollView>
        {porCocina.filter(r => r.marketing).map((r, i) => (
          <View key={i} style={[styles.alertaRow, {
            borderLeftColor: tipoColor(r.marketing_tipo ?? 'ok'),
          }]}>
            <View style={styles.alertaLabel}>
              <Text style={styles.alertaLabelText}>
                {r.marketing_tipo === 'warn' ? 'CRITICO' : r.marketing_tipo === 'alert' ? 'ATENCION' : 'OPORTUNIDAD'}
              </Text>
            </View>
            <Text style={styles.alertaTexto}>
              <Text style={{ fontWeight: '700' }}>{r.tipo_cocina}</Text>
              {`  ${r.participacion_pct}% participacion\n`}{r.marketing}
            </Text>
          </View>
        ))}
      </View>

      {/* SECCION 3: Ranking con comisiones */}
      <View style={[styles.card, { backgroundColor: Brand.cardGreen }]}>
        <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
          <View style={styles.seccionHeader}>
            <Ionicons name="trophy-outline" size={18} color={Brand.green} />
            <Text style={[styles.seccionTitulo, { color: Brand.green }]}>Ranking — Top {limit}</Text>
          </View>
          <TouchableOpacity onPress={() => setLimitModal(true)} style={styles.chipSmall}>
            <Ionicons name="options-outline" size={14} color={Brand.green} />
            <Text style={[styles.chipSmallText, { color: Brand.green, borderColor: Brand.green }]}>Cantidad: {limit}</Text>
          </TouchableOpacity>
        </View>

        {ranking.map((r, i) => (
          <View key={i} style={styles.rankCard}>
            <View style={styles.rankHeader}>
              <Text style={styles.rankPos}>#{r.posicion}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.rankNombre} numberOfLines={1}>{r.nombre}</Text>
                <Text style={styles.rankSub}>{r.tipo_cocina} · {r.colonia}</Text>
              </View>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeNum}>{r.calificacion}</Text>
                <Text style={styles.rankBadgeLbl}>calif.</Text>
              </View>
            </View>

            <View style={styles.rankStats}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>${(r.ingresos / 1000).toFixed(1)}k</Text>
                <Text style={styles.statLbl}>Ingresos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{r.total_pedidos.toLocaleString()}</Text>
                <Text style={styles.statLbl}>Pedidos</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: r.tasa_cancelacion > 15 ? Brand.red : Brand.green }]}>
                  {r.tasa_cancelacion}%
                </Text>
                <Text style={styles.statLbl}>Cancelac.</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: Brand.blue }]}>{r.comision_sugerida}%</Text>
                <Text style={styles.statLbl}>Comision</Text>
              </View>
            </View>

            {r.sugerencia !== '' && (
              <View style={[styles.alertaRow, {
                borderLeftColor: tipoColor(r.sugerencia_tipo ?? 'ok'),
                marginTop: 8,
              }]}>
                <View style={styles.alertaLabel}>
                  <Text style={styles.alertaLabelText}>
                    {r.sugerencia_tipo === 'warn' ? 'ATENCION' : r.sugerencia_tipo === 'alert' ? 'REVISAR' : 'BIEN'}
                  </Text>
                </View>
                <Text style={styles.alertaTexto}>{r.sugerencia}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Modal limit */}
      <Modal visible={limitModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Cantidad de restaurantes</Text>
            <Text style={styles.modalSub}>Ingresa cuantos restaurantes quieres ver en el ranking</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 15"
              keyboardType="numeric"
              value={limitInput}
              onChangeText={setLimitInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={styles.btn} onPress={aplicarLimit}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLimitModal(false)} style={{ marginTop: 12 }}>
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
  distRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Brand.border },
  distColonia:    { fontSize: 13, fontWeight: '600', color: Brand.text },
  distMun:        { fontSize: 11, color: Brand.subtext },
  distStats:      { alignItems: 'center', marginLeft: 12 },
  distNum:        { fontSize: 14, fontWeight: 'bold', color: Brand.text },
  distLbl:        { fontSize: 10, color: Brand.subtext },
  distBadge:      { marginLeft: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  alertaRow:      { borderLeftWidth: 3, borderRadius: 6, padding: 10, backgroundColor: Brand.card, marginBottom: 8 },
  alertaLabel:    { marginBottom: 4 },
  alertaLabelText:{ fontSize: 9, fontWeight: '800', color: Brand.subtext, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertaTexto:    { fontSize: 12, color: Brand.text, lineHeight: 18 },
  rankCard:       { backgroundColor: Brand.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  rankHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  rankPos:        { fontSize: 18, fontWeight: 'bold', color: Brand.green, width: 32 },
  rankNombre:     { fontSize: 14, fontWeight: '700', color: Brand.text },
  rankSub:        { fontSize: 11, color: Brand.subtext },
  rankBadge:      { backgroundColor: '#FEF9C3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignItems: 'center' },
  rankBadgeNum:   { fontSize: 14, fontWeight: 'bold', color: '#854D0E' },
  rankBadgeLbl:   { fontSize: 9, color: Brand.subtext },
  rankStats:      { flexDirection: 'row', justifyContent: 'space-around' },
  statBox:        { alignItems: 'center' },
  statVal:        { fontSize: 16, fontWeight: 'bold', color: Brand.text },
  statLbl:        { fontSize: 10, color: Brand.subtext, marginTop: 2 },
  chipSmall:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: Brand.green },
  chipSmallText:  { fontSize: 12, fontWeight: '600' },
  modalBg:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  modalCard:      { backgroundColor: Brand.card, borderRadius: 16, padding: 24 },
  modalTitulo:    { fontSize: 16, fontWeight: 'bold', color: Brand.text, marginBottom: 6 },
  modalSub:       { fontSize: 12, color: Brand.subtext, marginBottom: 16, lineHeight: 18 },
  input:          { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, color: Brand.text, marginBottom: 16, fontSize: 16 },
  btn:            { backgroundColor: Brand.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
});
