import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { Brand } from '@/constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const icon = (name: IoniconsName) =>
  ({ color }: { color: string }) => (
    <Ionicons name={name} size={24} color={color} />
  );

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Brand.accent,
        tabBarInactiveTintColor: Brand.subtext,
        tabBarStyle: {
          backgroundColor: Brand.card,
          borderTopColor:  Brand.border,
          shadowColor:     '#000',
          shadowOpacity:   0.08,
          shadowRadius:    8,
          height:          60,
          paddingBottom:   8,
        },
        headerShown:  false,
        tabBarButton: HapticTab,
      }}>

      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', tabBarIcon: icon('home') }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{ title: 'Pedidos', tabBarIcon: icon('receipt-outline') }}
      />
      <Tabs.Screen
        name="restaurantes"
        options={{ title: 'Restaurantes', tabBarIcon: icon('restaurant-outline') }}
      />
      <Tabs.Screen
        name="conductores"
        options={{ title: 'Conductores', tabBarIcon: icon('bicycle-outline') }}
      />
      <Tabs.Screen
        name="mas"
        options={{ title: 'Más', tabBarIcon: icon('grid-outline') }}
      />

      {/* Pantallas ocultas del proyecto anterior */}
      <Tabs.Screen name="explore"  options={{ href: null }} />
      <Tabs.Screen name="graficas" options={{ href: null }} />
      <Tabs.Screen name="reporte"  options={{ href: null }} />
    </Tabs>
  );
}
