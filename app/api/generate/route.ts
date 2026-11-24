import { NextResponse } from 'next/server';
import { z } from 'zod';

const TestCase = z.object({ id: z.string(), category: z.enum(['Positive', 'Negative', 'Boundary', 'Security']), description: z.string(), requestPayload: z.unknown(), expectedResult: z.string(), requirementReference: z.string(), assumptionWarnings: z.array(z.string()) });
const RequestBody = z.object({ input: z.string().min(5), inputType: z.enum(['openapi', 'description']), strategy: z.enum(['zero-shot', 'role-based', 'few-shot', 'structured', 'adaptive']) });
const Output = z.object({ tests: z.array(TestCase).min(1), coverage: z.number(), tokens: z.number().optional() });

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: 'AI generation is not configured. Add OPENAI_API_KEY to the server environment, or use Demo mode.' }, { status: 503 });
  const startedAt = Date.now();
  try {
    const body = RequestBody.parse(await request.json());
    const system = `You are TestForge AI, an API QA engineer. Generate high-signal API test cases grounded strictly in the supplied specification or endpoint description. Never invent undocumented behavior, status codes, schemas, auth requirements, or constraints. When a behavior cannot be supported by the input, state that in assumptionWarnings and avoid asserting it as expected behavior. Return only valid JSON matching {"tests":[{"id":"TC-001","category":"Positive|Negative|Boundary|Security","description":"...","requestPayload":{},"expectedResult":"...","requirementReference":"...","assumptionWarnings":[]}],"coverage":0}. Coverage is an integer percentage of identifiable documented requirements exercised. Include a balanced mix of positive, negative, boundary and security tests only where evidence supports them. For unavailable evidence use an explicit warning. Keep each case independently actionable.`;
    const strategyInstructions: Record<string, string> = {
      'zero-shot': 'Use zero-shot reasoning. Produce a concise, direct set of cases grounded in the supplied evidence.',
      'role-based': 'Adopt the role of a senior API test engineer. Prioritize realistic client and adversarial perspectives.',
      'few-shot': 'Use this pattern: requirement → concrete request → documented expected result → evidence reference. Apply it consistently.',
      'structured': 'Work systematically: extract requirements, map each to cases, then return the final JSON with concise traceability.',
      'adaptive': 'Use an adaptive multi-stage workflow internally: extract evidence, identify gaps, generate diverse cases, and audit every expected result for unsupported claims.'
    };
    const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: `${system}\n\nPrompt strategy: ${strategyInstructions[body.strategy]}` }, { role: 'user', content: `Input type: ${body.inputType}\n\n${body.input}` }] }) });
    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json({ error: `AI provider error (${response.status}). ${message.slice(0, 240)}` }, { status: 502 });
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return NextResponse.json({ error: 'The AI provider returned an empty response. Please try again.' }, { status: 502 });
    const parsed = Output.parse(JSON.parse(content));
    const usage = data.usage?.total_tokens;
    return NextResponse.json({ ...parsed, tokens: usage ?? parsed.tokens, latencyMs: Date.now() - startedAt });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input or AI response did not match the required test case schema.', details: error.issues.map(i => i.message) }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'The AI returned malformed JSON. Please retry generation.' }, { status: 502 });
    return NextResponse.json({ error: 'Unable to generate tests right now. Check your connection and try again.' }, { status: 500 });
  }
}
