"""
DidiFood – Generador v4
========================
Cambios vs v3:
• Fechas extendidas: 2020-01-01 -> 2026-05-29
• pedidos:  +propina, +distancia_km, +tiempo_prep_min, +es_primera_orden
• usuarios: +canal_adquisicion, +dispositivo
• NUEVO: detalle_pedidos  (productos reales por pedido)
• NUEVO: calificaciones   (rating individual por pedido entregado)
• NUEVO: sanciones_conductores (historial detallado con motivo y gravedad)
• NUEVO: combos + combo_productos
"""

import csv, os, random
from datetime import datetime, timedelta

random.seed(42)

# ─── ESCALA ───────────────────────────────────────────────────────────────────
NUM_USUARIOS            = 2_000
NUM_CONDUCTORES         = 500
PEDIDOS_MIN_POR_USUARIO = 80
PEDIDOS_EXTRA           = 40_000

# ─── FECHAS ───────────────────────────────────────────────────────────────────
FECHA_BASE = datetime(2020, 1, 1,  9,  0, 0)
FECHA_FIN  = datetime(2026, 5, 29, 23, 59, 0)
RANGO_DIAS = (FECHA_FIN - FECHA_BASE).days

# ─── CATÁLOGOS GENERALES ──────────────────────────────────────────────────────
CANALES_ADQUISICION = ['organico', 'referido', 'promocion', 'red_social']
PESOS_CANAL         = [50, 25, 15, 10]

DISPOSITIVOS      = ['android', 'ios', 'web']
PESOS_DISPOSITIVO = [65, 30, 5]

TIPOS_VEHICULO = ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Motocicleta']
ESTATUS_DRIVER = ['Activo', 'Inactivo', 'Sancionado']
METODOS_PAGO   = ['Efectivo', 'Tarjeta', 'Transferencia']

ESTATUS_PEDIDO = [
    (1, 'Pendiente'),
    (2, 'Confirmado'),
    (3, 'En preparacion'),
    (4, 'Listo para recoger'),
    (5, 'En camino'),
    (6, 'Entregado'),
    (7, 'Cancelado por el cliente'),
    (8, 'Cancelado por el restaurante'),
    (9, 'Cancelado por el conductor'),
]
PESOS_ESTATUS = [5, 10, 12, 8, 15, 38, 5, 4, 3]

# ─── COLONIAS PERIFÉRICAS (costo de envío y distancia diferenciados) ──────────
COLONIAS_PERIFERICAS = {
    'San Jacinto Amilpas', 'Santa Cruz Amilpas', 'San Agustín de las Juntas',
    'Tlalixtac de Cabrera', 'San Andrés Huayapam', 'Santa María del Tule',
    'Cuilápam de Guerrero', 'Zaachila', 'Etla', 'Tlacolula de Matamoros',
}

# ─── SANCIONES ────────────────────────────────────────────────────────────────
TIPOS_SANCION = [
    'calificacion_baja', 'abandono_pedido', 'reporte_usuario',
    'accidente', 'incumplimiento_protocolo', 'demora_excesiva', 'fraude',
]
PESOS_SANCION = [30, 25, 20, 8, 8, 7, 2]
GRAVEDADES    = ['leve', 'moderada', 'grave']

PESOS_GRAVEDAD = {
    'calificacion_baja':        [50, 40, 10],
    'abandono_pedido':          [20, 50, 30],
    'reporte_usuario':          [30, 40, 30],
    'accidente':                [40, 40, 20],
    'incumplimiento_protocolo': [60, 35,  5],
    'demora_excesiva':          [70, 25,  5],
    'fraude':                   [ 0, 30, 70],
}

DESCRIPCIONES_SANCION = {
    'calificacion_baja': [
        'Calificacion promedio por debajo de 3.5 durante 4 semanas consecutivas',
        'Multiples reportes de mal trato a usuarios en el ultimo mes',
        'Calificacion cayo a 3.2 tras 15 reportes negativos en 30 dias',
        'Promedio de 2.8 estrellas en las ultimas 50 entregas',
    ],
    'abandono_pedido': [
        'Abandono 4 pedidos confirmados en una semana sin justificacion',
        'No se presento a recoger pedido en restaurante confirmado 3 veces consecutivas',
        'Acepto pedido y desconecto la app sin entregar en 2 ocasiones',
        'Dejo 6 pedidos sin entregar en el ultimo mes reportados por usuarios',
    ],
    'reporte_usuario': [
        'Tres reportes de usuario por comportamiento inapropiado durante entrega',
        'Usuario reporto que el conductor marco como entregado sin realizar entrega',
        'Reporte formal de usuario por cobro adicional no autorizado de $50',
        'Dos reportes de usuario por llegar en estado inadecuado para operar',
    ],
    'accidente': [
        'Involucrado en accidente de transito menor durante entrega activa',
        'Colision con otro vehiculo en zona de alta demanda, sin lesionados',
        'Accidente en motocicleta con danos al vehiculo durante turno activo',
    ],
    'incumplimiento_protocolo': [
        'Incumplimiento de protocolos de entrega en zona de acceso restringido',
        'No portaba equipamiento de identificacion requerido en multiples entregas',
        'Uso de ruta no autorizada detectado por sistema GPS en 5 ocasiones',
        'Entrego pedido a persona diferente al destinatario sin verificacion',
    ],
    'demora_excesiva': [
        'Tiempo promedio de entrega supero 90 minutos en 10 pedidos consecutivos',
        'Multiples quejas de demora superior a 2 horas sin justificacion valida',
        'Patron de demora detectado en zona Centro Historico durante horas pico',
    ],
    'fraude': [
        'Intento de cobro duplicado detectado por sistema automatico de pagos',
        'Manipulacion de datos de ubicacion reportada por auditoria de GPS',
        'Registro de entregas falsas confirmado por revision de evidencias',
    ],
}

# ─── COMENTARIOS CALIFICACIONES ───────────────────────────────────────────────
COMENTARIOS_CAL = [
    'Excelente servicio, muy rapido',
    'La comida llego calientita y bien presentada',
    'El conductor fue muy amable y puntual',
    'Todo completo, sin problemas',
    'La comida estaba deliciosa, volvere a pedir',
    'Pedido bien empacado, sin derrames',
    'Un poco tardado pero llego en buen estado',
    'Podrian mejorar el tiempo de espera',
    'El pedido llego un poco frio pero sabroso',
    'Faltaron servilletas pero en general bien',
    'El conductor tuvo dificultades para ubicar la direccion',
    'Excelente experiencia, lo recomiendo ampliamente',
    'Muy buena relacion precio-calidad',
    'La porcion fue adecuada al precio',
    'El empaque podria mejorar para liquidos',
    'Rapido y sin contratiempos',
    'El restaurante tarda mucho en preparar',
    'Segunda vez que pido y siempre excelente',
]

# ─── COLONIAS REALES DE OAXACA ────────────────────────────────────────────────
COLONIAS = [
    ("Centro Histórico",                "Oaxaca de Juárez"),
    ("Colonia Reforma",                 "Oaxaca de Juárez"),
    ("Colonia Estrella",                "Oaxaca de Juárez"),
    ("Colonia Volcanes",                "Oaxaca de Juárez"),
    ("Colonia Doctores",                "Oaxaca de Juárez"),
    ("Colonia Américas",                "Oaxaca de Juárez"),
    ("Colonia Candiani",                "Oaxaca de Juárez"),
    ("Colonia Linda Vista",             "Oaxaca de Juárez"),
    ("San Felipe del Agua",             "Oaxaca de Juárez"),
    ("El Tequio",                       "Oaxaca de Juárez"),
    ("Colonia Pascual",                 "Oaxaca de Juárez"),
    ("Santa Rosa Panzacola",            "Oaxaca de Juárez"),
    ("San Martín Mexicapam",            "Oaxaca de Juárez"),
    ("Colonia del Valle",               "Oaxaca de Juárez"),
    ("Colonia Jardín",                  "Oaxaca de Juárez"),
    ("Colonia Trinidad de las Huertas", "Oaxaca de Juárez"),
    ("Colonia Aguilera",                "Oaxaca de Juárez"),
    ("San Jacinto Amilpas",             "San Jacinto Amilpas"),
    ("Santa Cruz Amilpas",              "Santa Cruz Amilpas"),
    ("San Agustín de las Juntas",       "San Agustín de las Juntas"),
    ("Tlalixtac de Cabrera",            "Tlalixtac de Cabrera"),
    ("San Andrés Huayapam",             "San Andrés Huayapam"),
    ("Santa María del Tule",            "Santa María del Tule"),
    ("Cuilápam de Guerrero",            "Cuilápam de Guerrero"),
    ("Zaachila",                        "Zaachila"),
    ("Etla",                            "San Pablo Villa de Mitla"),
    ("Tlacolula de Matamoros",          "Tlacolula de Matamoros"),
]

