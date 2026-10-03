import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Cable,
  Check,
  ChevronDown,
  CircleHelp,
  CircuitBoard,
  Download,
  FolderOpen,
  Lightbulb,
  LogOut,
  LoaderCircle,
  Maximize,
  Minimize,
  Paintbrush,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Route,
  Footprints,
  Play,
  Trash2,
  Power,
  Redo2,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Undo2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import Bench from './components/Bench';
import Inspector from './components/Inspector';
import ObservationPanel from './components/ObservationPanel';
import { traceLoad } from './sim/loadTrace';
import LanguageToggle from './components/LanguageToggle';
import ThemeToggle from './components/ThemeToggle';
import ResetMenu from './components/ResetMenu';
import Modal from './components/Modal';
import LayoutReference from './components/LayoutReference';
import { createWorkspaceState, currentWorkspace, workspaceReducer } from './workspace';
import ColorPicker, { WIRE_COLORS } from './components/ColorPicker';
import { DEVICES, LOADS, TERMINAL_IDS } from './sim/model';
import type { Wire } from './sim/model';
import { useSimulation } from './hooks/useSimulation';
import { useProjectAutosave } from './hooks/useProjectAutosave';
import { useBenchFullscreen } from './hooks/useBenchFullscreen';
import { EXAMPLES } from './sim/examples';
import { encodeProject, parseProject } from './project';
import { localizeDevice } from './layout';
import { useI18n, type TranslationKey, type TranslationValues } from './i18n';
import { localizeFault, localizeProjectError, localizeStorageError } from './i18n/messages';
import type { Point } from './layout';
import { PROJECT_LIMITS } from './limits';
import { readStoredProject, saveStoredProject, type StorageProblem } from './storage';
import { APP_VERSION } from './version';
import { arrangeAutomaticWires, routeNewWire } from './rendering/wireRouting';
import './inspection.css';
import './observation.css';
import './observation-integration.css';

type UiMessage =
  | { kind: 'ui'; key: TranslationKey; values?: TranslationValues }
  | { kind: 'fault'; value: Parameters<typeof localizeFault>[0] }
  | { kind: 'error'; value: unknown }
  | { kind: 'storage'; value: Parameters<typeof localizeStorageError>[0] }
  | { kind: 'example'; id: string };
const message = (key: TranslationKey, values?: TranslationValues): UiMessage => ({
  kind: 'ui',
  key,
  values,
});
const EXAMPLE_KEYS: Record<string, Record<'name' | 'subtitle' | 'description', TranslationKey>> = {
  'button-lamp': {
    name: 'ui.example.button-lamp.name',
    subtitle: 'ui.example.button-lamp.subtitle',
    description: 'ui.example.button-lamp.description',
  },
  'contactor-jog': {
    name: 'ui.example.contactor-jog.name',
    subtitle: 'ui.example.contactor-jog.subtitle',
    description: 'ui.example.contactor-jog.description',
  },
  'self-hold': {
    name: 'ui.example.self-hold.name',
    subtitle: 'ui.example.self-hold.subtitle',
    description: 'ui.example.self-hold.description',
  },
};

function observationTarget(wires: Wire[], preferred: string | null): string {
  const connectedLoads = LOADS.filter((load) =>
    wires.some(
      (wire) => [wire.from, wire.to].includes(load.from) || [wire.from, wire.to].includes(load.to),
    ),
  );
  return (
    connectedLoads.find((load) => load.deviceId === preferred)?.deviceId ??
    connectedLoads[0]?.deviceId ??
    LOADS.find((load) => load.deviceId === preferred)?.deviceId ??
    LOADS[0].deviceId
  );
}

function newId() {
  return crypto.randomUUID();
}

