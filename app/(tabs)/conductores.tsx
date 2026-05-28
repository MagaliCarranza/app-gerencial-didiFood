import { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator,
         TouchableOpacity, TextInput, Modal } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Brand } from '@/constants/theme';
import { API, fetchJSON } from '@/constants/api';

const nivelColor = (tipo: string) => {
  if (tipo === 'warn')  return Brand.red;
  if (tipo === 'alert') return '#F59E0B';
  return Brand.green;
};

export default function ConductoresScreen() {
  const [resumen,      setResumen]      = useState<any>(null);
  const [porVehiculo,  setPorVehiculo]  = useState<any[]>([]);
  const [porZona,      setPorZona]      = useState<any[]>([]);
  const [reactivacion, setReactivacion] = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [cantidad,     setCantidad]     = useState(10);
  const [cantidadInput, setCantidadInput] = useState('10');
  const [modalCant,    setModalCant]    = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('conductores_cantidad').then(v => {
      if (v) { setCantidad(parseInt(v)); setCantidadInput(v); }
    });
  }, []);

  const cargar = useCallback((cant = cantidad) => {
    setLoading(true); setError('');
    Promise.all([
      fetchJSON(`${API}/kpi/conductores`),
      fetchJSON(`${API}/conductores/por-vehiculo`),
      fetchJSON(`${API}/conductores/por-zona`),
      fetchJSON(`${API}/conductores/reactivacion`),
    ]).then(([res, veh, zon, rea]) => {
      setResumen(res);
      setPorVehiculo(veh);
      setPorZona(zon);
      setReactivacion(rea.slice(0, cant));
      setLoading(false);
    }).catch(() => { setError('Error cargando datos'); setLoading(false); });
  }, [cantidad]);

  useEffect(() => { cargar(); }, [cargar]);

  const aplicarCantidad = () => {
    const n = parseInt(cantidadInput);
    if (n > 0) {
      AsyncStorage.setItem('conductores_cantidad', String(n));
      setCantidad(n);
      setReactivacion(prev => prev.slice(0, n));
      cargar(n);
    }
    setModalCant(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Brand.accent} /></View>;
  if (error)   return <View style={styles.center}><Text style={{ color: Brand.red }}>{error}</Text></View>;

  const barVehiculo = porVehiculo.map((v, i) => ({
    value:      v.pedidos,
    label:      v.tipo_vehiculo.substring(0, 5),
    frontColor: v.volumen_pct > 60 ? Brand.green : v.volumen_pct < 25 ? Brand.red : Brand.accent,
  }));

  const pctActivos = resumen ? ((resumen.activos / resumen.total) * 100).toFixed(1) : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header con fondo oscuro */}
      <View style={styles.headerBg}>
        <Text style={styles.titulo}>Conductores</Text>
        <Text style={styles.subtitulo}>Flota y operacion</Text>
      </View>

      {/* Resumen general */}
      {resumen && (
        <View style={[styles.card, { backgroundColor: Brand.cardPurple }]}>
          <View style={styles.seccionHeader}>
            <Ionicons name="people-outline" size={18} color={Brand.purple} />
            <Text style={[styles.seccionTitulo, { color: Brand.purple }]}>Resumen de la flota</Text>
          </View>
          <View style={styles.grid3}>
            <View style={[styles.statCircle, { backgroundColor: Brand.green }]}>
              <Text style={styles.statCircleNum}>{resumen.activos}</Text>
              <Text style={styles.statCircleLbl}>Activos</Text>
            </View>
            <View style={[styles.statCircle, { backgroundColor: Brand.subtext }]}>
              <Text style={styles.statCircleNum}>{resumen.inactivos}</Text>
              <Text style={styles.statCircleLbl}>Inactivos</Text>
            </View>
            <View style={[styles.statCircle, { backgroundColor: Brand.red }]}>
              <Text style={styles.statCircleNum}>{resumen.sancionados}</Text>
              <Text style={styles.statCircleLbl}>Sancionados</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${pctActivos}%`, backgroundColor: Brand.green,
            }]} />
          </View>
          <Text style={styles.sub}>
            {pctActivos}% de actividad  ·  Calificacion promedio: {resumen.calificacion_promedio}
          </Text>
        </View>
      )}

      {/* Seccion 1: Por tipo de vehiculo */}
      <View style={[styles.card, { backgroundColor: Brand.cardBlue }]}>
        <View style={styles.seccionHeader}>
          <Ionicons name="car-outline" size={18} color={Brand.blue} />
          <Text style={[styles.seccionTitulo, { color: Brand.blue }]}>Volumen por tipo de vehiculo</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <BarChart
            data={barVehiculo}
            barWidth={30}
            spacing={12}
            noOfSections={4}
            yAxisTextStyle={{ color: Brand.subtext, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 10 }}
            hideRules
            barBorderRadius={4}
            height={150}
          />
        </ScrollView>
        {porVehiculo.map((v, i) => v.sugerencia !== '' && (
          <View key={i} style={[styles.alertaRow, {
            borderLeftColor: v.volumen_pct > 60 ? Brand.green : Brand.subtext,
          }]}>
            <View style={styles.alertaLabel}>
              <Text style={styles.alertaLabelText}>
                {v.volumen_pct > 60 ? 'DEMANDA ALTA' : 'BAJO VOLUMEN'}
              </Text>
            </View>
            <Text style={styles.alertaTexto}>
              {v.tipo_vehiculo}: {v.activos} activos · {v.tiempo_promedio} min prom.{'\n'}{v.sugerencia}
            </Text>
          </View>
        ))}
      </View>

      {/* Seccion 2: Distribucion por zona */}
      <View style={[styles.card, { backgroundColor: Brand.cardGreen }]}>
        <View style={styles.seccionHeader}>
          <Ionicons name="location-outline" size={18} color={Brand.green} />
          <Text style={[styles.seccionTitulo, { color: Brand.green }]}>Distribucion por zona</Text>
        </View>
        {porZona.map((z, i) => (
          <View key={i} style={styles.zonaRow}>
            <View style={[styles.zonaIndicador, { backgroundColor: nivelColor(z.nivel_tipo) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.zonaNombre} numberOfLines={1}>{z.zona}</Text>
              <Text style={[styles.zonaSub, { color: nivelColor(z.nivel_tipo) }]}>{z.nivel}</Text>
            </View>
            <View style={styles.zonaStats}>
              <Text style={styles.zonaNum}>{z.activos}</Text>
              <Text style={styles.zonaLbl}>activos</Text>
            </View>
            <View style={styles.zonaStats}>
              <Text style={styles.zonaNum}>{z.ratio_pedidos_por_conductor}</Text>
              <Text style={styles.zonaLbl}>ped/cond</Text>
            </View>
          </View>
        ))}
        <View style={[styles.alertaRow, { borderLeftColor: Brand.blue, marginTop: 8, backgroundColor: Brand.cardBlue }]}>
          <View style={styles.alertaLabel}>
            <Text style={styles.alertaLabelText}>SUGERENCIA</Text>
          </View>
          <Text style={styles.alertaTexto}>
            Las zonas en rojo requieren incorporar conductores para reducir tiempos de espera
          </Text>
        </View>
      </View>

      {/* Seccion 3: Reactivacion con filtro */}
      <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
        <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
          <View style={styles.seccionHeader}>
            <Ionicons name="flash-outline" size={18} color={Brand.accent} />
            <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Conductores para reactivar</Text>
          </View>
          <TouchableOpacity onPress={() => setModalCant(true)} style={styles.chipSmall}>
            <Ionicons name="options-outline" size={14} color={Brand.accent} />
            <Text style={styles.chipSmallText}>Cantidad: {cantidad}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Priorizados por calificacion historica</Text>

        {reactivacion.map((c, i) => (
          <View key={i} style={styles.reacCard}>
            <View style={styles.rankHeader}>
              <View style={[styles.estBadge, {
                backgroundColor: c.estatus === 'Inactivo' ? '#FEF3C7' : Brand.redLight,
              }]}>
                <Text style={{
                  fontSize: 10, fontWeight: '700',
                  color: c.estatus === 'Inactivo' ? '#92400E' : Brand.red,
                }}>
                  {c.estatus.toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rankNombre}>{c.nombre}</Text>
                <Text style={styles.rankSub}>{c.tipo_vehiculo} · {c.zona}</Text>
              </View>
              <View style={styles.calBadge}>
                <Text style={styles.calTexto}>{c.calificacion}</Text>
                <Text style={{ fontSize: 9, color: Brand.subtext }}>calif.</Text>
              </View>
            </View>
            <View style={[styles.alertaRow, {
              borderLeftColor: c.estatus === 'Inactivo' ? Brand.green : Brand.red,
              marginTop: 4, backgroundColor: Brand.card,
            }]}>
              <View style={styles.alertaLabel}>
                <Text style={styles.alertaLabelText}>
                  {c.estatus === 'Inactivo' ? 'BONO SUGERIDO' : 'ATENCION'}
                </Text>
              </View>
              <Text style={styles.alertaTexto}>{c.bono_sugerido}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Modal cantidad */}
      <Modal visible={modalCant} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Cantidad mostrada</Text>
            <Text style={styles.modalSub}>Ingresa cuantos conductores quieres ver en la lista de reactivacion</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 15"
              keyboardType="numeric"
              value={cantidadInput}
              onChangeText={setCantidadInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={styles.btn} onPress={aplicarCantidad}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalCant(false)} style={{ marginTop: 12 }}>
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
  card:            { borderRadius: 16, padding: 16, margin: 16, marginBottom: 0, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  seccionHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  seccionTitulo:   { fontSize: 14, fontWeight: '700', color: Brand.text },
  grid3:           { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  statCircle:      { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  statCircleNum:   { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statCircleLbl:   { fontSize: 10, color: '#fff', marginTop: 2 },
  progressBar:     { height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill:    { height: 8, borderRadius: 4 },
  sub:             { fontSize: 11, color: Brand.subtext },
  alertaRow:       { borderLeftWidth: 3, borderRadius: 6, padding: 10, marginBottom: 6 },
  alertaLabel:     { marginBottom: 4 },
  alertaLabelText: { fontSize: 9, fontWeight: '800', color: Brand.subtext, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertaTexto:     { fontSize: 12, color: Brand.text, lineHeight: 18 },
  zonaRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Brand.border },
  zonaIndicador:   { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  zonaNombre:      { fontSize: 13, fontWeight: '600', color: Brand.text },
  zonaSub:         { fontSize: 10 },
  zonaStats:       { alignItems: 'center', marginLeft: 12 },
  zonaNum:         { fontSize: 14, fontWeight: 'bold', color: Brand.text },
  zonaLbl:         { fontSize: 10, color: Brand.subtext },
  reacCard:        { backgroundColor: Brand.card, borderRadius: 10, padding: 10, marginBottom: 8 },
  rankHeader:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rankNombre:      { fontSize: 13, fontWeight: '700', color: Brand.text },
  rankSub:         { fontSize: 11, color: Brand.subtext },
  calBadge:        { alignItems: 'center', backgroundColor: '#FEF9C3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  calTexto:        { fontSize: 14, fontWeight: 'bold', color: '#854D0E' },
  estBadge:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chipSmall:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: Brand.accent },
  chipSmallText:   { fontSize: 12, color: Brand.accent, fontWeight: '600' },
  modalBg:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  modalCard:       { backgroundColor: Brand.card, borderRadius: 16, padding: 24 },
  modalTitulo:     { fontSize: 16, fontWeight: 'bold', color: Brand.text, marginBottom: 6 },
  modalSub:        { fontSize: 12, color: Brand.subtext, marginBottom: 16, lineHeight: 18 },
  input:           { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, color: Brand.text, marginBottom: 16, fontSize: 16 },
  btn:             { backgroundColor: Brand.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
});