CALLES = [
    "Macedonio Alcalá","Porfirio Díaz","Independencia","Juárez","Hidalgo",
    "Morelos","Reforma","Constitución","García Vigil","Abasolo","Murguía",
    "Mina","Zaragoza","Crespo","Allende","Rayón","Armenta y López",
    "Las Casas","Matamoros","Valerio Trujano","Manuel Doblado","Xicoténcatl",
    "Cinco de Mayo","Niños Héroes","Benito Juárez","Universidad","Ferrocarril",
    "Símbolos Patrios","Heroico Colegio Militar","Blvd. Tecnológico",
    "Blvd. Vasconcelos","Blvd. Guadalupe Hinojosa","Calzada Madero",
    "Calzada Héroes de Chapultepec","Periférico","Av. Chapultepec",
]

NOMBRES = [
    'Fernanda','Valentina','Adriana','Ana','Carlos','Andres','Patricia',
    'Juan','Karla','Sofia','Mario','Elena','Gabriela','Diego','Miguel',
    'Daniel','Rosa','Ricardo','Paola','Eduardo','Camila','Jose',
    'Mariana','Luis','Andrea','Fernando','Ximena','Sebastian','Alejandra',
    'Raul','Natalia','Hugo','Daniela','Javier','Monica','Alberto',
    'Renata','Oscar','Lucia','Tomas','Brenda','Arturo','Claudia',
    'Roberto','Veronica','Marco','Irene','Salvador','Nadia','Ernesto',
    'Lorena','Sergio','David','Alejandro','Beatriz','Carmen','Jorge',
    'Guadalupe','Hector','Yolanda','Ignacio','Antonia',
]
APELLIDOS = [
    'Jimenez','Gonzalez','Reyes','Guerrero','Lopez','Vega','Diaz',
    'Morales','Rodriguez','Flores','Mendoza','Torres','Sanchez','Ruiz',
    'Castillo','Ortega','Salinas','Rivera','Ramos','Cruz','Hernandez',
    'Navarro','Aguilar','Pineda','Vazquez','Campos','Delgado','Rojas',
    'Cabrera','Mejia','Nunez','Ibarra','Fuentes','Solis','Molina',
    'Acosta','Escobar','Cortes','Padilla','Espinoza','Santiago','Vargas',
    'Medina','Perez','Ramirez','Chagoya','Bautista','Toledo','Aquino',
    'Velasco','Montes','Aragon','Cisneros','Leal','Pacheco','Dominguez',
    'Ochoa','Gutierrez','Carrillo','Peralta',
]

