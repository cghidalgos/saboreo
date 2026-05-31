-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: datos iniciales de producción
-- Idempotente: usa ON CONFLICT DO NOTHING / DO UPDATE según columna única
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Usuario administrador ─────────────────────────────────────────────────
INSERT INTO profiles (id, email, full_name, password_hash)
VALUES (
  '4dce1a71-4485-47c0-bd78-e2ef5b123859',
  'admin@saboreo.com',
  'Administrador',
  '$2b$10$SAAwBwEQdVzzuUVB3sNYRufTaVP.zbGKyrOyj4N/Fvr9WfHh11Hdq'
)
ON CONFLICT (email) DO NOTHING;

-- ── 2. Rol admin ─────────────────────────────────────────────────────────────
INSERT INTO user_roles (user_id, role)
VALUES (
  '4dce1a71-4485-47c0-bd78-e2ef5b123859',
  'admin'
)
ON CONFLICT (user_id, role) DO NOTHING;

-- ── 3. Consentimiento informado "Orquídeas" ──────────────────────────────────
INSERT INTO consentimientos (
  id,
  titulo,
  titulo_investigacion,
  investigadores,
  texto_intro,
  ingredientes,
  tiene_pregunta_alergia,
  texto_alergia,
  parrafos,
  texto_contacto,
  creado_por
)
VALUES (
  '5fba39e5-2606-48f1-b3a6-0658b92c01ac',

  $SEED$Consentimiento informado — Orquídeas$SEED$,

  $SEED$Diseño de un producto proteico enriquecido con subproductos de cacao basado en técnicas de inteligencia artificial para la población infantil$SEED$,

  $SEED$[
    {"nombre": "Diana Paola Navia Porras",         "email": "dpnavia@usbcali.edu.co",          "tel": "3175757338"},
    {"nombre": "Hani Daniela Tenorio Mosquera",    "email": "hdtenoriom@correo.usbcali.edu.co", "tel": null},
    {"nombre": "María Juliana Giraldo Santacruz",  "email": "mjgiraldos1@correo.usbcali.edu.co","tel": null}
  ]$SEED$::jsonb,

  $SEED$El propósito de este consentimiento informado es proveer a los participantes en esta investigación una clara explicación de la naturaleza de la misma, así como el rol que desempeña en esta.

La presente investigación es conducida por las investigadoras Hani Daniela Tenorio Mosquera y María Juliana Giraldo Santacruz de la Universidad de San Buenaventura Cali y asesorada por la directora de la investigación Diana Paola Navia Porras, de la misma institución. El objetivo general de esta investigación es evaluar mediante gestos faciales, palabras y opiniones la percepción sensorial que tienen los panelistas de cada muestra, para así alimentar la plataforma creada mediante IA.

Si usted accede a participar en este estudio, se le pedirá probar trece (13) muestras del alimento presentado en barra, realizadas en esta investigación, y se evaluará la percepción sensorial que tiene de estas por medio de diversas preguntas.$SEED$,

  $SEED$[
    {"ingrediente": "Tofu de soya",       "marca": "Morinaga",              "porcentaje": "20-30%"},
    {"ingrediente": "Harina de avena",    "marca": "Quaker",                "porcentaje": "10-50%"},
    {"ingrediente": "Cascarilla de cacao","marca": "Producto no comercial", "porcentaje": "20-60%"},
    {"ingrediente": "Mucilago de cacao",  "marca": "Producto no comercial", "porcentaje": "20-30%"},
    {"ingrediente": "Manteca de cacao",   "marca": "San Jorge",             "porcentaje": "3-6%"},
    {"ingrediente": "Stevia",             "marca": "Azana",                 "porcentaje": "6-10%"}
  ]$SEED$::jsonb,

  true,

  $SEED$¿Tiene algún tipo de alergia a los ingredientes del producto que probará en el ensayo?$SEED$,

  $SEED$[
    "El ejercicio sensorial consiste en probar la muestra y dar su percepción. Esto tomará como máximo 60 minutos de su tiempo. Todo dato personal recolectado que permita identificarlo será tomado de forma anónima y estos no serán utilizados en ninguna circunstancia para el desarrollo de la investigación, guardando completa confidencialidad. Asimismo, los datos recolectados en la encuesta serán utilizados para completar los objetivos de esta investigación y estos serán incluidos en el documento de proyecto de investigación referido anteriormente, al cual el equipo de investigación de la Universidad de San Buenaventura de Cali tendrá acceso por medio de la plataforma «Saboreo».",
    "Tenga presente que los productos que usted va a ensayar son aptos para el consumo humano y se han desarrollado garantizando su higiene e inocuidad.",
    "Por otro lado, tenga presente que durante todo el estudio se va a respetar su bienestar, reconocimiento, dignidad e integridad corporal con la finalidad de que no sufra ningún daño moral o psicológico.",
    "Asimismo, usted es libre de participar o no en este estudio; en caso de hacerlo también tiene la posibilidad de abandonar el estudio durante cualquier momento en el caso que usted lo desee.",
    "Pulsando el botón «Aceptar» se entiende que está de acuerdo con las condiciones del panel sensorial y confirma su participación."
  ]$SEED$::jsonb,

  $SEED$Diana Paola Navia Porras
Tel: 3175757338
Correo: dpnavia@usbcali.edu.co$SEED$,

  '4dce1a71-4485-47c0-bd78-e2ef5b123859'
)
ON CONFLICT (id) DO NOTHING;

