import React, { useRef, useEffect } from 'react';
import { VisualizerStyle } from '../types';

interface VisualizerProps {
  frequencyData: Uint8Array;
  style: VisualizerStyle;
  onClick: () => void;
  isLocked: boolean;
}

const drawPulse = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number, color: string) => {
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

const drawBarsMirrored = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number, color: string) => {
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

const drawWaveSymmetric = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number, color: string) => {
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


const Visualizer: React.FC<VisualizerProps> = ({ frequencyData, style, onClick, isLocked }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        case 'bars':
        default:
            drawBarsMirrored(context, frequencyData, width, height, accentColor);
            break;
    }

  }, [frequencyData, style]);

  return (
    <div 
        onClick={!isLocked ? onClick : undefined}
        role="button"
        tabIndex={!isLocked ? 0 : -1}
        aria-label={isLocked ? "סגנון אקולייזר נעול" : "שנה סגנון אקולייזר"}
        className={`w-full h-20 ${!isLocked ? 'cursor-pointer' : ''}`}
    >
        <canvas ref={canvasRef} width="300" height="80" className="w-full h-full" />
    </div>
  );
};

export default Visualizer;