export default function App() {
  const { locale, t } = useI18n();
  const exampleText = (id: string, field: 'name' | 'subtitle' | 'description') => {
    const key = EXAMPLE_KEYS[id]?.[field];
    return key ? t(key) : id;
  };
  const renderMessage = (item: UiMessage): string => {
    switch (item.kind) {
      case 'ui':
        return t(item.key, item.values);
      case 'fault':
        return localizeFault(item.value, locale);
      case 'error':
        return localizeProjectError(item.value, locale);
      case 'storage':
        return localizeStorageError(item.value, locale);
      case 'example':
        return t('ui.log.exampleLoaded', { name: exampleText(item.id, 'name') });
    }
  };
  const [boot] = useState(() => readStoredProject());
  const [workspaceState, dispatchWorkspace] = useReducer(workspaceReducer, boot, (initial) =>
    createWorkspaceState(
      initial.project?.name || t('ui.project.defaultName'),
      initial.project?.wires || [],
    ),
  );
  const { name, history } = currentWorkspace(workspaceState);
  const wires = history.present;
  const activeExample = workspaceState.example?.id || '';
  const ownName = workspaceState.workbench.name;
  const ownWires = workspaceState.workbench.history.present;
  const setName = (name: string) => dispatchWorkspace({ type: 'set-name', name });
  const simulation = useSimulation(wires);
  const {
    powered,
    result,
    operate,
    setPower,
    resetSimulation,
    snapshots,
    selectedSnapshotId,
    displayed,
    previousDisplayed,
    viewingHistory,
    selectSnapshot,
    releaseMomentary,
  } = simulation;
  const [stepMode, setStepMode] = useState(false);
  const [traceTarget, setTraceTarget] = useState('KM1');
  const [traceVisible, setTraceVisible] = useState(true);
  const editLocked = powered || viewingHistory;
  const trace = useMemo(
    () => traceLoad(displayed.wires, displayed.result, displayed.powered, traceTarget),
    [displayed, traceTarget],
  );
  const previousTrace = useMemo(
    () =>
      previousDisplayed
        ? traceLoad(
            previousDisplayed.wires,
            previousDisplayed.result,
            previousDisplayed.powered,
            traceTarget,
          )
        : null,
    [previousDisplayed, traceTarget],
  );
  const [selected, setSelected] = useState<string | null>('KM1'),
    [selectedWire, setSelectedWire] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null),
    [route, setRoute] = useState<Point[]>([]),
    [color, setColor] = useState<string>(WIRE_COLORS[0].value);
  const [fixed, setFixed] = useState(true),
    [mode, setMode] = useState<'wire' | 'pan'>('wire'),
    [nav, setNav] = useState(() => window.innerWidth > 1050);
  const [examplesExpanded, setExamplesExpanded] = useState(true);
  const [devicesExpanded, setDevicesExpanded] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorRef = useRef<HTMLElement>(null);
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const observationToggleRef = useRef<HTMLButtonElement>(null);
  const [modal, setModal] = useState<'help' | 'reference' | 'new' | null>(null);
  const [notice, setNotice] = useState<UiMessage | null>(
    boot.error ? { kind: 'storage', value: boot } : null,
  );
  const {
    rootRef: fullscreenRef,
    expanded,
    toggle: toggleFullscreen,
  } = useBenchFullscreen((key) => setNotice(message(key)));
  useEffect(() => {
    if (!expanded) setInspectorOpen(false);
  }, [expanded]);
  useEffect(() => {
    if (inspectorOpen && (expanded || (stepMode && window.innerWidth <= 920)))
      inspectorRef.current?.focus({ preventScroll: true });
  }, [expanded, inspectorOpen, stepMode]);
  const closeInspector = () => {
    setInspectorOpen(false);
    const trigger = expanded ? inspectorToggleRef.current : observationToggleRef.current;
    trigger?.focus({ preventScroll: true });
  };
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>(
    boot.error ? 'error' : 'saved',
  );
  const [saveError, setSaveError] = useState<Parameters<typeof localizeStorageError>[0] | null>(
    boot.error ? boot : null,
  );
  const [saveProblem, setSaveProblem] = useState<StorageProblem | null>(boot.problem);
  const [events, setEvents] = useState<UiMessage[]>([message('ui.log.ready')]);
  const importInput = useRef<HTMLInputElement>(null);
  const log = useCallback(
    (message: UiMessage) => setEvents((prev) => [message, ...prev].slice(0, 12)),
    [],
  );
  const cancel = useCallback(() => {
    setPending(null);
    setRoute([]);
  }, []);
  const commit = useCallback(
    (next: Wire[]) => dispatchWorkspace({ type: 'commit', wires: next }),
    [],
  );
  const undo = useCallback(() => {
    if (editLocked) return;
    dispatchWorkspace({ type: 'undo' });
    cancel();
    setSelectedWire(null);
  }, [editLocked, cancel]);
  const redo = useCallback(() => {
    if (editLocked) return;
    dispatchWorkspace({ type: 'redo' });
    cancel();
    setSelectedWire(null);
  }, [editLocked, cancel]);
  const removeWire = useCallback(() => {
    if (!selectedWire || editLocked) return;
    commit(wires.filter((w) => w.id !== selectedWire));
    setSelectedWire(null);
    log(message('ui.log.wireRemoved'));
  }, [selectedWire, editLocked, commit, wires, log]);
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.defaultPrevented || modal) return;
      const target = e.target;
      if (
        target instanceof Element &&
        (target.closest('input, textarea, select, [role="menu"]') ||
          (target instanceof HTMLElement && target.isContentEditable))
      )
        return;
      if (e.key === 'Escape') {
        cancel();
        setSelectedWire(null);
        setModal(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWire) {
        e.preventDefault();
        removeWire();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [cancel, redo, undo, removeWire, selectedWire, modal]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  useProjectAutosave({
    name: ownName,
    wires: ownWires,
    onPending: () => setSaveState('saving'),
    onSaved: (saved) => {
      setSaveState(saved.ok ? 'saved' : 'error');
      setSaveError(saved.ok ? null : saved);
      setSaveProblem(saved.problem);
      if (!saved.ok) setNotice({ kind: 'storage', value: saved });
    },
  });
  const lastState = useRef('');
  useEffect(() => {
    const state = JSON.stringify([powered, result.coils, result.lamps, result.fault?.kind]);
    if (lastState.current === state) return;
    lastState.current = state;
    if (result.fault) {
      log({ kind: 'fault', value: result.fault });
    } else if (powered) {
      const running = Object.keys(result.coils).filter((id) => result.coils[id]);
      log(
        running.length
          ? message('ui.log.energized', {
              devices: running.join(', '),
              count: Object.values(result.lamps).filter(Boolean).length,
            })
          : message('ui.log.powerOn'),
      );
    }
  }, [powered, result, log]);
  const onSocket = (id: string) => {
    if (viewingHistory) {
      setNotice(message('learning.historyReadonly'));
      return;
    }
    if (powered) {
      setSelected(id.split(':')[0]);
      setSelectedWire(null);
      setNotice(message('ui.notice.powerOffFirst'));
      return;
    }
    if (!pending) {
      setPending(id);
      setSelected(id.split(':')[0]);
      setSelectedWire(null);
      setRoute([]);
      return;
    }
    if (pending === id) {
      cancel();
      return;
    }
    if (
      wires.some((w) => (w.from === pending && w.to === id) || (w.from === id && w.to === pending))
    ) {
      setNotice(message('ui.notice.duplicateWire'));
      cancel();
      return;
    }
    if (wires.length >= PROJECT_LIMITS.maxWires) {
      setNotice(message('ui.notice.wireLimit', { count: PROJECT_LIMITS.maxWires }));
      cancel();
      return;
    }
    const wire: Wire = {
      id: newId(),
      from: pending,
      to: id,
      color,
      points: route.length ? route : routeNewWire(pending, id, wires).slice(1, -1),
    };
    commit([...wires, wire]);
    log(message('ui.log.wireConnected', { from: pending, to: id }));
    cancel();
  };
  const togglePower = () => {
    if (viewingHistory) return;
    cancel();
    setSelectedWire(null);
    if (powered) {
      setPower(false);
      log(message('ui.log.powerOff'));
    } else {
      setPower(true);
      setMode('wire');
    }
  };
  const loadExample = (id: string) => {
    if (editLocked) return;
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    // A fresh exercise should start readable without requiring a separate
    // arrange action. Imported projects retain their original saved geometry.
    const next = arrangeAutomaticWires(ex.wires).map((w) => ({
      ...w,
      id: newId(),
      ...(w.points ? { points: w.points.map((pt) => ({ ...pt })) } : {}),
    }));
    dispatchWorkspace({ type: 'enter-example', id, name: exampleText(ex.id, 'name'), wires: next });
    resetSimulation(next);
    if (stepMode) setTraceTarget(observationTarget(next, traceTarget));
    if (window.innerWidth <= 1050) setNav(false);
    cancel();
    setSelected('KM1');
    setSelectedWire(null);
    log({ kind: 'example', id: ex.id });
    setNotice(message('ui.notice.exampleLoaded'));
  };
  const resetBench = () => {
    resetSimulation(wires);
    cancel();
    setSelectedWire(null);
    setMode('wire');
    setNotice(message('ui.reset.done'));
    log(message('ui.reset.done'));
  };
  const exitExample = () => {
    if (!activeExample) return;
    dispatchWorkspace({ type: 'exit-example' });
    if (window.innerWidth <= 1050) setNav(false);
    resetSimulation(ownWires);
    cancel();
    setSelectedWire(null);
    setSelected('KM1');
    setMode('wire');
    setNotice(message('ui.example.exited'));
    log(message('ui.example.exited'));
  };
  const save = () => {
    if (activeExample) {
      exportFile();
      return;
    }
    const saved = saveStoredProject(name, wires);
    setSaveState(saved.ok ? 'saved' : 'error');
    setSaveError(saved.ok ? null : saved);
    setSaveProblem(saved.problem);
    setNotice(saved.ok ? message('ui.notice.saved') : { kind: 'storage', value: saved });
  };
  const exportFile = () => {
    try {
      const url = URL.createObjectURL(
        new Blob([encodeProject(name, wires)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[/\\:*?"<>|]/g, '-')}.wirebench.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Keep the URL alive while the browser starts or confirms the download.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      log(message('ui.log.download'));
      setNotice(message('ui.notice.download'));
    } catch (err) {
      setNotice({ kind: 'error', value: err });
    }
  };
  const importFile = async (file: File) => {
    try {
      if (file.size > PROJECT_LIMITS.maxFileBytes) {
        setNotice(message('ui.file.tooLarge'));
        return;
      }
      const project = parseProject(await file.text());
      dispatchWorkspace({ type: 'replace-project', name: project.name, wires: project.wires });
      resetSimulation(project.wires);
      cancel();
      setSelectedWire(null);
      log(message('ui.log.imported', { name: project.name }));
      setNotice(message('ui.notice.imported'));
    } catch (err) {
      setNotice({ kind: 'error', value: err });
    } finally {
      if (importInput.current) importInput.current.value = '';
    }
  };
  const selectedConnection = wires.find((wire) => wire.id === selectedWire);
  const canArrange = wires.some((wire) => wire.points === undefined);
  const arrangeWires = () => {
    if (editLocked || pending || !canArrange) return;
    commit(arrangeAutomaticWires(wires));
    log(message('ui.log.wiresArranged'));
    setNotice(message('ui.notice.wiresArranged'));
  };
  const rerouteWire = () => {
    if (editLocked || pending || !selectedConnection) return;
    const points = routeNewWire(
      selectedConnection.from,
      selectedConnection.to,
      wires.filter((wire) => wire.id !== selectedConnection.id),
    ).slice(1, -1);
    if (JSON.stringify(points) === JSON.stringify(selectedConnection.points)) return;
    commit(wires.map((wire) => (wire.id === selectedConnection.id ? { ...wire, points } : wire)));
    log(message('ui.log.wireRouted'));
  };
  const activeCount = Object.values(result.coils).filter(Boolean).length;
  return (
    <div
      ref={fullscreenRef}
      className={`app ${nav ? '' : 'nav-hidden'} ${expanded ? 'bench-expanded' : ''}`}
      onKeyDownCapture={(event) => {
        // Close this non-modal panel before the document-level fullscreen shortcut.
        // Menus and dialogs retain their own Escape handling.
        if (
          event.key === 'Escape' &&
          (expanded || (stepMode && window.innerWidth <= 920)) &&
          inspectorOpen &&
          !modal &&
          !(event.target instanceof Element && event.target.closest('[role="menu"]'))
        ) {
          event.preventDefault();
          event.stopPropagation();
          closeInspector();
        }
      }}
    >
      <header className="app-header">
        <button
          className="view-button navigation-toggle"
          aria-label={nav ? t('ui.sidebar.collapse') : t('ui.sidebar.expand')}
          aria-expanded={nav}
          aria-controls="experiment-sidebar"
          title={nav ? t('ui.sidebar.collapseHint') : t('ui.sidebar.expandHint')}
          onClick={() => setNav((v) => !v)}
        >
          {nav ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          <span>{nav ? t('ui.sidebar.collapse') : t('ui.sidebar.expand')}</span>
        </button>
        <a
          className="brand"
          href="#"
          aria-label={t('ui.brand.home')}
          onClick={(e) => e.preventDefault()}
        >
          <div className="brand-mark">
            <CircuitBoard size={23} />
          </div>
          <div>
            WireBench<h1>{t('ui.sidebar.workbench')}</h1>
          </div>
          <span className="version">v{APP_VERSION}</span>
        </a>
        <div className="project-title">
          <span>{t('ui.project.label')}</span>
          <input
            aria-label={t('ui.project.name')}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (!name.trim()) setName(t('ui.project.untitled'));
            }}
          />
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <LanguageToggle />
          <span
            className={`save-status ${saveState}`}
            title={
              saveError
                ? localizeStorageError(saveError, locale)
                : t(activeExample ? 'ui.example.sessionHint' : 'ui.save.autoHint')
            }
          >
            {saveState === 'saving' ? (
              <LoaderCircle size={13} />
            ) : saveState === 'saved' ? (
              <Check size={13} />
            ) : (
              <CircleHelp size={13} />
            )}
            <span>
              {activeExample && saveState !== 'error'
                ? t('ui.example.session')
                : saveState === 'saved'
                  ? t('ui.save.saved')
                  : saveState === 'saving'
                    ? t('ui.save.saving')
                    : saveProblem === 'protected'
                      ? t('ui.save.protected')
                      : t('ui.save.error')}
            </span>
          </span>
          <button
            className="button quiet"
            aria-label={t('ui.action.guide')}
            onClick={() => setModal('help')}
          >
            <BookOpen size={16} />
            <span>{t('ui.action.guide')}</span>
          </button>
          <button
            className="button outline"
            aria-label={t('ui.action.export')}
            onClick={exportFile}
          >
            <Download size={15} />
            <span>{t('ui.action.export')}</span>
          </button>
        </div>
      </header>
      {nav && !expanded && (
        <button
          className="sidebar-backdrop"
          aria-label={t('ui.sidebar.close')}
          onClick={() => setNav(false)}
          tabIndex={-1}
        />
      )}
      <div className="workspace">
        <aside id="experiment-sidebar" className="sidebar" aria-label={t('ui.sidebar.navigation')}>
          <div className="sidebar-heading">
            <span>{t('ui.sidebar.workspace')}</span>
            <button aria-label={t('ui.sidebar.collapseNavigation')} onClick={() => setNav(false)}>
              <PanelLeftClose size={16} />
              <span>{t('ui.sidebar.collapseShort')}</span>
            </button>
          </div>
          <button
            className={`sidebar-current ${activeExample ? 'inactive' : ''}`}
            aria-pressed={!activeExample}
            onClick={() => {
              exitExample();
              if (window.innerWidth <= 1050) setNav(false);
            }}
            title={t(activeExample ? 'ui.example.exitHint' : 'ui.sidebar.autonomous')}
          >
            <CircuitBoard size={17} /> {t('ui.sidebar.autonomous')} <span>01</span>
          </button>
          <button
            className="section-label section-toggle"
            aria-label={
              examplesExpanded ? t('ui.sidebar.collapseExamples') : t('ui.sidebar.expandExamples')
            }
            aria-expanded={examplesExpanded}
            aria-controls="sidebar-examples"
            onClick={() => setExamplesExpanded((value) => !value)}
          >
            <ChevronDown size={14} className="section-chevron" />
            {t('ui.sidebar.examples')} <span>{EXAMPLES.length}</span>
          </button>
          <div id="sidebar-examples" className={`examples ${examplesExpanded ? '' : 'hidden'}`}>
            {EXAMPLES.map((ex, i) => (
              <button
                key={ex.id}
                disabled={editLocked && activeExample !== ex.id}
                aria-pressed={activeExample === ex.id}
                className={`example-card ${activeExample === ex.id ? 'chosen' : ''}`}
                onClick={() => (activeExample === ex.id ? exitExample() : loadExample(ex.id))}
                title={exampleText(ex.id, 'description')}
              >
                <span className="example-number">0{i + 1}</span>
                <div>
                  <strong>{exampleText(ex.id, 'name')}</strong>
                  <span>{exampleText(ex.id, 'subtitle')}</span>
                </div>
                {activeExample === ex.id ? <LogOut size={14} /> : <ArrowUpRight size={14} />}
              </button>
            ))}
          </div>
          <button
            className="section-label section-toggle inventory-heading"
            aria-label={
              devicesExpanded ? t('ui.sidebar.collapseDevices') : t('ui.sidebar.expandDevices')
            }
            aria-expanded={devicesExpanded}
            aria-controls="sidebar-devices"
            onClick={() => setDevicesExpanded((value) => !value)}
          >
            <ChevronDown size={14} className="section-chevron" />
            {t('ui.sidebar.devices')} <span>{DEVICES.length}</span>
          </button>
          <div
            id="sidebar-devices"
            className={`device-inventory ${devicesExpanded ? '' : 'hidden'}`}
          >
            {DEVICES.map((d) => (
              <button
                key={d.id}
                className={selected === d.id && !selectedWire ? 'current' : ''}
                title={localizeDevice(d, locale)}
                onClick={() => {
                  setSelected(d.id);
                  setSelectedWire(null);
                }}
              >
                <span
                  className={`inventory-dot ${displayed.result.coils[d.id] || displayed.result.lamps[d.id] || displayed.inputs[d.id] ? 'active' : ''}`}
                />
                <code>{d.id === 'ESTOP' ? 'E-STOP' : d.id}</code>
                <span>{localizeDevice(d, locale).replace(/ [123]$/, '')}</span>
              </button>
            ))}
          </div>
          <div className="sidebar-bottom">
            <button
              onClick={() => window.open('/?preview=materials', '_blank', 'noopener,noreferrer')}
            >
              <Paintbrush size={15} /> {t('preview.study')} <ArrowUpRight size={13} />
            </button>
            <button onClick={() => setModal('reference')}>
              <FolderOpen size={15} /> {t('ui.sidebar.reference')} <ArrowUpRight size={13} />
            </button>
            <div>
              <ShieldCheck size={13} /> {t('ui.sidebar.offline')}
            </div>
          </div>
        </aside>
        <main className="work-area">
          {activeExample && (
            <div className="example-session">
              <div>
                <strong>{exampleText(activeExample, 'name')}</strong>
                <span>{t('ui.example.sessionHint')}</span>
              </div>
              <button
                className="view-button"
                onClick={exitExample}
                title={t('ui.example.exitHint')}
              >
                <LogOut size={16} />
                <span>{t('ui.example.exit')}</span>
              </button>
            </div>
          )}
          <div className="toolbar">
            <div className="toolbar-primary">
              <button
                className={`power-button ${powered ? 'powered' : ''}`}
                disabled={viewingHistory}
                onClick={togglePower}
              >
                {powered ? <Square size={14} fill="currentColor" /> : <Power size={16} />}
                <span>{powered ? t('ui.action.powerOff') : t('ui.action.powerOn')}</span>
              </button>
              <ResetMenu onReset={resetBench} onClear={() => setModal('new')} />
              <span className="toolbar-divider" />
              <div className="mode-label">
                <Cable size={16} />
                <span>
                  {powered
                    ? t('ui.mode.locked')
                    : pending
                      ? t('ui.mode.wiring')
                      : t('ui.mode.tool')}
                </span>
              </div>
              <ColorPicker value={color} disabled={editLocked} onChange={setColor} />
            </div>
            <div className="toolbar-actions">
              <button
                className={`view-button ${stepMode ? 'toggled' : ''}`}
                aria-pressed={stepMode}
                title={t('learning.modeHint')}
                onClick={() => {
                  cancel();
                  releaseMomentary();
                  selectSnapshot(null);
                  setStepMode(!stepMode);
                  if (!stepMode) {
                    setTraceTarget(observationTarget(wires, selected));
                    setInspectorOpen(true);
                  }
                }}
              >
                <Footprints size={16} />
                <span>{t('learning.mode')}</span>
              </button>
              {expanded && <ThemeToggle />}
              {expanded && <LanguageToggle />}
              {expanded && (
                <button
                  ref={inspectorToggleRef}
                  className={`icon-button inspector-toggle ${inspectorOpen ? 'toggled' : ''}`}
                  aria-label={t(inspectorOpen ? 'ui.inspection.close' : 'ui.inspection.open')}
                  title={t(inspectorOpen ? 'ui.inspection.close' : 'ui.inspection.open')}
                  aria-expanded={inspectorOpen}
                  aria-controls="bench-inspector"
                  onClick={() => (inspectorOpen ? closeInspector() : setInspectorOpen(true))}
                >
                  {inspectorOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
                </button>
              )}
              <button
                className="icon-button"
                aria-label={t('ui.action.undo')}
                disabled={editLocked || !history.past.length}
                onClick={undo}
              >
                <Undo2 size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={t('ui.action.redo')}
                disabled={editLocked || !history.future.length}
                onClick={redo}
              >
                <Redo2 size={16} />
              </button>
              <span className="toolbar-divider" />
              <button
                className="icon-button"
                aria-label={t('ui.action.arrangeWires')}
                title={t('ui.action.arrangeWiresHint')}
                disabled={editLocked || !!pending || !canArrange}
                onClick={arrangeWires}
              >
                <Route size={16} />
              </button>
              <button
                className={`icon-button ${fixed ? 'toggled' : ''}`}
                aria-label={fixed ? t('ui.action.dimFixed') : t('ui.action.showFixed')}
                aria-pressed={fixed}
                onClick={() => setFixed((v) => !v)}
              >
                <SlidersHorizontal size={16} />
              </button>
              <button
                className="icon-button"
                aria-label={t(activeExample ? 'ui.action.export' : 'ui.action.save')}
                title={t(activeExample ? 'ui.action.export' : 'ui.action.save')}
                onClick={save}
              >
                {activeExample ? <Download size={16} /> : <Save size={16} />}
              </button>
              <button
                className="icon-button"
                aria-label={t('ui.action.import')}
                disabled={editLocked}
                onClick={() => importInput.current?.click()}
              >
                <Upload size={16} />
              </button>
              <button
                className="view-button fullscreen-toggle"
                aria-label={expanded ? t('ui.action.exitFullscreen') : t('ui.action.fullscreen')}
                aria-pressed={expanded}
                title={expanded ? t('ui.action.exitFullscreenHint') : t('ui.action.fullscreenHint')}
                onClick={() => void toggleFullscreen()}
              >
                {expanded ? <Minimize size={16} /> : <Maximize size={16} />}
                <span>{expanded ? t('ui.action.exitFullscreen') : t('ui.action.fullscreen')}</span>
              </button>
            </div>
          </div>
          {stepMode && (
            <div className={`observation-bar ${viewingHistory ? 'is-history' : ''}`} role="status">
              <span>{t(viewingHistory ? 'learning.historyReadonly' : 'learning.modeHint')}</span>
              <div className="observation-bar-actions">
                {viewingHistory && (
                  <button className="view-button" onClick={() => selectSnapshot(null)}>
                    {t('learning.backToLive')}
                  </button>
                )}
                <button
                  ref={observationToggleRef}
                  className="view-button"
                  aria-controls="bench-inspector"
                  title={t('learning.inspect')}
                  onClick={() => setInspectorOpen(true)}
                >
                  {t('learning.traceTarget', { id: traceTarget })}
                </button>
              </div>
            </div>
          )}
          {displayed.result.fault && (
            <div className="fault-banner" role="alert">
              <Zap size={17} />
              <div>
                <strong>
                  {displayed.result.fault.kind === 'short'
                    ? t('ui.fault.short')
                    : displayed.result.fault.kind === 'unstable'
                      ? t('ui.fault.unstable')
                      : t('ui.fault.unsupported')}
                </strong>
                <span>
                  {localizeFault(displayed.result.fault, locale)} {t('ui.fault.stopped')}
                </span>
              </div>
              <button disabled={viewingHistory} onClick={() => setPower(false)}>
                {t('ui.fault.check')} <ArrowRight size={14} />
              </button>
            </div>
          )}
          <Bench
            wires={wires}
            inputs={displayed.inputs}
            result={displayed.result}
            powered={displayed.powered}
            stepMode={stepMode}
            readOnly={viewingHistory}
            trace={stepMode && traceVisible ? trace : null}
            selected={selectedWire ? null : selected}
            selectedWire={selectedWire}
            pending={pending}
            route={route}
            color={color}
            fixed={fixed}
            mode={mode}
            onSelect={(id) => {
              setSelected(id);
              setSelectedWire(null);
            }}
            onWireSelect={(id) => {
              setSelectedWire(id);
              cancel();
            }}
            onClearSelection={() => {
              setSelected(null);
              setSelectedWire(null);
            }}
            onSocket={onSocket}
            onOperate={operate}
            onRoute={(point) =>
              setRoute((r) => (r.length < PROJECT_LIMITS.maxPoints ? [...r, point] : r))
            }
            onMoveWire={(id, points) => {
              if (!editLocked) commit(wires.map((w) => (w.id === id ? { ...w, points } : w)));
            }}
            onCancel={cancel}
            onMode={(m) => {
              setMode(m);
              cancel();
            }}
          />
          <footer className="canvas-footer">
            {selectedConnection ? (
              <div className="connection-summary" aria-label={t('ui.inspection.connection')}>
                <div className="connection-summary-endpoints" role="status">
                  <i style={{ backgroundColor: selectedConnection.color }} aria-hidden="true" />
                  <span className="connection-summary-label">
                    {t('ui.inspection.selectedWire')}
                  </span>
                  <b className="connection-endpoint-label">A</b>
                  <code>{selectedConnection.from}</code>
                  <span aria-hidden="true">—</span>
                  <b className="connection-endpoint-label">B</b>
                  <code>{selectedConnection.to}</code>
                </div>
                <div className="connection-summary-actions">
                  {expanded && !inspectorOpen && (
                    <button
                      className="view-button"
                      aria-label={t('ui.inspection.details')}
                      aria-controls="bench-inspector"
                      aria-expanded={inspectorOpen}
                      onClick={() => setInspectorOpen(true)}
                    >
                      <PanelRightOpen size={14} />
                      <span>{t('ui.inspection.details')}</span>
                    </button>
                  )}
                  <button
                    className="icon-button"
                    aria-label={t('ui.inspection.clearSelection')}
                    onClick={() => setSelectedWire(null)}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className={powered ? 'online' : ''}>
                  <i />
                  {viewingHistory
                    ? t('learning.historyReadonly')
                    : powered
                      ? result.fault
                        ? t('ui.footer.stopped')
                        : t('ui.footer.powered')
                      : t('ui.footer.editable')}
                </span>
                <span>
                  <Cable size={13} />
                  {t(wires.length === 1 ? 'ui.footer.wire' : 'ui.footer.wires', {
                    count: wires.length,
                  })}
                </span>
                <span>{t('ui.footer.terminals', { count: TERMINAL_IDS.length })}</span>
                <span className="footer-help">
                  {t('ui.footer.zoom')} <b>·</b> {t('ui.footer.pan')} <b>·</b>{' '}
                  {t('ui.footer.cancel')}
                </span>
              </>
            )}
          </footer>
        </main>
        <Inspector
          panelRef={inspectorRef}
          compact={expanded}
          hidden={expanded && !inspectorOpen}
          onClose={expanded || (stepMode && inspectorOpen) ? closeInspector : undefined}
          learningOpen={stepMode && inspectorOpen}
          stepMode={stepMode}
          readOnly={viewingHistory}
          learning={
            stepMode ? (
              <ObservationPanel
                trace={trace}
                previousTrace={previousTrace}
                snapshots={snapshots}
                selectedSnapshotId={selectedSnapshotId}
                displayed={displayed}
                previousDisplayed={previousDisplayed}
                onSelectSnapshot={(id) => {
                  cancel();
                  selectSnapshot(id);
                }}
                onLoadChange={setTraceTarget}
                traceVisible={traceVisible}
                onTraceVisibleChange={setTraceVisible}
              />
            ) : undefined
          }
          selected={selected}
          wire={selectedConnection}
          inputs={displayed.inputs}
          result={displayed.result}
          powered={displayed.powered}
          events={events.map(renderMessage)}
          onWireChange={(next) => {
            if (!editLocked) commit(wires.map((w) => (w.id === next.id ? next : w)));
          }}
          onRemoveWire={removeWire}
          onRouteWire={rerouteWire}
          onOperate={operate}
        />
      </div>
      <div className="app-bottom">
        <span>
          <span className="status-dot" /> {t('ui.footer.local')}
        </span>
        <span>
          {viewingHistory
            ? t('learning.historyReadonly')
            : powered
              ? t(activeCount === 1 ? 'ui.footer.coil' : 'ui.footer.coils', { count: activeCount })
              : t('ui.footer.ready')}
        </span>
        <span>
          WireBench 2D <span className="bottom-version">v{APP_VERSION}</span>
        </span>
      </div>
      <input
        type="file"
        ref={importInput}
        className="hidden"
        accept=".json,.wirebench.json,application/json"
        aria-label={t('ui.file.input')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <CircleHelp size={17} />
          <span>{renderMessage(notice)}</span>
          <button aria-label={t('ui.notice.close')} onClick={() => setNotice(null)}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Modal
          label={
            modal === 'new'
              ? t('ui.modal.new')
              : modal === 'help'
                ? t('ui.action.guide')
                : t('ui.sidebar.reference')
          }
          onClose={() => setModal(null)}
        >
          <section className={`modal ${modal === 'reference' ? 'reference-modal' : ''}`}>
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  WIREBENCH / {modal === 'reference' ? 'REFERENCE' : 'QUICK START'}
                </span>
                <h2>
                  {modal === 'new'
                    ? t('ui.modal.newHeading')
                    : modal === 'help'
                      ? t('ui.modal.guideHeading')
                      : t('ui.modal.referenceHeading')}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label={t('ui.modal.close')}
                onClick={() => setModal(null)}
              >
                <X size={19} />
              </button>
            </div>
            {modal === 'reference' ? (
              <LayoutReference />
            ) : modal === 'new' ? (
              <>
                <p>{t('ui.modal.newDescription')}</p>
                <div className="modal-actions">
                  <button className="button outline" onClick={() => setModal(null)}>
                    {t('ui.modal.cancel')}
                  </button>
                  <button
                    className="button primary"
                    onClick={() => {
                      const next: Wire[] = [];
                      commit(next);
                      resetSimulation(next);
                      setMode('wire');
                      cancel();
                      setSelectedWire(null);
                      setModal(null);
                      log(message('ui.log.new'));
                      setNotice(message('ui.log.new'));
                    }}
                  >
                    <Trash2 size={16} />
                    {t('ui.modal.new')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="help-steps">
                  <div>
                    <span>01</span>
                    <h3>{t('ui.guide.wireTitle')}</h3>
                    <p>{t('ui.guide.wireDescription')}</p>
                  </div>
                  <div>
                    <span>02</span>
                    <h3>{t('ui.action.powerOn')}</h3>
                    <p>{t('ui.guide.powerDescription')}</p>
                  </div>
                  <div>
                    <span>03</span>
                    <h3>{t('ui.guide.operateTitle')}</h3>
                    <p>{t('ui.guide.operateDescription')}</p>
                  </div>
                  <div>
                    <span>04</span>
                    <h3>{t('learning.mode')}</h3>
                    <p>{t('learning.guide')}</p>
                  </div>
                </div>
                <div className="help-callout">
                  <Lightbulb size={20} />
                  <div>
                    <strong>{t('ui.guide.suggestion')}</strong>
                    <p>{t('ui.guide.suggestionDescription')}</p>
                  </div>
                </div>
                <div className="help-shortcuts">
                  <span>
                    <kbd>{t('ui.guide.scroll')}</kbd>
                    {t('ui.guide.zoom')}
                  </span>
                  <span>
                    <kbd>{t('ui.guide.spaceDrag')}</kbd>
                    {t('ui.guide.pan')}
                  </span>
                  <span>
                    <kbd>⌘ / Ctrl Z</kbd>
                    {t('ui.guide.undo')}
                  </span>
                  <span>
                    <kbd>Delete</kbd>
                    {t('ui.guide.delete')}
                  </span>
                  <span>
                    <kbd>Esc</kbd>
                    {t('ui.guide.exitFullscreen')}
                  </span>
                </div>
                <p className="help-footnote">{t('ui.guide.boundaries')}</p>
                <div className="modal-actions">
                  <button className="button primary" onClick={() => setModal(null)}>
                    <Play size={14} />
                    {t('ui.guide.start')}
                  </button>
                </div>
              </>
            )}
          </section>
        </Modal>
      )}
    </div>
  );
}
