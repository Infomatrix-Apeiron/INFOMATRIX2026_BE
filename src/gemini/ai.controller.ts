import {Body, Controller, Post, UploadedFiles, UseInterceptors} from '@nestjs/common';
import {GeminiService} from './gemini.service';
import {FilesInterceptor} from '@nestjs/platform-express';

@Controller('ai')
export class AiController {

    constructor(private geminiService: GeminiService) {
    }

    @Post('generate-ideas')
    @UseInterceptors(FilesInterceptor('files'))
    async generateIdeas(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('prompt') userPrompt: string,
    ) {
        return await this.geminiService.generateIdeas(
            userPrompt,
            files?.map(file => ({
                mimeType: file.mimetype,
                buffer: file.buffer,
            }))
        );
    }

    @Post('generate-instructions')
    @UseInterceptors(FilesInterceptor('photo'))
    async generateInstructions(
        @Body('title') title: string,
        @Body('description') description: string,
        @UploadedFiles() files: Express.Multer.File[],
    ) {

        const photo = files?.[0]
            ? {
                mimeType: files[0].mimetype,
                buffer: files[0].buffer
            }
            : undefined;

        return await this.geminiService.assembleInstructionsWithImages(
            title,
            description,
            photo
        );
    }

    @Post('generate-feedback')
    @UseInterceptors(FilesInterceptor('photo'))
    async praiseCraft(
        @UploadedFiles() files: Express.Multer.File[]
    ) {

        const photo = files?.[0]
            ? {
                mimeType: files[0].mimetype,
                buffer: files[0].buffer
            }
            : undefined;

        const message = await this.geminiService.generateFeedback(photo);

        return {
            message
        };
    }
}
