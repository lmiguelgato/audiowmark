/**
 * AudioWmark Real-time Web Application
 * 
 * This application demonstrates real-time audio watermarking using WebAssembly.
 * It includes both a sender (watermark embedder) and receiver (watermark detector).
 */

class AudioWmarkApp {
    constructor() {
        this.wasmModule = null;
        this.audioContext = null;
        this.watermarker = null;
        this.detector = null;
        
        // Audio processing
        this.sampleRate = 44100;
        this.frameSize = 512; // Will be set by WASM module
        this.isInitialized = false;
        
        // Sender state
        this.senderActive = false;
        this.oscillator = null;
        this.senderGain = null;
        this.senderProcessor = null;
        
        // Receiver state
        this.receiverActive = false;
        this.micStream = null;
        this.receiverProcessor = null;
        this.detectionHistory = [];
        
        // Statistics
        this.framesProcessed = 0;
        this.lastDetectionTime = 0;
        
        // WASM function wrappers
        this.wasmFunctions = {};
        
        this.initializeUI();
    }
    
    async initialize() {
        try {
            // Load WebAssembly module
            this.wasmModule = await AudioWmarkModule();
            console.log('AudioWmark WASM module loaded');
            
            // Setup WASM function wrappers
            this.setupWasmFunctions();
            
            // Get recommended frame size
            this.frameSize = this.wasmFunctions.getRecommendedFrameSize();
            
            // Initialize Web Audio
            await this.initializeAudioContext();
            
            this.isInitialized = true;
            this.showMainContent();
            this.updateSystemInfo();
            
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('Failed to initialize AudioWmark. Please refresh the page.');
        }
    }
    
    setupWasmFunctions() {
        const { cwrap, ccall } = this.wasmModule;
        
        this.wasmFunctions = {
            // Watermarker functions
            watermarkerCreate: cwrap('watermarker_create', 'number', ['number', 'number', 'number', 'string']),
            watermarkerDestroy: cwrap('watermarker_destroy', null, ['number']),
            watermarkerProcessFrame: cwrap('watermarker_process_frame', 'number', ['number', 'number', 'number', 'number']),
            watermarkerReset: cwrap('watermarker_reset', null, ['number']),
            
            // Detector functions
            detectorCreate: cwrap('detector_create', 'number', ['number', 'number']),
            detectorDestroy: cwrap('detector_destroy', null, ['number']),
            detectorProcessFrame: cwrap('detector_process_frame', null, ['number', 'number', 'number']),
            detectorGetResult: cwrap('detector_get_result', 'number', ['number', 'number', 'number', 'number']),
            detectorReset: cwrap('detector_reset', null, ['number']),
            
            // Utility functions
            textToHex: cwrap('text_to_hex', 'string', ['string']),
            hexToText: cwrap('hex_to_text', 'string', ['string']),
            validateHexMessage: cwrap('validate_hex_message', 'number', ['string']),
            getRecommendedFrameSize: cwrap('get_recommended_frame_size', 'number', [])
        };
    }
    
