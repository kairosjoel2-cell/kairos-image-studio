/**
 * App shell: header, panels, canvas stage, status bar, modals, and global
 * keyboard shortcuts.
 */
import React, { useEffect, useState } from 'react';
import { EditorProvider, useEditor } from './state/editorStore';
import CanvasStage from './components/CanvasStage';
import LayersPanel from './components/LayersPanel';
import PropertiesPanel from './components/PropertiesPanel';
import { NewProjectModal, ProjectsModal, ExportModal } from './components/Modals';
import { createDocument } from './lib/document';

type ModalKind = 'new' | 'projects' | 'export' | null;

const initialDoc = createDocument('Untitled design', 1080, 1080);

function EditorShell(): JSX.Element {
  const {
    doc,
    selection,
    canUndo,
    canRedo,
    dirty,
    toast,
    undo,
    redo,
    deleteLayer,
    duplicateLayer,
    saveNow,
    setSelection,
  } = useEditor();
  const [modal, setModal] = useState<ModalKind>(null);
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;

      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((meta && e.key.toLowerCase() === 'y') || (meta && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redo();
      } else if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selection.length === 1) duplicateLayer(selection[0]);
      } else if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.length > 0) {
          e.preventDefault();
          selection.forEach((id) => deleteLayer(id));
        }
      } else if (e.key === 'Escape') {
        setSelection([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, deleteLayer, duplicateLayer, saveNow, setSelection, selection]);

  const selectionLabel =
    selection.length === 0 ? 'No selection' : selection.length === 1 ? '1 layer selected' : `${selection.length} layers selected`;

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="brand">
          KAIROS<span>.</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('new')}>
          + New
        </button>
        <button className="btn" onClick={() => setModal('projects')}>
          Open
        </button>
        <button className="btn" onClick={() => void saveNow()}>
          Save
        </button>
        <span className="spacer" />
        <button className="btn" onClick={undo} disabled={!canUndo} aria-label="Undo">
          ↶ Undo
        </button>
        <button className="btn" onClick={redo} disabled={!canRedo} aria-label="Redo">
          ↷ Redo
        </button>
        <button className="btn btn-primary" onClick={() => setModal('export')}>
          ⬇ Export
        </button>
      </header>

      <div className="app-body">
        <aside className="panel panel-left" aria-label="Layers">
          <div className="panel-content">
            <LayersPanel />
          </div>
        </aside>

        <CanvasStage />

        <aside className="panel panel-right" aria-label="Properties">
          <div className="panel-content">
            <PropertiesPanel />
          </div>
        </aside>
      </div>

      <footer className="status-bar">
        <span className={'dot' + (online ? '' : ' offline')} title={online ? 'Online' : 'Offline — everything still works'} />
        <span>
          {doc.width} × {doc.height} px
        </span>
        <span>{doc.layers.length} layers</span>
        <span>{selectionLabel}</span>
        <span className="spacer" style={{ flex: 1 }} />
        <span>{dirty ? 'Unsaved changes…' : 'Saved'}</span>
        <span>{online ? 'Online' : 'Offline mode'}</span>
      </footer>

      {modal === 'new' && <NewProjectModal onClose={() => setModal(null)} />}
      {modal === 'projects' && <ProjectsModal onClose={() => setModal(null)} />}
      {modal === 'export' && <ExportModal onClose={() => setModal(null)} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function App(): JSX.Element {
  return (
    <EditorProvider initialDoc={initialDoc}>
      <EditorShell />
    </EditorProvider>
  );
}