# ─── RESTAURANTES ─────────────────────────────────────────────────────────────
_DATOS_REST = [
    # ── OAXAQUEÑA (55) ─────────────────────────────────────────────────────────
    ( 1,"El Tule Negro","Oaxaqueña",9.3),( 2,"La Olla de Barro","Oaxaqueña",9.1),
    ( 3,"Tlayudas Doña Cata","Oaxaqueña",9.4),( 4,"Mole y Copal","Oaxaqueña",9.2),
    ( 5,"El Metate","Oaxaqueña",8.9),( 6,"Casa de los Sabores","Oaxaqueña",9.0),
    ( 7,"El Comal de Barro","Oaxaqueña",9.1),( 8,"Fogón Istmeño","Oaxaqueña",9.3),
    ( 9,"La Tlayuda Mayor","Oaxaqueña",9.2),(10,"Sabor Zapoteco","Oaxaqueña",8.8),
    (11,"El Tejate","Oaxaqueña",8.7),(12,"Cocina de Humo","Oaxaqueña",9.0),
    (13,"Tasajo y Punto","Oaxaqueña",9.1),(14,"La Memela Feliz","Oaxaqueña",8.6),
    (15,"Raíces Oaxaqueñas","Oaxaqueña",9.2),(16,"El Chileajo","Oaxaqueña",8.9),
    (17,"Moles del Valle","Oaxaqueña",9.3),(18,"Totopo Real","Oaxaqueña",8.8),
    (19,"La Marquesita","Oaxaqueña",8.5),(20,"Don Wenceslao","Oaxaqueña",9.0),
    (21,"Tasajo de los Valles","Oaxaqueña",9.1),(22,"El Quesillo","Oaxaqueña",8.7),
    (23,"Cocina Mixteca","Oaxaqueña",9.0),(24,"Estofado Tradicional","Oaxaqueña",8.8),
    (25,"La Coloradita","Oaxaqueña",9.2),(26,"Mole de Olla Oaxaca","Oaxaqueña",8.9),
    (27,"Empanadas del Istmo","Oaxaqueña",9.1),(28,"El Barro Cocido","Oaxaqueña",8.6),
    (29,"Atole y Tamales","Oaxaqueña",8.8),(30,"La Hierba Santa","Oaxaqueña",9.3),
    (31,"Tlayudas La Panchita","Oaxaqueña",9.0),(32,"Cocina de Doña Lupe","Oaxaqueña",8.9),
    (33,"El Amarillo Oaxaqueño","Oaxaqueña",9.1),(34,"Mole Negro Tradición","Oaxaqueña",9.4),
    (35,"Chapulines y Más","Oaxaqueña",8.5),(36,"La Tetela","Oaxaqueña",8.7),
    (37,"Cocina Zapoteca del Sur","Oaxaqueña",9.0),(38,"El Asiento de Barro","Oaxaqueña",8.8),
    (39,"Guías y Quelites","Oaxaqueña",9.2),(40,"Tamales de Hoja","Oaxaqueña",8.9),
    (41,"La Sopa de Fideo Oaxaqueña","Oaxaqueña",8.6),(42,"Enchiladas de Mole","Oaxaqueña",8.8),
    (43,"Casa Mixteca","Oaxaqueña",9.0),(44,"El Tepache","Oaxaqueña",8.4),
    (45,"Cocina de Monte Albán","Oaxaqueña",9.1),(46,"La Cazuela Grande","Oaxaqueña",8.7),
    (47,"Nopales y Más","Oaxaqueña",8.5),(48,"Chileatole Oaxaqueño","Oaxaqueña",8.9),
    (49,"El Molcajete","Oaxaqueña",9.0),(50,"Cocina de Juchitán","Oaxaqueña",9.2),
    (51,"La Vela Istmeña","Oaxaqueña",9.1),(52,"Memelas del Mercado","Oaxaqueña",8.7),
    (53,"El Pinole","Oaxaqueña",8.6),(54,"Cocina de Tehuantepec","Oaxaqueña",9.0),
    (55,"Tlayudas La Güera","Oaxaqueña",8.8),
    # ── MEXICANA (45) ──────────────────────────────────────────────────────────
    (56,"Taquería El Palenque","Mexicana",8.8),(57,"Los Comales del Centro","Mexicana",9.3),
    (58,"La Pozolería","Mexicana",8.9),(59,"Birria Don Nacho","Mexicana",9.1),
    (60,"Enchiladas La Señora","Mexicana",8.7),(61,"El Mercado de los Sabores","Mexicana",9.0),
    (62,"Carnitas El Güero","Mexicana",8.8),(63,"El Chicharrón Crujiente","Mexicana",8.6),
    (64,"Flautas La Esperanza","Mexicana",8.9),(65,"Tacos de Canasta Oaxaca","Mexicana",8.5),
    (66,"Antojitos La Rosita","Mexicana",8.7),(67,"El Sope Dorado","Mexicana",8.9),
    (68,"Pozole Rojo Don Memo","Mexicana",9.0),(69,"Tostadas La Paloma","Mexicana",8.6),
    (70,"Chilaquiles del Alba","Mexicana",8.8),(71,"Gorditas La Mixteca","Mexicana",8.7),
    (72,"El Molote","Mexicana",9.1),(73,"Tamales La Abuela","Mexicana",9.0),
    (74,"Menudo Los Viernes","Mexicana",8.5),(75,"Sopes y Tlacoyos","Mexicana",8.8),
    (76,"La Barbacoa del Valle","Mexicana",9.2),(77,"Quesadillas El Rincón","Mexicana",8.6),
    (78,"Huaraches La Esperanza","Mexicana",8.7),(79,"El Tlacoyo","Mexicana",8.9),
    (80,"Enchiladas Mineras","Mexicana",8.8),(81,"Tortas El Mexicano","Mexicana",8.5),
    (82,"La Hacienda de los Sabores","Mexicana",8.9),(83,"Taquería Nocturna","Mexicana",8.7),
    (84,"El Sazón de Oaxaca","Mexicana",8.8),(85,"Antojería Central","Mexicana",8.6),
    (86,"Carnitas El Torito","Mexicana",9.0),(87,"La Cazuela del Pueblo","Mexicana",8.7),
    (88,"Tacos de Guisado Oaxaca","Mexicana",8.9),(89,"Taquería Los Equipales","Mexicana",8.5),
    (90,"El Cocinero Viajero","Mexicana",8.8),(91,"Antojitos La Mixteca","Mexicana",8.6),
    (92,"La Fonda del Maíz","Mexicana",9.0),(93,"Tostadas El Tule","Mexicana",8.7),
    (94,"Menudo Madrugador","Mexicana",8.5),(95,"El Caldito de Res","Mexicana",8.8),
    (96,"Tacos Estilo Oaxaca","Mexicana",9.0),(97,"La Empanada del Norte","Mexicana",8.6),
    (98,"Cocina de Rancho","Mexicana",8.9),(99,"El Comal Caliente","Mexicana",8.7),
    (100,"Antojitos El Correo","Mexicana",8.8),
    # ── MARISCOS (30) ──────────────────────────────────────────────────────────
    (101,"Costa Verde Oaxaca","Mariscos",9.0),(102,"El Pulpo Loco","Mariscos",8.9),
    (103,"Mariscos La Sirena","Mariscos",9.1),(104,"Cevichería El Mar","Mariscos",9.0),
    (105,"El Camarón Feliz","Mariscos",8.8),(106,"Ostionería El Puerto","Mariscos",9.2),
    (107,"Mariscos Don Beto","Mariscos",8.7),(108,"La Langosta Oaxaqueña","Mariscos",9.1),
    (109,"Aguachile El Pacífico","Mariscos",9.0),(110,"Pescados y Mariscos La Paz","Mariscos",8.8),
    (111,"El Tirón de Camarón","Mariscos",8.9),(112,"Caldo de Mariscos El Istmo","Mariscos",9.1),
    (113,"Tostadas de Atún El Centro","Mariscos",8.6),(114,"Mariscos El Pescador","Mariscos",9.0),
    (115,"La Jaiba Alegre","Mariscos",8.8),(116,"Ceviche del Pacifico","Mariscos",9.2),
    (117,"El Pulpo en su Tinta","Mariscos",9.0),(118,"Ostiones El Salinero","Mariscos",8.7),
    (119,"Camarones al Mojo Oaxaca","Mariscos",8.9),(120,"La Mojarra Frita","Mariscos",8.8),
    (121,"Mariscos La Vaquita","Mariscos",9.0),(122,"El Filete Oaxaqueño","Mariscos",8.7),
    (123,"Sopa de Lima Marina","Mariscos",8.9),(124,"Cevichería La Noche Buena","Mariscos",9.1),
    (125,"Mariscos El Faro","Mariscos",8.6),(126,"Tostadas de Marlín","Mariscos",8.8),
    (127,"El Caldo Tlalpeño del Mar","Mariscos",8.9),(128,"Coctelería La Playita","Mariscos",9.0),
    (129,"Mariscos Tres Hermanos","Mariscos",8.7),(130,"Vuelve a la Vida Oaxaca","Mariscos",9.1),
    # ── CAFETERÍA (30) ─────────────────────────────────────────────────────────
    (131,"Café Origen Oaxaca","Cafetería",9.0),(132,"El Aromo Café","Cafetería",8.8),
    (133,"Brújula Espresso Bar","Cafetería",9.1),(134,"Café de Olla Tradicional","Cafetería",8.7),
    (135,"La Taza de Copal","Cafetería",8.9),(136,"Café Monte Albán","Cafetería",8.6),
    (137,"El Grano de Café","Cafetería",8.8),(138,"Café Plumaje","Cafetería",9.0),
    (139,"La Molienda Café","Cafetería",8.7),(140,"Espresso Sierra Juárez","Cafetería",9.2),
    (141,"Café del Barrio","Cafetería",8.5),(142,"Tostado Oaxaqueño","Cafetería",8.7),
    (143,"El Fogón Café","Cafetería",8.6),(144,"Café La Noche de Reyes","Cafetería",8.9),
    (145,"Café Xanica","Cafetería",9.0),(146,"La Torrefacción","Cafetería",8.8),
    (147,"Café del Mercado","Cafetería",8.6),(148,"El Barista Oaxaqueño","Cafetería",8.7),
    (149,"Café Tlayuda","Cafetería",8.5),(150,"Granos del Sur","Cafetería",8.9),
    (151,"Café La Zicanda","Cafetería",8.7),(152,"El Caracol Café","Cafetería",8.8),
    (153,"Café Los Valles","Cafetería",9.0),(154,"La Percoladora","Cafetería",8.6),
    (155,"Café Mixteco","Cafetería",8.8),(156,"El Capuchino Oaxaqueño","Cafetería",8.7),
    (157,"Café Sierra Madre","Cafetería",9.1),(158,"Taza y Barro","Cafetería",8.9),
    (159,"Café Etla","Cafetería",8.5),(160,"El Café de los Sabios","Cafetería",8.8),
    # ── CARNES (25) ────────────────────────────────────────────────────────────
    (161,"Asador El Norteño","Carnes",8.9),(162,"La Brasa del Valle","Carnes",9.0),
    (163,"Parrilla El Mezquite","Carnes",8.8),(164,"El Rib Eye Oaxaqueño","Carnes",9.1),
    (165,"Carne Asada El Patio","Carnes",8.7),(166,"La Arrachera Dorada","Carnes",9.0),
    (167,"Parrillada Don Panfilo","Carnes",8.8),(168,"El Asadero Mixteco","Carnes",8.9),
    (169,"Costillas La Lumbre","Carnes",9.2),(170,"La Picaña del Sur","Carnes",8.8),
    (171,"Brasa y Carbón","Carnes",9.0),(172,"El Corte Perfecto","Carnes",8.7),
    (173,"Parrilla Oaxaca Norte","Carnes",8.9),(174,"El Tomahawk Oaxaqueño","Carnes",9.1),
    (175,"Asados de la Sierra","Carnes",8.6),(176,"La Leña y el Fuego","Carnes",9.0),
    (177,"Parrillada El Humo","Carnes",8.8),(178,"El Brisket Oaxaca","Carnes",8.9),
    (179,"Carne en su Punto","Carnes",8.7),(180,"La Parrilla del Mercado","Carnes",8.8),
    (181,"Asador Los Valles","Carnes",9.0),(182,"El Churrasco Oaxaqueño","Carnes",8.9),
    (183,"Parrilla La Mixteca","Carnes",8.7),(184,"Brasa Negra Oaxaca","Carnes",9.1),
    (185,"El Corral de las Brasas","Carnes",8.8),
    # ── VEGETARIANA (20) ───────────────────────────────────────────────────────
    (186,"Verde Oaxaca","Vegetariana",8.9),(187,"Raíz y Semilla","Vegetariana",9.0),
    (188,"El Jardín Vegano","Vegetariana",8.8),(189,"Tlayudas Veganas Oaxaca","Vegetariana",8.7),
    (190,"La Milpa Verde","Vegetariana",9.1),(191,"Quelites y Más","Vegetariana",8.9),
    (192,"El Hongo Mágico","Vegetariana",8.8),(193,"Cosecha Vegana","Vegetariana",9.0),
    (194,"La Hoja Santa Vegana","Vegetariana",8.7),(195,"Brotes del Valle","Vegetariana",8.9),
    (196,"El Aguacate Verde","Vegetariana",8.6),(197,"Semilla de Luz","Vegetariana",9.0),
    (198,"La Calabaza Oaxaqueña","Vegetariana",8.8),(199,"Tacos de Coliflor Oaxaca","Vegetariana",8.7),
    (200,"El Frijol Negro Vegano","Vegetariana",8.9),(201,"Huerto del Centro","Vegetariana",9.1),
    (202,"La Espinaca Feliz","Vegetariana",8.5),(203,"Verdes del Mercado","Vegetariana",8.8),
    (204,"El Tomate Rojo","Vegetariana",8.7),(205,"Bocados de la Tierra","Vegetariana",9.0),
    # ── POLLO (20) ─────────────────────────────────────────────────────────────
    (206,"Pollos El Mesón","Pollo",8.8),(207,"La Pollería del Centro","Pollo",8.7),
    (208,"El Pollo Adobado","Pollo",9.0),(209,"Pollos a la Brasa Oaxaca","Pollo",8.9),
    (210,"El Gallito Asado","Pollo",8.6),(211,"Pollo en Mole Oaxaqueño","Pollo",9.1),
    (212,"La Pollería La Mixteca","Pollo",8.7),(213,"Pollos El Tule","Pollo",8.8),
    (214,"El Pollo Encebollado","Pollo",8.5),(215,"Pollos al Carbón Valles","Pollo",8.9),
    (216,"La Alita Crujiente","Pollo",8.7),(217,"Pollo Rostizado El Centro","Pollo",8.8),
    (218,"El Pollo del Mercado","Pollo",9.0),(219,"Pollos Don Fermín","Pollo",8.6),
    (220,"Alitas y Más Oaxaca","Pollo",8.8),(221,"El Pollo Enchilado","Pollo",8.7),
    (222,"Pollos La Casita","Pollo",8.9),(223,"El Pollo al Limón","Pollo",8.5),
    (224,"Pollos El Palmar","Pollo",8.8),(225,"La Pollería Los Valles","Pollo",8.7),
    # ── PIZZERÍA (15) ──────────────────────────────────────────────────────────
    (226,"Pizzería El Amate","Pizzería",8.7),(227,"La Pizza del Centro","Pizzería",8.8),
    (228,"Pizza Oaxaqueña","Pizzería",9.0),(229,"El Horno de Barro Pizza","Pizzería",9.1),
    (230,"Pizza Al Metate","Pizzería",8.6),(231,"Pizzería El Volcán","Pizzería",8.8),
    (232,"La Masa Feliz","Pizzería",8.7),(233,"Pizza de Comal","Pizzería",8.9),
    (234,"El Queso Derretido","Pizzería",8.5),(235,"Pizzería Los Valles","Pizzería",8.7),
    (236,"Pizza Artesanal Oaxaca","Pizzería",9.0),(237,"La Pizza del Tule","Pizzería",8.6),
    (238,"Pizzería Central Oaxaca","Pizzería",8.8),(239,"El Calzone Oaxaqueño","Pizzería",8.7),
    (240,"Pizza La Mixteca","Pizzería",8.9),
    # ── DESAYUNOS (20) ─────────────────────────────────────────────────────────
    (241,"Desayunos La Aurora","Desayunos",8.8),(242,"El Chilaquil Madrugador","Desayunos",9.0),
    (243,"Brunch del Mercado","Desayunos",8.7),(244,"Huevos al Gusto Oaxaca","Desayunos",8.9),
    (245,"La Molletes del Centro","Desayunos",8.6),(246,"Desayunos Doña Flora","Desayunos",9.1),
    (247,"El Atole con Todo","Desayunos",8.8),(248,"Brunch El Copal","Desayunos",8.7),
    (249,"La Pancita del Día","Desayunos",8.9),(250,"Desayunos El Manantial","Desayunos",8.5),
    (251,"Huevos Motuleños Oaxaca","Desayunos",8.8),(252,"El Buen Despertar","Desayunos",8.7),
    (253,"Desayunos La Paloma","Desayunos",9.0),(254,"El Pan Dulce Oaxaqueño","Desayunos",8.6),
    (255,"Molletes El Amate","Desayunos",8.8),(256,"La Cafetera del Mercado","Desayunos",8.9),
    (257,"Desayunos La Mixteca","Desayunos",8.7),(258,"El Chilaquil de Mole","Desayunos",9.1),
    (259,"Desayunos Los Sabinos","Desayunos",8.5),(260,"La Tabla del Brunch","Desayunos",8.8),
    # ── CALDOS (15) ────────────────────────────────────────────────────────────
    (261,"El Caldo Tlalpeño","Caldos",8.8),(262,"Consomé de Res El Valle","Caldos",9.0),
    (263,"Caldos La Abuela Oaxaca","Caldos",8.9),(264,"El Pozole de Maíz Azul","Caldos",9.1),
    (265,"Birria de Res El Compadre","Caldos",9.2),(266,"El Caldo de Haba","Caldos",8.6),
    (267,"Menudo El Madrugador","Caldos",8.7),(268,"Caldos El Fogón","Caldos",8.8),
    (269,"El Caldo de Pollo Oaxaqueño","Caldos",8.9),(270,"Sopa de Lima del Istmo","Caldos",9.0),
    (271,"El Caldo de Pata","Caldos",8.5),(272,"Caldos La Noche de Viernes","Caldos",8.8),
    (273,"El Consomé Mágico","Caldos",8.7),(274,"Caldos de Mariscos El Puerto","Caldos",9.0),
    (275,"El Cocido de Res","Caldos",8.9),
    # ── PANADERÍA (15) ─────────────────────────────────────────────────────────
    (276,"Pan de Yema Oaxaqueño","Panadería",9.0),(277,"La Telera del Mercado","Panadería",8.7),
    (278,"Pan de Muerto El Centro","Panadería",8.9),(279,"El Horno de Adobe","Panadería",9.1),
    (280,"Repostería La Mixteca","Panadería",8.8),(281,"Pastelería Oaxaca Dulce","Panadería",8.9),
    (282,"El Bizcocho Oaxaqueño","Panadería",8.6),(283,"Pan Artesanal Los Valles","Panadería",8.8),
    (284,"La Conchas del Centro","Panadería",8.7),(285,"Repostería El Copal","Panadería",9.0),
    (286,"El Suspiro Dulce","Panadería",8.5),(287,"Panadería La Mixteca","Panadería",8.8),
    (288,"El Pan de Cazuela","Panadería",8.7),(289,"Postres El Tule","Panadería",8.9),
    (290,"La Panadería del Mercado","Panadería",9.0),
    # ── HAMBURGUESAS (10) ──────────────────────────────────────────────────────
    (291,"Burguer El Copal","Hamburguesas",8.7),(292,"La Hamburguesa Oaxaqueña","Hamburguesas",8.9),
    (293,"El Smash del Centro","Hamburguesas",8.8),(294,"Burguer La Mixteca","Hamburguesas",8.6),
    (295,"El Queso Oaxaqueño Burger","Hamburguesas",9.0),(296,"Burguer Los Valles","Hamburguesas",8.7),
    (297,"La Burger Artesanal Oaxaca","Hamburguesas",8.8),(298,"El Double Smash Oaxaca","Hamburguesas",8.9),
    (299,"Burguer El Tule","Hamburguesas",8.5),(300,"La Hamburguesa del Mercado","Hamburguesas",8.8),
]

