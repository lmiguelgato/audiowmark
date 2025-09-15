/**
 * AudioWorklet processor for watermark embedding
 * Uses actual WASM library for watermarking
 */

class WatermarkSenderProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        this.initialized = false;
        this.frameSize = 512; // Recommended size from WASM
        this.sampleRate = sampleRate;
        
        // WASM state
        this.wasmModule = null;
        this.watermarker = null;
        this.inputPtr = null;
        this.outputPtr = null;
        this.wasmBinary = null;
        
        // Setup message handling
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
        
        console.log('WatermarkSenderProcessor created - waiting for WASM binary...');
    }
    
    async handleMessage(data) {
        switch (data.type) {
            case 'init':
                await this.initWatermarker(data);
                break;
            case 'destroy':
                this.cleanup();
                break;
        }
    }
    
    async initWatermarker(data) {
        try {
            this.frameSize = data.frameSize || 512;
            const message = data.message || 'Demo Message';
            const strength = data.strength || 0.1;
            this.wasmBinary = data.wasmBinary;
            
            if (!this.wasmBinary) {
                throw new Error('WASM binary not provided');
            }
            
            console.log('Loading WASM module in sender processor...');
            
            // Load WASM module from binary
            await this.loadWasmFromBinary();
            
            // Convert message to hex using WASM function
            const messagePtr = this.allocateString(message);
            const hexPtr = this.wasmModule._text_to_hex_simple(messagePtr);
            this.wasmModule._free(messagePtr);
            
            if (!hexPtr) {
                throw new Error('Failed to convert message to hex');
            }
            
            const hexMessage = this.UTF8ToString(hexPtr);
            this.wasmModule._free(hexPtr);
            
            console.log(`Creating watermarker: SR=${this.sampleRate}, msg="${message}", hex="${hexMessage}"`);
            
            // Create watermarker
            const hexPtr2 = this.allocateString(hexMessage);
            this.watermarker = this.wasmModule._create_simple_watermarker(
                this.sampleRate, 
                1, // mono
                strength,
                hexPtr2
            );
            this.wasmModule._free(hexPtr2);
            
            if (!this.watermarker) {
                throw new Error('Failed to create watermarker');
            }
            
            // Allocate audio buffers
            this.inputPtr = this.wasmModule._malloc(this.frameSize * 4); // 4 bytes per float
            this.outputPtr = this.wasmModule._malloc(this.frameSize * 4);
            
            if (!this.inputPtr || !this.outputPtr) {
                throw new Error('Failed to allocate audio buffers');
            }
            
            this.initialized = true;
            
            this.port.postMessage({ type: 'initialized', success: true });
            console.log('WatermarkSenderProcessor initialized with WASM');
            
        } catch (error) {
            console.error('Failed to initialize watermarker:', error);
            this.port.postMessage({ type: 'initialized', success: false, error: error.message });
        }
    }
    
    async loadWasmFromBinary() {
        // Create a simple WASM module loader without dependencies
        const wasmImports = {
            a: (ptr, type, destructor) => { throw new Error('Exception thrown'); },
            b: () => { throw new Error('Abort called'); },
            c: (size) => false // resize heap - return false to indicate failure
        };
        
        const wasmInstance = await WebAssembly.instantiate(this.wasmBinary, { a: wasmImports });
        
        // Create a minimal module interface
        this.wasmModule = {
            instance: wasmInstance.instance,
            exports: wasmInstance.instance.exports,
            HEAPF32: null,
            HEAP8: null,
            HEAPU8: null,
            
            // Memory management functions
            _malloc: wasmInstance.instance.exports.n,
            _free: wasmInstance.instance.exports.p,
            
            // Watermarker functions
            _create_simple_watermarker: wasmInstance.instance.exports.f,
            _destroy_simple_watermarker: wasmInstance.instance.exports.g,
            _process_simple_frame: wasmInstance.instance.exports.h,
            _text_to_hex_simple: wasmInstance.instance.exports.m,
            
            // Memory access
            memory: wasmInstance.instance.exports.d
        };
        
        // Update memory views
        this.updateMemoryViews();
    }
    
    updateMemoryViews() {
        const buffer = this.wasmModule.memory.buffer;
        this.wasmModule.HEAPF32 = new Float32Array(buffer);
        this.wasmModule.HEAP8 = new Int8Array(buffer);
        this.wasmModule.HEAPU8 = new Uint8Array(buffer);
    }
    
    allocateString(str) {
        const length = str.length;
        const ptr = this.wasmModule._malloc(length + 1);
        for (let i = 0; i < length; i++) {
            this.wasmModule.HEAP8[ptr + i] = str.charCodeAt(i);
        }
        this.wasmModule.HEAP8[ptr + length] = 0; // null terminator
        return ptr;
    }
    
    UTF8ToString(ptr) {
        if (!ptr) return '';
        let str = '';
        let i = 0;
        while (this.wasmModule.HEAP8[ptr + i] !== 0) {
            str += String.fromCharCode(this.wasmModule.HEAP8[ptr + i]);
            i++;
        }
        return str;
    }
    
    process(inputs, outputs, parameters) {
        if (!this.initialized || !this.watermarker) {
            // Pass through audio if not initialized
            if (inputs[0] && outputs[0] && inputs[0][0] && outputs[0][0]) {
                outputs[0][0].set(inputs[0][0]);
            }
            return true;
        }
        
        try {
            const input = inputs[0];
            const output = outputs[0];
            
            if (input && input[0] && output && output[0]) {
                const inputChannel = input[0];
                const outputChannel = output[0];
                const frameSize = inputChannel.length;
                
                // Use smaller frames if needed to match our buffer size
                const processFrameSize = Math.min(frameSize, this.frameSize);
                
                // Update memory views if needed (memory might have grown)
                this.updateMemoryViews();
                
                // Copy input to WASM memory
                const inputArray = new Float32Array(
                    this.wasmModule.memory.buffer, 
                    this.inputPtr, 
                    processFrameSize
                );
                inputArray.set(inputChannel.subarray(0, processFrameSize));
                
                // Process through WASM watermarker
                const success = this.wasmModule._process_simple_frame(
                    this.watermarker,
                    this.inputPtr,
                    this.outputPtr,
                    processFrameSize,
                    1 // mono
                );
                
                if (success) {
                    // Copy output from WASM memory
                    const outputArray = new Float32Array(
                        this.wasmModule.memory.buffer, 
                        this.outputPtr, 
                        processFrameSize
                    );
                    outputChannel.set(outputArray.subarray(0, processFrameSize));
                    
                    // If we have remaining samples, pass them through
                    if (frameSize > processFrameSize) {
                        for (let i = processFrameSize; i < frameSize; i++) {
                            outputChannel[i] = inputChannel[i];
                        }
                    }
                } else {
                    // Pass through on failure
                    outputChannel.set(inputChannel);
                }
            }
        } catch (error) {
            console.error('Error in WASM watermark processing:', error);
            // Pass through on error
            if (inputs[0] && outputs[0] && inputs[0][0] && outputs[0][0]) {
                outputs[0][0].set(inputs[0][0]);
            }
        }
        
        return true;
    }
    
    cleanup() {
        if (this.wasmModule) {
            if (this.watermarker) {
                this.wasmModule._destroy_simple_watermarker(this.watermarker);
                this.watermarker = null;
            }
            if (this.inputPtr) {
                this.wasmModule._free(this.inputPtr);
                this.inputPtr = null;
            }
            if (this.outputPtr) {
                this.wasmModule._free(this.outputPtr);
                this.outputPtr = null;
            }
        }
        this.initialized = false;
    }
}

registerProcessor('watermark-sender', WatermarkSenderProcessor);