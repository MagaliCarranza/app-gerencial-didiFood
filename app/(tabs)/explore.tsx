import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const API = 'http://192.168.0.9:3000';

export default function ReporteScreen() {
  const [loading, setLoading] = useState(false);

  const generarPDF = async () => {
    setLoading(true);
    try {
      const [p, i, t, c, r] = await Promise.all([
        fetch(`${API}/kpi/total-pedidos`).then(r => r.json()),
        fetch(`${API}/kpi/ingresos`).then(r => r.json()),
        fetch(`${API}/kpi/tiempo-entrega`).then(r => r.json()),
        fetch(`${API}/kpi/cancelaciones`).then(r => r.json()),
        fetch(`${API}/kpi/top-restaurantes`).then(r => r.json()),
      ]);

      const restaurantesHTML = r.map((rest: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td>${rest.nombre}</td>
          <td>${Number(rest.total_pedidos).toLocaleString()}</td>
        </tr>
      `).join('');

      const html = `
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; }
            h1 { color: #FF6B35; font-size: 28px; margin-bottom: 4px; }
            h2 { color: #475569; font-size: 16px; font-weight: normal; margin-bottom: 40px; }
            .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .kpi-card { background: #f8fafc; border-left: 4px solid #FF6B35; padding: 20px; border-radius: 8px; }
            .kpi-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; }
            .kpi-value { font-size: 28px; font-weight: bold; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #FF6B35; color: white; padding: 12px; text-align: left; }
            td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background: #f8fafc; }
            .footer { margin-top: 60px; font-size: 11px; color: #94a3b8; text-align: center; }
            .cancelacion { display: flex; gap: 40px; margin: 20px 0; }
            .cancel-item { text-align: center; }
            .cancel-num { font-size: 36px; font-weight: bold; }
            .cancel-label { font-size: 13px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <h1>DiDi Food — Informe Gerencial</h1>
          <h2>Reporte generado el ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</h2>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Total de pedidos</div>
              <div class="kpi-value">${Number(p.total).toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Ingresos totales</div>
              <div class="kpi-value">$${Number(i.ingresos).toLocaleString()}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Tiempo promedio de entrega</div>
              <div class="kpi-value">${t.promedio} min</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">Tasa de cancelación</div>
              <div class="kpi-value">${c.porcentaje}%</div>
            </div>
          </div>

          <h2 style="font-size:18px; font-weight:bold; color:#1e293b;">Cancelaciones</h2>
          <div class="cancelacion">
            <div class="cancel-item">
              <div class="cancel-num" style="color:#22c55e">${(100 - Number(c.porcentaje)).toFixed(1)}%</div>
              <div class="cancel-label">Pedidos completados</div>
            </div>
            <div class="cancel-item">
              <div class="cancel-num" style="color:#ef4444">${c.porcentaje}%</div>
              <div class="cancel-label">Pedidos cancelados</div>
            </div>
            <div class="cancel-item">
              <div class="cancel-num" style="color:#1e293b">${Number(c.cancelados).toLocaleString()}</div>
              <div class="cancel-label">Total cancelados</div>
            </div>
          </div>

          <h2 style="font-size:18px; font-weight:bold; color:#1e293b;">Top 5 restaurantes por pedidos</h2>
          <table>
            <tr>
              <th>#</th>
              <th>Restaurante</th>
              <th>Total pedidos</th>
            </tr>
            ${restaurantesHTML}
          </table>

          <div class="footer">
            Informe confidencial — DiDi Food © ${new Date().getFullYear()} — Uso exclusivo para gerentes
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Informe gerencial</Text>
      <Text style={styles.subtitle}>Genera el reporte en PDF</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>¿Qué incluye el PDF?</Text>
        <Text style={styles.item}>✅ Total de pedidos</Text>
        <Text style={styles.item}>✅ Ingresos totales</Text>
        <Text style={styles.item}>✅ Tiempo promedio de entrega</Text>
        <Text style={styles.item}>✅ Tasa de cancelación</Text>
        <Text style={styles.item}>✅ Top 5 restaurantes</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={generarPDF} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Generar PDF</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FF6B35', marginTop: 60 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  card: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 24 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 16 },
  item: { fontSize: 14, color: '#94a3b8', marginBottom: 8 },
  button: { backgroundColor: '#FF6B35', borderRadius: 12, padding: 18, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});