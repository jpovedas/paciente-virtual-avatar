import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { messages, caseContext, caseTitle } = await req.json();

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'No hay mensajes para evaluar' }, { status: 400 });
  }

  const transcript = messages
    .map((m: { role: string; content: string }) =>
      `${m.role === 'user' ? 'Médico' : 'Paciente'}: ${m.content}`)
    .join('\n');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Eres un evaluador experto de habilidades clínicas médicas.

CASO CLÍNICO (${caseTitle}):
${caseContext}

TRANSCRIPCIÓN DE LA CONSULTA:
${transcript}

Evalúa la consulta médica y responde ÚNICAMENTE con un JSON válido con esta estructura exacta (sin markdown, sin texto adicional):
{
  "score": <número del 1 al 10>,
  "diagnostico_identificado": <true o false>,
  "diagnostico_probable": "<nombre del diagnóstico más probable según el caso>",
  "fortalezas": ["<fortaleza 1>", "<fortaleza 2>"],
  "areas_mejora": ["<área 1>", "<área 2>"],
  "preguntas_clave_realizadas": ["<pregunta realizada 1>"],
  "preguntas_faltantes": ["<pregunta importante no realizada 1>", "<pregunta 2>"],
  "resumen": "<2-3 oraciones de feedback general constructivo>"
}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const evaluation = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return NextResponse.json(evaluation);
  } catch (error: any) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: error.message || 'Error al generar evaluación' },
      { status: 500 }
    );
  }
}
