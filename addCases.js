// Script para agregar casos clínicos a Firebase
// Ejecutar con: node scripts/addCases.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

// Configuración de Firebase (copia de tu .env.local)
const firebaseConfig = {
  apiKey: "AIzaSyDHjGUosvXZp8Oo5TcZAgoVXCCo8A61Z8A",
  authDomain: "paciente-virtual-avatar.firebaseapp.com",
  projectId: "paciente-virtual-avatar-e86ce",
  storageBucket: "paciente-virtual-avatar.firebasestorage.app",
  messagingSenderId: "93155755963",
  appId: "1:93155755963:web:25b28a02ce2d468b4f269e"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Array de casos clínicos
const casos = [
  {
    title: "Hipertensión Arterial",
    specialty: "Cardiología",
    difficulty: "Fácil",
    avatarGender: "female",
    caseContext: `PERFIL:
- María González, 58 años, maestra

MOTIVO DE CONSULTA:
Dolor de cabeza frecuente y mareos desde hace 2 semanas

SÍNTOMAS:
- Cefalea matutina
- Mareos ocasionales
- Visión borrosa intermitente
- No ha medido presión recientemente

ANTECEDENTES:
- Madre con hipertensión
- Sedentarismo
- IMC: 28 (sobrepeso)

COMPORTAMIENTO:
- Preocupada pero calmada
- Responde con claridad
- Menciona estrés laboral alto`
  },
  {
    title: "Diabetes Tipo 2 Descompensada",
    specialty: "Endocrinología",
    difficulty: "Intermedio",
    avatarGender: "male",
    caseContext: `PERFIL:
- Roberto Sánchez, 62 años, jubilado

MOTIVO DE CONSULTA:
Mucha sed, orino mucho y me siento cansado

SÍNTOMAS:
- Polidipsia y poliuria desde hace 1 mes
- Fatiga marcada
- Visión borrosa
- Pérdida de peso (5 kg en 2 meses)
- Herida en pie que no cicatriza

ANTECEDENTES:
- Diabético hace 10 años
- Irregular con medicamentos
- Padre falleció por complicaciones diabéticas

COMPORTAMIENTO:
- Algo preocupado
- Admite no cuidarse bien
- Respuestas directas`
  },
  {
    title: "Asma Bronquial Exacerbada",
    specialty: "Neumología",
    difficulty: "Intermedio",
    avatarGender: "female",
    caseContext: `PERFIL:
- Ana Martínez, 28 años, diseñadora

MOTIVO DE CONSULTA:
No puedo respirar bien, me falta el aire

SÍNTOMAS:
- Disnea progresiva hace 2 días
- Tos seca nocturna
- Sibilancias audibles
- Opresión en el pecho
- Empeora con ejercicio

ANTECEDENTES:
- Asma desde los 15 años
- Alérgica a ácaros y polen
- Usa inhalador pero se acabó hace 1 semana

COMPORTAMIENTO:
- Ansiosa, respira con dificultad
- Respuestas cortas por falta de aire
- Preocupada`
  },
  {
    title: "Gastroenteritis Aguda",
    specialty: "Medicina Interna",
    difficulty: "Fácil",
    avatarGender: "male",
    caseContext: `PERFIL:
- Luis Ramírez, 35 años, ingeniero

MOTIVO DE CONSULTA:
Llevo 2 días con diarrea y vómito

SÍNTOMAS:
- Diarrea líquida (6-8 veces/día)
- Náuseas y vómitos
- Dolor abdominal difuso tipo cólico
- Fiebre baja (37.8°C)
- Come poco por náuseas

ANTECEDENTES:
- Sano previamente
- Comió mariscos hace 3 días

COMPORTAMIENTO:
- Se ve cansado y deshidratado
- Responde bien pero con molestia
- Algo desesperado por mejorar`
  },
  {
    title: "Migraña con Aura",
    specialty: "Neurología",
    difficulty: "Intermedio",
    avatarGender: "female",
    caseContext: `PERFIL:
- Patricia Flores, 32 años, contadora

MOTIVO DE CONSULTA:
Dolor de cabeza terrible con luces

SÍNTOMAS:
- Cefalea hemicraneal pulsátil intensa
- Visión de luces zigzagueantes antes del dolor
- Náuseas y vómitos
- Fotofobia y fonofobia
- Crisis dura 8-12 horas
- 2-3 episodios al mes

ANTECEDENTES:
- Primera crisis a los 20 años
- Madre con migrañas
- Se desencadena con estrés y menstruación

COMPORTAMIENTO:
- Habla despacio por el dolor
- Molesta con luz y ruido
- Busca alivio urgente`
  }
];

// Función para agregar casos
async function agregarCasos() {
  console.log('🔄 Agregando casos clínicos a Firestore...\n');
  
  try {
    for (const caso of casos) {
      const docRef = await addDoc(collection(db, 'clinical_cases'), caso);
      console.log(`✅ Caso agregado: "${caso.title}" (ID: ${docRef.id})`);
    }
    console.log('\n✨ ¡Todos los casos se agregaron exitosamente!');
  } catch (error) {
    console.error('❌ Error agregando casos:', error);
  }
}

// Ejecutar
agregarCasos();