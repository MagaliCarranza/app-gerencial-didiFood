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

const nivelOrden = (tipo: string) => {
  if (tipo === 'warn')  return 0;
  if (tipo === 'alert') return 1;
  return 2;
};

const recInfo = (rec: string) => {
  if (rec === 'reactivar')   return { bg: '#D1FAE5', txt: '#065F46', border: Brand.green,  label: 'REACTIVAR' };
  if (rec === 'evaluar')     return { bg: '#FEF3C7', txt: '#92400E', border: '#D97706',    label: 'EVALUAR' };
  return                            { bg: Brand.redLight, txt: Brand.red, border: Brand.red, label: 'NO REACTIVAR' };
};

export default function ConductoresScreen() {
  const [resumen,            setResumen]            = useState<any>(null);
  const [porVehiculo,        setPorVehiculo]        = useState<any[]>([]);
  const [porZona,            setPorZona]            = useState<any[]>([]);
  const [reactivacion,       setReactivacion]       = useState<any[]>([]);
  const [sancionados,        setSancionados]        = useState<any[]>([]);
  const [califConductores,   setCalifConductores]   = useState<any[]>([]);
  const [periodo,            setPeriodo]            = useState<string>('');
  const [sancDetalle,        setSancDetalle]        = useState<any>(null);
  const [loading,            setLoading]            = useState(true);
  const [error,              setError]              = useState('');

  // Filtro lista reactivacion
  const [cantidad,           setCantidad]           = useState(10);
  const [cantidadInput,      setCantidadInput]      = useState('10');
  const [modalCant,          setModalCant]          = useState(false);

  // Filtro sancionados
  const [cantidadSanc,       setCantidadSanc]       = useState(5);
  const [cantidadSancInput,  setCantidadSancInput]  = useState('5');
  const [modalSanc,          setModalSanc]          = useState(false);

  // Filtro zonas
  const [cantidadZonas,      setCantidadZonas]      = useState(0); // 0 = todas
  const [cantidadZonasInput, setCantidadZonasInput] = useState('');
  const [modalZonas,         setModalZonas]         = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('conductores_cantidad'),
      AsyncStorage.getItem('conductores_sanc_cantidad'),
      AsyncStorage.getItem('conductores_zonas_cantidad'),
    ]).then(([cant, sanc, zonas]) => {
      if (cant)  { setCantidad(parseInt(cant));       setCantidadInput(cant); }
      if (sanc)  { setCantidadSanc(parseInt(sanc));   setCantidadSancInput(sanc); }
      if (zonas) { setCantidadZonas(parseInt(zonas)); setCantidadZonasInput(zonas); }
    });
  }, []);

  const cargar = useCallback((cant = cantidad) => {
    setLoading(true); setError('');
    Promise.all([
      fetchJSON(`${API}/kpi/conductores`),
      fetchJSON(`${API}/conductores/por-vehiculo`),
      fetchJSON(`${API}/conductores/por-zona`),
      fetchJSON(`${API}/conductores/reactivacion`),
      fetchJSON(`${API}/conductores/sancionados`),
      fetchJSON(`${API}/calificaciones/conductores`).catch(() => []),
      fetchJSON(`${API}/conductores/sanciones`).catch(() => null),
    ]).then(([res, veh, zon, rea, sanc, calif, sancDet]) => {
      setResumen(res);
      setPorVehiculo(veh);
      setPorZona(zon);
      setReactivacion(rea.slice(0, cant));
      setSancionados(sanc);
      setCalifConductores(Array.isArray(calif) ? calif : []);
      setSancDetalle(sancDet);
      setPeriodo(veh[0]?.periodo ?? zon[0]?.periodo ?? calif[0]?.periodo ?? '');
      setLoading(false);
    }).catch(() => { setError('Error cargando datos'); setLoading(false); });
  }, [cantidad]);

  useEffect(() => { cargar(); }, [cargar]);

  const aplicarCantidad = () => {
    const n = parseInt(cantidadInput);
    if (n > 0) {
      AsyncStorage.setItem('conductores_cantidad', String(n));
      setCantidad(n);
      cargar(n);
    }
    setModalCant(false);
  };

  const aplicarCantSanc = () => {
    const n = parseInt(cantidadSancInput);
    if (n > 0) {
      AsyncStorage.setItem('conductores_sanc_cantidad', String(n));
      setCantidadSanc(n);
    }
    setModalSanc(false);
  };

  const aplicarCantZonas = () => {
    const n = parseInt(cantidadZonasInput);
    if (n > 0) {
      AsyncStorage.setItem('conductores_zonas_cantidad', String(n));
      setCantidadZonas(n);
    } else {
      AsyncStorage.removeItem('conductores_zonas_cantidad');
      setCantidadZonas(0);
      setCantidadZonasInput('');
    }
    setModalZonas(false);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Brand.accent} /></View>;
  if (error)   return <View style={styles.center}><Text style={{ color: Brand.red }}>{error}</Text></View>;

  const barVehiculo = porVehiculo.map(v => ({
    value:      v.pedidos,
    label:      v.tipo_vehiculo.substring(0, 5),
    frontColor: v.volumen_pct > 60 ? Brand.green : v.volumen_pct < 25 ? Brand.red : Brand.accent,
  }));

  const pctActivos     = resumen ? parseFloat(((resumen.activos     / resumen.total) * 100).toFixed(1)) : 0;
  const pctInactivos   = resumen ? parseFloat(((resumen.inactivos   / resumen.total) * 100).toFixed(1)) : 0;
  const pctSancionados = resumen ? parseFloat(((resumen.sancionados / resumen.total) * 100).toFixed(1)) : 0;

  // Zonas ordenadas: escasez > presion > bien, luego limitadas por cantidadZonas
  const porZonaOrdenada = [...porZona].sort((a, b) => nivelOrden(a.nivel_tipo) - nivelOrden(b.nivel_tipo));
  const zonasMostradas  = cantidadZonas > 0 ? porZonaOrdenada.slice(0, cantidadZonas) : porZonaOrdenada;

  const sancionadosMostrados = sancionados.slice(0, cantidadSanc);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.headerBg}>
        <Text style={styles.titulo}>Conductores</Text>
        <Text style={styles.subtitulo}>Flota y operacion</Text>
        {periodo ? (
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>
            Periodo: {periodo}
          </Text>
        ) : null}
      </View>

      {/* Resumen general */}
      {resumen && (
        <View style={[styles.card, { backgroundColor: Brand.cardPurple }]}>
          <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="people-outline" size={18} color={Brand.purple} />
              <Text style={[styles.seccionTitulo, { color: Brand.purple }]}>Resumen de la flota</Text>
            </View>
            <View style={{backgroundColor:'#DBEAFE',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
              <Text style={{fontSize:9,color:'#1D4ED8',fontWeight:'700'}}>ESTADO ACTUAL</Text>
            </View>
          </View>
          <Text style={styles.sub}>Estado actual de todos los conductores registrados. Solo los activos pueden recibir pedidos.</Text>
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
            <View style={[styles.progressFill, { width: `${pctActivos}%`,     backgroundColor: Brand.green }]} />
            <View style={[styles.progressFill, { width: `${pctInactivos}%`,   backgroundColor: Brand.subtext }]} />
            <View style={[styles.progressFill, { width: `${pctSancionados}%`, backgroundColor: Brand.red }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={[styles.sub, { color: Brand.green }]}>Activos {pctActivos}%</Text>
            <Text style={[styles.sub, { color: Brand.subtext }]}>Inactivos {pctInactivos}%</Text>
            <Text style={[styles.sub, { color: Brand.red }]}>Sancionados {pctSancionados}%</Text>
          </View>
          <Text style={styles.sub}>Calificacion promedio: {resumen.calificacion_promedio}</Text>
        </View>
      )}

      {/* Por tipo de vehiculo */}
      <View style={[styles.card, { backgroundColor: Brand.cardBlue }]}>
        <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
          <View style={styles.seccionHeader}>
            <Ionicons name="car-outline" size={18} color={Brand.blue} />
            <Text style={[styles.seccionTitulo, { color: Brand.blue }]}>Volumen por tipo de vehiculo</Text>
          </View>
          <View style={{backgroundColor:'#DCFCE7',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
            <Text style={{fontSize:9,color:'#166534',fontWeight:'700'}}>MES ACTUAL</Text>
          </View>
        </View>
        <Text style={styles.sub}>Pedidos completados por cada tipo de vehiculo. Indica cual tiene mayor demanda y donde conviene enfocar el reclutamiento.</Text>
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
              <Text style={styles.alertaLabelText}>{v.volumen_pct > 60 ? 'DEMANDA ALTA' : 'BAJO VOLUMEN'}</Text>
            </View>
            <Text style={styles.alertaTexto}>
              {v.tipo_vehiculo}: {v.activos} activos · {v.tiempo_promedio} min prom.{'\n'}{v.sugerencia}
            </Text>
          </View>
        ))}
      </View>

      {/* Distribucion por zona con filtro */}
      <View style={[styles.card, { backgroundColor: Brand.cardGreen }]}>
        <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
          <View style={styles.seccionHeader}>
            <Ionicons name="location-outline" size={18} color={Brand.green} />
            <Text style={[styles.seccionTitulo, { color: Brand.green }]}>Distribucion por zona</Text>
            <View style={{backgroundColor:'#DCFCE7',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
              <Text style={{fontSize:9,color:'#166534',fontWeight:'700'}}>MES ACTUAL</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              setCantidadZonasInput(cantidadZonas > 0 ? String(cantidadZonas) : String(porZona.length));
              setModalZonas(true);
            }}
            style={[styles.chipSmall, { borderColor: Brand.green }]}
          >
            <Ionicons name="options-outline" size={14} color={Brand.green} />
            <Text style={[styles.chipSmallText, { color: Brand.green }]}>
              {cantidadZonas > 0 ? `Mostrando: ${Math.min(cantidadZonas, porZona.length)}` : `Todas (${porZona.length})`}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Ordenadas por prioridad de abastecimiento</Text>

        {zonasMostradas.map((z, i) => (
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

        {cantidadZonas > 0 && cantidadZonas < porZona.length && (
          <Text style={[styles.sub, { textAlign: 'center', marginTop: 8 }]}>
            Mostrando {zonasMostradas.length} de {porZona.length} zonas
          </Text>
        )}

        <View style={[styles.alertaRow, { borderLeftColor: Brand.blue, marginTop: 8, backgroundColor: Brand.cardBlue }]}>
          <View style={styles.alertaLabel}>
            <Text style={styles.alertaLabelText}>SUGERENCIA</Text>
          </View>
          <Text style={styles.alertaTexto}>
            Las zonas en rojo requieren incorporar conductores para reducir tiempos de espera
          </Text>
        </View>
      </View>

      {/* Conductores Sancionados */}
      {sancionados.length > 0 && (
        <View style={[styles.card, { backgroundColor: '#FFF1F2' }]}>
          <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="warning-outline" size={18} color={Brand.red} />
              <Text style={[styles.seccionTitulo, { color: Brand.red }]}>Conductores Sancionados</Text>
              <View style={{backgroundColor:'#F1F5F9',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
                <Text style={{fontSize:9,color:'#64748B',fontWeight:'700'}}>HISTÓRICO</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => { setCantidadSancInput(String(cantidadSanc)); setModalSanc(true); }}
              style={[styles.chipSmall, { borderColor: Brand.red }]}
            >
              <Ionicons name="options-outline" size={14} color={Brand.red} />
              <Text style={[styles.chipSmallText, { color: Brand.red }]}>Cantidad: {cantidadSanc}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sub}>
            {sancionados.length} conductor{sancionados.length !== 1 ? 'es' : ''} sancionado{sancionados.length !== 1 ? 's' : ''} · Analisis de reactivacion
          </Text>

          {sancionadosMostrados.map((c, i) => {
            const info = recInfo(c.recomendacion);
            return (
              <View key={i} style={[styles.reacCard, { borderLeftWidth: 3, borderLeftColor: info.border }]}>
                <View style={styles.rankHeader}>
                  <View style={[styles.estBadge, { backgroundColor: info.bg }]}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: info.txt }}>{info.label}</Text>
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

                <View style={styles.sancionStats}>
                  <View style={styles.sancionStat}>
                    <Text style={styles.sancionNum}>{c.pedidos_historicos}</Text>
                    <Text style={styles.sancionLbl}>entregas hist.</Text>
                  </View>
                  <View style={styles.sancionStat}>
                    <Text style={[styles.sancionNum, { color: c.tasa_cancelacion > 15 ? Brand.red : Brand.text }]}>
                      {c.tasa_cancelacion}%
                    </Text>
                    <Text style={styles.sancionLbl}>cancelaciones</Text>
                  </View>
                </View>

                <View style={[styles.alertaRow, { borderLeftColor: info.border, marginTop: 4, backgroundColor: Brand.card }]}>
                  <View style={styles.alertaLabel}>
                    <Text style={styles.alertaLabelText}>RAZON</Text>
                  </View>
                  <Text style={styles.alertaTexto}>{c.razon}</Text>
                </View>
                <View style={[styles.alertaRow, { borderLeftColor: Brand.subtext, marginTop: 4, backgroundColor: Brand.card }]}>
                  <View style={styles.alertaLabel}>
                    <Text style={styles.alertaLabelText}>ACCION SUGERIDA</Text>
                  </View>
                  <Text style={styles.alertaTexto}>{c.accion}</Text>
                </View>
              </View>
            );
          })}

          {sancionados.length > cantidadSanc && (
            <Text style={[styles.sub, { textAlign: 'center', marginTop: 8 }]}>
              Mostrando {cantidadSanc} de {sancionados.length} sancionados
            </Text>
          )}
        </View>
      )}

      {/* Calificaciones reales */}
      {califConductores.length > 0 && (
        <View style={[styles.card, { backgroundColor: Brand.cardYellow }]}>
          <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="star-outline" size={18} color="#D97706" />
              <Text style={[styles.seccionTitulo, { color: '#D97706' }]}>Calificaciones reales — Top y bottom</Text>
            </View>
            <View style={{backgroundColor:'#DCFCE7',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
              <Text style={{fontSize:9,color:'#166534',fontWeight:'700'}}>MES ACTUAL</Text>
            </View>
          </View>
          <Text style={styles.sub}>Calificaciones otorgadas por usuarios despues de cada entrega, distintas al promedio calculado al registro. Reflejan el desempeno real en operacion activa.</Text>

          {/* Top 3 */}
          {califConductores.slice(0, 3).map((c, i) => (
            <View key={i} style={[styles.reacCard, { borderLeftWidth: 3, borderLeftColor: Brand.green }]}>
              <View style={styles.rankHeader}>
                <View style={[styles.estBadge, { backgroundColor: '#D1FAE5' }]}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#065F46' }}>TOP #{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankNombre}>{c.nombre}</Text>
                  <Text style={styles.rankSub}>{c.tipo_vehiculo} · {c.zona}</Text>
                </View>
                <View style={styles.calBadge}>
                  <Text style={styles.calTexto}>{c.calificacion_real}</Text>
                  <Text style={{ fontSize: 9, color: Brand.subtext }}>{c.total_reseñas} reseñas</Text>
                </View>
              </View>
              <View style={styles.sancionStats}>
                <View style={styles.sancionStat}>
                  <Text style={[styles.sancionNum, { color: Brand.green }]}>{c.pct_positivas}%</Text>
                  <Text style={styles.sancionLbl}>positivas</Text>
                </View>
                <View style={styles.sancionStat}>
                  <Text style={[styles.sancionNum, { color: Brand.red }]}>{c.pct_negativas}%</Text>
                  <Text style={styles.sancionLbl}>negativas</Text>
                </View>
              </View>
              {c.sugerencia !== '' && (
                <View style={[styles.alertaRow, { borderLeftColor: Brand.green, marginTop: 4, backgroundColor: Brand.card }]}>
                  <Text style={styles.alertaTexto}>{c.sugerencia}</Text>
                </View>
              )}
            </View>
          ))}

          {/* Bottom 2 */}
          {califConductores.length > 3 && (
            <>
              <Text style={[styles.sub, { marginTop: 10, marginBottom: 4, fontWeight: '600', color: Brand.red }]}>
                Conductores que necesitan mejora:
              </Text>
              {[...califConductores].reverse().slice(0, 2).map((c, i) => (
                <View key={i} style={[styles.reacCard, { borderLeftWidth: 3, borderLeftColor: Brand.red }]}>
                  <View style={styles.rankHeader}>
                    <View style={[styles.estBadge, { backgroundColor: Brand.redLight }]}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: Brand.red }}>MEJORAR</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankNombre}>{c.nombre}</Text>
                      <Text style={styles.rankSub}>{c.tipo_vehiculo} · {c.zona}</Text>
                    </View>
                    <View style={[styles.calBadge, { backgroundColor: '#FEE2E2' }]}>
                      <Text style={[styles.calTexto, { color: Brand.red }]}>{c.calificacion_real}</Text>
                      <Text style={{ fontSize: 9, color: Brand.subtext }}>{c.total_reseñas} reseñas</Text>
                    </View>
                  </View>
                  {c.sugerencia !== '' && (
                    <View style={[styles.alertaRow, { borderLeftColor: Brand.red, marginTop: 4, backgroundColor: Brand.card }]}>
                      <Text style={styles.alertaTexto}>{c.sugerencia}</Text>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Sanciones por tipo */}
      {sancDetalle && sancDetalle.por_gravedad?.length > 0 && (
        <View style={[styles.card, { backgroundColor: '#FFF7ED' }]}>
          <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
            <View style={styles.seccionHeader}>
              <Ionicons name="shield-outline" size={18} color={Brand.accent} />
              <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Sanciones por gravedad</Text>
            </View>
            <View style={{backgroundColor:'#F1F5F9',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
              <Text style={{fontSize:9,color:'#64748B',fontWeight:'700'}}>HISTÓRICO</Text>
            </View>
          </View>
          <Text style={styles.sub}>Infracciones registradas clasificadas por nivel: Alta implica suspension inmediata, Media requiere advertencia formal, Baja queda como nota en el expediente.</Text>
          <View style={styles.grid3}>
            {sancDetalle.por_gravedad.map((g: any, i: number) => {
              const colores: Record<string, string> = { Alta: Brand.red, Media: '#D97706', Baja: Brand.green };
              const color = colores[g.gravedad] ?? Brand.subtext;
              return (
                <View key={i} style={{ alignItems: 'center' }}>
                  <Text style={[styles.statCircleNum, { color, fontSize: 22 }]}>{g.total}</Text>
                  <Text style={[styles.statCircleLbl, { color: Brand.subtext }]}>{g.gravedad}</Text>
                </View>
              );
            })}
          </View>

          <Text style={[styles.sub, { marginTop: 8, marginBottom: 6, fontWeight: '600' }]}>
            Sanciones recientes:
          </Text>
          {sancDetalle.recientes?.slice(0, 4).map((s: any, i: number) => {
            const gravColor: Record<string, string> = { Alta: Brand.red, Media: '#D97706', Baja: Brand.green };
            const color = gravColor[s.gravedad] ?? Brand.subtext;
            return (
              <View key={i} style={[styles.alertaRow, { borderLeftColor: color, backgroundColor: Brand.card, marginBottom: 6 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={[styles.alertaLabelText, { color }]}>{s.gravedad.toUpperCase()} — {s.tipo}</Text>
                  <Text style={styles.alertaLabelText}>{s.estatus}</Text>
                </View>
                <Text style={styles.alertaTexto}>{s.conductor} · {s.zona}</Text>
                <Text style={[styles.sub, { marginTop: 2 }]}>{s.descripcion}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Conductores para reactivar */}
      <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
        <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
          <View style={styles.seccionHeader}>
            <Ionicons name="flash-outline" size={18} color={Brand.accent} />
            <Text style={[styles.seccionTitulo, { color: Brand.accent }]}>Conductores para reactivar</Text>
            <View style={{backgroundColor:'#F1F5F9',paddingHorizontal:6,paddingVertical:2,borderRadius:4}}>
              <Text style={{fontSize:9,color:'#64748B',fontWeight:'700'}}>HISTÓRICO</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setModalCant(true)} style={styles.chipSmall}>
            <Ionicons name="options-outline" size={14} color={Brand.accent} />
            <Text style={styles.chipSmallText}>Cantidad: {cantidad}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sub}>Conductores inactivos o sancionados con buen historial de entregas. Recuperar flota existente con un bono es mas economico que reclutar nuevos conductores.</Text>

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

      {/* Modal cantidad reactivacion */}
      <Modal visible={modalCant} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Cantidad mostrada</Text>
            <Text style={styles.modalSub}>Conductores a mostrar en la lista de reactivacion</Text>
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

      {/* Modal cantidad sancionados */}
      <Modal visible={modalSanc} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Conductores sancionados</Text>
            <Text style={styles.modalSub}>
              Cantidad a mostrar ({sancionados.length} sancionados en total)
            </Text>
            <TextInput
              style={styles.input}
              placeholder={`Max: ${sancionados.length}`}
              keyboardType="numeric"
              value={cantidadSancInput}
              onChangeText={setCantidadSancInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={[styles.btn, { backgroundColor: Brand.red }]} onPress={aplicarCantSanc}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalSanc(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: Brand.subtext, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal cantidad zonas */}
      <Modal visible={modalZonas} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Zonas a mostrar</Text>
            <Text style={styles.modalSub}>
              Cuantas zonas quieres ver, ordenadas por prioridad de abastecimiento.
              Deja en blanco o pon 0 para ver todas ({porZona.length}).
            </Text>
            <TextInput
              style={styles.input}
              placeholder={`Todas (${porZona.length})`}
              keyboardType="numeric"
              value={cantidadZonasInput}
              onChangeText={setCantidadZonasInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={[styles.btn, { backgroundColor: Brand.green }]} onPress={aplicarCantZonas}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalZonas(false)} style={{ marginTop: 12 }}>
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
  progressBar:     { height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden', marginBottom: 6, flexDirection: 'row' },
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
  sancionStats:    { flexDirection: 'row', gap: 16, marginBottom: 4 },
  sancionStat:     { alignItems: 'center' },
  sancionNum:      { fontSize: 16, fontWeight: 'bold', color: Brand.text },
  sancionLbl:      { fontSize: 10, color: Brand.subtext },
  chipSmall:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: Brand.accent },
  chipSmallText:   { fontSize: 12, color: Brand.accent, fontWeight: '600' },
  modalBg:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  modalCard:       { backgroundColor: Brand.card, borderRadius: 16, padding: 24 },
  modalTitulo:     { fontSize: 16, fontWeight: 'bold', color: Brand.text, marginBottom: 6 },
  modalSub:        { fontSize: 12, color: Brand.subtext, marginBottom: 16, lineHeight: 18 },
  input:           { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, color: Brand.text, marginBottom: 16, fontSize: 16 },
  btn:             { backgroundColor: Brand.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
});