# ─── PRODUCTOS POR TIPO ───────────────────────────────────────────────────────
_PRODUCTOS_POR_TIPO = {
"Oaxaqueña": [
    ("Tlayuda de Tasajo","Principal",195),("Tlayuda de Cecina","Principal",185),
    ("Tlayuda de Chorizo","Principal",175),("Tlayuda Negra con Frijoles","Principal",165),
    ("Mole Negro con Pollo","Principal",200),("Mole Coloradito","Principal",190),
    ("Mole Amarillo","Principal",185),("Mole Chichilo","Principal",195),
    ("Mole Verde","Principal",180),("Mole Rojo","Principal",185),
    ("Estofado Oaxaqueño","Principal",190),("Chileajo de Cerdo","Principal",195),
    ("Tasajo Asado","Principal",230),("Tasajo Encebollado","Principal",220),
    ("Cecina Enchilada","Principal",210),("Chorizo Negro","Principal",180),
    ("Memelas con Frijoles","Entrada",90),("Memelas con Queso","Entrada",95),
    ("Tamales Oaxaqueños de Mole","Principal",130),("Tamales de Rajas","Principal",120),
    ("Empanadas de Amarillo","Principal",145),("Empanadas de Frijol","Principal",135),
    ("Tetelas de Frijol","Entrada",90),("Tetelas de Quesillo","Entrada",100),
    ("Chapulines con Limón","Entrada",65),("Chapulines Enchilados","Entrada",70),
    ("Quesillo Asado","Entrada",85),("Sopa de Guías","Entrada",95),
    ("Sopa de Fideo Oaxaqueña","Entrada",75),("Arroz con Hierba Santa","Entrada",70),
    ("Chocolate Oaxaqueño Caliente","Bebida",50),("Tejate","Bebida",55),
    ("Atole de Maíz Azul","Bebida",48),("Atole de Guayaba","Bebida",48),
    ("Mezcal Artesanal","Bebida",85),("Mezcal Reposado","Bebida",100),
    ("Agua de Jamaica","Bebida",30),("Agua de Tamarindo","Bebida",30),
    ("Horchata Oaxaqueña","Bebida",35),("Nicuatole","Postre",60),
    ("Buñuelos con Miel","Postre",55),("Arroz con Leche","Postre",50),
],
"Mexicana": [
    ("Taco de Barbacoa","Principal",38),("Taco de Carnitas","Principal",38),
    ("Taco de Chicharrón","Principal",35),("Taco de Suadero","Principal",38),
    ("Taco al Pastor","Principal",35),("Taco de Canasta Frijol","Principal",28),
    ("Quesadilla de Flor de Calabaza","Principal",70),("Quesadilla de Huitlacoche","Principal",75),
    ("Quesadilla de Queso","Principal",60),("Gordita de Chicharrón","Principal",55),
    ("Gordita de Frijol","Principal",50),("Sope de Pollo","Principal",65),
    ("Tostada de Pollo","Entrada",55),("Tostada de Frijol","Entrada",48),
    ("Flautas de Pollo","Principal",115),("Enchiladas Verdes","Principal",105),
    ("Enchiladas Rojas","Principal",105),("Chilaquiles Verdes","Principal",110),
    ("Pozole Rojo","Principal",135),("Pozole Blanco","Principal",130),
    ("Birria de Res","Principal",145),("Menudo Rojo","Principal",110),
    ("Tamales de Rajas","Principal",50),("Torta de Carnitas","Principal",90),
    ("Guacamole con Totopos","Entrada",85),("Elote con Chile y Limón","Entrada",40),
    ("Agua de Limón","Bebida",28),("Agua de Horchata","Bebida",32),
    ("Michelada con Clamato","Bebida",90),("Arroz Rojo","Entrada",55),
    ("Frijoles Negros de Olla","Entrada",45),("Pay de Limón","Postre",70),
],
"Mariscos": [
    ("Ceviche de Camarón","Principal",175),("Ceviche de Pescado","Principal",165),
    ("Ceviche Mixto","Principal",195),("Aguachile Rojo","Principal",185),
    ("Aguachile Verde","Principal",185),("Camarones al Mojo de Ajo","Principal",220),
    ("Camarones Empanizados","Principal",210),("Camarones a la Diabla","Principal",215),
    ("Filete de Pescado a la Plancha","Principal",195),("Filete al Chipotle","Principal",200),
    ("Pulpo a las Brasas","Principal",245),("Pulpo en su Tinta","Principal",235),
    ("Ostiones al Natural","Entrada",140),("Ostiones Gratinados","Entrada",155),
    ("Caldo de Camarón","Entrada",145),("Caldo de Mariscos","Entrada",155),
    ("Tostadas de Atún","Entrada",125),("Tostadas de Marlín","Entrada",130),
    ("Vuelve a la Vida","Entrada",165),("Coctel de Camarón","Entrada",160),
    ("Agua de Coco Natural","Bebida",50),("Michelada Clamato","Bebida",90),
    ("Limonada Mineral","Bebida",48),("Flan de Coco","Postre",65),
    ("Arroz Blanco","Entrada",55),
],
"Cafetería": [
    ("Café Americano","Bebida",55),("Cappuccino","Bebida",72),
    ("Latte de Vainilla","Bebida",78),("Latte de Caramelo","Bebida",78),
    ("Espresso Doble","Bebida",50),("Cold Brew","Bebida",80),
    ("Café de Olla","Bebida",45),("Moka","Bebida",80),
    ("Chai Latte","Bebida",75),("Matcha Latte","Bebida",85),
    ("Smoothie de Frutos Rojos","Bebida",90),("Jugo Verde","Bebida",70),
    ("Croissant de Mantequilla","Entrada",60),("Bagel de Queso Crema","Entrada",65),
    ("Pan de Plátano","Entrada",55),("Muffin de Arándano","Postre",55),
    ("Pay de Queso","Postre",90),("Brownie de Chocolate","Postre",68),
    ("Galleta de Avena","Postre",40),("Cheesecake de Frutos Rojos","Postre",95),
    ("Tarta de Limón","Postre",85),("Croissant de Jamón","Entrada",80),
    ("Sándwich de Pavo","Principal",110),("Wrap Vegetal","Principal",105),
    ("Ensalada César","Principal",100),
],
"Carnes": [
    ("Rib Eye 400g","Principal",340),("Arrachera Marinada","Principal",250),
    ("Chuletón de Cerdo","Principal",290),("Costillas BBQ","Principal",270),
    ("Picaña al Carbón","Principal",310),("T-Bone Oaxaqueño","Principal",380),
    ("Filete Mignon","Principal",360),("Brochetas de Res","Principal",220),
    ("Brochetas Mixtas","Principal",230),("Carne Asada Norteña","Principal",260),
    ("Chorizos al Carbón","Entrada",115),("Chorizo de Oaxaca Asado","Entrada",120),
    ("Chistorra Oaxaqueña","Entrada",110),("Papas a la Francesa","Entrada",70),
    ("Papas Gajo con Chipotle","Entrada",75),("Ensalada Mixta","Entrada",95),
    ("Arroz Blanco","Entrada",55),("Frijoles Charros","Entrada",75),
    ("Agua de Limón","Bebida",30),("Naranjada Natural","Bebida",42),
    ("Cerveza Artesanal Oaxaca","Bebida",90),("Mezcal Shot","Bebida",85),
    ("Helado de Vainilla","Postre",60),("Brownie con Helado","Postre",80),
],
"Vegetariana": [
    ("Bowl de Quinoa con Vegetales","Principal",120),("Hamburguesa Vegana de Lentejas","Principal",135),
    ("Wrap de Hummus y Vegetales","Principal",110),("Tacos de Coliflor al Pastor","Principal",95),
    ("Lasaña de Espinacas","Principal",145),("Buddha Bowl","Principal",130),
    ("Tlayuda Vegana","Principal",155),("Pizza Vegana","Principal",150),
    ("Ensalada Tofu y Aguacate","Principal",125),("Sopa Crema de Zanahoria","Entrada",80),
    ("Crema de Calabaza","Entrada",82),("Gazpacho Verde","Entrada",78),
    ("Hummus con Pita","Entrada",95),("Guacamole Vegano","Entrada",88),
    ("Brochetas de Verduras","Entrada",85),("Smoothie de Espinaca","Bebida",80),
    ("Jugo Verde Detox","Bebida",75),("Kombucha de Jengibre","Bebida",70),
    ("Agua de Pepino y Limón","Bebida",35),("Brownie Vegano","Postre",65),
    ("Helado de Coco","Postre",60),("Cheesecake Vegano","Postre",90),
],
"Pollo": [
    ("Cuarto de Pollo Asado","Principal",65),("Medio Pollo al Carbón","Principal",110),
    ("Pollo Entero","Principal",195),("Pollo en Mole Negro","Principal",185),
    ("Pollo Adobado","Principal",130),("Alitas BBQ (10 pzas)","Principal",145),
    ("Alitas a la Diabla (10 pzas)","Principal",145),("Alitas Buffalo (10 pzas)","Principal",150),
    ("Pierna de Pollo Asada","Principal",90),("Pechuga a la Plancha","Principal",115),
    ("Taco de Pollo Asado","Principal",42),("Torta de Pollo","Principal",95),
    ("Papas con Pollo","Entrada",75),("Ensalada de Pollo","Entrada",90),
    ("Arroz Blanco","Entrada",55),("Frijoles Negros","Entrada",45),
    ("Agua de Limón","Bebida",28),("Refresco","Bebida",32),
    ("Flan de Vainilla","Postre",55),("Gelatina de Leche","Postre",45),
],
"Pizzería": [
    ("Pizza Margarita Personal","Principal",115),("Pizza Pepperoni Personal","Principal",130),
    ("Pizza Hawaiana Personal","Principal",128),("Pizza Cuatro Quesos","Principal",145),
    ("Pizza Oaxaqueña (Quesillo+Tasajo)","Principal",175),("Pizza de Chorizo","Principal",150),
    ("Pizza de Vegetales","Principal",140),("Pizza de Mariscos","Principal",185),
    ("Calzone de Jamón","Principal",130),("Calzone de Espinaca","Principal",125),
    ("Pan de Ajo con Queso","Entrada",52),("Pan de Ajo con Hierbas","Entrada",50),
    ("Palitos de Pan","Entrada",48),("Ensalada César","Entrada",95),
    ("Alitas de Pollo","Entrada",115),("Agua Fresca","Bebida",30),
    ("Refresco","Bebida",32),("Jugo de Naranja","Bebida",50),
    ("Tiramisú","Postre",85),("Panna Cotta","Postre",80),
],
"Desayunos": [
    ("Chilaquiles Verdes con Pollo","Principal",120),("Chilaquiles Rojos con Huevo","Principal",115),
    ("Chilaquiles de Mole Negro","Principal",130),("Huevos Rancheros","Principal",105),
    ("Huevos al Gusto (Estrellados/Revueltos)","Principal",95),("Huevos con Chorizo","Principal",110),
    ("Molletes con Frijoles","Principal",90),("Molletes con Jamón","Principal",95),
    ("Enfrijoladas","Principal",115),("Enmoladas","Principal",125),
    ("Enchiladas Verdes Mañaneras","Principal",120),("Tamal con Café","Principal",75),
    ("Atole de Guayaba","Bebida",48),("Atole de Maíz","Bebida",45),
    ("Café de Olla","Bebida",45),("Café con Leche","Bebida",50),
    ("Jugo de Naranja Natural","Bebida",55),("Pan Dulce Oaxaqueño","Entrada",40),
    ("Concha de Chocolate","Entrada",38),("Empanada de Requeson","Entrada",55),
    ("Flan Napolitano","Postre",60),("Gelatina de Leche","Postre",48),
],
"Caldos": [
    ("Pozole Rojo de Res","Principal",140),("Pozole Blanco de Pollo","Principal",130),
    ("Birria de Res Estilo Oaxaca","Principal",155),("Menudo Rojo","Principal",115),
    ("Consomé de Pollo","Principal",105),("Caldo de Res con Verduras","Principal",120),
    ("Caldo Tlalpeño","Principal",130),("Sopa de Lima Istmeña","Principal",115),
    ("Caldo de Habas","Principal",95),("Sopa de Fideo Seco","Entrada",70),
    ("Arroz Rojo","Entrada",58),("Tostadas","Entrada",45),
    ("Limones y Oregano (Condimento)","Entrada",25),("Agua de Jamaica","Bebida",30),
    ("Agua de Tamarindo","Bebida",30),("Refresco","Bebida",32),
    ("Mezcal Shot","Bebida",80),("Flan Casero","Postre",58),
    ("Arroz con Leche","Postre",52),
],
"Panadería": [
    ("Pan de Yema Grande","Principal",65),("Pan de Yema Chico","Principal",40),
    ("Pan de Muerto Oaxaqueño","Principal",55),("Concha de Vainilla","Entrada",38),
    ("Concha de Chocolate","Entrada",38),("Cuernito de Mantequilla","Entrada",35),
    ("Polvorón de Canela","Postre",32),("Polvorón de Nuez","Postre",35),
    ("Empanada de Requeson","Entrada",55),("Empanada de Piña","Entrada",50),
    ("Bolillo Recién Horneado","Entrada",18),("Telera del Día","Entrada",20),
    ("Pastel de Tres Leches","Postre",120),("Pastel de Chocolate","Postre",110),
    ("Gelatina Artesanal","Postre",45),("Arroz con Leche","Postre",50),
    ("Buñuelos con Azúcar","Postre",48),("Café de Olla","Bebida",45),
    ("Atole de Guayaba","Bebida",48),("Leche con Chocolate","Bebida",50),
],
"Hamburguesas": [
    ("Smash Burger Sencillo","Principal",120),("Smash Burger Doble","Principal",155),
    ("Burger con Quesillo Oaxaqueño","Principal",145),("Burger BBQ","Principal",150),
    ("Burger Aguacate y Tocino","Principal",160),("Burger Vegana de Garbanzo","Principal",135),
    ("Burger de Pollo Crispy","Principal",130),("Burger de Champiñones","Principal",140),
    ("Papas a la Francesa","Entrada",70),("Papas con Queso Derretido","Entrada",85),
    ("Aros de Cebolla","Entrada",78),("Ensalada Coleslaw","Entrada",60),
    ("Agua Fresca","Bebida",30),("Malteada de Vainilla","Bebida",90),
    ("Malteada de Fresa","Bebida",90),("Refresco","Bebida",32),
    ("Pay de Manzana","Postre",75),("Helado de Vainilla","Postre",60),
],
}

