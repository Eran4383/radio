import React, { useRef, useEffect } from 'react';

// Helper functions for each drawing style
const drawPulse = (ctx, data, width, height, color) => {
    const bass = (data[0] + data[1] + data[2]) / 3;
    const mid = (data[Math.floor(data.length / 2)] + data[Math.floor(data.length / 2) + 1]) / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2;

    // Outer ring for mid tones
    ctx.beginPath();
    ctx.strokeStyle = `${color}80`;
    ctx.lineWidth = 2;
    ctx.arc(centerX, centerY, maxRadius * (mid / 255), 0, 2 * Math.PI);
    ctx.stroke();

    // Inner circle for bass
    const radius = (bass / 255) * maxRadius * 0.7;
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, `${color}FF`);
    gradient.addColorStop(1, `${color}00`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
};

const drawBarsMirrored = (ctx, data, width, height, color) => {
    const bufferLength = data.length;
    const halfBuffer = Math.floor(bufferLength / 2);
    const centerX = width / 2;
    const barWidth = (width / 2) / halfBuffer;
    
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, `${color}40`);
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;

    for (let i = 0; i < halfBuffer; i++) {
        const barHeight = (data[i] / 255) * height;
        // Draw right side
        ctx.fillRect(centerX + (i * barWidth), height - barHeight, barWidth - 1, barHeight);
        // Draw left side (mirrored)
        ctx.fillRect(centerX - ((i + 1) * barWidth), height - barHeight, barWidth - 1, barHeight);
    }
};

const drawWaveSymmetric = (ctx, data, width, height, color) => {
    const bufferLength = data.length;
    const halfBuffer = Math.floor(bufferLength / 2);
    const centerX = width / 2;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const sliceWidth = (width / 2) / halfBuffer;
    
    // Right side
    let x = centerX;
    ctx.moveTo(centerX, height - (data[0] / 255.0) * height);
    for (let i = 0; i < halfBuffer; i++) {
        const v = data[i] / 255.0;
        const y = height - (v * height);
        ctx.lineTo(x, y);
        x += sliceWidth;
    }
    
    // Left side (mirrored)
    x = centerX;
    ctx.moveTo(centerX, height - (data[0] / 255.0) * height);
    for (let i = 0; i < halfBuffer; i++) {
        const v = data[i] / 255.0;
        const y = height - (v * height);
        ctx.lineTo(x, y);
        x -= sliceWidth;
    }

    ctx.stroke();
};

const drawSpectrumSymmetric = (ctx, data, width, height) => {
    const bufferLength = data.length;
    const halfBuffer = Math.floor(bufferLength / 2);
    const centerX = width / 2;
    const barWidth = (width / 2) / halfBuffer;

    for (let i = 0; i < halfBuffer; i++) {
        const barHeight = (data[i] / 255) * height;
        const hue = (i / halfBuffer) * 180;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        // Right side
        ctx.fillRect(centerX + i * barWidth, height - barHeight, barWidth, barHeight);
        // Left side (mirrored)
        ctx.fillRect(centerX - (i + 1) * barWidth, height - barHeight, barWidth, barHeight);
    }
};

const drawAuroraSymmetric = (ctx, data, width, height) => {
    const bufferLength = data.length;
    const halfBuffer = Math.floor(bufferLength / 2);
    const centerX = width / 2;
    const sliceWidth = (width / 2) / halfBuffer;

    const createGradient = (color1, color2) => {
        const gradient = ctx.createLinearGradient(centerX, 0, width, 0);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };
    
    ctx.lineWidth = 3;

    const drawHalf = (sign) => {
        ctx.save();
        ctx.translate(centerX, 0);
        ctx.scale(sign, 1);
        
        ctx.strokeStyle = createGradient('#ff00ff80', '#00ffff80');
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        for (let i = 0; i < halfBuffer; i++) {
            const v = data[i] / 255.0;
            const y = height / 2 - (v * height / 2);
            ctx.lineTo(i * sliceWidth, y);
        }
        ctx.stroke();

        ctx.strokeStyle = createGradient('#ffff0080', '#ff00ff80');
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        for (let i = 0; i < halfBuffer; i++) {
            const v = data[halfBuffer - 1 - i] / 255.0; // reverse
            const y = height / 2 + (v * height / 2);
            ctx.lineTo(i * sliceWidth, y);
        }
        ctx.stroke();

        ctx.restore();
    };
    
    drawHalf(1);
    drawHalf(-1);
};


