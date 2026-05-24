import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, Dimensions } from 'react-native';
import { VictoryBar, VictoryChart, VictoryTheme, VictoryPie, VictoryAxis } from 'victory-native';

const API = 'http://10.168.104.158:3000';
const screenWidth = Dimensions.get('window').width;

export default function HomeScreen() {
  const [pedidos, setPedidos] = useState(null);
  const [ingresos, setIngresos] = useState(null);
  const [tiempo, setTiempo] = useState(null);
  const [cancelaciones, setCancelaciones] = useState(null);
  const [topRestaurantes, setTopRestaurantes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/kpi/total-pedidos`).then(r => r.json()),
      fetch(`${API}/kpi/ingresos`).then(r => r.json()),
      fetch(`${API}/kpi/tiempo-entrega`).then(r => r.json()),
      fetch(`${API}/kpi/cancelaciones`).then(r => r.json()),
      fetch(`${API}/kpi/top-restaurantes`).then(r => r.json()),
    ]).then(([p, i, t, c, r]) => {
      setPedidos(p.total);
      setIngresos(i.ingresos);
      setTiempo(t.promedio);
      setCancelaciones(c);
      setTopRestaurantes(r);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={styles.loadingText}>Cargando KPIs...</Text>
    </View>
  );

  const pieData = [
    { x: 'Completados', y: 100 - Number(cancelaciones?.porcentaje || 0), color: '#22c55e' },
    { x: 'Cancelados', y: Number(cancelaciones?.porcentaje || 0), color: '#ef4444' },
  ];

  const barData = topRestaurantes.map((r, i) => ({
    x: r.nombre.substring(0, 10),
    y: Number(r.total_pedidos),
  }));

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>DiDi Food</Text>
      <Text style={styles.subtitle}>Panel gerencial</Text>

      {/* KPIs tarjetas */}
      <View style={styles.row}>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.label}>Total pedidos</Text>
          <Text style={styles.value}>{Number(pedidos).toLocaleString()}</Text>
        </View>
        <View style={[styles.card, styles.halfCard]}>
          <Text style={styles.label}>Tiempo entrega</Text>
          <Text style={styles.value}>{tiempo} min</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Ingresos totales</Text>
        <Text style={styles.valueLarge}>${Number(ingresos).toLocaleString()}</Text>
      </View>

      {/* Gráfica pastel cancelaciones */}
      <View style={styles.card}>
        <Text style={styles.label}>Tasa de cancelación</Text>
        <Text style={styles.cancelPct}>{cancelaciones?.porcentaje}% cancelados</Text>
        <VictoryPie
          data={pieData}
          colorScale={pieData.map(d => d.color)}
          width={screenWidth - 80}
          height={220}
          innerRadius={60}
          labels={({ datum }) => `${datum.x}\n${datum.y.toFixed(1)}%`}
          style={{ labels: { fill: '#94a3b8', fontSize: 11 } }}
        />
      </View>

      {/* Gráfica barras top restaurantes */}
      <View style={styles.card}>
        <Text style={styles.label}>Top 5 restaurantes</Text>
        <VictoryChart
          theme={VictoryTheme.material}
          width={screenWidth - 80}
          height={260}
          domainPadding={20}
        >
          <VictoryAxis
            style={{ tickLabels: { fill: '#94a3b8', fontSize: 9, angle: -20 } }}
          />
          <VictoryAxis dependentAxis
            style={{ tickLabels: { fill: '#94a3b8', fontSize: 9 } }}
          />
          <VictoryBar
            data={barData}
            style={{ data: { fill: '#FF6B35', borderRadius: 4 } }}
            animate={{ duration: 500 }}
          />
        </VictoryChart>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  loadingContainer: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 12 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FF6B35', marginTop: 60 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16 },
  halfCard: { flex: 1 },
  label: { fontSize: 12, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' },
  value: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  valueLarge: { fontSize: 32, fontWeight: 'bold', color: '#FF6B35' },
  cancelPct: { fontSize: 16, color: '#ef4444', marginBottom: 8 },
});