# ─── UTILIDADES ───────────────────────────────────────────────────────────────
def csv_guardar(ruta, filas):
    carpeta = os.path.dirname(ruta)
    if carpeta:
        os.makedirs(carpeta, exist_ok=True)
    with open(ruta, 'w', newline='', encoding='utf-8') as f:
        csv.writer(f).writerows(filas)
    print(f'  OK  {os.path.basename(ruta):<35}  {len(filas)-1:>8,} registros')

def costo_envio_zona(colonia):
    if colonia in COLONIAS_PERIFERICAS:
        return round(random.uniform(40, 85), 2)
    return round(random.uniform(15, 50), 2)

def distancia_zona(colonia):
    if colonia in COLONIAS_PERIFERICAS:
        return round(random.uniform(8, 25), 1)
    return round(random.uniform(1, 10), 1)

def _gen_rating(base, sigma=0.4, min_val=1.0, max_val=5.0):
    """Rating gaussiano redondeado a 0.5"""
    r = random.gauss(base, sigma)
    r = max(min_val, min(max_val, r))
    return round(r * 2) / 2

# ─── BUILD: RESTAURANTES + PRODUCTOS ─────────────────────────────────────────
def build_restaurantes_productos():
    restaurantes = []
    productos    = []
    id_producto  = 1
    rng_local    = random.Random(99)

    for id_r, nombre, tipo, calif in _DATOS_REST:
        colonia, municipio = rng_local.choice(COLONIAS)
        calle  = rng_local.choice(CALLES)
        num    = rng_local.randint(1, 999)
        tel    = f'951{rng_local.randint(1000000, 9999999)}'
        email  = f'rest{id_r:03d}@didifood.mx'
        dir_   = f'{calle} #{num}, {colonia}, {municipio}, Oaxaca'

        restaurantes.append({
            'id_restaurante': id_r, 'nombre': nombre, 'tipo_cocina': tipo,
            'direccion': dir_, 'colonia': colonia, 'municipio': municipio,
            'telefono': tel, 'email': email,
            'calificacion_promedio': calif, 'estatus': 'Activo',
        })

        catalogo = _PRODUCTOS_POR_TIPO.get(tipo, _PRODUCTOS_POR_TIPO['Mexicana'])
        n        = rng_local.choice([3, 3, 4])
        muestra  = rng_local.sample(catalogo, min(n, len(catalogo)))
        for nombre_p, cat, precio in muestra:
            productos.append({
                'id_producto': id_producto, 'id_restaurante': id_r,
                'nombre_restaurante': nombre, 'nombre_producto': nombre_p,
                'categoria': cat, 'precio': precio, 'estatus': 'Disponible',
            })
            id_producto += 1

    return restaurantes, productos

