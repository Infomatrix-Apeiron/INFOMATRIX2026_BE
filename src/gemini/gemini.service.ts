import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {GoogleGenAI} from '@google/genai';
import {randomUUID} from 'node:crypto';
import {getAssemblyPrompt, prepareIdeasListPrompt, prepareResultPrompt} from './gemini.prompts';

@Injectable()
export class GeminiService {

    private readonly logger = new Logger(GeminiService.name);
    private ai: GoogleGenAI;

    // Pipeline tuning
    private readonly IMAGE_BATCH_SIZE = 3;
    private readonly IMAGE_MAX_RETRIES_5XX = 2;

    constructor(private config: ConfigService) {
        this.ai = new GoogleGenAI({
            apiKey: this.config.get<string>('GEMINI_API_KEY')!,
        })
    }

    async generateText(prompt: string): Promise<string> {

        const response = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }],
                },
            ],
        });

        return response.text ?? '';
    }

    async generateIdeas(
        text: string,
        files?: {
            mimeType: string;
            buffer: Buffer;
        }[]
    ): Promise<{ title: string; description: string, emoji: string }[]> {

        const parts: any[] = [
            {
                text: prepareIdeasListPrompt(text ?? '')
            }
        ];

        if (files?.length) {
            for (const file of files) {
                parts.push({
                    inlineData: {
                        mimeType: file.mimeType,
                        data: file.buffer.toString('base64'),
                    },
                });
            }
        }

        const ideasSchema = {
            type: "array",
            minItems: 4,
            maxItems: 7,
            items: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    emoji: { type: "string" },
                },
                required: ["title", "description", "emoji"]
            }
        };

        const response = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            config: {
                responseMimeType: "application/json",
                responseSchema: ideasSchema,
                maxOutputTokens: 8192,
            },
            contents: [
                {
                    role: 'user',
                    parts,
                },
            ],
        });

        const textResponse = response.text ?? '[]';

        try {
            return JSON.parse(textResponse);
        } catch {
            return [];
        }
    }

    async generateInstructions(
        title: string,
        description: string,
        photo?: { mimeType: string; buffer: Buffer }
    ) {

        const parts: any[] = [
            {
                text: getAssemblyPrompt(title, description)
            }
        ];

        if (photo) {
            parts.push({
                inlineData: {
                    mimeType: photo.mimeType,
                    data: photo.buffer.toString('base64'),
                }
            });
        }

        const schema = {
            type: "object",
            properties: {
                title: { type: "string" },
                description: { type: "string" },
                steps: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            step: { type: "number" },
                            title: { type: "string" },
                            description: { type: "string" },
                            imagePrompt: { type: "string" }
                        },
                        required: ["step", "title", "description", "imagePrompt"]
                    }
                }
            },
            required: ["title", "description", "steps"]
        };

        const response = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            config: {
                responseMimeType: "application/json",
                responseSchema: schema
            },
            contents: [{ role: 'user', parts }]
        });

        return JSON.parse(response.text ?? '{}');
    }

    async generateFeedback(
        photo?: { mimeType: string; buffer: Buffer }
    ): Promise<string> {

        const parts: any[] = [
            {
                text: prepareResultPrompt()
            }
        ];

        if (photo) {
            parts.push({
                inlineData: {
                    mimeType: photo.mimeType,
                    data: photo.buffer.toString('base64'),
                }
            });
        }

        const schema = {
            type: "object",
            properties: {
                message: { type: "string" }
            },
            required: ["message"]
        };

        const response = await this.ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            config: {
                responseMimeType: "application/json",
                responseSchema: schema
            },
            contents: [{ role: 'user', parts }]
        });

        const result = JSON.parse(response.text ?? '{}');

        return result.message ?? '';
    }


    // ================================================================
    // IMAGE GENERATION
    // ================================================================
    // Currently using ONLY NanoBanana 2 (Gemini 3.1 Flash Image).
    // Imagen 4 Fast was disabled due to extremely low Tier 1 RPD (70/day).
    // The Imagen method is kept commented below — re-enable if quota changes.
    // ================================================================

    async generateImageWithNanoBanana(prompt: string, retries?: number, imageId?: string): Promise<string> {

        const id = imageId ?? randomUUID().slice(0, 8);
        const remaining = retries ?? this.IMAGE_MAX_RETRIES_5XX;
        const attempt = this.IMAGE_MAX_RETRIES_5XX - remaining + 1;
        const startedAt = Date.now();

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-3.1-flash-image-preview',
                contents: prompt,
                config: {
                    imageConfig: {
                        aspectRatio: '1:1'
                    }
                }
            });

            const parts = response.candidates?.[0]?.content?.parts ?? [];
            const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'));

            if (!imagePart?.inlineData?.data) {
                throw new Error('Empty NanoBanana response');
            }

            this.logger.log(`[NanoBanana] success imageId=${id} attempt=${attempt} duration=${Date.now() - startedAt}ms`);
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

        } catch (err: any) {
            const status = err?.status ?? err?.error?.code;
            const isRetryable5xx = [500, 502, 503, 504].includes(status);

            this.logger.error(
                `[NanoBanana] fail imageId=${id} attempt=${attempt} status=${status ?? 'n/a'} duration=${Date.now() - startedAt}ms msg=${err?.message}`
            );

            if (isRetryable5xx && remaining > 0) {
                const delay = Math.min(8000, 1000 * Math.pow(2, attempt - 1)) + Math.random() * 500;
                this.logger.warn(`[NanoBanana] retry imageId=${id} in ${Math.round(delay)}ms`);
                await new Promise(r => setTimeout(r, delay));
                return this.generateImageWithNanoBanana(prompt, remaining - 1, id);
            }

            // 4xx (включно з 429), або 5xx з вичерпаними retry — підіймаємо вгору
            throw err;
        }
    }


    // ================================================================
    // PIPELINE
    // ================================================================

    async assembleInstructionsWithImages(
        title: string,
        description: string,
        photo?: { mimeType: string; buffer: Buffer }
    ) {

        const requestId = randomUUID().slice(0, 8);
        const startedAt = Date.now();

        this.logger.log(`[Pipeline] start requestId=${requestId} title="${title}"`);

        const instructions = await this.generateInstructions(title, description, photo);

        const stepsCount = instructions.steps?.length ?? 0;
        this.logger.log(`[Pipeline] instructions ready requestId=${requestId} steps=${stepsCount}`);

        const steps = await this.generateImagesInBatches(instructions.steps, this.IMAGE_BATCH_SIZE, requestId);

        const failed = steps.filter(s => !s.image).length;
        this.logger.log(
            `[Pipeline] done requestId=${requestId} duration=${Date.now() - startedAt}ms steps=${steps.length} failed=${failed}`
        );

        return {
            title: instructions.title,
            description: instructions.description,
            steps
        };
    }

    private async generateImagesInBatches(rawSteps: any[], batchSize: number, requestId: string) {

        const result: any[] = [];
        const totalBatches = Math.ceil(rawSteps.length / batchSize);

        for (let i = 0; i < rawSteps.length; i += batchSize) {

            const batchNum = Math.floor(i / batchSize) + 1;
            const batch = rawSteps.slice(i, i + batchSize);

            this.logger.log(`[Pipeline] batch ${batchNum}/${totalBatches} requestId=${requestId} size=${batch.length}`);

            const processed = await Promise.all(
                batch.map(async (step) => {

                    const imageId = `${requestId}-s${step.step}`;

                    try {
                        const image = await this.generateImageWithNanoBanana(step.imagePrompt, undefined, imageId);
                        return {
                            step: step.step,
                            title: step.title,
                            description: step.description,
                            image
                        };
                    } catch (err: any) {
                        // Падіння одного кроку не валить весь pipeline.
                        // Фронт отримає image: null і зможе показати плейсхолдер.
                        this.logger.error(`[Pipeline] step skipped requestId=${requestId} step=${step.step}`);
                        return {
                            step: step.step,
                            title: step.title,
                            description: step.description,
                            image: null
                        };
                    }
                })
            );

            result.push(...processed);
        }

        return result;
    }
}