-- ── 4. Encuesta "Panel Sensorial Barra – Proyecto Orquídeas" ─────────────────
INSERT INTO encuestas (
  id,
  titulo,
  descripcion,
  producto,
  estado,
  num_muestras,
  instrucciones,
  atributos,
  preguntas,
  texto_alergia,
  campos_participante,
  consentimiento_id,
  usar_consentimiento,
  creado_por
)
VALUES (
  '9f43bedb-2025-4b2a-a94f-3aeb32aaa200',

  $SEED$Panel Sensorial Barra – Proyecto Orquídeas$SEED$,

  $SEED$Evaluación sensorial del atributo SABOR en 13 muestras de barra proteica enriquecida con subproductos de cacao para población infantil. Investigación conducida por la Universidad de San Buenaventura Cali.$SEED$,

  $SEED$Barra proteica cacao-avena (tofu de soya, harina de avena, cascarilla de cacao, mucilago de cacao, manteca de cacao, stevia)$SEED$,

  'activa',

  13,

  $SEED$Por favor evalúe las siguientes muestras cuidadosamente. Pruebe un bocado por muestra. Beba agua y consuma un trozo de galleta para limpiar su paladar entre cada muestra. Asegúrese de que el número de muestra coincida con la muestra que esté evaluando.$SEED$,

  '["SABOR"]'::jsonb,

  $SEED$[{"id": "p1", "tipo": "si_no", "texto": "¿Volvería a consumir este producto?", "requerida": true}]$SEED$::jsonb,

  $SEED$¿Tiene algún tipo de alergia a los ingredientes del producto que probará en el ensayo?$SEED$,

  $SEED$[
    {"key": "nombre",      "tipo": "texto",  "label": "Nombre completo",        "activo": true, "requerido": true},
    {"key": "edad",        "tipo": "numero", "label": "Edad",                   "activo": true, "requerido": true},
    {"key": "genero",      "tipo": "select", "label": "Género",                 "activo": true, "requerido": true, "opciones": ["Niño", "Niña", "Otro"]},
    {"key": "institucion", "tipo": "texto",  "label": "Institución / escuela",  "activo": true, "requerido": false}
  ]$SEED$::jsonb,

  '5fba39e5-2606-48f1-b3a6-0658b92c01ac',

  true,

  '4dce1a71-4485-47c0-bd78-e2ef5b123859'
)
ON CONFLICT (id) DO NOTHING;