# ─── BUILD: CONDUCTORES (rng aislado para no alterar secuencia global) ────────
def build_conductores():
    rng          = random.Random(43)
    fecha_base_c = datetime(2019, 1, 1, 8, 0, 0)
    conductores  = []
    for i in range(1, NUM_CONDUCTORES + 1):
        nombre = rng.choice(NOMBRES)
        ap     = rng.choice(APELLIDOS)
        am     = rng.choice(APELLIDOS)
        tel    = f'951{rng.randint(1000000, 9999999)}'
        email  = f'drv{i:04d}@didifood.mx'
        vehic  = rng.choice(TIPOS_VEHICULO)
        placa  = f'OXA-{i:03d}-{rng.randint(100, 999)}'
        calif  = round(rng.uniform(3.5, 5.0), 1)
        est    = rng.choices(ESTATUS_DRIVER, weights=[80, 15, 5], k=1)[0]
        f_ing  = fecha_base_c + timedelta(
                     days=rng.randint(0, 1000), minutes=rng.randint(0, 1440))
        zona, _ = rng.choice(COLONIAS)
        conductores.append({
            'id_conductor': i, 'nombre': nombre,
            'apellido_paterno': ap, 'apellido_materno': am,
            'telefono': tel, 'email': email,
            'tipo_vehiculo': vehic, 'placa': placa,
            'calificacion_promedio': calif, 'estatus': est,
            'fecha_ingreso': f_ing, 'zona_operacion': zona,
        })
    return conductores

