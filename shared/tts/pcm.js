// Shared PCM utilities for browser engines. Never concatenate WAV headers.
export function splitText(text, maxLength = 240) {
    const sentences = typeof Intl.Segmenter === 'function'
        ? Array.from(new Intl.Segmenter(undefined, { granularity: 'sentence' }).segment(text), item => item.segment)
        : text.match(/[^.!?。！？\n]+[.!?。！？\n]*|[.!?。！？\n]+/gu) || [text];
    const chunks = [];
    for (let sentence of sentences) {
        sentence = sentence.trim();
        while (Array.from(sentence).length > maxLength) {
            const points = Array.from(sentence);
            let end = points.slice(0, maxLength + 1).lastIndexOf(' ');
            if (end < maxLength / 2) end = maxLength;
            chunks.push(points.slice(0, end).join('').trim());
            sentence = points.slice(end).join('').trim();
        }
        if (sentence) chunks.push(sentence);
    }
    return chunks;
}

export function joinAudio(chunks, sampleRate, pauseMs = 0) {
    if (!chunks.length) throw new Error('No audio generated');
    const gaps = chunks.slice(1).map((_, index) => Math.round(sampleRate * (Array.isArray(pauseMs) ? pauseMs[index] || 0 : pauseMs) / 1000));
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + gaps.reduce((sum, gap) => sum + gap, 0);
    const output = new Float32Array(length);
    let offset = 0;
    for (const [index, chunk] of chunks.entries()) {
        output.set(chunk, offset);
        // A very short edge fade removes discontinuities without overlapping words.
        const fade = Math.min(Math.round(sampleRate * 0.003), Math.floor(chunk.length / 2));
        for (let i = 0; i < fade; i++) {
            output[offset + i] *= i / fade;
            output[offset + chunk.length - 1 - i] *= i / fade;
        }
        offset += chunk.length + (gaps[index] || 0);
    }
    return output;
}

export function pcmToWav(samples, sampleRate) {
    return chunksToWav([samples], sampleRate, 0, false);
}

// Write chunks directly into the WAV, without another full-length float buffer.
export function chunksToWav(chunks, sampleRate, pauseMs = 0, fadeEdges = true) {
    if (!chunks.length) throw new Error('No audio generated');
    const gaps = chunks.slice(1).map((_, index) => Math.round(sampleRate * (Array.isArray(pauseMs) ? pauseMs[index] || 0 : pauseMs) / 1000));
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + gaps.reduce((sum, gap) => sum + gap, 0);
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    const text = (offset, value) => Array.from(value).forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true);
    text(8, 'WAVE'); text(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, length * 2, true);
    let offset = 44;
    for (const [index, chunk] of chunks.entries()) {
        const fade = fadeEdges ? Math.min(Math.round(sampleRate * 0.003), Math.floor(chunk.length / 2)) : 0;
        for (let i = 0; i < chunk.length; i++) {
            let value = chunk[i];
            if (!Number.isFinite(value)) throw new Error('The model produced invalid audio. Try another quality setting.');
            // Match the float32 rounding of joinAudio, including its edge fades.
            if (i < fade) value = Math.fround(value * (i / fade));
            else if (i >= chunk.length - fade) value = Math.fround(value * ((chunk.length - 1 - i) / fade));
            value = Math.max(-1, Math.min(1, value));
            view.setInt16(offset, Math.round(value * (value < 0 ? 32768 : 32767)), true);
            offset += 2;
        }
        offset += (gaps[index] || 0) * 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
}
