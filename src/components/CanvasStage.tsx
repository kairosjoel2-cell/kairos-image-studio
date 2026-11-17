/**
 * CanvasStage: renders the document, draws selection overlays, and handles
 * pointer gestures for move, resize (rotation-aware), and rotate.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../state/editorStore';
import { renderDocumentToCanvas, hitTestLayer } from '../lib/renderer';
import type { Layer } from '../types';
import { rotatePoint, clamp, degToRad, uid } from '../utils/helpers';

type HandleId = 'tl' | 'tr' | 'br' | 'bl' | 't' | 'b' | 'l' | 'r';

interface DragState {
  mode: 'move' | 'resize' | 'rotate';
  layerId: string;
  pointerStart: { x: number; y: number };
  layerStart: Layer;
  anchorSign: { x: number; y: number } | null;
  anchorPoint: { x: number; y: number } | null;
  startAngle: number;
}

const HANDLE_HIT = 10;
const ROTATE_HANDLE_OFFSET = 28;

function layerCorners(layer: Layer): { x: number; y: number }[] {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const local: { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: layer.width, y: 0 },
    { x: layer.width, y: layer.height },
    { x: 0, y: layer.height },
  ];
  return local.map((p) => rotatePoint(p, { x: cx, y: cy }, layer.rotation));
}

export default function CanvasStage(): JSX.Element {
  const { doc, selection, setSelection, toggleSelection, mutateLayer, showToast } = useEditor();
  const areaRef = useRef<HTMLDivElement>(null);
  const renderCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [zoom, setZoom] = useState(0.5);
  const [autoFit, setAutoFit] = useState(true);

  const fitZoom = useCallback((): number => {
    const area = areaRef.current;
    if (!area) return 0.5;
    const availW = area.clientWidth - 48;
    const availH = area.clientHeight - 48;
    if (availW <= 0 || availH <= 0) return 0.5;
    return clamp(Math.min(availW / doc.width, availH / doc.height), 0.02, 4);
  }, [doc.width, doc.height]);

  useEffect(() => {
    if (!autoFit) return;
    setZoom(fitZoom());
  }, [autoFit, fitZoom, doc.width, doc.height]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area || !autoFit) return;
    const observer = new ResizeObserver(() => setZoom(fitZoom()));
    observer.observe(area);
    return () => observer.disconnect();
  }, [autoFit, fitZoom]);

  // Render document onto the visible canvas.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const visible = renderCanvasRef.current;
      if (!visible) return;
      try {
        const offscreen = await renderDocumentToCanvas(doc, { scale: zoom });
        if (cancelled) return;
        visible.width = offscreen.width;
        visible.height = offscreen.height;
        const ctx = visible.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, visible.width, visible.height);
        ctx.drawImage(offscreen, 0, 0);
      } catch (err) {
        console.error('[KAIROS] canvas render failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, zoom]);

  // Draw selection overlay.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    overlay.width = Math.max(1, Math.round(doc.width * zoom));
    overlay.height = Math.max(1, Math.round(doc.height * zoom));
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.save();
    ctx.scale(zoom, zoom);

    for (const id of selection) {
      const layer = doc.layers.find((l) => l.id === id);
      if (!layer) continue;
      const corners = layerCorners(layer);
      ctx.strokeStyle = '#e5484d';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      ctx.stroke();

      const hs = 7 / zoom;
      for (const c of corners) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#e5484d';
        ctx.lineWidth = 1.5 / zoom;
        ctx.beginPath();
        ctx.rect(c.x - hs / 2, c.y - hs / 2, hs, hs);
        ctx.fill();
        ctx.stroke();
      }

      // Rotation handle above top edge midpoint.
      const midTop = {
        x: (corners[0].x + corners[1].x) / 2,
        y: (corners[0].y + corners[1].y) / 2,
      };
      const center = { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 };
      const dir = rotatePoint({ x: midTop.x, y: midTop.y - ROTATE_HANDLE_OFFSET / zoom }, center, 0);
      ctx.beginPath();
      ctx.moveTo(midTop.x, midTop.y);
      ctx.lineTo(dir.x, dir.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dir.x, dir.y, 5 / zoom, 0, Math.PI * 2);
      ctx.fillStyle = '#e5484d';
      ctx.fill();
    }
    ctx.restore();
  }, [doc, selection, zoom]);

  const toCanvasCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const overlay = overlayRef.current;
      if (!overlay) return { x: 0, y: 0 };
      const rect = overlay.getBoundingClientRect();
      return {
        x: (clientX - rect.left) / zoom,
        y: (clientY - rect.top) / zoom,
      };
    },
    [zoom],
  );

  const hitHandle = useCallback(
    (px: number, py: number): { kind: 'rotate' } | { kind: 'resize'; handle: HandleId } | null => {
      if (selection.length !== 1) return null;
      const layer = doc.layers.find((l) => l.id === selection[0]);
      if (!layer) return null;
      const corners = layerCorners(layer);
      const center = { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 };
      const midTop = {
        x: (corners[0].x + corners[1].x) / 2,
        y: (corners[0].y + corners[1].y) / 2,
      };
      const rotHandle = rotatePoint(
        { x: midTop.x, y: midTop.y - ROTATE_HANDLE_OFFSET / zoom },
        center,
        0,
      );
      const distRot = Math.hypot(px - rotHandle.x, py - rotHandle.y);
      if (distRot * zoom <= HANDLE_HIT) return { kind: 'rotate' };

      const signs: { handle: HandleId; sign: { x: number; y: number }; corner: number }[] = [
        { handle: 'tl', sign: { x: -1, y: -1 }, corner: 0 },
        { handle: 'tr', sign: { x: 1, y: -1 }, corner: 1 },
        { handle: 'br', sign: { x: 1, y: 1 }, corner: 2 },
        { handle: 'bl', sign: { x: -1, y: 1 }, corner: 3 },
      ];
      for (const s of signs) {
        const c = corners[s.corner];
        if (Math.hypot(px - c.x, py - c.y) * zoom <= HANDLE_HIT) {
          return { kind: 'resize', handle: s.handle };
        }
      }
      return null;
    },
    [doc.layers, selection, zoom],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = toCanvasCoords(e.clientX, e.clientY);
      const handle = hitHandle(p.x, p.y);
      const overlay = overlayRef.current;
      if (handle && selection.length === 1) {
        const layer = doc.layers.find((l) => l.id === selection[0]);
        if (layer && overlay) {
          const center = { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 };
          const corners = layerCorners(layer);
          const signs: Record<string, { x: number; y: number; corner: number }> = {
            tl: { x: -1, y: -1, corner: 0 },
            tr: { x: 1, y: -1, corner: 1 },
            br: { x: 1, y: 1, corner: 2 },
            bl: { x: -1, y: 1, corner: 3 },
          };
          if (handle.kind === 'rotate') {
            const startAngle = Math.atan2(p.y - center.y, p.x - center.x);
            dragRef.current = {
              mode: 'rotate',
              layerId: layer.id,
              pointerStart: p,
              layerStart: { ...layer },
              anchorSign: null,
              anchorPoint: null,
              startAngle,
            };
          } else {
            const s = signs[handle.handle];
            const anchorPoint = corners[s.corner];
            dragRef.current = {
              mode: 'resize',
              layerId: layer.id,
              pointerStart: p,
              layerStart: { ...layer },
              anchorSign: { x: s.x, y: s.y },
              anchorPoint,
              startAngle: 0,
            };
          }
          overlay.setPointerCapture(e.pointerId);
          return;
        }
      }

      const hitId = hitTestLayer(doc.layers, p.x, p.y);
      if (hitId) {
        toggleSelection(hitId, e.shiftKey);
        const layer = doc.layers.find((l) => l.id === hitId);
        if (layer && overlay) {
          dragRef.current = {
            mode: 'move',
            layerId: hitId,
            pointerStart: p,
            layerStart: { ...layer },
            anchorSign: null,
            anchorPoint: null,
            startAngle: 0,
          };
          overlay.setPointerCapture(e.pointerId);
        }
      } else {
        setSelection([]);
      }
    },
    [doc.layers, hitHandle, selection, toCanvasCoords, toggleSelection, setSelection],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const p = toCanvasCoords(e.clientX, e.clientY);
      const dx = p.x - drag.pointerStart.x;
      const dy = p.y - drag.pointerStart.y;

      if (drag.mode === 'move') {
        mutateLayer(
          drag.layerId,
          (l) => ({
            ...l,
            x: Math.round(drag.layerStart.x + dx),
            y: Math.round(drag.layerStart.y + dy),
          }),
          'move:' + drag.layerId,
        );
        return;
      }

      if (drag.mode === 'rotate') {
        const layer = drag.layerStart;
        const center = { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 };
        const angle = Math.atan2(p.y - center.y, p.x - center.x);
        let deltaDeg = ((angle - drag.startAngle) * 180) / Math.PI;
        if (e.shiftKey) {
          const snap = 15;
          const total = drag.layerStart.rotation + deltaDeg;
          deltaDeg = Math.round(total / snap) * snap - drag.layerStart.rotation;
        }
        mutateLayer(
          drag.layerId,
          (l) => ({ ...l, rotation: Math.round(drag.layerStart.rotation + deltaDeg) }),
          'rotate:' + drag.layerId,
        );
        return;
      }

      if (drag.mode === 'resize' && drag.anchorSign && drag.anchorPoint) {
        const layer = drag.layerStart;
        const rad = degToRad(layer.rotation);
        const ldx = dx * Math.cos(rad) + dy * Math.sin(rad);
        const ldy = -dx * Math.sin(rad) + dy * Math.cos(rad);
        const sx = drag.anchorSign.x;
        const sy = drag.anchorSign.y;
        let newW = Math.max(8, Math.round(layer.width + sx * ldx));
        let newH = Math.max(8, Math.round(layer.height + sy * ldy));
        if (e.shiftKey && layer.type !== 'text') {
          const ratio = layer.width / layer.height;
          const byW = Math.abs(ldx) >= Math.abs(ldy);
          newH = byW ? Math.round(newW / ratio) : newH;
          newW = byW ? newW : Math.round(newH * ratio);
          newW = Math.max(8, newW);
          newH = Math.max(8, newH);
        }
        const theta = degToRad(layer.rotation);
        const off = {
          x: (sx * newW) / 2,
          y: (sy * newH) / 2,
        };
        const rotatedOff = rotatePoint(off, { x: 0, y: 0 }, layer.rotation);
        const centerNew = {
          x: drag.anchorPoint.x - rotatedOff.x,
          y: drag.anchorPoint.y - rotatedOff.y,
        };
        mutateLayer(
          drag.layerId,
          (l) => ({
            ...l,
            x: Math.round(centerNew.x - newW / 2),
            y: Math.round(centerNew.y - newH / 2),
            width: newW,
            height: newH,
          }),
          'resize:' + drag.layerId,
        );
      }
    },
    [mutateLayer, toCanvasCoords],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onDoubleClick = useCallback(() => {
    if (selection.length === 1) {
      const layer = doc.layers.find((l) => l.id === selection[0]);
      if (layer && layer.type === 'text') showToast('Edit text in the Text tab');
    }
  }, [doc.layers, selection, showToast]);

  const stageWidth = Math.round(doc.width * zoom);
  const stageHeight = Math.round(doc.height * zoom);

  return (
    <div className="canvas-area" ref={areaRef}>
      <div
        className="canvas-stack"
        style={{ width: stageWidth, height: stageHeight }}
        role="application"
        aria-label="Design canvas"
      >
        <canvas ref={renderCanvasRef} style={{ width: stageWidth, height: stageHeight }} />
        <canvas
          ref={overlayRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: stageWidth,
            height: stageHeight,
            touchAction: 'none',
            cursor: 'crosshair',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        />
      </div>
      <div className="zoom-controls">
        <button
          className="btn btn-ghost"
          onClick={() => {
            setAutoFit(false);
            setZoom((z) => clamp(z - 0.1, 0.05, 4));
          }}
          aria-label="Zoom out"
        >
          −
        </button>
        <span style={{ fontSize: 11, minWidth: 44, textAlign: 'center' }} aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setAutoFit(false);
            setZoom((z) => clamp(z + 0.1, 0.05, 4));
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button className="btn btn-ghost" onClick={() => setAutoFit(true)}>
          Fit
        </button>
      </div>
    </div>
  );
}