# ─── CSV GENERATORS ───────────────────────────────────────────────────────────
def gen_restaurantes(datos):
    cab = [['id_restaurante','nombre','tipo_cocina','colonia','municipio',
            'direccion','telefono','email','calificacion_promedio','estatus']]
    for r in datos:
        cab.append([r['id_restaurante'], r['nombre'], r['tipo_cocina'],
                    r['colonia'], r['municipio'], r['direccion'],
                    r['telefono'], r['email'], r['calificacion_promedio'], r['estatus']])
    return cab

def gen_productos(datos):
    cab = [['id_producto','id_restaurante','nombre_restaurante',
            'nombre_producto','categoria','precio','estatus']]
    for p in datos:
        cab.append([p['id_producto'], p['id_restaurante'], p['nombre_restaurante'],
                    p['nombre_producto'], p['categoria'], p['precio'], p['estatus']])
    return cab

def gen_usuarios():
    cab = [['id_usuario','nombre','apellido_paterno','apellido_materno',
            'telefono','email','colonia','municipio','direccion_completa',
            'fecha_registro','calificacion_promedio','canal_adquisicion','dispositivo']]
    fecha_base_u = datetime(2019, 6, 1, 8, 0, 0)
    for i in range(1, NUM_USUARIOS + 1):
        nombre = random.choice(NOMBRES)
        ap     = random.choice(APELLIDOS)
        am     = random.choice(APELLIDOS)
        tel    = f'951{random.randint(1000000, 9999999)}'
        email  = f'{nombre.lower()}{i}@gmail.com'
        col, mun = random.choice(COLONIAS)
        calle  = random.choice(CALLES)
        num    = random.randint(1, 999)
        dir_   = f'{calle} #{num}, {col}, {mun}, Oaxaca'
        f_reg  = fecha_base_u + timedelta(
                     days=random.randint(0, 1200), minutes=random.randint(0, 1440))
        calif  = round(random.uniform(3.5, 5.0), 1)
        canal  = random.choices(CANALES_ADQUISICION, weights=PESOS_CANAL, k=1)[0]
        disp   = random.choices(DISPOSITIVOS, weights=PESOS_DISPOSITIVO, k=1)[0]
        cab.append([i, nombre, ap, am, tel, email, col, mun, dir_,
                    f_reg, calif, canal, disp])
    return cab

def gen_conductores_csv(datos):
    cab = [['id_conductor','nombre','apellido_paterno','apellido_materno',
            'telefono','email','tipo_vehiculo','placa',
            'calificacion_promedio','estatus','fecha_ingreso','zona_operacion']]
    for c in datos:
        cab.append([c['id_conductor'], c['nombre'], c['apellido_paterno'],
                    c['apellido_materno'], c['telefono'], c['email'],
                    c['tipo_vehiculo'], c['placa'], c['calificacion_promedio'],
                    c['estatus'], c['fecha_ingreso'], c['zona_operacion']])
    return cab

# ─── PEDIDOS + DETALLE (función principal más extensa) ────────────────────────
def gen_pedidos_y_detalle(restaurantes_data, productos_data):
    """
    Retorna (pedidos_csv, detalle_csv, entregados_meta)
    entregados_meta = [(id_pedido, id_usuario, id_restaurante, id_conductor, fecha_pedido)]
    """
    # Índice productos por restaurante
    productos_por_rest = {}
    for p in productos_data:
        productos_por_rest.setdefault(p['id_restaurante'], []).append({
            'id_producto': p['id_producto'],
            'precio':      float(p['precio']),
        })

    rest_map = {r['id_restaurante']: (r['nombre'], r['tipo_cocina'])
                for r in restaurantes_data}
    ids_rest = list(rest_map.keys())

    ids_st  = [e[0] for e in ESTATUS_PEDIDO]
    nom_st  = {e[0]: e[1] for e in ESTATUS_PEDIDO}

    pesos_usr = [4 if i <= 200 else 1 for i in range(1, NUM_USUARIOS + 1)]

    todos = []  # list of (pedido_row, detalle_items)

    def _fila(id_pedido, id_u, id_r, is_first=False):
        id_c  = random.randint(1, NUM_CONDUCTORES)
        id_st = random.choices(ids_st, weights=PESOS_ESTATUS, k=1)[0]
        nombre_r, tipo_r = rest_map[id_r]

        fecha_p = FECHA_BASE + timedelta(
            days=random.randint(0, RANGO_DIAS),
            minutes=random.randint(0, 1439))

        hora_rec = hora_ent = tiempo_min = tiempo_prep = None
        if id_st in (3, 4, 5, 6):
            tiempo_prep = random.randint(8, 25)
            hora_rec    = fecha_p + timedelta(minutes=random.randint(10, 40))
        if id_st == 6:
            transit    = random.randint(10, 50)
            tiempo_min = tiempo_prep + transit
            hora_ent   = fecha_p + timedelta(minutes=tiempo_min)

        col_ent, mun_ent = random.choice(COLONIAS)
        distancia        = distancia_zona(col_ent)

        # Selección real de productos
        prods    = productos_por_rest.get(id_r, [{'id_producto': 1, 'precio': 150.0}])
        n_items  = random.randint(1, min(4, len(prods)))
        selected = random.sample(prods, n_items)
        cants    = [random.randint(1, 2) for _ in selected]
        subtotal = round(sum(p['precio'] * c for p, c in zip(selected, cants)), 2)
        detalle  = [(p['id_producto'], c, p['precio']) for p, c in zip(selected, cants)]

        costo_env = costo_envio_zona(col_ent)

        propina = 0.0
        if id_st == 6 and random.random() < 0.35:
            propina = float(random.choice([10, 15, 20, 25, 30, 40, 50]))

        total  = round(subtotal + costo_env + propina, 2)
        metodo = random.choice(METODOS_PAGO)

        row = [id_pedido, id_u, id_r, nombre_r, tipo_r, id_c,
               nom_st[id_st], metodo, fecha_p, hora_rec, hora_ent,
               subtotal, costo_env, total, tiempo_min, col_ent, mun_ent,
               propina, distancia, tiempo_prep, is_first]
        return row, detalle

    id_pedido = 1

    print(f'    -> {NUM_USUARIOS:,} usuarios x {PEDIDOS_MIN_POR_USUARIO} pedidos minimos...')
    for id_u in range(1, NUM_USUARIOS + 1):
        favs    = random.sample(ids_rest, k=random.randint(1, 4))
        pesos_r = [3 if r in favs else 1 for r in ids_rest]
        for j in range(PEDIDOS_MIN_POR_USUARIO):
            id_r = random.choices(ids_rest, weights=pesos_r, k=1)[0]
            todos.append(_fila(id_pedido, id_u, id_r, is_first=(j == 0)))
            id_pedido += 1

    print(f'    -> {PEDIDOS_EXTRA:,} pedidos extra...')
    for _ in range(PEDIDOS_EXTRA):
        id_u = random.choices(range(1, NUM_USUARIOS + 1), weights=pesos_usr, k=1)[0]
        id_r = random.choice(ids_rest)
        todos.append(_fila(id_pedido, id_u, id_r, is_first=False))
        id_pedido += 1

    random.shuffle(todos)

    pedido_cab  = [['id_pedido','id_usuario','id_restaurante','nombre_restaurante',
                    'tipo_cocina','id_conductor','estatus_pedido','metodo_pago',
                    'fecha_pedido','hora_recogida','hora_entrega',
                    'subtotal','costo_envio','total','tiempo_entrega_min',
                    'colonia_entrega','municipio_entrega',
                    'propina','distancia_km','tiempo_prep_min','es_primera_orden']]
    detalle_cab = [['id_detalle','id_pedido','id_producto',
                    'cantidad','precio_unitario','id_combo']]

    pedidos_rows    = pedido_cab
    detalle_rows    = detalle_cab
    entregados_meta = []
    id_det          = 1

    for idx, (fila, detalles) in enumerate(todos, 1):
        fila[0] = idx
        pedidos_rows.append(fila)
        if fila[6] == 'Entregado':
            entregados_meta.append((idx, fila[1], fila[2], fila[5], fila[8]))
        for id_prod, cant, precio in detalles:
            detalle_rows.append([id_det, idx, id_prod, cant, precio, None])
            id_det += 1

    return pedidos_rows, detalle_rows, entregados_meta

