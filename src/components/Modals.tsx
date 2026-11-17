/**
 * Modals: new project wizard, projects browser, and export dialog.
 */
import React, { useEffect, useState } from 'react';
import { useEditor } from '../state/editorStore';
import { CANVAS_TEMPLATES } from '../lib/document';
import { listProjects } from '../lib/db';
import { EXPORT_FORMATS, exportDocument } from '../lib/export';
import type { ExportFormat } from '../lib/export';
import { formatTime } from '../utils/helpers';
import type { ProjectMeta } from '../types';

function closeOnBackdrop(e: React.MouseEvent, onClose: () => void): void {
  if (e.target === e.currentTarget) onClose();
}

export function NewProjectModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { newProject } = useEditor();
  const [templateId, setTemplateId] = useState('square');
  const [name, setName] = useState('');
  const [customW, setCustomW] = useState(1200);
  const [customH, setCustomH] = useState(900);

  const groups = Array.from(new Set(CANVAS_TEMPLATES.map((t) => t.group)));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => closeOnBackdrop(e, onClose)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="New project">
        <h2>New project</h2>
        <div className="field">
          <label>Project name</label>
          <input
            type="text"
            placeholder="Untitled design"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        {groups.map((group) => (
          <div key={group}>
            <div className="section-title">{group}</div>
            <div className="template-grid">
              {CANVAS_TEMPLATES.filter((t) => t.group === group).map((t) => (
                <button
                  key={t.id}
                  className={'template-card' + (templateId === t.id ? ' btn-primary' : '')}
                  style={templateId === t.id ? { borderColor: 'var(--k-red)' } : undefined}
                  onClick={() => setTemplateId(t.id)}
                >
                  <div className="tpl-name">{t.name}</div>
                  <div className="tpl-size">
                    {t.width} × {t.height}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {templateId === 'custom' && (
          <div className="field-row" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Width (px)</label>
              <input type="number" min={16} max={6000} value={customW} onChange={(e) => setCustomW(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Height (px)</label>
              <input type="number" min={16} max={6000} value={customH} onChange={(e) => setCustomH(Number(e.target.value))} />
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              newProject(templateId, name, customW, customH);
              onClose();
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { openProject, removeProject } = useEditor();
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);

  useEffect(() => {
    void listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => closeOnBackdrop(e, onClose)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Open project">
        <h2>Projects</h2>
        {projects === null ? (
          <p style={{ color: 'var(--k-text-dim)', fontSize: 12 }}>Loading…</p>
        ) : projects.length === 0 ? (
          <p style={{ color: 'var(--k-text-dim)', fontSize: 12 }}>
            No saved projects yet. Create one and it will appear here — stored offline in your browser.
          </p>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <div
                key={p.id}
                className="project-card"
                role="button"
                tabIndex={0}
                onClick={() => {
                  void openProject(p.id).then(onClose);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void openProject(p.id).then(onClose);
                }}
              >
                <div className="thumb">no preview</div>
                <div className="meta">
                  <div className="name">{p.name}</div>
                  <div className="date">
                    {p.width}×{p.height} · {formatTime(p.updatedAt)}
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ marginTop: 6, padding: '3px 8px', fontSize: 10 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this project permanently?')) {
                        void removeProject(p.id).then(() => {
                          void listProjects().then(setProjects);
                        });
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExportModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { doc, showToast } = useEditor();
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(1);
  const [busy, setBusy] = useState(false);

  const outW = Math.round(doc.width * scale);
  const outH = Math.round(doc.height * scale);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => closeOnBackdrop(e, onClose)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Export">
        <h2>Export</h2>
        <div className="field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
            {EXPORT_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        {format !== 'png' && (
          <div className="field">
            <label>Quality ({Math.round(quality * 100)}%)</label>
            <input type="range" min={0.1} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
          </div>
        )}
        <div className="field">
          <label>Scale ({scale}× — output {outW}×{outH}px)</label>
          <input type="range" min={0.25} max={4} step={0.25} value={scale} onChange={(e) => setScale(Number(e.target.value))} />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void exportDocument(doc, { format, quality, scale })
                .then(() => {
                  showToast('Exported ' + doc.name);
                  onClose();
                })
                .catch(() => {
                  showToast('Export failed');
                })
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Exporting…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
