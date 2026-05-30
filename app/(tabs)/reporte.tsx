import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { Brand } from '@/constants/theme';

const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
const API = `http://${host}:3000`;

const fetchJSON = (url: string) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  return fetch(url, { signal: ctrl.signal })
    .then(r => r.json())
    .finally(() => clearTimeout(timer));
};

export default function ReporteScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const cargar = () => {
    setLoading(true);
    setError('');
    Promise.all([
      fetchJSON(`${API}/kpi/total-pedidos`),
      fetchJSON(`${API}/kpi/ingresos`),
      fetchJSON(`${API}/kpi/tiempo-entrega`),
      fetchJSON(`${API}/kpi/cancelaciones`),
      fetchJSON(`${API}/kpi/top-restaurantes`),
    ]).then(([pedidos, ingresos, tiempo, cancel, top]) => {
      setData({ pedidos, ingresos, tiempo, cancel, top });
      setLoading(false);
    }).catch(() => {
      setError(`No se pudo conectar con la API.\n${API}`);
      setLoading(false);
    });
  };

  useEffect(() => { cargar(); }, []);

  const generarPDF = async () => {
    if (!data) return;
    setGenerating(true);

    const { pedidos, ingresos, tiempo, cancel, top } = data;
    const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

    const barrasCancelacion = `
      <div style="display:flex; height:20px; border-radius:10px; overflow:hidden; margin:12px 0;">
        <div style="width:${100 - Number(cancel.porcentaje)}%; background:#22c55e;"></div>
        <div style="width:${cancel.porcentaje}%; background:#ef4444;"></div>
      </div>`;

    const filasTop = top.map((r: any, i: number) => `
      <tr style="border-bottom:1px solid #1B2A3F;">
        <td style="padding:10px 8px; color:#64748B;">${i + 1}</td>
        <td style="padding:10px 8px; font-weight:600;">${r.nombre}</td>
        <td style="padding:10px 8px; text-align:right; color:#FF6B35; font-weight:bold;">${Number(r.total_pedidos).toLocaleString()}</td>
      </tr>`).join('');

    const maxTop = Math.max(...top.map((r: any) => Number(r.total_pedidos)));
    const barrasTop = top.map((r: any, i: number) => `
      <div style="display:flex; align-items:center; margin-bottom:10px; gap:10px;">
        <div style="width:90px; font-size:11px; color:#64748B; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.nombre}</div>
        <div style="flex:1; height:14px; background:#0D1B2A; border-radius:7px; overflow:hidden;">
          <div style="width:${(Number(r.total_pedidos)/maxTop)*100}%; height:100%; background:${i===0?'#FF6B35':'#3b82f6'}; border-radius:7px;"></div>
        </div>
        <div style="width:50px; font-size:11px; color:#64748B; text-align:right;">${Number(r.total_pedidos).toLocaleString()}</div>
      </div>`).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; background:#0D1B2A; color:#E2E8F0; padding:40px; }
        .header { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #FF6B35; padding-bottom:20px; margin-bottom:32px; }
        .header-left h1 { font-size:28px; color:#FF6B35; font-weight:800; }
        .header-left p { color:#64748B; font-size:13px; margin-top:4px; }
        .badge { background:#FF6B35; color:#fff; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; }
        .grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:24px; }
        .kpi-card { background:#1B2A3F; border-radius:12px; padding:20px; }
        .kpi-label { font-size:10px; color:#64748B; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
        .kpi-value { font-size:26px; font-weight:800; color:#E2E8F0; }
        .kpi-value.accent { color:#FF6B35; }
        .section { background:#1B2A3F; border-radius:12px; padding:24px; margin-bottom:20px; }
        .section-title { font-size:15px; font-weight:700; color:#E2E8F0; margin-bottom:4px; }
        .section-sub { font-size:11px; color:#64748B; margin-bottom:16px; }
        table { width:100%; border-collapse:collapse; }
        th { text-align:left; padding:10px 8px; font-size:11px; color:#64748B; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #0D1B2A; }
        .cancel-stats { display:flex; justify-content:space-around; margin-bottom:12px; }
        .cancel-stat { text-align:center; }
        .cancel-stat .pct { font-size:28px; font-weight:800; }
        .cancel-stat .lbl { font-size:11px; color:#64748B; margin-top:4px; }
        .footer { text-align:center; margin-top:32px; color:#64748B; font-size:11px; border-top:1px solid #1B2A3F; padding-top:20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <h1>DiDi Food</h1>
          <p>Informe ejecutivo gerencial · ${fecha}</p>
        </div>
        <div class="badge">CONFIDENCIAL</div>
      </div>

      <div class="grid">
        <div class="kpi-card">
          <div class="kpi-label">Total pedidos</div>
          <div class="kpi-value">${Number(pedidos.total).toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Ingresos totales</div>
          <div class="kpi-value accent">$${Number(ingresos.ingresos).toLocaleString()}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Tiempo entrega prom.</div>
          <div class="kpi-value">${tiempo.promedio} <span style="font-size:14px;color:#64748B;">min</span></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Tasa de cancelación</div>
        <div class="section-sub">Distribución de pedidos completados vs cancelados</div>
        <div class="cancel-stats">
          <div class="cancel-stat">
            <div class="pct" style="color:#22c55e;">${(100 - Number(cancel.porcentaje)).toFixed(1)}%</div>
            <div class="lbl">Completados</div>
          </div>
          <div class="cancel-stat">
            <div class="pct" style="color:#ef4444;">${cancel.porcentaje}%</div>
            <div class="lbl">Cancelados</div>
          </div>
        </div>
        ${barrasCancelacion}
      </div>

      <div class="section">
        <div class="section-title">Top 5 restaurantes por volumen</div>
        <div class="section-sub">Ranking por total de pedidos recibidos</div>
        ${barrasTop}
        <table style="margin-top:16px;">
          <tr>
            <th>#</th><th>Restaurante</th><th style="text-align:right;">Pedidos</th>
          </tr>
          ${filasTop}
        </table>
      </div>

      <div class="footer">
        Generado el ${fecha} · DiDi Food — Panel Gerencial · Uso interno confidencial
      </div>
    </body>
    </html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Informe DiDi Food' });
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF');
    }
    setGenerating(false);
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Brand.accent} />
      <Text style={styles.loadingText}>Cargando datos...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.loadingContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={cargar}>
        <Text style={styles.retryText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );

  const { pedidos, ingresos, tiempo, cancel, top } = data;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Reporte PDF</Text>
      <Text style={styles.subtitle}>Informe ejecutivo gerencial</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen del informe</Text>
        <Text style={styles.cardSub}>El PDF incluye gráficas, KPIs y ranking de restaurantes</Text>

        <View style={styles.previewRow}>
          <View style={styles.previewItem}>
            <Text style={styles.previewValue}>{Number(pedidos.total).toLocaleString()}</Text>
            <Text style={styles.previewLabel}>Pedidos</Text>
          </View>
          <View style={styles.previewItem}>
            <Text style={[styles.previewValue, { color: Brand.accent }]}>${Number(ingresos.ingresos).toLocaleString()}</Text>
            <Text style={styles.previewLabel}>Ingresos</Text>
          </View>
          <View style={styles.previewItem}>
            <Text style={styles.previewValue}>{tiempo.promedio}</Text>
            <Text style={styles.previewLabel}>Min entrega</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cancelaciones</Text>
        <View style={styles.cancelRow}>
          <View style={styles.cancelStat}>
            <Text style={[styles.cancelPct, { color: Brand.green }]}>{(100 - Number(cancel.porcentaje)).toFixed(1)}%</Text>
            <Text style={styles.previewLabel}>Completados</Text>
          </View>
          <View style={styles.cancelStat}>
            <Text style={[styles.cancelPct, { color: Brand.red }]}>{cancel.porcentaje}%</Text>
            <Text style={styles.previewLabel}>Cancelados</Text>
          </View>
        </View>
        <View style={styles.barContainer}>
          <View style={[styles.barFill, { width: `${100 - Number(cancel.porcentaje)}%`, backgroundColor: Brand.green }]} />
          <View style={[styles.barFill, { width: `${cancel.porcentaje}%`, backgroundColor: Brand.red }]} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top 5 restaurantes</Text>
        {top.map((r: any, i: number) => (
          <Text key={i} style={styles.topItem}>{i + 1}. {r.nombre} — <Text style={{ color: Brand.accent }}>{Number(r.total_pedidos).toLocaleString()} pedidos</Text></Text>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={generarPDF} disabled={generating}>
        {generating
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Generar y compartir PDF</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.bg, padding: 20 },
  loadingContainer: { flex: 1, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Brand.subtext, marginTop: 12 },
  errorText: { color: Brand.red, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  retryBtn: { backgroundColor: Brand.accent, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: '#fff', fontWeight: 'bold' },
  title: { fontSize: 28, fontWeight: 'bold', color: Brand.accent, marginTop: 60 },
  subtitle: { fontSize: 14, color: Brand.subtext, marginBottom: 24 },
  card: { backgroundColor: Brand.card, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: Brand.text, marginBottom: 4 },
  cardSub: { fontSize: 12, color: Brand.subtext, marginBottom: 16 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-around' },
  previewItem: { alignItems: 'center' },
  previewValue: { fontSize: 20, fontWeight: 'bold', color: Brand.text },
  previewLabel: { fontSize: 11, color: Brand.subtext, marginTop: 4 },
  cancelRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  cancelStat: { alignItems: 'center' },
  cancelPct: { fontSize: 28, fontWeight: 'bold' },
  barContainer: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
  barFill: { height: 12 },
  topItem: { color: Brand.text, fontSize: 14, marginBottom: 8 },
  button: { backgroundColor: Brand.accent, borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 40 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
