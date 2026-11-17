/**
 * Modals: flyer import wizard, new project, projects browser, export dialog,
 * and AI settings.
 */
import React, { useEffect, useRef, useState } from 'react';
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

/* ---------------------------- flyer import ------------------------------ */

export function ImportFlyerModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { importFlyerFile, showToast } = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<'pick' | 'working' | 'done'>('pick');
  const [summary, setSummary] = useState<{ blockCount: number; patchCount: number; mode: string; notes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startImport = () => {
    if (!file) return;
    setPhase('working');
    setError(null);
    importFlyerFile(file, name)
      .then((result) => {
        setSummary(result);
        setPhase('done');
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Import failed';
        setError(message);
        setPhase('pick');
        showToast(message);
      });
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => closeOnBackdrop(e, onClose)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Import flyer">
        <h2>Import flyer</h2>
        <p style={{ fontSize: 12, color: 'var(--k-text-dim)', marginBottom: 12 }}>
          Upload an existing flyer (PNG, JPG, WEBP, or PDF). KAIROSWEB keeps the original
          design as the base layer, extracts every text block, and rebuilds them as
          editable text — layout preserved.
        </p>

        {phase !== 'done' && (
          <>
            <div className="field">
              <label>Flyer file</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                disabled={phase === 'working'}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''));
                }}
              />
            </div>
            <div className="field">
              <label>Project name</label>
              <input
                type="text"
                placeholder="Imported flyer"
                value={name}
                disabled={phase === 'working'}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {phase === 'working' && (
              <p style={{ fontSize: 12, color: 'var(--k-red)' }} aria-live="polite">
                Working… uploading, analyzing, and rebuilding layers. Large flyers can take
                up to a minute.
              </p>
            )}
            {error && <p style={{ fontSize: 12, color: 'var(--k-red)' }}>{error}</p>}

            <div className="modal-actions">
              <button className="btn" onClick={onClose} disabled={phase === 'working'}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={startImport} disabled={!file || phase === 'working'}>
                {phase === 'working' ? 'Converting…' : 'Convert to editable design'}
              </button>
            </div>
          </>
        )}

        {phase === 'done' && summary && (
          <>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>Import complete.</strong>
            </div>
            <ul style={{ fontSize: 12, color: 'var(--k-text-dim)', paddingLeft: 18, marginBottom: 8 }}>
              <li>{summary.blockCount} editable text blocks</li>
              <li>{summary.patchCount} background patches</li>
              <li>Extraction mode: {summary.mode === 'ai' ? 'AI vision' : 'offline heuristic'}</li>
            </ul>
            {summary.notes.length > 0 && (
              <ul style={{ fontSize: 11, color: 'var(--k-text-faint)', paddingLeft: 18, marginBottom: 8 }}>
                {summary.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onClose}>
                Start editing
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------- new project ------------------------------- */

export function NewProjectModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { newProject } = useEditor();
  const [templateId, setTemplateId] = useState('a4');
  const [name, setName] = useState('');
  const [customW, setCustomW] = useState(1240);
  const [customH, setCustomH] = useState(1754);

  const groups = Array.from(new Set(CANVAS_TEMPLATES.map((t) => t.group)));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => closeOnBackdrop(e, onClose)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="New project">
        <h2>New project</h2>
        <div className="field">
          <label>Project name</label>
          <input
            type="text"
            placeholder="Untitled flyer"
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
                  className="template-card"
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

/* ---------------------------- projects list ----------------------------- */

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
            No saved projects yet. Import a flyer or create one — everything is stored
            offline in your browser.
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

/* -------------------------------- export -------------------------------- */

export function ExportModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { doc, showToast } = useEditor();
  const [format, setFormat] = useState<ExportFormat>('pdf');
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
        {(format === 'jpeg' || format === 'webp') && (
          <div className="field">
            <label>Quality ({Math.round(quality * 100)}%)</label>
            <input type="range" min={0.1} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
          </div>
        )}
        <div className="field">
          <label>
            Scale ({scale}× — output {outW}×{outH}px)
          </label>
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
                  showToast('Export failed — check your connection for PDF exports');
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

/* ----------------------------- AI settings ------------------------------ */

export function SettingsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const { aiSettings, updateAiSettings } = useEditor();
  const [baseUrl, setBaseUrl] = useState(aiSettings.baseUrl);
  const [apiKey, setApiKey] = useState(aiSettings.apiKey);
  const [model, setModel] = useState(aiSettings.model);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => closeOnBackdrop(e, onClose)}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="AI settings">
        <h2>AI settings</h2>
        <p style={{ fontSize: 12, color: 'var(--k-text-dim)', marginBottom: 12 }}>
          Used for flyer text extraction. Your key is stored only in this browser
          (localStorage) and is sent directly to the endpoint you choose — never to any
          other server, and never committed to the repository.
        </p>
        <div className="field">
          <label>API base URL (OpenAI-compatible)</label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div className="field">
          <label>API key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label>Vision model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
          />
        </div>
        <p style={{ fontSize: 11, color: 'var(--k-text-faint)' }}>
          Works with OpenAI, Groq, OpenRouter, DeepSeek, or any OpenAI-compatible
          /chat/completions endpoint that accepts image input. Without a key the app
          still imports flyers in offline mode.
        </p>
        <div className="modal-actions">
          <button
            className="btn btn-danger"
            onClick={() => {
              updateAiSettings({ baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' });
              onClose();
            }}
          >
            Clear key
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              updateAiSettings({ baseUrl, apiKey, model });
              onClose();
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
