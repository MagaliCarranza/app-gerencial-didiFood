import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Brand } from '@/constants/theme';
import { API } from '@/constants/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu email y contraseña');
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (data.ok) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Credenciales incorrectas');
        setLoading(false);
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar con el servidor');
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('@/assets/images/repartidor.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>DiDi Food</Text>
      <Text style={styles.subtitle}>Panel gerencial</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Correo"
          placeholderTextColor={Brand.subtext}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Contraseña</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputFlex}
            placeholder="Contraseña"
            placeholderTextColor={Brand.subtext}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Brand.subtext} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Iniciar sesión</Text>
          }
        </TouchableOpacity>

        <Text style={styles.hint}>Usuario: didifood@gmail.com{'\n'}Contraseña: didi123</Text>
</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.bg, padding: 30, justifyContent: 'center' },
  logo: { width: 120, height: 120, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: 'bold', color: Brand.accent, textAlign: 'center' },
  subtitle: { fontSize: 16, color: Brand.subtext, textAlign: 'center', marginBottom: 48 },
  form: { backgroundColor: Brand.card, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  label: { fontSize: 13, color: Brand.subtext, marginBottom: 8, textTransform: 'uppercase' },
  input: { backgroundColor: Brand.bg, borderRadius: 10, padding: 14, color: Brand.text, marginBottom: 20, fontSize: 15, borderWidth: 1, borderColor: Brand.border },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Brand.bg, borderRadius: 10, borderWidth: 1, borderColor: Brand.border, marginBottom: 20 },
  inputFlex: { flex: 1, padding: 14, color: Brand.text, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 14 },
  button: { backgroundColor: Brand.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  hint: { fontSize: 11, color: Brand.subtext, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
