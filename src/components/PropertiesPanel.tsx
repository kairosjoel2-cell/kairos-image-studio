/**
 * PropertiesPanel: transform, per-layer-type properties, adjustments,
 * background, and canvas settings.
 */
import React, { useRef } from 'react';
import { useEditor } from '../state/editorStore';
import { BLEND_MODES, NEUTRAL_ADJUSTMENTS } from '../types';
import type { Layer, Adjustments, ShadowStyle, StrokeStyle, GradientFill } from '../types';
import { FILTER_PRESETS } from '../lib/filters';
import { CANVAS_TEMPLATES } from '../lib/document';
import { clamp, loadImage, uid } from '../utils/helpers';
import { putAsset } from '../lib/db';

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommitId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommitId?: string;
}): JSX.Element {
  return (
    <div className="field">
      <label>
        {label} <span style={{ color: 'var(--k-text-faint)' }}>{Math.round(value * 100) / 100}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        data-coalesce={onCommitId}
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function PropertiesPanel(): JSX.Element {
  const { doc, selection, mutateLayer, patchBackground, setDocSize, renameDoc, addImageLayer, showToast } = useEditor();
  const bgFileRef = useRef<HTMLInputElement>(null);

  const selected = selection.length === 1 ? doc.layers.find((l) => l.id === selection[0]) ?? null : null;

  const patchAdjustments = (layer: Layer, patch: Partial<Adjustments>, key: string) => {
    mutateLayer(layer.id, (l) => ({ ...l, adjustments: { ...l.adjustments, ...patch } }), key);
  };

  const applyPreset = (layer: Layer, adjustments: Adjustments) => {
    mutateLayer(layer.id, (l) => ({ ...l, adjustments: { ...adjustments } }));
  };

  const patchShadow = (layer: Layer, patch: Partial<ShadowStyle>) => {
    mutateLayer(layer.id, (l) => {
      const base: ShadowStyle = l.shadow ?? { enabled: true, color: '#000000', blur: 12, offsetX: 0, offsetY: 4 };
      return { ...l, shadow: { ...base, ...patch } };
    });
  };

  const patchStroke = (layer: Layer, patch: Partial<StrokeStyle>) => {
    mutateLayer(layer.id, (l) => {
      const base: StrokeStyle = l.stroke ?? { enabled: true, color: '#ffffff', width: 2 };
      return { ...l, stroke: { ...base, ...patch } };
    });
  };

  const patchGradient = (layer: Layer, patch: Partial<GradientFill>) => {
    mutateLayer(layer.id, (l) => {
      const base: GradientFill = l.gradient ?? { enabled: true, from: '#e5484d', to: '#111113', angle: 0 };
      return { ...l, gradient: { ...base, ...patch } };
    });
  };

  const handleBgImage = async (file: File) => {
    const assetId = uid('asset');
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      await putAsset(assetId, file);
      patchBackground({ imageAssetId: assetId, imageMode: 'cover' });
      void img;
      showToast('Background image set');
    } catch {
      showToast('Could not load background image');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      {!selected && (
        <p style={{ fontSize: 12, color: 'var(--k-text-faint)' }}>
          Select a layer to edit its properties.
        </p>
      )}

      {selected && (
        <>
          <div className="section-title">Transform — {selected.name}</div>
          <div className="field-row">
            <div className="field">
              <label>X</label>
              <input
                type="number"
                value={Math.round(selected.x)}
                onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, x: Number(e.target.value) }), 'x:' + selected.id)}
              />
            </div>
            <div className="field">
              <label>Y</label>
              <input
                type="number"
                value={Math.round(selected.y)}
                onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, y: Number(e.target.value) }), 'y:' + selected.id)}
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>W</label>
              <input
                type="number"
                min={8}
                value={Math.round(selected.width)}
                onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, width: Math.max(8, Number(e.target.value)) }), 'w:' + selected.id)}
              />
            </div>
            <div className="field">
              <label>H</label>
              <input
                type="number"
                min={8}
                value={Math.round(selected.height)}
                onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, height: Math.max(8, Number(e.target.value)) }), 'h:' + selected.id)}
              />
            </div>
          </div>
          <Slider
            label="Rotation"
            value={selected.rotation}
            min={-180}
            max={180}
            onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, rotation: v }), 'rot:' + selected.id)}
            onCommitId={'rot:' + selected.id}
          />
          <Slider
            label="Opacity"
            value={selected.opacity}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, opacity: v }), 'op:' + selected.id)}
            onCommitId={'op:' + selected.id}
          />
          <div className="field">
            <label>Blend mode</label>
            <select
              value={selected.blendMode}
              onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, blendMode: e.target.value as Layer['blendMode'] }))}
            >
              {BLEND_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="btn-row" style={{ marginBottom: 6 }}>
            <button className="btn" onClick={() => mutateLayer(selected.id, (l) => ({ ...l, flipX: !l.flipX }))}>
              ⇄ Flip H
            </button>
            <button className="btn" onClick={() => mutateLayer(selected.id, (l) => ({ ...l, flipY: !l.flipY }))}>
              ⇅ Flip V
            </button>
          </div>

          {selected.type === 'image' && (
            <>
              <div className="section-title">Filters</div>
              <div className="btn-row" style={{ marginBottom: 8 }}>
                {FILTER_PRESETS.map((p) => (
                  <button key={p.id} className="btn" onClick={() => applyPreset(selected, p.adjustments)}>
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="section-title">Adjust</div>
              <Slider label="Brightness" value={selected.adjustments.brightness} min={0} max={2} step={0.01} onChange={(v) => patchAdjustments(selected, { brightness: v }, 'br:' + selected.id)} onCommitId={'br:' + selected.id} />
              <Slider label="Contrast" value={selected.adjustments.contrast} min={0} max={2} step={0.01} onChange={(v) => patchAdjustments(selected, { contrast: v }, 'ct:' + selected.id)} onCommitId={'ct:' + selected.id} />
              <Slider label="Saturation" value={selected.adjustments.saturation} min={0} max={2} step={0.01} onChange={(v) => patchAdjustments(selected, { saturation: v }, 'st:' + selected.id)} onCommitId={'st:' + selected.id} />
              <Slider label="Hue" value={selected.adjustments.hue} min={-180} max={180} onChange={(v) => patchAdjustments(selected, { hue: v }, 'hu:' + selected.id)} onCommitId={'hu:' + selected.id} />
              <Slider label="Blur" value={selected.adjustments.blur} min={0} max={20} step={0.1} onChange={(v) => patchAdjustments(selected, { blur: v }, 'bl:' + selected.id)} onCommitId={'bl:' + selected.id} />
              <Slider label="Sepia" value={selected.adjustments.sepia} min={0} max={1} step={0.01} onChange={(v) => patchAdjustments(selected, { sepia: v }, 'se:' + selected.id)} onCommitId={'se:' + selected.id} />
              <Slider label="Grayscale" value={selected.adjustments.grayscale} min={0} max={1} step={0.01} onChange={(v) => patchAdjustments(selected, { grayscale: v }, 'gr:' + selected.id)} onCommitId={'gr:' + selected.id} />
              <Slider label="Invert" value={selected.adjustments.invert} min={0} max={1} step={0.01} onChange={(v) => patchAdjustments(selected, { invert: v }, 'in:' + selected.id)} onCommitId={'in:' + selected.id} />
              <button
                className="btn btn-block"
                onClick={() => patchAdjustments(selected, { ...NEUTRAL_ADJUSTMENTS }, 'reset:' + selected.id)}
              >
                Reset adjustments
              </button>

              <div className="section-title">Crop (source pixels)</div>
              <div className="field-row">
                <div className="field">
                  <label>Crop X</label>
                  <input
                    type="number"
                    value={Math.round(selected.crop.x)}
                    onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, crop: { ...l.crop, x: Math.max(0, Number(e.target.value)) } }, 'cx:' + selected.id))}
                  />
                </div>
                <div className="field">
                  <label>Crop Y</label>
                  <input
                    type="number"
                    value={Math.round(selected.crop.y)}
                    onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, crop: { ...l.crop, y: Math.max(0, Number(e.target.value)) } }, 'cy:' + selected.id))}
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Crop W</label>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(selected.crop.width)}
                    onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, crop: { ...l.crop, width: Math.max(1, Number(e.target.value)) } }, 'cw:' + selected.id))}
                  />
                </div>
                <div className="field">
                  <label>Crop H</label>
                  <input
                    type="number"
                    min={1}
                    value={Math.round(selected.crop.height)}
                    onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, crop: { ...l.crop, height: Math.max(1, Number(e.target.value)) } }, 'ch:' + selected.id))}
                  />
                </div>
              </div>
              <div className="btn-row">
                <button
                  className="btn"
                  onClick={() =>
                    mutateLayer(selected.id, (l) => ({
                      ...l,
                      crop: { x: 0, y: 0, width: l.naturalWidth, height: l.naturalHeight },
                    }))
                  }
                >
                  Reset crop
                </button>
              </div>
            </>
          )}

          {selected.type === 'text' && (
            <>
              <div className="section-title">Text</div>
              <div className="field">
                <label>Content</label>
                <textarea
                  rows={3}
                  value={selected.text}
                  onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, text: e.target.value }), 'txt:' + selected.id)}
                />
              </div>
              <div className="field">
                <label>Font family</label>
                <select
                  value={selected.fontFamily}
                  onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, fontFamily: e.target.value }))}
                >
                  <option value="Inter, system-ui, sans-serif">System Sans</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Times New Roman', serif">Times New Roman</option>
                  <option value="'Courier New', monospace">Courier New</option>
                  <option value="Impact, sans-serif">Impact</option>
                  <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                  <option value="Verdana, sans-serif">Verdana</option>
                  <option value="'Arial Black', sans-serif">Arial Black</option>
                </select>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Size</label>
                  <input
                    type="number"
                    min={6}
                    value={selected.fontSize}
                    onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, fontSize: Math.max(6, Number(e.target.value)) }), 'fs:' + selected.id)}
                  />
                </div>
                <div className="field">
                  <label>Weight</label>
                  <select
                    value={selected.fontWeight}
                    onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, fontWeight: Number(e.target.value) }))}
                  >
                    <option value={300}>Light</option>
                    <option value={400}>Regular</option>
                    <option value={600}>Semibold</option>
                    <option value={700}>Bold</option>
                    <option value={900}>Black</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Align</label>
                <select
                  value={selected.align}
                  onChange={(e) => mutateLayer(selected.id, (l) => ({ ...l, align: e.target.value as 'left' | 'center' | 'right' }))}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <Slider label="Line height" value={selected.lineHeight} min={0.8} max={2.4} step={0.05} onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, lineHeight: v }), 'lh:' + selected.id)} onCommitId={'lh:' + selected.id} />
              <Slider label="Letter spacing" value={selected.letterSpacing} min={-10} max={40} step={0.5} onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, letterSpacing: v }), 'ls:' + selected.id)} onCommitId={'ls:' + selected.id} />
              <Slider label="Curve radius" value={selected.curve ? selected.curve.radius : 0} min={0} max={2000} onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, curve: v > 0 ? { radius: v } : null }), 'cv:' + selected.id)} onCommitId={'cv:' + selected.id} />
              <div className="btn-row" style={{ marginBottom: 8 }}>
                <button className={'btn' + (selected.uppercase ? ' btn-primary' : '')} onClick={() => mutateLayer(selected.id, (l) => ({ ...l, uppercase: !l.uppercase }))}>
                  AA
                </button>
                <button className={'btn' + (selected.italic ? ' btn-primary' : '')} onClick={() => mutateLayer(selected.id, (l) => ({ ...l, italic: !l.italic }))}>
                  <em>I</em>
                </button>
                <button className={'btn' + (selected.underline ? ' btn-primary' : '')} onClick={() => mutateLayer(selected.id, (l) => ({ ...l, underline: !l.underline }))}>
                  <span style={{ textDecoration: 'underline' }}>U</span>
                </button>
              </div>
              <ColorField label="Fill" value={selected.fill} onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, fill: v }), 'fill:' + selected.id)} />
            </>
          )}

          {selected.type === 'shape' && (
            <>
              <div className="section-title">Shape</div>
              {selected.shape === 'rectangle' && (
                <Slider label="Corner radius" value={selected.cornerRadius} min={0} max={200} onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, cornerRadius: v }), 'cr:' + selected.id)} onCommitId={'cr:' + selected.id} />
              )}
              {selected.shape === 'star' && (
                <Slider label="Points" value={selected.points} min={3} max={12} onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, points: Math.round(v) }), 'pt:' + selected.id)} onCommitId={'pt:' + selected.id} />
              )}
              <ColorField label="Fill" value={selected.fill} onChange={(v) => mutateLayer(selected.id, (l) => ({ ...l, fill: v }), 'fill:' + selected.id)} />
            </>
          )}

          {(selected.type === 'text' || selected.type === 'shape') && (
            <>
              <div className="section-title">Gradient</div>
              <button
                className={'btn btn-block' + (selected.gradient?.enabled ? ' btn-primary' : '')}
                onClick={() =>
                  mutateLayer(selected.id, (l) => ({
                    ...l,
                    gradient: l.gradient && l.gradient.enabled ? null : { enabled: true, from: '#e5484d', to: '#111113', angle: 0 },
                  }))
                }
              >
                {selected.gradient?.enabled ? 'Disable gradient' : 'Enable gradient'}
              </button>
              {selected.gradient?.enabled && (
                <>
                  <ColorField label="From" value={selected.gradient.from} onChange={(v) => patchGradient(selected, { from: v })} />
                  <ColorField label="To" value={selected.gradient.to} onChange={(v) => patchGradient(selected, { to: v })} />
                  <Slider label="Angle" value={selected.gradient.angle} min={0} max={360} onChange={(v) => patchGradient(selected, { angle: v })} onCommitId={'ga:' + selected.id} />
                </>
              )}

              <div className="section-title">Stroke</div>
              <button
                className={'btn btn-block' + (selected.stroke?.enabled ? ' btn-primary' : '')}
                onClick={() =>
                  mutateLayer(selected.id, (l) => ({
                    ...l,
                    stroke: l.stroke && l.stroke.enabled ? null : { enabled: true, color: '#ffffff', width: 2 },
                  }))
                }
              >
                {selected.stroke?.enabled ? 'Disable stroke' : 'Enable stroke'}
              </button>
              {selected.stroke?.enabled && (
                <>
                  <ColorField label="Color" value={selected.stroke.color} onChange={(v) => patchStroke(selected, { color: v })} />
                  <Slider label="Width" value={selected.stroke.width} min={0.5} max={40} step={0.5} onChange={(v) => patchStroke(selected, { width: v })} onCommitId={'sw:' + selected.id} />
                </>
              )}

              <div className="section-title">Shadow</div>
              <button
                className={'btn btn-block' + (selected.shadow?.enabled ? ' btn-primary' : '')}
                onClick={() =>
                  mutateLayer(selected.id, (l) => ({
                    ...l,
                    shadow: l.shadow && l.shadow.enabled ? null : { enabled: true, color: '#000000', blur: 12, offsetX: 0, offsetY: 4 },
                  }))
                }
              >
                {selected.shadow?.enabled ? 'Disable shadow' : 'Enable shadow'}
              </button>
              {selected.shadow?.enabled && (
                <>
                  <ColorField label="Color" value={selected.shadow.color} onChange={(v) => patchShadow(selected, { color: v })} />
                  <Slider label="Blur" value={selected.shadow.blur} min={0} max={60} onChange={(v) => patchShadow(selected, { blur: v })} onCommitId={'sb:' + selected.id} />
                  <Slider label="Offset X" value={selected.shadow.offsetX} min={-60} max={60} onChange={(v) => patchShadow(selected, { offsetX: v })} onCommitId={'sx:' + selected.id} />
                  <Slider label="Offset Y" value={selected.shadow.offsetY} min={-60} max={60} onChange={(v) => patchShadow(selected, { offsetY: v })} onCommitId={'sy:' + selected.id} />
                </>
              )}
            </>
          )}
        </>
      )}

      <div className="section-title">Background</div>
      <ColorField label="Color" value={doc.background.color} onChange={(v) => patchBackground({ color: v }, 'bgc')} />
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <button className="btn" onClick={() => bgFileRef.current?.click()}>
          Set image
        </button>
        {doc.background.imageAssetId && (
          <button className="btn btn-danger" onClick={() => patchBackground({ imageAssetId: null })}>
            Remove image
          </button>
        )}
      </div>
      <input
        ref={bgFileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleBgImage(file);
          e.target.value = '';
        }}
      />
      {doc.background.imageAssetId && (
        <div className="field">
          <label>Image fit</label>
          <select value={doc.background.imageMode} onChange={(e) => patchBackground({ imageMode: e.target.value as 'cover' | 'contain' | 'tile' })}>
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="tile">Tile</option>
          </select>
        </div>
      )}

      <div className="section-title">Canvas</div>
      <div className="field">
        <label>Project name</label>
        <input type="text" value={doc.name} onChange={(e) => renameDoc(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Width</label>
          <input type="number" min={16} max={6000} value={doc.width} onChange={(e) => setDocSize(Number(e.target.value), doc.height)} />
        </div>
        <div className="field">
          <label>Height</label>
          <input type="number" min={16} max={6000} value={doc.height} onChange={(e) => setDocSize(doc.width, Number(e.target.value))} />
        </div>
      </div>
      <div className="btn-row">
        {CANVAS_TEMPLATES.filter((t) => t.id !== 'custom')
          .slice(0, 4)
          .map((t) => (
            <button key={t.id} className="btn" onClick={() => setDocSize(t.width, t.height)}>
              {t.name}
            </button>
          ))}
      </div>
      <div style={{ height: 12 }} />
      <button className="btn btn-block" onClick={() => {
        if (selection.length === 1) {
          const layer = doc.layers.find((l) => l.id === selection[0]);
          if (layer) mutateLayer(layer.id, (l) => ({ ...l, name: l.name }));
        }
        showToast('Properties panel');
      }}>
        —
      </button>
    </>
  );
}
