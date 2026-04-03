import { CONFIG } from "../config";

const DEFAULT_SYSTEM = "Sos un tutor universitario experto que ayuda a estudiantes de la Licenciatura en Gobernanza de Datos de la UCALP. Respondé siempre en español rioplatense, de forma clara, amable y pedagógica. Usá voseo.";
const DEFAULT_MODEL = "arcee-ai/trinity-large-preview:free";

/**
 * Call AI via OpenRouter (dev) or Cloudflare Worker proxy (production).
 * @param {string} prompt - The text prompt
 * @param {string} systemPrompt - System prompt (default tutor)
 * @param {Array} images - Optional array of image objects for vision [{data: "base64...", mimeType: "image/png"}]
 */
export async function callAI(prompt, systemPrompt = DEFAULT_SYSTEM, images = null) {
  try {
    const apiKey = import.meta.env.VITE_OPENROUTER_KEY;

    // Build user message content
    let userContent = prompt;
    if (images && images.length > 0) {
      userContent = [
        ...images.map(img => ({
          type: "image_url",
          image_url: { url: img.data.startsWith("data:") ? img.data : `data:${img.mimeType || "application/pdf"};base64,${img.data}` },
        })),
        { type: "text", text: prompt },
      ];
    }

    if (apiKey) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Studium UCALP",
        },
        body: JSON.stringify({
          model: import.meta.env.VITE_AI_MODEL || DEFAULT_MODEL,
          max_tokens: 8192,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });
      const data = await res.json();
      if (data.error) {
        console.error("OpenRouter error:", data.error);
        return `Error: ${data.error.message || "No se pudo generar respuesta."}`;
      }
      return data.choices?.[0]?.message?.content || "No pude generar una respuesta.";
    }

    // Production: via Cloudflare Worker proxy
    const res = await fetch(CONFIG.AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemPrompt, images }),
    });
    const data = await res.json();
    return data.response || "No pude generar una respuesta.";
  } catch (err) {
    console.error("AI Error:", err);
    return "Error al conectar con la IA. Verificá tu conexión.";
  }
}

/**
 * Generate study summary for a course
 */
export async function generateCourseSummary(courseName, materialText = null) {
  const contextPart = materialText
    ? `\n\nEstos son los contenidos reales de la materia:\n---\n${materialText.slice(0, 6000)}\n---\n\nBasate en estos contenidos para el resumen.`
    : "";

  return callAI(
    `Generame un resumen completo de estudio para la materia "${courseName}" de la Licenciatura en Gobernanza de Datos.${contextPart}\n\nIncluí:\n1. Conceptos clave (5-7 conceptos con definiciones breves)\n2. Mapa conceptual en texto (relaciones entre conceptos)\n3. Preguntas de repaso (3 preguntas)\nFormato: usá markdown con ## para secciones.`
  );
}

/**
 * Generate weekly study plan
 */
export async function generateStudyPlan(courses) {
  const list = courses.map(c => `- ${c.fullname} (progreso: ${c.progress ?? 0}%)`).join("\n");
  const result = await callAI(
    `Creame un plan de estudio semanal para un estudiante que cursa:\n${list}\n\nOrganizalo de lunes a sábado, bloques de 1-2 horas. Priorizá las de menor progreso. Incluí técnicas de estudio. Formato JSON exacto (sin markdown, sin backticks): {"days":[{"day":"Lunes","blocks":[{"time":"09:00-10:30","course":"nombre","task":"descripción","technique":"técnica"}]}]}`,
    "Sos un tutor experto en planificación. Respondé SOLO con el JSON pedido, sin texto adicional, sin markdown, sin backticks."
  );
  try { return JSON.parse(result.replace(/```json|```/g, "").trim()); }
  catch { return null; }
}

/**
 * Generate practice quiz
 */
export async function generateQuiz(courseName, materialText = null) {
  const contextPart = materialText
    ? `\n\nBasate en este contenido real:\n---\n${materialText.slice(0, 4000)}\n---`
    : "";

  const result = await callAI(
    `Generame un cuestionario de 5 preguntas multiple choice para "${courseName}".${contextPart}\nFormato JSON exacto (sin markdown, sin backticks): {"questions":[{"id":1,"question":"texto","options":["A","B","C","D"],"correct":0,"explanation":"por qué"}]}`,
    "Sos un profesor que crea evaluaciones. Respondé SOLO con JSON, sin texto adicional."
  );
  try { return JSON.parse(result.replace(/```json|```/g, "").trim()); }
  catch { return null; }
}

/**
 * Chat with tutor
 */
export async function chatWithTutor(message, courseContext) {
  return callAI(
    `${courseContext}\n\nPregunta del alumno: ${message}`,
    "Sos un tutor IA de la Lic. en Gobernanza de Datos de la UCALP. Ayudás con dudas, explicás conceptos, sugerís técnicas de estudio. Usá español rioplatense con voseo. Sé cálido pero riguroso."
  );
}