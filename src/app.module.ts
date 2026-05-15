import {Module} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {ConfigModule} from '@nestjs/config';
import {AiController} from './gemini/ai.controller';
import {GeminiService} from './gemini/gemini.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true
        })
    ],
    controllers: [AppController, AiController],
    providers: [AppService, GeminiService],
})

export class AppModule {
}
