import { pipeline, env } from '@xenova/transformers';

// Configuration for browser environment (disable node-specific FS)
env.allowLocalModels = false;
env.useBrowserCache = true;

class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-tiny.en';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = await pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    // If the message is a preload command
    if (event.data.action === 'preload') {
        try {
            await PipelineSingleton.getInstance(x => {
                self.postMessage({ status: 'progress', data: x });
            });
            self.postMessage({ status: 'ready' });
        } catch (err) {
            self.postMessage({ status: 'error', error: err.message });
        }
        return;
    }

    const audioData = event.data.audio;
    const isFinal = event.data.isFinal !== undefined ? event.data.isFinal : true;
    if (!audioData) return;
    
    // Retrieve the translation pipeline
    let transcriber;
    try {
        transcriber = await PipelineSingleton.getInstance(x => {
            self.postMessage({ status: 'progress', data: x });
        });
    } catch (err) {
        self.postMessage({ status: 'error', error: err.message });
        return;
    }

    // Only notify transcribing for final chunk to avoid UI jitter
    if (isFinal) self.postMessage({ status: 'transcribing' });

    try {
        let output = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            language: 'english',
            task: 'transcribe',
        });

        self.postMessage({
            status: isFinal ? 'complete' : 'interim',
            result: output.text
        });
    } catch (err) {
        self.postMessage({ status: 'error', error: err.message });
    }
});