const drawRings = (ctx, data, width, height) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(centerX, centerY) * 0.9;
    
    const bass = data.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const mid = data.slice(10, 20).reduce((a, b) => a + b, 0) / 10;
    const treble = data.slice(30, 40).reduce((a, b) => a + b, 0) / 10;

    const bassRadius = (bass / 255) * maxRadius;
    const midRadius = (mid / 255) * maxRadius;
    const trebleRadius = (treble / 255) * maxRadius;

    ctx.lineWidth = Math.max(2, (bass / 255) * 10);
    ctx.strokeStyle = `rgba(255, 0, 80, ${bass / 255})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, bassRadius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.lineWidth = Math.max(1.5, (mid / 255) * 8);
    ctx.strokeStyle = `rgba(0, 255, 255, ${mid / 255})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, midRadius, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.lineWidth = Math.max(1, (treble / 255) * 6);
    ctx.strokeStyle = `rgba(255, 255, 0, ${treble / 255})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, trebleRadius, 0, 2 * Math.PI);
    ctx.stroke();
};

const drawStatic = (ctx, data, width, height, color) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const bass = data.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const energy = bass / 255;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    const numBolts = Math.floor(energy * 20);
    for (let i = 0; i < numBolts; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        let x = centerX;
        let y = centerY;
        const angle = Math.random() * Math.PI * 2;
        const totalLength = (Math.random() * 0.5 + 0.5) * Math.min(width, height) * 0.5 * energy;

        for (let j = 0; j < 5; j++) {
            const segmentLength = totalLength / 5;
            x += Math.cos(angle) * segmentLength + (Math.random() - 0.5) * 20;
            y += Math.sin(angle) * segmentLength + (Math.random() - 0.5) * 20;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
};

const drawVortex = (ctx, data, width, height, color) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const bass = data.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const energy = bass / 255;
    
    const numParticles = 100;
    for (let i = 0; i < numParticles; i++) {
        const angle = i * (Math.PI * 2 / numParticles) + (energy * Math.PI);
        const distance = (i / numParticles) * Math.min(width, height) * 0.4;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        const size = (data[i % data.length] / 255) * 4 * energy + 1;
        const opacity = data[i % data.length] / 255;

        const hexOpacity = Math.round(opacity * 255).toString(16).padStart(2, '0');
        ctx.fillStyle = `${color}${hexOpacity}`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
};

const Visualizer = ({ frequencyData, style }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frequencyData) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);

    const computedStyle = getComputedStyle(document.documentElement);
    const accentColor = computedStyle.getPropertyValue('--accent').trim() || '#14b8a6';
    
    switch(style) {
        case 'wave':
            drawWaveSymmetric(context, frequencyData, width, height, accentColor);
            break;
        case 'pulse':
            drawPulse(context, frequencyData, width, height, accentColor);
            break;
        case 'spectrum':
            drawSpectrumSymmetric(context, frequencyData, width, height);
            break;
        case 'aurora':
            drawAuroraSymmetric(context, frequencyData, width, height);
            break;
        case 'rings':
            drawRings(context, frequencyData, width, height);
            break;
        case 'static':
            drawStatic(context, frequencyData, width, height, accentColor);
            break;
        case 'vortex':
            drawVortex(context, frequencyData, width, height, accentColor);
            break;
        case 'bars':
        default:
            drawBarsMirrored(context, frequencyData, width, height, accentColor);
            break;
    }

  }, [frequencyData, style]);

  return (
    React.createElement("div", { 
        className: "w-full h-full"
    },
        React.createElement("canvas", { ref: canvasRef, width: "300", height: "80", className: "w-full h-full" })
    )
  );
};

export default Visualizer;