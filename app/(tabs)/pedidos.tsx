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
  const [propinas,   setPropinas]   = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [anioSel, setAnioSel] = useState(2024);

  // Metas por año específico
  const [metaAnual,       setMetaAnual]       = useState(0);
  const [metasMensuales,  setMetasMensuales]  = useState<Record<number, number>>({});
  const [modalMeta,       setModalMeta]       = useState(false);
  const [tabMeta,         setTabMeta]         = useState<'anual' | 'mensual'>('anual');
  const [mesSel,          setMesSel]          = useState(1);
  const [metaInput,       setMetaInput]       = useState('');

  // Zonas con mayor tiempo + conductores por zona
  const [tiemposPorZona,          setTiemposPorZona]          = useState<any[]>([]);
  const [conductoresPorZona,      setConductoresPorZona]      = useState<any[]>([]);
  const [zonaExpandida,           setZonaExpandida]           = useState<string | null>(null);
  const [loadingZonas,            setLoadingZonas]            = useState(false);
  const [cantidadZonasLentas,     setCantidadZonasLentas]     = useState(8);
  const [cantidadZonasLentasInput,setCantidadZonasLentasInput]= useState('8');
  const [modalZonasLentas,        setModalZonasLentas]        = useState(false);
  const [cantidadRatioZonas,      setCantidadRatioZonas]      = useState(5);
  const [cantidadRatioZonasInput, setCantidadRatioZonasInput] = useState('5');
  const [modalRatioZonas,         setModalRatioZonas]         = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('pedidos_zonas_lentas_cantidad').then(v => {
      if (v) { setCantidadZonasLentas(parseInt(v)); setCantidadZonasLentasInput(v); }
    });
    AsyncStorage.getItem('pedidos_ratio_zonas_cantidad').then(v => {
      if (v) { setCantidadRatioZonas(parseInt(v)); setCantidadRatioZonasInput(v); }
    });
  }, []);

  const aplicarZonasLentas = () => {
    const n = parseInt(cantidadZonasLentasInput);
    if (n > 0) { AsyncStorage.setItem('pedidos_zonas_lentas_cantidad', String(n)); setCantidadZonasLentas(n); }
    setModalZonasLentas(false);
  };
  const aplicarRatioZonas = () => {
    const n = parseInt(cantidadRatioZonasInput);
    if (n > 0) { AsyncStorage.setItem('pedidos_ratio_zonas_cantidad', String(n)); setCantidadRatioZonas(n); }
    setModalRatioZonas(false);
  };

  const cargar = useCallback(() => {
    setLoading(true); setError('');
    Promise.all([
      fetchJSON(`${API}/pedidos/por-periodo`),
      fetchJSON(`${API}/pedidos/por-estatus`),
      fetchJSON(`${API}/pedidos/tiempos`),
      fetchJSON(`${API}/pedidos/clientes-nuevos`),
      fetchJSON(`${API}/pedidos/ratio-envio`),
      fetchJSON(`${API}/pedidos/propinas`).catch(() => null),
    ]).then(([pp, pe, ti, cl, ra, prop]) => {
      setPorPeriodo(pp); setPorEstatus(pe); setTiempos(ti);
      setClientes(cl); setRatio(ra); setPropinas(prop); setLoading(false);
    }).catch(() => { setError('Error cargando datos'); setLoading(false); });
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Al cambiar el año: cargar metas del año y datos de zonas
  useEffect(() => {
    setMetaAnual(0);
    setMetasMensuales({});
    setZonaExpandida(null);

    AsyncStorage.getItem(`meta_anual_${anioSel}`).then(v => {
      setMetaAnual(v ? parseInt(v) : 0);
    });

    const claves = Array.from({ length: 12 }, (_, i) => `meta_mensual_${anioSel}_${i + 1}`);
    AsyncStorage.multiGet(claves).then(pares => {
      const obj: Record<number, number> = {};
      pares.forEach(([clave, val]) => {
        if (val) {
          const mes = parseInt(clave.split('_').pop()!);
          obj[mes] = parseInt(val);
        }
      });
      setMetasMensuales(obj);
    });

    setLoadingZonas(true);
    Promise.all([
      fetchJSON(`${API}/pedidos/tiempos-por-zona?anio=${anioSel}`),
      fetchJSON(`${API}/conductores/tiempos-por-zona?anio=${anioSel}`),
    ]).then(([tzs, czs]) => {
      setTiemposPorZona(tzs);
      setConductoresPorZona(czs);
    }).catch(() => {
      setTiemposPorZona([]);
      setConductoresPorZona([]);
    }).finally(() => setLoadingZonas(false));
  }, [anioSel]);

  const guardarMeta = () => {
    const n = parseInt(metaInput);
    if (tabMeta === 'anual') {
      if (n > 0) {
        AsyncStorage.setItem(`meta_anual_${anioSel}`, String(n));
        setMetaAnual(n);
      } else {
        AsyncStorage.removeItem(`meta_anual_${anioSel}`);
        setMetaAnual(0);
      }
    } else {
      if (n > 0) {
        AsyncStorage.setItem(`meta_mensual_${anioSel}_${mesSel}`, String(n));
        setMetasMensuales(prev => ({ ...prev, [mesSel]: n }));
      } else {
        AsyncStorage.removeItem(`meta_mensual_${anioSel}_${mesSel}`);
        setMetasMensuales(prev => {
          const c = { ...prev };
          delete c[mesSel];
          return c;
        });
      }
    }
    setModalMeta(false);
    setMetaInput('');
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Brand.accent} /></View>;
  if (error)   return <View style={styles.center}><Text style={{ color: Brand.red }}>{error}</Text></View>;

  const porMesAnio = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const rows = porPeriodo.filter(r => r.anio === anioSel && r.mes === mes);
    const total      = rows.reduce((a, r) => a + r.total, 0);
    const entregados = rows.reduce((a, r) => a + r.entregados, 0);
    return { mes, total, entregados, label: MESES[mes] };
  });

  const metaDelMes = (mes: number) =>
    metasMensuales[mes] ?? (metaAnual > 0 ? Math.round(metaAnual / 12) : 0);

  const barDataPedidos = porMesAnio.map(r => {
    const meta = metaDelMes(r.mes);
    return {
      value: r.entregados,
      label: r.label,
      frontColor: meta > 0
        ? (r.entregados >= meta ? Brand.green : Brand.blue)
        : Brand.blue,
    };
  });

  const tiemposAnio    = tiempos.filter(t => t.anio === anioSel);
  const lineDataTiempos = tiemposAnio.map(t => ({ value: t.promedio, label: MESES[t.mes] }));
  const tiempoPromAnio  = tiemposAnio.length > 0
    ? (tiemposAnio.reduce((a, t) => a + t.promedio, 0) / tiemposAnio.length).toFixed(1)
    : null;

  const ratioAnio    = (ratio?.por_mes ?? []).filter((r: any) => r.anio === anioSel);
  const lineDataRatio = ratioAnio.map((r: any) => ({ value: r.ratio_pct, label: MESES[r.mes] }));

  const totalAnio      = porMesAnio.reduce((a, r) => a + r.total, 0);
  const entregadosAnio = porMesAnio.reduce((a, r) => a + r.entregados, 0);
  const metaPct        = metaAnual > 0 ? Math.round((entregadosAnio / metaAnual) * 100) : null;

  const anios = [...new Set(porPeriodo.map(r => r.anio))].sort();

  const conductoresDeZona = (zona: string) =>
    (conductoresPorZona.find(z => z.zona === zona)?.conductores ?? []);

  const mesesConMeta = Object.keys(metasMensuales).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      <View style={styles.headerBg}>
        <Text style={styles.titulo}>Pedidos</Text>
        <Text style={styles.subtitulo}>Analisis operativo</Text>
      </View>

      {/* Selector de año */}
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
              <Text style={styles.statLbl}>vs Meta anual</Text>
            </View>
          )}
        </View>

        {metaAnual > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, {
              width: `${Math.min(metaPct ?? 0, 100)}%`,
              backgroundColor: (metaPct ?? 0) >= 100 ? Brand.green : Brand.blue,
            }]} />
          </View>
        )}

        {/* Botones de metas */}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity
            style={styles.metaBtn}
            onPress={() => {
              setTabMeta('anual');
              setMetaInput(metaAnual > 0 ? String(metaAnual) : '');
              setModalMeta(true);
            }}
          >
            <Ionicons name="flag-outline" size={14} color={Brand.blue} />
            <Text style={[styles.metaBtnText, { color: Brand.blue }]}>
              {metaAnual > 0 ? `Meta anual: ${metaAnual.toLocaleString()}` : `Establecer meta anual ${anioSel}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.metaBtn}
            onPress={() => {
              setTabMeta('mensual');
              setMesSel(new Date().getMonth() + 1);
              setMetaInput('');
              setModalMeta(true);
            }}
          >
            <Ionicons name="calendar-outline" size={14} color={Brand.blue} />
            <Text style={[styles.metaBtnText, { color: Brand.blue }]}>
              {mesesConMeta > 0 ? `Metas mensuales (${mesesConMeta} meses)` : 'Metas por mes'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Resumen de metas mensuales */}
        {mesesConMeta > 0 && (
          <View style={[styles.alertaRow, { borderLeftColor: Brand.blue, marginTop: 8, marginBottom: 0 }]}>
            <View style={styles.alertaLabel}>
              <Text style={styles.alertaLabelText}>METAS MENSUALES {anioSel}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(mes =>
                metasMensuales[mes] ? (
                  <View key={mes} style={styles.metaMesBadge}>
                    <Text style={styles.metaMesLbl}>{MESES[mes]}</Text>
                    <Text style={styles.metaMesVal}>{metasMensuales[mes].toLocaleString()}</Text>
                  </View>
                ) : null
              )}
            </View>
          </View>
        )}

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
        {(metaAnual > 0 || mesesConMeta > 0) && (
          <Text style={[styles.sub, { marginTop: 6 }]}>
            Verde = alcanza meta · Azul = por debajo de meta
          </Text>
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

      {/* SECCION 3: Tiempos de entrega + detalle por zona */}
      <View style={[styles.card, { backgroundColor: Brand.cardOrange }]}>
        <SeccionHeader titulo="Tiempos de entrega (min)" icon="time-outline" color={Brand.accent} />
        {tiempoPromAnio && (
          <Text style={styles.sub}>Promedio {anioSel}: {tiempoPromAnio} min</Text>
        )}
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

        {/* Zonas con mayor tiempo de entrega */}
        <View style={[styles.separador]} />
        <View style={[styles.seccionHeader, { justifyContent: 'space-between' }]}>
          <View style={styles.seccionHeader}>
            <Ionicons name="alert-circle-outline" size={16} color={Brand.accent} />
            <Text style={[styles.seccionTitulo, { color: Brand.accent, fontSize: 13 }]}>
              Zonas con mayor tiempo
            </Text>
          </View>
          <TouchableOpacity onPress={() => setModalZonasLentas(true)} style={styles.chipFiltro}>
            <Ionicons name="options-outline" size={13} color={Brand.accent} />
            <Text style={styles.chipFiltroTxt}>Ver: {cantidadZonasLentas}</Text>
          </TouchableOpacity>
        </View>

        {loadingZonas ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <ActivityIndicator size="small" color={Brand.accent} />
            <Text style={[styles.sub, { marginTop: 4 }]}>Cargando datos de zonas...</Text>
          </View>
        ) : tiemposPorZona.length > 0 ? (
          <>
            <Text style={[styles.sub, { marginBottom: 8 }]}>
              Toca una zona para comparar el desempeno de sus conductores
            </Text>
            {tiemposPorZona.slice(0, cantidadZonasLentas).map((z, i) => {
              const expandida = zonaExpandida === z.zona;
              const conds     = conductoresDeZona(z.zona);
              const colorBorde = i < 3 ? Brand.red : i < 6 ? '#F59E0B' : Brand.subtext;
              const colorTiempo = i < 3 ? Brand.red : i < 6 ? '#D97706' : Brand.text;
              return (
                <View key={i}>
                  <TouchableOpacity
                    style={[styles.zonaLentaRow, { borderLeftColor: colorBorde }]}
                    onPress={() => setZonaExpandida(expandida ? null : z.zona)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zonaLentaNombre} numberOfLines={1}>{z.zona}</Text>
                      <Text style={styles.sub}>{z.municipio} · {z.total_pedidos} pedidos</Text>
                    </View>
                    <View style={styles.tiempoBox}>
                      <Text style={[styles.tiempoVal, { color: colorTiempo }]}>{z.tiempo_promedio}</Text>
                      <Text style={styles.tiempoLbl}>min prom.</Text>
                    </View>
                    <View style={styles.tiempoRange}>
                      <Text style={styles.tiempoRangeTxt}>{z.tiempo_minimo}–{z.tiempo_maximo}</Text>
                      <Text style={styles.tiempoLbl}>rango min</Text>
                    </View>
                    <Ionicons
                      name={expandida ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={Brand.subtext}
                      style={{ marginLeft: 6 }}
                    />
                  </TouchableOpacity>

                  {expandida && (
                    <View style={styles.conductoresZona}>
                      {conds.length > 0 ? (
                        <>
                          <Text style={[styles.sub, { marginBottom: 6, fontWeight: '600' }]}>
                            Conductores en {z.zona} — del mas rapido al mas lento:
                          </Text>
                          {conds.map((c: any, j: number) => (
                            <View key={j} style={styles.condZonaRow}>
                              <View style={[styles.condRankBadge, {
                                backgroundColor:
                                  j === 0 ? Brand.green :
                                  j === conds.length - 1 ? Brand.red : Brand.border,
                              }]}>
                                <Text style={{
                                  fontSize: 11, fontWeight: '700',
                                  color: j === 0 || j === conds.length - 1 ? '#fff' : Brand.subtext,
                                }}>{j + 1}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.condZonaNombre}>{c.conductor}</Text>
                                <Text style={styles.sub}>{c.tipo_vehiculo} · {c.total_entregas} entregas</Text>
                              </View>
                              <Text style={[styles.condZonaTiempo, {
                                color:
                                  j === 0 ? Brand.green :
                                  j === conds.length - 1 ? Brand.red : Brand.text,
                              }]}>
                                {c.tiempo_promedio} min
                              </Text>
                            </View>
                          ))}
                          {conds.length >= 2 && (
                            <View style={[styles.alertaRow, { borderLeftColor: Brand.subtext, marginTop: 6 }]}>
                              <Text style={styles.alertaTexto}>
                                Diferencia entre el mas rapido y el mas lento:{' '}
                                <Text style={{ fontWeight: '700' }}>
                                  {(conds[conds.length - 1].tiempo_promedio - conds[0].tiempo_promedio).toFixed(1)} min
                                </Text>
                              </Text>
                            </View>
                          )}
                        </>
                      ) : (
                        <Text style={styles.sub}>Sin datos de conductores para esta zona en {anioSel}</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        ) : (
          <Text style={styles.noData}>Sin datos de zonas para {anioSel}</Text>
        )}
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

        <View style={[styles.seccionHeader, { justifyContent: 'space-between', marginTop: 8 }]}>
          <Text style={[styles.sub, { fontWeight: '600', color: Brand.purple }]}>Zonas con mayor costo de envio</Text>
          <TouchableOpacity onPress={() => setModalRatioZonas(true)} style={styles.chipFiltro}>
            <Ionicons name="options-outline" size={13} color={Brand.purple} />
            <Text style={[styles.chipFiltroTxt, { color: Brand.purple }]}>Ver: {cantidadRatioZonas}</Text>
          </TouchableOpacity>
        </View>
        {ratio?.por_zona?.slice(0, cantidadRatioZonas).map((z: any, i: number) => (
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

      {/* SECCION 5: Propinas */}
      {propinas && (
        <View style={[styles.card, { backgroundColor: Brand.cardYellow }]}>
          <SeccionHeader titulo="Analisis de propinas" icon="gift-outline" color="#D97706" />
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#D97706' }]}>{propinas.global.tasa_pct}%</Text>
              <Text style={styles.statLbl}>Pedidos con propina</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#D97706' }]}>${propinas.global.propina_promedio}</Text>
              <Text style={styles.statLbl}>Promedio</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: Brand.green }]}>
                ${(propinas.global.propinas_total / 1000).toFixed(1)}k
              </Text>
              <Text style={styles.statLbl}>Total hist.</Text>
            </View>
          </View>

          {propinas.por_mes?.length > 0 && (() => {
            const mesData = propinas.por_mes.filter((m: any) => m.anio === anioSel);
            const barPropinas = mesData.map((m: any) => ({
              value: m.tasa_propina_pct,
              label: MESES[m.mes],
              frontColor: m.tasa_propina_pct > 40 ? Brand.green : '#D97706',
            }));
            return barPropinas.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <BarChart
                  data={barPropinas}
                  barWidth={22}
                  spacing={8}
                  noOfSections={4}
                  yAxisTextStyle={{ color: Brand.subtext, fontSize: 10 }}
                  xAxisLabelTextStyle={{ color: Brand.subtext, fontSize: 10 }}
                  hideRules
                  barBorderRadius={4}
                  height={130}
                />
              </ScrollView>
            ) : null;
          })()}

          <View style={[styles.alertaRow, { borderLeftColor: '#D97706', marginTop: 8 }]}>
            <View style={styles.alertaLabel}>
              <Text style={styles.alertaLabelText}>OPORTUNIDAD</Text>
            </View>
            <Text style={styles.alertaTexto}>
              Mostrar sugerencia de propina en la pantalla de confirmacion aumenta la tasa hasta un 55% y mejora la retencion de conductores
            </Text>
          </View>
        </View>
      )}

      {/* Modal zonas lentas */}
      <Modal visible={modalZonasLentas} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Zonas lentas a mostrar</Text>
            <Text style={styles.modalSub}>Cantidad de zonas con mayor tiempo de entrega ({tiemposPorZona.length} disponibles para {anioSel})</Text>
            <TextInput
              style={styles.input}
              placeholder={`Max: ${tiemposPorZona.length}`}
              keyboardType="numeric"
              value={cantidadZonasLentasInput}
              onChangeText={setCantidadZonasLentasInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={styles.btn} onPress={aplicarZonasLentas}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalZonasLentas(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: Brand.subtext, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal ratio zonas */}
      <Modal visible={modalRatioZonas} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Zonas de envio a mostrar</Text>
            <Text style={styles.modalSub}>Cantidad de zonas en el ranking de costo de envio ({ratio?.por_zona?.length ?? 0} disponibles)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 8"
              keyboardType="numeric"
              value={cantidadRatioZonasInput}
              onChangeText={setCantidadRatioZonasInput}
              placeholderTextColor={Brand.subtext}
            />
            <TouchableOpacity style={[styles.btn, { backgroundColor: Brand.purple }]} onPress={aplicarRatioZonas}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Aplicar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalRatioZonas(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: Brand.subtext, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal metas (anual + mensual por año específico) */}
      <Modal visible={modalMeta} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Metas de pedidos {anioSel}</Text>

            {/* Tabs Anual / Mensual */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, tabMeta === 'anual' && styles.tabActive]}
                onPress={() => {
                  setTabMeta('anual');
                  setMetaInput(metaAnual > 0 ? String(metaAnual) : '');
                }}
              >
                <Text style={[styles.tabTxt, tabMeta === 'anual' && styles.tabTxtActive]}>Anual</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tabMeta === 'mensual' && styles.tabActive]}
                onPress={() => {
                  setTabMeta('mensual');
                  setMetaInput(metasMensuales[mesSel] ? String(metasMensuales[mesSel]) : '');
                }}
              >
                <Text style={[styles.tabTxt, tabMeta === 'mensual' && styles.tabTxtActive]}>Por mes</Text>
              </TouchableOpacity>
            </View>

            {tabMeta === 'anual' ? (
              <>
                <Text style={styles.modalSub}>
                  Meta total de pedidos entregados para todo {anioSel}.
                  {metaAnual > 0 ? ` Actual: ${metaAnual.toLocaleString()}` : ''}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: 70000"
                  keyboardType="numeric"
                  value={metaInput}
                  onChangeText={setMetaInput}
                  placeholderTextColor={Brand.subtext}
                />
              </>
            ) : (
              <>
                <Text style={styles.modalSub}>
                  Selecciona el mes y establece su meta individual.
                  Los puntos indican meses con meta ya configurada.
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.mesMiniChip, mesSel === m && styles.mesMiniChipActive]}
                        onPress={() => {
                          setMesSel(m);
                          setMetaInput(metasMensuales[m] ? String(metasMensuales[m]) : '');
                        }}
                      >
                        <Text style={[styles.mesMiniTxt, mesSel === m && { color: '#fff' }]}>
                          {MESES[m]}
                        </Text>
                        {metasMensuales[m] ? <View style={styles.mesDot} /> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <TextInput
                  style={styles.input}
                  placeholder={`Meta para ${MESES[mesSel]} (0 para borrar)`}
                  keyboardType="numeric"
                  value={metaInput}
                  onChangeText={setMetaInput}
                  placeholderTextColor={Brand.subtext}
                />
              </>
            )}

            <TouchableOpacity style={styles.btn} onPress={guardarMeta}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setModalMeta(false); setMetaInput(''); }} style={{ marginTop: 12 }}>
              <Text style={{ color: Brand.subtext, textAlign: 'center' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: Brand.bg },
  center:           { flex: 1, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  headerBg:         { backgroundColor: Brand.headerDark, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  titulo:           { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF' },
  subtitulo:        { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  card:             { borderRadius: 16, padding: 16, margin: 16, marginBottom: 0, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  seccionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  seccionTitulo:    { fontSize: 14, fontWeight: '700', color: Brand.text },
  chips:            { flexDirection: 'row', gap: 8, margin: 16, marginBottom: 0 },
  chip:             { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border },
  chipActive:       { backgroundColor: Brand.accent, borderColor: Brand.accent },
  chipText:         { color: Brand.subtext, fontSize: 13, fontWeight: '600' },
  chipTextActive:   { color: '#fff' },
  statsRow:         { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  statBox:          { alignItems: 'center' },
  statVal:          { fontSize: 20, fontWeight: 'bold', color: Brand.text },
  statLbl:          { fontSize: 11, color: Brand.subtext, marginTop: 2 },
  progressBar:      { height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill:     { height: 8, borderRadius: 4 },
  metaBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  metaBtnText:      { fontSize: 12, fontWeight: '600' },
  metaMesBadge:     { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' },
  metaMesLbl:       { fontSize: 9, color: Brand.subtext, fontWeight: '600' },
  metaMesVal:       { fontSize: 11, color: Brand.blue, fontWeight: '700' },
  estatusRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  estatusLabel:     { width: 120, fontSize: 11, color: Brand.subtext },
  barTrack:         { flex: 1, height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  barFill:          { height: 8, borderRadius: 4 },
  estatusPct:       { width: 40, fontSize: 11, color: Brand.subtext, textAlign: 'right' },
  alertaRow:        { borderLeftWidth: 3, borderRadius: 6, padding: 10, backgroundColor: Brand.card, marginTop: 6 },
  alertaLabel:      { marginBottom: 4 },
  alertaLabelText:  { fontSize: 9, fontWeight: '800', color: Brand.subtext, textTransform: 'uppercase', letterSpacing: 0.5 },
  alertaTexto:      { fontSize: 12, color: Brand.text, flex: 1 },
  sub:              { fontSize: 11, color: Brand.subtext },
  noData:           { color: Brand.subtext, textAlign: 'center', padding: 20, fontSize: 13 },
  separador:        { height: 1, backgroundColor: Brand.border, marginVertical: 16 },
  chipFiltro:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: Brand.accent },
  chipFiltroTxt:    { fontSize: 11, color: Brand.accent, fontWeight: '600' },
  // Zonas lentas
  zonaLentaRow:     { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderRadius: 6, padding: 10, backgroundColor: Brand.card, marginBottom: 6 },
  zonaLentaNombre:  { fontSize: 13, fontWeight: '600', color: Brand.text },
  tiempoBox:        { alignItems: 'center', marginLeft: 8, minWidth: 48 },
  tiempoVal:        { fontSize: 16, fontWeight: 'bold' },
  tiempoLbl:        { fontSize: 9, color: Brand.subtext },
  tiempoRange:      { alignItems: 'center', marginLeft: 8, minWidth: 48 },
  tiempoRangeTxt:   { fontSize: 11, color: Brand.subtext, fontWeight: '600' },
  // Conductores por zona
  conductoresZona:  { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 6, marginLeft: 4 },
  condZonaRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Brand.border },
  condRankBadge:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  condZonaNombre:   { fontSize: 12, fontWeight: '600', color: Brand.text },
  condZonaTiempo:   { fontSize: 13, fontWeight: 'bold', minWidth: 52, textAlign: 'right' },
  // Modal
  modalBg:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 32 },
  modalCard:        { backgroundColor: Brand.card, borderRadius: 16, padding: 24 },
  modalTitulo:      { fontSize: 16, fontWeight: 'bold', color: Brand.text, marginBottom: 12 },
  modalSub:         { fontSize: 12, color: Brand.subtext, marginBottom: 12, lineHeight: 18 },
  tabRow:           { flexDirection: 'row', backgroundColor: Brand.border, borderRadius: 10, padding: 3, marginBottom: 16 },
  tab:              { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive:        { backgroundColor: Brand.card },
  tabTxt:           { fontSize: 13, color: Brand.subtext, fontWeight: '600' },
  tabTxtActive:     { color: Brand.accent },
  mesMiniChip:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Brand.border, alignItems: 'center' },
  mesMiniChipActive:{ backgroundColor: Brand.accent },
  mesMiniTxt:       { fontSize: 12, color: Brand.subtext, fontWeight: '600' },
  mesDot:           { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.blue, marginTop: 2 },
  input:            { borderWidth: 1, borderColor: Brand.border, borderRadius: 10, padding: 12, color: Brand.text, marginBottom: 16, fontSize: 16 },
  btn:              { backgroundColor: Brand.accent, borderRadius: 10, padding: 14, alignItems: 'center' },
});
