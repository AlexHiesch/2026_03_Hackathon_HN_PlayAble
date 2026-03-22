/**
 * WebGL 2 post-processing renderer.
 *
 * The game renders to an offscreen Canvas 2D (320x240).
 * Each frame, this uploads it as a texture and draws a fullscreen
 * quad through the CRT shader at the display's native resolution.
 */

export class WebGLRenderer {
    constructor(displayCanvas) {
        this.canvas = displayCanvas;
        const gl = displayCanvas.getContext('webgl2', { antialias: false, alpha: false });
        if (!gl) throw new Error('WebGL 2 not supported');
        this.gl = gl;

        // Default uniform values
        this.uniforms = {
            wavyness: 0.0,
            bitcrush: 256.0,
            hue_shift: 0.0,
            chromatic_aberration: 0.0,
            line_glitch: 0.0,
            scanline_intensity: 0.25,
            curvature: 0.12,
            vignette_intensity: 0.4,
        };

        this._time = 0;
        this._program = null;
        this._uLocations = {};
        this._vao = null;
        this._texture = null;
        this._ready = false;

        this._init();
    }

    async _init() {
        const gl = this.gl;

        // Load shaders
        const [vertSrc, fragSrc] = await Promise.all([
            fetch('js/shaders/crt.vert').then(r => r.text()),
            fetch('js/shaders/crt.frag').then(r => r.text()),
        ]);

        // Compile
        const vs = this._compile(gl.VERTEX_SHADER, vertSrc);
        const fs = this._compile(gl.FRAGMENT_SHADER, fragSrc);

        // Link
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error('Shader link error: ' + gl.getProgramInfoLog(prog));
        }
        this._program = prog;
        gl.useProgram(prog);

        // Cache uniform locations
        const uNames = [
            'tex', 'time', 'wavyness', 'bitcrush', 'hue_shift',
            'chromatic_aberration', 'line_glitch', 'scanline_intensity',
            'curvature', 'vignette_intensity', 'resolution',
        ];
        for (const name of uNames) {
            this._uLocations[name] = gl.getUniformLocation(prog, name);
        }

        // Fullscreen quad: two triangles covering [-1,1]
        // vert (x,y), texcoord (u,v)
        const quadVerts = new Float32Array([
            -1, -1, 0, 1,
             1, -1, 1, 1,
            -1,  1, 0, 0,
             1,  1, 1, 0,
        ]);

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        const aVert = gl.getAttribLocation(prog, 'vert');
        const aTex = gl.getAttribLocation(prog, 'texcoord');
        gl.enableVertexAttribArray(aVert);
        gl.vertexAttribPointer(aVert, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(aTex);
        gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 16, 8);

        this._vao = vao;

        // Create texture for the game canvas
        this._texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this._ready = true;
    }

    _compile(type, src) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Shader compile error: ' + info);
        }
        return shader;
    }

    /** Upload the offscreen game canvas and render with CRT effects. */
    render(gameCanvas, timestamp) {
        if (!this._ready) return;

        const gl = this.gl;
        this._time = timestamp;

        // Resize to match CSS display size
        const dpr = window.devicePixelRatio || 1;
        const displayW = Math.round(this.canvas.clientWidth * dpr);
        const displayH = Math.round(this.canvas.clientHeight * dpr);
        if (this.canvas.width !== displayW || this.canvas.height !== displayH) {
            this.canvas.width = displayW;
            this.canvas.height = displayH;
        }

        gl.viewport(0, 0, displayW, displayH);

        // Upload game canvas as texture
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gameCanvas);

        // Set uniforms
        gl.useProgram(this._program);
        gl.uniform1i(this._uLocations.tex, 0);
        gl.uniform1f(this._uLocations.time, this._time);
        gl.uniform1f(this._uLocations.wavyness, this.uniforms.wavyness);
        gl.uniform1f(this._uLocations.bitcrush, this.uniforms.bitcrush);
        gl.uniform1f(this._uLocations.hue_shift, this.uniforms.hue_shift);
        gl.uniform1f(this._uLocations.chromatic_aberration, this.uniforms.chromatic_aberration);
        gl.uniform1f(this._uLocations.line_glitch, this.uniforms.line_glitch);
        gl.uniform1f(this._uLocations.scanline_intensity, this.uniforms.scanline_intensity);
        gl.uniform1f(this._uLocations.curvature, this.uniforms.curvature);
        gl.uniform1f(this._uLocations.vignette_intensity, this.uniforms.vignette_intensity);
        gl.uniform2f(this._uLocations.resolution, displayW, displayH);

        // Draw
        gl.bindVertexArray(this._vao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    get ready() {
        return this._ready;
    }

    /** Update CRT effect parameters. */
    setUniforms(params) {
        Object.assign(this.uniforms, params);
    }
}
