import {Body, Controller, HttpException, HttpStatus, Post, UploadedFiles, UseInterceptors} from '@nestjs/common';
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
        @Body('age') age: number,
    ) {

        const photos = files?.map(file => ({
            mimeType: file.mimetype,
            buffer: file.buffer,
        }));

        // 1. SAFETY CHECK
        const safety = await this.geminiService.checkPhotoPrivacy(photos);
        console.log('safety', safety);

        if (!safety.safe) {
            throw new HttpException(
                {
                    error: 'unsafe_content',
                    message: safety.child_friendly_message,
                    reason: safety.reason,
                },
                HttpStatus.UNPROCESSABLE_ENTITY,
            );
        }

        // 2. GENERATE IDEAS
        return await this.geminiService.generateIdeas(userPrompt, age, photos);
    }

    @Post('generate-instructions')
    @UseInterceptors(FilesInterceptor('photo'))
    async generateInstructions(
        @Body('title') title: string,
        @Body('description') description: string,
        @Body('age') age: number,
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
            age,
            photo,
        );
    }

    @Post('generate-feedback')
    @UseInterceptors(FilesInterceptor('photo'))
    async praiseCraft(
        @UploadedFiles() files: Express.Multer.File[],
        @Body('age') age: number,
    ) {

        const photo = files?.[0]
            ? {
                mimeType: files[0].mimetype,
                buffer: files[0].buffer
            }
            : undefined;

        const message = await this.geminiService.generateFeedback(age, photo);

        return {
            message
        };
    }
}
