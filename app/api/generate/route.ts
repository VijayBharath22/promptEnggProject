import { NextResponse } from 'next/server';
import { z } from 'zod';

const TestCase = z.object({ id: z.string(), category: z.enum(['Positive', 'Negative', 'Boundary', 'Security']), description: z.string(), requestPayload: z.unknown(), expectedResult: z.string(), requirementReference: z.string(), assumptionWarnings: z.array(z.string()) });
const RequestBody = z.object({ input: z.string().min(5), inputType: z.enum(['openapi', 'description']), strategy: z.enum(['zero-shot', 'role-based', 'few-shot', 'structured', 'adaptive']) });
const Output = z.object({ tests: z.array(TestCase).min(1), coverage: z.number(), tokens: z.number().optional() });
const outputFormat = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      tests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            category: { type: 'string', enum: ['Positive', 'Negative', 'Boundary', 'Security'] },
            description: { type: 'string' },
            // Encode arbitrary request JSON as a string for Claude's strict schema, then parse it below.
            requestPayload: { type: 'string' },
            expectedResult: { type: 'string' },
            requirementReference: { type: 'string' },
            assumptionWarnings: { type: 'array', items: { type: 'string' } },
          },
          required: ['id', 'category', 'description', 'requestPayload', 'expectedResult', 'requirementReference', 'assumptionWarnings'],
          additionalProperties: false,
        },
      },
      coverage: { type: 'number' },
    },
    required: ['tests', 'coverage'],
    additionalProperties: false,
  },
} as const;

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: 'Claude generation is not configured. Add ANTHROPIC_API_KEY to .env.local, save the file, and restart the server.' }, { status: 503 });
  const startedAt = Date.now();
  try {
    const body = RequestBody.parse(await request.json());
    const system = `You are TestForge AI, an API QA engineer. Generate 5 to 8 high-signal API test cases grounded strictly in the supplied specification or endpoint description. Never invent undocumented behavior, status codes, schemas, auth requirements, or constraints. When a behavior cannot be supported by the input, state that in assumptionWarnings and avoid asserting it as expected behavior. Return the requested JSON object. Encode each requestPayload as a JSON string (for example, "{\\"method\\":\\"GET\\",\\"path\\":\\"/items\\"}"); the application will decode it. Coverage is a percentage of identifiable documented requirements exercised. Include positive, negative, boundary and security tests only where evidence supports them. For unavailable evidence use an explicit warning. Keep each case concise and independently actionable.`;
    const strategyInstructions: Record<string, string> = {
      'zero-shot': 'Use zero-shot reasoning. Produce a concise, direct set of cases grounded in the supplied evidence.',
      'role-based': 'Adopt the role of a senior API test engineer. Prioritize realistic client and adversarial perspectives.',
      'few-shot': 'Use this pattern: requirement → concrete request → documented expected result → evidence reference. Apply it consistently.',
      'structured': 'Work systematically: extract requirements, map each to cases, then return the final JSON with concise traceability.',
      'adaptive': 'Use an adaptive multi-stage workflow internally: extract evidence, identify gaps, generate diverse cases, and audit every expected result for unsupported claims.'
    };
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 4096,
        system: `${system}\n\nPrompt strategy: ${strategyInstructions[body.strategy]}`,
        messages: [{ role: 'user', content: `Input type: ${body.inputType}\n\n${body.input}` }],
        output_config: { format: outputFormat },
      }),
    });
    if (!response.ok) {
      const providerError = await response.json().catch(() => null);
      const message = providerError?.error?.message || `Claude API request failed (${response.status}).`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
    const data = await response.json();
    const content = data.content?.find((block: { type?: string }) => block.type === 'text')?.text;
    if (!content) return NextResponse.json({ error: 'The AI provider returned an empty response. Please try again.' }, { status: 502 });
    if (data.stop_reason === 'max_tokens') return NextResponse.json({ error: 'Claude stopped before finishing the test cases. Try a shorter API specification.' }, { status: 502 });
    const decoded = JSON.parse(content);
    const parsed = Output.parse({
      ...decoded,
      tests: decoded.tests?.map((test: { requestPayload?: unknown }) => ({
        ...test,
        requestPayload: typeof test.requestPayload === 'string' ? JSON.parse(test.requestPayload) : test.requestPayload,
      })),
    });
    const usage = data.usage?.input_tokens + data.usage?.output_tokens;
    return NextResponse.json({ ...parsed, tokens: usage ?? parsed.tokens, latencyMs: Date.now() - startedAt });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input or AI response did not match the required test case schema.', details: error.issues.map(i => i.message) }, { status: 400 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'The AI returned malformed JSON. Please retry generation.' }, { status: 502 });
    return NextResponse.json({ error: 'Unable to generate tests right now. Check your connection and try again.' }, { status: 500 });
  }
}
