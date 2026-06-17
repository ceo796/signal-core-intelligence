import React, { useEffect, useRef } from 'react';

export const GridWave: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 0.6;
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const rows = 25;
      const cols = 40;
      const cellWidth = canvas.width / cols;
      const cellHeight = canvas.height / rows;

      phase += 0.02;

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const waveX = Math.sin(c * 0.15 + phase) * 15;
          const waveY = Math.cos(r * 0.15 + phase) * 15;

          const perspectiveFactor = r / rows;

          const x = c * cellWidth + waveX * perspectiveFactor;
          const y = r * cellHeight * perspectiveFactor + waveY;

          if (c < cols - 1) {
            const nextX =
              (c + 1) * cellWidth +
              Math.sin((c + 1) * 0.15 + phase) * 15 * perspectiveFactor;
            ctx.moveTo(x, y);
            ctx.lineTo(nextX, y);
          }

          if (r < rows - 1) {
            const nextPerspective = (r + 1) / rows;
            const nextY =
              (r + 1) * cellHeight * nextPerspective +
              Math.cos((r + 1) * 0.15 + phase) * 15;
            const nextX =
              c * cellWidth +
              Math.sin(c * 0.15 + phase) * 15 * nextPerspective;
            ctx.moveTo(x, y);
            ctx.lineTo(nextX, nextY);
          }
        }
      }
      ctx.stroke();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full pointer-events-none z-0"
      style={{ maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 70%, rgba(0,0,0,0))' }}
    />
  );
};