# ─── CALIFICACIONES ───────────────────────────────────────────────────────────
def gen_calificaciones(entregados_meta, rest_rating_map, cond_rating_map):
    """65% de los pedidos entregados reciben calificacion"""
    cab = [['id_calificacion','id_pedido','id_usuario','id_restaurante',
            'id_conductor','calificacion_rest','calificacion_cond',
            'comentario','fecha']]
    id_cal = 1
    for id_ped, id_usr, id_rest, id_cond, fecha_ped in entregados_meta:
        if random.random() > 0.65:
            continue
        rest_base = rest_rating_map.get(id_rest, 9.0) / 2.0   # escala 10->5
        cond_base = cond_rating_map.get(id_cond, 4.0)          # ya en escala 5
        cal_rest  = _gen_rating(rest_base)
        cal_cond  = _gen_rating(cond_base)
        comentario = random.choice(COMENTARIOS_CAL) if random.random() < 0.28 else None
        fecha_cal  = fecha_ped + timedelta(minutes=random.randint(15, 1440))
        cab.append([id_cal, id_ped, id_usr, id_rest, id_cond,
                    cal_rest, cal_cond, comentario, fecha_cal])
        id_cal += 1
    return cab

# ─── SANCIONES ────────────────────────────────────────────────────────────────
def gen_sanciones(conductores_data):
    """Historial de sanciones para conductores Sancionados e Inactivos con antecedentes"""
    rng = random.Random(55)
    cab = [['id_sancion','id_conductor','fecha_sancion','tipo_sancion',
            'descripcion','pedidos_afectados','gravedad',
            'estatus_sancion','fecha_resolucion']]
    id_sanc = 1

    for c in conductores_data:
        n = 0
        if c['estatus'] == 'Sancionado':
            n = rng.randint(1, 3)
        elif c['estatus'] == 'Inactivo' and rng.random() < 0.15:
            n = 1   # sancion resuelta en el pasado

        if n == 0:
            continue

        fecha_ing     = c['fecha_ingreso']
        dias_disp     = max(60, (FECHA_FIN - fecha_ing).days - 30)

        for j in range(n):
            tipo    = rng.choices(TIPOS_SANCION, weights=PESOS_SANCION, k=1)[0]
            grav    = rng.choices(GRAVEDADES, weights=PESOS_GRAVEDAD[tipo], k=1)[0]
            desc    = rng.choice(DESCRIPCIONES_SANCION[tipo])
            afect   = rng.randint(1, 12) if tipo in ('abandono_pedido', 'demora_excesiva', 'fraude') else 0
            offset  = rng.randint(30, dias_disp)
            f_sanc  = fecha_ing + timedelta(days=offset)

            # La última sanción activa; las anteriores están resueltas
            if c['estatus'] == 'Sancionado':
                est_s = 'activa' if j == n - 1 else 'resuelta'
            else:
                est_s = 'resuelta'

            f_resol = None
            if est_s == 'resuelta':
                f_resol = f_sanc + timedelta(days=rng.randint(15, 60))

            cab.append([id_sanc, c['id_conductor'], f_sanc, tipo, desc,
                        afect, grav, est_s, f_resol])
            id_sanc += 1

    return cab

# ─── COMBOS ───────────────────────────────────────────────────────────────────
def gen_combos(restaurantes_data, productos_data):
    """~40% de restaurantes tienen 1-2 combos con descuento del 10-20%"""
    rng = random.Random(77)

    prod_por_rest = {}
    for p in productos_data:
        prod_por_rest.setdefault(p['id_restaurante'], []).append(p)

    combos_rows  = [['id_combo','id_restaurante','nombre_combo','descripcion',
                     'precio_combo','precio_normal','ahorro_pct','activo']]
    cp_rows      = [['id_combo','id_producto','cantidad']]
    id_combo     = 1

    for r in restaurantes_data:
        if rng.random() > 0.40:
            continue
        prods = prod_por_rest.get(r['id_restaurante'], [])
        if len(prods) < 2:
            continue

        for _ in range(rng.randint(1, 2)):
            n_p      = rng.randint(2, min(3, len(prods)))
            selected = rng.sample(prods, n_p)
            cants    = [rng.randint(1, 2) for _ in selected]
            p_normal = round(sum(p['precio'] * c for p, c in zip(selected, cants)), 2)
            dcto     = rng.uniform(0.10, 0.20)
            p_combo  = round(p_normal * (1 - dcto), 2)
            ahorro   = round(dcto * 100, 1)

            # Nombre del combo basado en los productos
            partes   = [p['nombre_producto'].split()[0] for p in selected[:2]]
            nombre_c = f"Combo {' + '.join(partes)}"
            desc_c   = 'Incluye: ' + ', '.join(
                f'{c}x {p["nombre_producto"]}' for p, c in zip(selected, cants))

            combos_rows.append([id_combo, r['id_restaurante'], nombre_c,
                                 desc_c, p_combo, p_normal, ahorro, True])
            for p, c in zip(selected, cants):
                cp_rows.append([id_combo, p['id_producto'], c])

            id_combo += 1

    return combos_rows, cp_rows

# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    # Guarda en la misma carpeta del script
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    SALIDA     = SCRIPT_DIR + os.sep
    total_est  = NUM_USUARIOS * PEDIDOS_MIN_POR_USUARIO + PEDIDOS_EXTRA

    print('\n' + '='*65)
    print('  DidiFood – Generador v4')
    print('='*65)
    print(f'  Restaurantes   : 300')
    print(f'  Productos      : ~1 000  (~3-4 por restaurante)')
    print(f'  Usuarios       : {NUM_USUARIOS:,}  (+canal_adquisicion, +dispositivo)')
    print(f'  Conductores    : {NUM_CONDUCTORES:,}')
    print(f'  Pedidos est.   : {total_est:,}  (+propina, +distancia_km, +tiempo_prep_min)')
    print(f'  Periodo        : {FECHA_BASE.year} – {FECHA_FIN.year}')
    print(f'  Nuevas tablas  : detalle_pedidos, calificaciones,')
    print(f'                   sanciones_conductores, combos, combo_productos')
    print('='*65 + '\n')

    print('Construyendo catalogos...')
    restaurantes_data, productos_data = build_restaurantes_productos()
    conductores_data                  = build_conductores()
    print(f'  -> {len(restaurantes_data)} restaurantes | {len(productos_data)} productos | {len(conductores_data)} conductores\n')

    print('Guardando tablas base...')
    csv_guardar(SALIDA + 'restaurantes.csv', gen_restaurantes(restaurantes_data))
    csv_guardar(SALIDA + 'productos.csv',    gen_productos(productos_data))
    csv_guardar(SALIDA + 'usuarios.csv',     gen_usuarios())
    csv_guardar(SALIDA + 'conductores.csv',  gen_conductores_csv(conductores_data))

    print('\nGenerando pedidos y detalle (proceso mas largo)...')
    pedidos_csv, detalle_csv, entregados_meta = gen_pedidos_y_detalle(
        restaurantes_data, productos_data)
    csv_guardar(SALIDA + 'pedidos.csv',         pedidos_csv)
    csv_guardar(SALIDA + 'detalle_pedidos.csv', detalle_csv)

    print('\nGenerando tablas derivadas...')
    rest_rating_map = {r['id_restaurante']: r['calificacion_promedio'] for r in restaurantes_data}
    cond_rating_map = {c['id_conductor']:   c['calificacion_promedio'] for c in conductores_data}
    csv_guardar(SALIDA + 'calificaciones.csv',        gen_calificaciones(entregados_meta, rest_rating_map, cond_rating_map))
    csv_guardar(SALIDA + 'sanciones_conductores.csv', gen_sanciones(conductores_data))

    combos_csv, cp_csv = gen_combos(restaurantes_data, productos_data)
    csv_guardar(SALIDA + 'combos.csv',          combos_csv)
    csv_guardar(SALIDA + 'combo_productos.csv', cp_csv)

    print(f'\n{"="*65}')
    print(f'  Listo — archivos en: {SALIDA}')
    print(f'  Total pedidos      : {len(pedidos_csv)-1:,}')
    print(f'  Total detalle      : {len(detalle_csv)-1:,}')
    print(f'  Total calific.     : {len(gen_calificaciones.__doc__ and [] or [])}  (ver archivo)')
    print('='*65 + '\n')
