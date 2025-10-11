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

const drawSpectrum = (ctx, data, width, height) => {
    const bufferLength = data.length;
    const barWidth = width / bufferLength;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (data[i] / 255) * height;
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
        ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
    }
};

const drawAurora = (ctx, data, width, height) => {
    ctx.clearRect(0, 0, width, height);
    const bufferLength = data.length;
    const sliceWidth = width / bufferLength;

    const createGradient = (color1, color2) => {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        return gradient;
    };

    ctx.lineWidth = 2;
    ctx.strokeStyle = createGradient('#ff00ff', '#00ffff');

    ctx.beginPath();
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 255.0;
        const y = v * height / 2;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    ctx.stroke();
    
    ctx.strokeStyle = createGradient('#ffff00', '#ff00ff');
    ctx.beginPath();
    x = 0;
    for (let i = 0; i < bufferLength; i++) {
        const v = data[bufferLength - 1 - i] / 255.0; // reverse
        const y = height - (v * height / 2);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        x += sliceWidth;
    }
    ctx.stroke();
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


const Visualizer = ({ frequencyData, style, onClick }) => {
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
            drawSpectrum(context, frequencyData, width, height);
            break;
        case 'aurora':
            drawAurora(context, frequencyData, width, height);
            break;
        case 'rings':
            drawRings(context, frequencyData, width, height);
            break;
        case 'bars':
        default:
            drawBarsMirrored(context, frequencyData, width, height, accentColor);
            break;
    }

  }, [frequencyData, style]);

  return (
    React.createElement("div", { 
        onClick: onClick,
        role: "button",
        tabIndex: 0,
        "aria-label": "שנה סגנון אקולייזר",
        className: "w-full h-20 cursor-pointer"
    },
        React.createElement("canvas", { ref: canvasRef, width: "300", height: "80", className: "w-full h-full" })
    )
  );
};

export default Visualizer;