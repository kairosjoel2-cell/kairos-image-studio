/**
 * LayersPanel: layer list with visibility/lock toggles, reorder, and add
 * layer actions.
 */
import React, { useRef } from 'react';
import { useEditor } from '../state/editorStore';

export default function LayersPanel(): JSX.Element {
  const {
    doc,
    selection,
    toggleSelection,
    mutateLayer,
    deleteLayer,
    duplicateLayer,
    moveLayer,
    addImageLayer,
    addTextLayer,
    addShapeLayer,
  } = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  const ordered = [...doc.layers].reverse();

  const iconFor = (type: string, shape?: string): string => {
    if (type === 'image') return 'IMG';
    if (type === 'text') return 'TXT';
    if (shape === 'rectangle') return 'RECT';
    if (shape === 'ellipse') return 'ELL';
    if (shape === 'triangle') return 'TRI';
    if (shape === 'star') return 'STAR';
    if (shape === 'line') return 'LINE';
    if (shape === 'arrow') return 'ARR';
    return 'SHP';
  };

  return (
    <>
      <div className="section-title">Add</div>
      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          + Image
        </button>
        <button className="btn" onClick={addTextLayer}>
          + Text
        </button>
        <button className="btn" onClick={() => addShapeLayer('rectangle')}>
          + Rect
        </button>
        <button className="btn" onClick={() => addShapeLayer('ellipse')}>
          + Ellipse
        </button>
        <button className="btn" onClick={() => addShapeLayer('triangle')}>
          + Triangle
        </button>
        <button className="btn" onClick={() => addShapeLayer('star')}>
          + Star
        </button>
        <button className="btn" onClick={() => addShapeLayer('line')}>
          + Line
        </button>
        <button className="btn" onClick={() => addShapeLayer('arrow')}>
          + Arrow
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addImageLayer(file);
          e.target.value = '';
        }}
      />

      <div className="section-title">Layers ({doc.layers.length})</div>
      {doc.layers.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--k-text-faint)' }}>
          Empty canvas. Add an image, text, or a shape to begin.
        </p>
      ) : (
        <div className="layer-list">
          {ordered.map((layer) => {
            const selected = selection.includes(layer.id);
            return (
              <div
                key={layer.id}
                className={'layer-item' + (selected ? ' selected' : '')}
                onClick={(e) => toggleSelection(layer.id, e.shiftKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') toggleSelection(layer.id, e.shiftKey);
                }}
              >
                <span className="layer-icon">{iconFor(layer.type, layer.type === 'shape' ? layer.shape : undefined)}</span>
                <span className="layer-name" title={layer.name}>
                  {layer.name}
                </span>
                <span className="layer-actions">
                  <button
                    className={'icon-btn' + (layer.visible ? '' : ' active')}
                    title={layer.visible ? 'Hide' : 'Show'}
                    onClick={(e) => {
                      e.stopPropagation();
                      mutateLayer(layer.id, (l) => ({ ...l, visible: !l.visible }));
                    }}
                  >
                    {layer.visible ? 'Eye' : 'Off'}
                  </button>
                  <button
                    className={'icon-btn' + (layer.locked ? ' active' : '')}
                    title={layer.locked ? 'Unlock' : 'Lock'}
                    onClick={(e) => {
                      e.stopPropagation();
                      mutateLayer(layer.id, (l) => ({ ...l, locked: !l.locked }));
                    }}
                  >
                    {layer.locked ? 'Lock' : 'Unl'}
                  </button>
                  <button
                    className="icon-btn"
                    title="Move up"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(layer.id, 'up');
                    }}
                  >
                    Up
                  </button>
                  <button
                    className="icon-btn"
                    title="Move down"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(layer.id, 'down');
                    }}
                  >
                    Dn
                  </button>
                  <button
                    className="icon-btn"
                    title="Duplicate"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateLayer(layer.id);
                    }}
                  >
                    Dup
                  </button>
                  <button
                    className="icon-btn"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayer(layer.id);
                    }}
                  >
                    Del
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