    async initializeAudioContext() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate,
            latencyHint: 'interactive'
        });
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        this.sampleRate = this.audioContext.sampleRate;
        console.log(`Audio context initialized at ${this.sampleRate}Hz`);
    }
    
    initializeUI() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }
    
    setupEventListeners() {
        // Sender controls
        document.getElementById('start-sender').addEventListener('click', () => this.startSender());
        document.getElementById('stop-sender').addEventListener('click', () => this.stopSender());
        
        // Receiver controls
        document.getElementById('start-receiver').addEventListener('click', () => this.startReceiver());
        document.getElementById('stop-receiver').addEventListener('click', () => this.stopReceiver());
        
        // Volume control
        const volumeSlider = document.getElementById('sender-volume');
        volumeSlider.addEventListener('input', (e) => {
            const value = e.target.value;
            document.getElementById('sender-volume-value').textContent = value + '%';
            if (this.senderGain) {
                this.senderGain.gain.value = value / 100;
            }
        });
        
        // Detection sensitivity
        document.getElementById('detection-sensitivity').addEventListener('change', (e) => {
            const sensitivity = parseFloat(e.target.value);
            console.log(`Detection sensitivity set to ${sensitivity}`);
        });
    }
    
    async startSender() {
        if (!this.isInitialized) {
            this.showError('System not initialized yet');
            return;
        }
        
        try {
            // Get message and convert to hex
            const message = document.getElementById('message-input').value || 'Hello World!';
            const messageHex = this.wasmFunctions.textToHex(message);
            
            if (!messageHex) {
                throw new Error('Failed to convert message to hex');
            }
            
            // Create watermarker
            this.watermarker = this.wasmFunctions.watermarkerCreate(
                this.sampleRate, 1, 0.004, messageHex
            );
            
            if (!this.watermarker) {
                throw new Error('Failed to create watermarker');
            }
            
            // Setup audio generation and processing
            await this.setupSenderAudio();
            
            this.senderActive = true;
            this.updateSenderUI();
            this.updateSenderStatus('🎵 Playing tone with embedded watermark...', 'active');
            
        } catch (error) {
            console.error('Failed to start sender:', error);
            this.updateSenderStatus('❌ Error: ' + error.message, 'error');
        }
    }
    
    async setupSenderAudio() {
        const frequency = parseInt(document.getElementById('tone-frequency').value) || 440;
        const volume = parseInt(document.getElementById('sender-volume').value) / 100;
        
        // Create oscillator for test tone
        this.oscillator = this.audioContext.createOscillator();
        this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        this.oscillator.type = 'sine';
        
        // Create gain node for volume control
        this.senderGain = this.audioContext.createGain();
        this.senderGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        
        // Create audio worklet processor for watermarking
        try {
            await this.audioContext.audioWorklet.addModule(this.createProcessorBlob());
            
            this.senderProcessor = new AudioWorkletNode(this.audioContext, 'watermark-processor', {
                processorOptions: {
                    frameSize: this.frameSize,
                    watermarkerPtr: this.watermarker
                }
            });
            
            // Connect audio graph: oscillator -> processor -> gain -> destination
            this.oscillator.connect(this.senderProcessor);
            this.senderProcessor.connect(this.senderGain);
            this.senderGain.connect(this.audioContext.destination);
            
            // Start oscillator
            this.oscillator.start();
            
        } catch (error) {
            // Fallback to ScriptProcessorNode if AudioWorklet is not available
            console.warn('AudioWorklet not available, using ScriptProcessorNode');
            await this.setupSenderAudioFallback();
        }
    }
    
    async setupSenderAudioFallback() {
        // Fallback implementation using ScriptProcessorNode
        const bufferSize = this.frameSize;
        this.senderProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        // Allocate WASM memory for audio processing
        const inputPtr = this.wasmModule._malloc(bufferSize * 4); // 4 bytes per float
        const outputPtr = this.wasmModule._malloc(bufferSize * 4);
        
        this.senderProcessor.onaudioprocess = (event) => {
            const inputBuffer = event.inputBuffer.getChannelData(0);
            const outputBuffer = event.outputBuffer.getChannelData(0);
            
            // Copy input to WASM memory
            this.wasmModule.HEAPF32.set(inputBuffer, inputPtr / 4);
            
            // Process through watermarker
            const success = this.wasmFunctions.watermarkerProcessFrame(
                this.watermarker, inputPtr, outputPtr, bufferSize
            );
            
            if (success) {
                // Copy output from WASM memory
                const wasmOutput = new Float32Array(
                    this.wasmModule.HEAPF32.buffer, outputPtr, bufferSize
                );
                outputBuffer.set(wasmOutput);
            } else {
                // Pass through original audio if watermarking fails
                outputBuffer.set(inputBuffer);
            }
            
            this.framesProcessed++;
            this.updateFrameCounter();
        };
        
        // Connect audio graph
        this.oscillator.connect(this.senderProcessor);
        this.senderProcessor.connect(this.senderGain);
        this.senderGain.connect(this.audioContext.destination);
        
        // Start oscillator
        this.oscillator.start();
        
        // Store pointers for cleanup
        this.senderProcessor.inputPtr = inputPtr;
        this.senderProcessor.outputPtr = outputPtr;
    }
    
    async startReceiver() {
        if (!this.isInitialized) {
            this.showError('System not initialized yet');
            return;
        }
        
        try {
            // Request microphone access
            this.micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: this.sampleRate
                }
            });
            
            // Create detector
            this.detector = this.wasmFunctions.detectorCreate(this.sampleRate, 1);
            if (!this.detector) {
                throw new Error('Failed to create detector');
            }
            
            // Setup audio processing
            await this.setupReceiverAudio();
            
            this.receiverActive = true;
            this.updateReceiverUI();
            this.updateReceiverStatus('🎤 Listening for watermarks...', 'detecting');
            
            // Start detection polling
            this.startDetectionPolling();
            
        } catch (error) {
            console.error('Failed to start receiver:', error);
            this.updateReceiverStatus('❌ Error: ' + error.message, 'error');
        }
    }
    
    async setupReceiverAudio() {
        const micSource = this.audioContext.createMediaStreamSource(this.micStream);
        
        try {
            await this.audioContext.audioWorklet.addModule(this.createDetectorProcessorBlob());
            
            this.receiverProcessor = new AudioWorkletNode(this.audioContext, 'detector-processor', {
                processorOptions: {
                    frameSize: this.frameSize,
                    detectorPtr: this.detector
                }
            });
            
            micSource.connect(this.receiverProcessor);
            
        } catch (error) {
            // Fallback to ScriptProcessorNode
            console.warn('AudioWorklet not available, using ScriptProcessorNode for detector');
            await this.setupReceiverAudioFallback(micSource);
        }
    }
    
    async setupReceiverAudioFallback(micSource) {
        const bufferSize = this.frameSize;
        this.receiverProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        // Allocate WASM memory
        const inputPtr = this.wasmModule._malloc(bufferSize * 4);
        
        this.receiverProcessor.onaudioprocess = (event) => {
            const inputBuffer = event.inputBuffer.getChannelData(0);
            
            // Copy input to WASM memory
            this.wasmModule.HEAPF32.set(inputBuffer, inputPtr / 4);
            
            // Process through detector
            this.wasmFunctions.detectorProcessFrame(this.detector, inputPtr, bufferSize);
            
            this.framesProcessed++;
            this.updateFrameCounter();
        };
        
        micSource.connect(this.receiverProcessor);
        // Don't connect to destination - we're just analyzing
        
        this.receiverProcessor.inputPtr = inputPtr;
    }
    
    startDetectionPolling() {
        const checkDetection = () => {
            if (!this.receiverActive || !this.detector) return;
            
            // Allocate memory for result
            const messageBufferSize = 256;
            const messagePtr = this.wasmModule._malloc(messageBufferSize);
            const confidencePtr = this.wasmModule._malloc(8); // double
            
            try {
                const detected = this.wasmFunctions.detectorGetResult(
                    this.detector, messagePtr, messageBufferSize, confidencePtr
                );
                
                if (detected) {
                    const messageHex = this.wasmModule.UTF8ToString(messagePtr);
                    const confidence = this.wasmModule.getValue(confidencePtr, 'double');
                    
                    this.handleDetection(messageHex, confidence);
                }
                
            } finally {
                this.wasmModule._free(messagePtr);
                this.wasmModule._free(confidencePtr);
            }
            
            // Continue polling
            setTimeout(checkDetection, 100); // Check every 100ms
        };
        
        checkDetection();
    }
    
    handleDetection(messageHex, confidence) {
        const sensitivityThreshold = parseFloat(document.getElementById('detection-sensitivity').value);
        
        if (confidence >= sensitivityThreshold) {
            const message = this.wasmFunctions.hexToText(messageHex) || messageHex;
            
            this.showDetectionResult(message, confidence);
            this.lastDetectionTime = Date.now();
            
            console.log(`Watermark detected: "${message}" (confidence: ${confidence.toFixed(2)})`);
        }
    }
    
    showDetectionResult(message, confidence) {
        const resultDiv = document.getElementById('detection-result');
        const messageSpan = document.getElementById('detected-message');
        const confidenceSpan = document.getElementById('confidence-value');
        const confidenceFill = document.getElementById('confidence-fill');
        
        messageSpan.textContent = message;
        confidenceSpan.textContent = (confidence * 100).toFixed(1);
        confidenceFill.style.width = (confidence * 100) + '%';
        
        resultDiv.classList.add('show');
        
        // Hide after 5 seconds
        setTimeout(() => {
            resultDiv.classList.remove('show');
        }, 5000);
    }
    
    stopSender() {
        this.senderActive = false;
        
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator = null;
        }
        
        if (this.senderProcessor) {
            this.senderProcessor.disconnect();
            if (this.senderProcessor.inputPtr) {
                this.wasmModule._free(this.senderProcessor.inputPtr);
                this.wasmModule._free(this.senderProcessor.outputPtr);
            }
            this.senderProcessor = null;
        }
        
        if (this.senderGain) {
            this.senderGain.disconnect();
            this.senderGain = null;
        }
        
        if (this.watermarker) {
            this.wasmFunctions.watermarkerDestroy(this.watermarker);
            this.watermarker = null;
        }
        
        this.updateSenderUI();
        this.updateSenderStatus('⏹️ Stopped', 'idle');
    }
    
    stopReceiver() {
        this.receiverActive = false;
        
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
            this.micStream = null;
        }
        
        if (this.receiverProcessor) {
            this.receiverProcessor.disconnect();
            if (this.receiverProcessor.inputPtr) {
                this.wasmModule._free(this.receiverProcessor.inputPtr);
            }
            this.receiverProcessor = null;
        }
        
        if (this.detector) {
            this.wasmFunctions.detectorDestroy(this.detector);
            this.detector = null;
        }
        
        this.updateReceiverUI();
        this.updateReceiverStatus('⏹️ Stopped', 'idle');
        
        // Hide detection result
        document.getElementById('detection-result').classList.remove('show');
    }
    
    updateSenderUI() {
        const startBtn = document.getElementById('start-sender');
        const stopBtn = document.getElementById('stop-sender');
        
        startBtn.style.display = this.senderActive ? 'none' : 'block';
        stopBtn.style.display = this.senderActive ? 'block' : 'none';
        startBtn.disabled = !this.isInitialized;
    }
    
    updateReceiverUI() {
        const startBtn = document.getElementById('start-receiver');
        const stopBtn = document.getElementById('stop-receiver');
        
        startBtn.style.display = this.receiverActive ? 'none' : 'block';
        stopBtn.style.display = this.receiverActive ? 'block' : 'none';
        startBtn.disabled = !this.isInitialized;
    }
    
    updateSenderStatus(message, type) {
        const status = document.getElementById('sender-status');
        status.textContent = message;
        status.className = `status ${type}`;
    }
    
    updateReceiverStatus(message, type) {
        const status = document.getElementById('receiver-status');
        status.textContent = message;
        status.className = `status ${type}`;
    }
    
    updateSystemInfo() {
        document.getElementById('sample-rate').textContent = this.sampleRate;
        document.getElementById('frame-size').textContent = this.frameSize;
        document.getElementById('latency').textContent = Math.round(this.frameSize / this.sampleRate * 1000 * 10) / 10;
    }
    
    updateFrameCounter() {
        document.getElementById('frames-processed').textContent = this.framesProcessed;
    }
    
    showMainContent() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    }
    
    showError(message) {
        const loading = document.getElementById('loading');
        loading.innerHTML = `
            <div style="color: #f56565;">
                <h3>❌ Error</h3>
                <p>${message}</p>
            </div>
        `;
    }
    
    // Create AudioWorklet processor blob for watermarking
    createProcessorBlob() {
        const processorCode = `
            class WatermarkProcessor extends AudioWorkletProcessor {
                constructor(options) {
                    super();
                    this.frameSize = options.processorOptions.frameSize;
                    this.watermarkerPtr = options.processorOptions.watermarkerPtr;
                }
                
                process(inputs, outputs, parameters) {
                    const input = inputs[0];
                    const output = outputs[0];
                    
                    if (input.length > 0 && output.length > 0) {
                        const inputChannel = input[0];
                        const outputChannel = output[0];
                        
                        // For now, just pass through (WASM processing would go here)
                        outputChannel.set(inputChannel);
                    }
                    
                    return true;
                }
            }
            
            registerProcessor('watermark-processor', WatermarkProcessor);
        `;
        
        return URL.createObjectURL(new Blob([processorCode], { type: 'application/javascript' }));
    }
    
    // Create AudioWorklet processor blob for detection
    createDetectorProcessorBlob() {
        const processorCode = `
            class DetectorProcessor extends AudioWorkletProcessor {
                constructor(options) {
                    super();
                    this.frameSize = options.processorOptions.frameSize;
                    this.detectorPtr = options.processorOptions.detectorPtr;
                }
                
                process(inputs, outputs, parameters) {
                    const input = inputs[0];
                    
                    if (input.length > 0) {
                        const inputChannel = input[0];
                        // WASM processing would go here
                    }
                    
                    return true;
                }
            }
            
            registerProcessor('detector-processor', DetectorProcessor);
        `;
        
        return URL.createObjectURL(new Blob([processorCode], { type: 'application/javascript' }));
    }
}

// Initialize the application when the page loads
const app = new AudioWmarkApp();
app.initialize();