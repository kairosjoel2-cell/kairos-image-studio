/**
 * Editor store: document state, selection, history, persistence, and UI
 * messages in one React context. All document mutations flow through here
 * so undo/redo and autosave stay consistent.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  DocumentState,
  Layer,
  PageBackground,
  ShapeKind,
  TextLayerData,
} from '../types';
import { createDocument, CANVAS_TEMPLATES } from '../lib/document';
import { HistoryEngine } from '../lib/history';
import { putProject, getProject, deleteProject, putAsset } from '../lib/db';
import { renderThumbnail } from '../lib/renderer';
import { uid, loadImage, clamp } from '../utils/helpers';

export interface EditorContextValue {
  doc: DocumentState;
  selection: string[];
  canUndo: boolean;
  canRedo: boolean;
  dirty: boolean;
  toast: string | null;

  showToast(message: string): void;

  commit(next: DocumentState, coalesceKey?: string): void;
  undo(): void;
  redo(): void;
  markSaved(): void;

  setSelection(ids: string[]): void;
  toggleSelection(id: string, additive: boolean): void;

  newProject(templateId: string, name: string, customW: number, customH: number): void;
  openProject(id: string): Promise<void>;
  removeProject(id: string): Promise<void>;
  saveNow(): Promise<void>;

  addImageLayer(file: File): Promise<void>;
  addTextLayer(): void;
  addShapeLayer(kind: ShapeKind): void;

  mutateLayer(id: string, fn: (layer: Layer) => Layer, coalesceKey?: string): void;
  deleteLayer(id: string): void;
  duplicateLayer(id: string): void;
  moveLayer(id: string, direction: 'up' | 'down' | 'top' | 'bottom'): void;

  patchBackground(patch: Partial<PageBackground>, coalesceKey?: string): void;
  setDocSize(width: number, height: number): void;
  renameDoc(name: string): void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside EditorProvider');
  return ctx;
}

function fitInside(width: number, height: number, maxW: number, maxH: number): { w: number; h: number } {
  const scale = Math.min(maxW / width, maxH / height, 1);
  return { w: Math.round(width * scale), h: Math.round(height * scale) };
}

export function EditorProvider({
  initialDoc,
  children,
}: {
  initialDoc: DocumentState;
  children: React.ReactNode;
}): JSX.Element {
  const [doc, setDoc] = useState<DocumentState>(initialDoc);
  const [selection, setSelectionState] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const historyRef = useRef<HistoryEngine<DocumentState>>(new HistoryEngine<DocumentState>(initialDoc));
  const docRef = useRef(doc);
  docRef.current = doc;
  const saveTimer = useRef<number | undefined>(undefined);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const scheduleSave = useCallback((next: DocumentState) => {
    setDirty(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void (async () => {
        try {
          const thumb = await renderThumbnail(next);
          await putProject(next, thumb);
          setDirty(false);
        } catch (err) {
          console.error('[KAIROS] autosave failed', err);
        }
      })();
    }, 900);
  }, []);

  const commit = useCallback(
    (next: DocumentState, coalesceKey?: string) => {
      historyRef.current.push(next, coalesceKey);
      setDoc(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.undo();
    if (prev) {
      setDoc(prev);
      scheduleSave(prev);
    }
  }, [scheduleSave]);

  const redo = useCallback(() => {
    const next = historyRef.current.redo();
    if (next) {
      setDoc(next);
      scheduleSave(next);
    }
  }, [scheduleSave]);

  const markSaved = useCallback(() => setDirty(false), []);

  const setSelection = useCallback((ids: string[]) => setSelectionState(ids), []);

  const toggleSelection = useCallback((id: string, additive: boolean) => {
    setSelectionState((prev) => {
      if (!additive) return [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }, []);

  const newProject = useCallback(
    (templateId: string, name: string, customW: number, customH: number) => {
      const tpl = CANVAS_TEMPLATES.find((t) => t.id === templateId) ?? CANVAS_TEMPLATES[0];
      const width = templateId === 'custom' ? clamp(Math.round(customW), 16, 6000) : tpl.width;
      const height = templateId === 'custom' ? clamp(Math.round(customH), 16, 6000) : tpl.height;
      const title = name.trim().length > 0 ? name.trim() : 'Untitled design';
      const fresh = createDocument(title, width, height, tpl.id === 'custom' ? '#ffffff' : tpl.bg);
      historyRef.current.reset(fresh);
      setDoc(fresh);
      setSelectionState([]);
      scheduleSave(fresh);
    },
    [scheduleSave],
  );

  const openProject = useCallback(
    async (id: string) => {
      const record = await getProject(id);
      if (record) {
        historyRef.current.reset(record.doc);
        setDoc(record.doc);
        setSelectionState([]);
        setDirty(false);
      } else {
        showToast('Project not found');
      }
    },
    [showToast],
  );

  const removeProject = useCallback(
    async (id: string) => {
      await deleteProject(id);
      if (docRef.current.id === id) {
        const fresh = createDocument('Untitled design', 1080, 1080);
        historyRef.current.reset(fresh);
        setDoc(fresh);
        setSelectionState([]);
      }
      showToast('Project deleted');
    },
    [showToast],
  );

  const saveNow = useCallback(async () => {
    const current = docRef.current;
    try {
      const thumb = await renderThumbnail(current);
      await putProject(current, thumb);
      setDirty(false);
      showToast('Project saved');
    } catch (err) {
      console.error('[KAIROS] save failed', err);
      showToast('Save failed');
    }
  }, [showToast]);

  const addImageLayer = useCallback(
    async (file: File) => {
      const assetId = uid('asset');
      const url = URL.createObjectURL(file);
      try {
        const img = await loadImage(url);
        const naturalWidth = img.naturalWidth || 1000;
        const naturalHeight = img.naturalHeight || 1000;
        await putAsset(assetId, file);

        const current = docRef.current;
        const fitted = fitInside(naturalWidth, naturalHeight, current.width * 0.7, current.height * 0.7);
        const layer: Layer = {
          id: uid('layer'),
          name: file.name.replace(/\.[^.]+$/, '') || 'Image',
          type: 'image',
          x: Math.round((current.width - fitted.w) / 2),
          y: Math.round((current.height - fitted.h) / 2),
          width: fitted.w,
          height: fitted.h,
          rotation: 0,
          opacity: 1,
          visible: true,
          locked: false,
          blendMode: 'normal',
          flipX: false,
          flipY: false,
          assetId,
          naturalWidth,
          naturalHeight,
          crop: { x: 0, y: 0, width: naturalWidth, height: naturalHeight },
          maskAssetId: null,
          maskInvert: false,
          adjustments: {
            brightness: 1, contrast: 1, saturation: 1,
            hue: 0, blur: 0, sepia: 0, grayscale: 0, invert: 0,
          },
        } as Layer;
        commit({ ...current, layers: [...current.layers, layer], updatedAt: Date.now() });
        setSelectionState([layer.id]);
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [commit],
  );

  const addTextLayer = useCallback(() => {
    const current = docRef.current;
    const fontSize = clamp(Math.round(current.width / 14), 18, 160);
    const width = Math.round(current.width * 0.6);
    const height = Math.round(fontSize * 1.5);
    const data: TextLayerData = {
      type: 'text',
      text: 'Your text here',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize,
      fontWeight: 700,
      italic: false,
      underline: false,
      align: 'center',
      lineHeight: 1.25,
      letterSpacing: 0,
      fill: '#111113',
      gradient: null,
      stroke: null,
      shadow: null,
      curve: null,
      uppercase: false,
    };
    const layer: Layer = {
      id: uid('layer'),
      name: 'Text',
      x: Math.round((current.width - width) / 2),
      y: Math.round((current.height - height) / 2),
      width,
      height,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      blendMode: 'normal',
      flipX: false,
      flipY: false,
      ...data,
    };
    commit({ ...current, layers: [...current.layers, layer], updatedAt: Date.now() });
    setSelectionState([layer.id]);
  }, [commit]);

  const addShapeLayer = useCallback(
    (kind: ShapeKind) => {
      const current = docRef.current;
      const width = Math.round(current.width * 0.4);
      const height = kind === 'line' || kind === 'arrow' ? Math.max(8, Math.round(current.width * 0.02)) : Math.round(current.height * 0.4);
      const layer: Layer = {
        id: uid('layer'),
        name: kind.charAt(0).toUpperCase() + kind.slice(1),
        type: 'shape',
        x: Math.round((current.width - width) / 2),
        y: Math.round((current.height - height) / 2),
        width,
        height,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        blendMode: 'normal',
        flipX: false,
        flipY: false,
        shape: kind,
        fill: '#e5484d',
        gradient: null,
        stroke: null,
        cornerRadius: 0,
        points: 5,
        shadow: null,
      };
      commit({ ...current, layers: [...current.layers, layer], updatedAt: Date.now() });
      setSelectionState([layer.id]);
    },
    [commit],
  );

  const mutateLayer = useCallback(
    (id: string, fn: (layer: Layer) => Layer, coalesceKey?: string) => {
      const current = docRef.current;
      const layers = current.layers.map((l) => (l.id === id ? fn(l) : l));
      commit({ ...current, layers, updatedAt: Date.now() }, coalesceKey);
    },
    [commit],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      const current = docRef.current;
      commit({ ...current, layers: current.layers.filter((l) => l.id !== id), updatedAt: Date.now() });
      setSelectionState((prev) => prev.filter((x) => x !== id));
    },
    [commit],
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      const current = docRef.current;
      const index = current.layers.findIndex((l) => l.id === id);
      if (index < 0) return;
      const original = current.layers[index];
      const copy: Layer = { ...original, id: uid('layer'), name: original.name + ' copy', x: original.x + 24, y: original.y + 24 };
      const layers = [...current.layers];
      layers.splice(index + 1, 0, copy);
      commit({ ...current, layers, updatedAt: Date.now() });
      setSelectionState([copy.id]);
    },
    [commit],
  );

  const moveLayer = useCallback(
    (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
      const current = docRef.current;
      const index = current.layers.findIndex((l) => l.id === id);
      if (index < 0) return;
      const layers = [...current.layers];
      const [item] = layers.splice(index, 1);
      let target = index;
      if (direction === 'up') target = Math.min(layers.length, index + 1);
      else if (direction === 'down') target = Math.max(0, index - 1);
      else if (direction === 'top') target = layers.length;
      else target = 0;
      layers.splice(target, 0, item);
      commit({ ...current, layers, updatedAt: Date.now() });
    },
    [commit],
  );

  const patchBackground = useCallback(
    (patch: Partial<PageBackground>, coalesceKey?: string) => {
      const current = docRef.current;
      commit(
        { ...current, background: { ...current.background, ...patch }, updatedAt: Date.now() },
        coalesceKey,
      );
    },
    [commit],
  );

  const setDocSize = useCallback(
    (width: number, height: number) => {
      const current = docRef.current;
      commit(
        {
          ...current,
          width: clamp(Math.round(width), 16, 6000),
          height: clamp(Math.round(height), 16, 6000),
          updatedAt: Date.now(),
        },
      );
    },
    [commit],
  );

  const renameDoc = useCallback(
    (name: string) => {
      const current = docRef.current;
      commit({ ...current, name, updatedAt: Date.now() });
    },
    [commit],
  );

  // Warn before leaving with pending autosave.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const value = useMemo<EditorContextValue>(
    () => ({
      doc,
      selection,
      canUndo: historyRef.current.canUndo,
      canRedo: historyRef.current.canRedo,
      dirty,
      toast,
      showToast,
      commit,
      undo,
      redo,
      markSaved,
      setSelection,
      toggleSelection,
      newProject,
      openProject,
      removeProject,
      saveNow,
      addImageLayer,
      addTextLayer,
      addShapeLayer,
      mutateLayer,
      deleteLayer,
      duplicateLayer,
      moveLayer,
      patchBackground,
      setDocSize,
      renameDoc,
    }),
    [
      doc,
      selection,
      dirty,
      toast,
      showToast,
      commit,
      undo,
      redo,
      markSaved,
      setSelection,
      toggleSelection,
      newProject,
      openProject,
      removeProject,
      saveNow,
      addImageLayer,
      addTextLayer,
      addShapeLayer,
      mutateLayer,
      deleteLayer,
      duplicateLayer,
      moveLayer,
      patchBackground,
      setDocSize,
      renameDoc,
    ],
  );

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export { createDocument };
