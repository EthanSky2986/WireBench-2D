import { useId } from 'react';
import { ChevronLeft, ChevronRight, ScanLine } from 'lucide-react';
import { useI18n, type Translate } from '../i18n';
import { localizeFault } from '../i18n/messages';
import { DEVICE_MAP, LOADS, type Wire } from '../sim/model';
import type { LoadTrace } from '../sim/loadTrace';
import {
  diffSimulationStates,
  OBSERVATION_HISTORY_LIMIT,
  type ObservationAction,
  type ObservationSnapshot,
} from '../sim/observationState';
import type { SimulationState } from '../sim/simulationState';
import '../observation.css';

export interface ObservationPanelProps {
  trace: LoadTrace;
  previousTrace: LoadTrace | null;
  snapshots: ObservationSnapshot[];
  selectedSnapshotId: number | null;
  displayed: SimulationState;
  previousDisplayed: SimulationState | null;
  onSelectSnapshot: (id: number | null) => void;
  onLoadChange: (id: string) => void;
  traceVisible: boolean;
  onTraceVisibleChange: (visible: boolean) => void;
}

/** Keep action identity separate from its translation and from device effects. */
export function formatObservationAction(action: ObservationAction, t: Translate): string {
  switch (action.type) {
    case 'initial':
      return t('learning.initial');
    case 'wiring-change':
      return t('learning.wiringChange');
    case 'reset':
      return t('learning.reset');
    case 'power':
      return t(action.powered ? 'learning.powerOn' : 'learning.powerOff');
    case 'release-momentary':
      return t(
        action.reason === 'blur'
          ? 'learning.releaseBlur'
          : action.reason === 'hidden'
            ? 'learning.releaseHidden'
            : 'learning.releaseMode',
      );
    case 'input': {
      const kind = DEVICE_MAP[action.deviceId]?.kind;
      const key =
        kind === 'button'
          ? action.active
            ? 'learning.press'
            : 'learning.release'
          : kind === 'thermal'
            ? action.active
              ? 'learning.thermalOn'
              : 'learning.thermalOff'
            : action.active
              ? 'learning.inputOn'
              : 'learning.inputOff';
      return t(key, { id: action.deviceId });
    }
  }
}

function addedIds(current: string[], previous: string[]): string[] {
  const before = new Set(previous);
  return current.filter((id) => !before.has(id));
}

function WireChanges({ ids, wires, label }: { ids: string[]; wires: Wire[]; label: string }) {
  if (ids.length === 0) return null;
  const changed = new Set(ids);
  return (
    <details className="observation-wire-changes">
      <summary>{label}</summary>
      <ul>
        {wires
          .filter((wire) => changed.has(wire.id))
          .map((wire) => (
            <li key={wire.id}>
              <code>
                {wire.from} ↔ {wire.to}
              </code>
            </li>
          ))}
      </ul>
    </details>
  );
}

/** Read-only evidence for one selected load; actions remain owned by App. */
export default function ObservationPanel({
  trace,
  previousTrace,
  snapshots,
  selectedSnapshotId,
  displayed,
  previousDisplayed,
  onSelectSnapshot,
  onLoadChange,
  traceVisible,
  onTraceVisibleChange,
}: ObservationPanelProps) {
  const { t, locale } = useI18n();
  const fieldId = useId();
  const selectedIndex =
    selectedSnapshotId === null
      ? snapshots.length - 1
      : snapshots.findIndex((snapshot) => snapshot.id === selectedSnapshotId);
  const snapshot = snapshots[selectedIndex];
  const readonly = selectedSnapshotId !== null;
  const difference = diffSimulationStates(previousDisplayed, displayed);
  const changes = [
    ...(difference.powerChanged
      ? [t(displayed.powered ? 'learning.powerOn' : 'learning.powerOff')]
      : []),
    ...difference.inputs.map((change) =>
      formatObservationAction({ type: 'input', deviceId: change.id, active: change.to }, t),
    ),
    ...difference.coils.map((change) =>
      t(change.to ? 'learning.coilOn' : 'learning.coilOff', { id: change.id }),
    ),
    ...difference.lamps.map((change) =>
      t(change.to ? 'learning.lampOn' : 'learning.lampOff', { id: change.id }),
    ),
    ...(difference.closedContacts.length
      ? [t('learning.closed', { contacts: difference.closedContacts.join(', ') })]
      : []),
    ...(difference.openedContacts.length
      ? [t('learning.opened', { contacts: difference.openedContacts.join(', ') })]
      : []),
    ...(difference.faultChanged ? [t('learning.faultChanged')] : []),
  ];
  const comparableTrace = previousTrace?.loadId === trace.loadId ? previousTrace : null;
  const wiresAdded = comparableTrace ? addedIds(trace.wireIds, comparableTrace.wireIds) : [];
  const wiresRemoved = comparableTrace ? addedIds(comparableTrace.wireIds, trace.wireIds) : [];
  const contactsAdded = comparableTrace
    ? addedIds(trace.contactIds, comparableTrace.contactIds)
    : [];
  const contactsRemoved = comparableTrace
    ? addedIds(comparableTrace.contactIds, trace.contactIds)
    : [];
  const traceChanged =
    wiresAdded.length + wiresRemoved.length + contactsAdded.length + contactsRemoved.length > 0;
  const keptOn = trace.status === 'energized' && comparableTrace?.status === 'energized';

  return (
    <section className="observation-panel" aria-label={t('learning.inspect')}>
      <div className="observation-heading">
        <ScanLine size={16} aria-hidden="true" />
        <h2>{t('learning.inspect')}</h2>
      </div>
      <div className={`observation-context ${readonly ? 'is-history' : ''}`}>
        <strong>{t(readonly ? 'learning.historyReadonly' : 'learning.live')}</strong>
        {readonly && (
          <button type="button" onClick={() => onSelectSnapshot(null)}>
            {t('learning.backToLive')}
          </button>
        )}
      </div>
      <div className="observation-navigation">
        <button
          type="button"
          className="icon-button"
          disabled={selectedIndex <= 0}
          aria-label={t('learning.previous')}
          onClick={() => onSelectSnapshot(snapshots[selectedIndex - 1].id)}
        >
          <ChevronLeft size={17} />
        </button>
        <select
          aria-label={t('learning.snapshot')}
          value={snapshot?.id ?? ''}
          onChange={(event) => onSelectSnapshot(Number(event.target.value))}
        >
          {snapshots.map((entry) => (
            <option value={entry.id} key={entry.id}>
              {t('learning.snapshotOption', {
                step: entry.step,
                action: formatObservationAction(entry.action, t),
              })}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-button"
          disabled={selectedIndex >= snapshots.length - 1}
          aria-label={t('learning.next')}
          onClick={() => onSelectSnapshot(snapshots[selectedIndex + 1].id)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
      {snapshot && (
        <p className="observation-action">{formatObservationAction(snapshot.action, t)}</p>
      )}
      {readonly && <p className="observation-hint">{t('learning.historyHint')}</p>}
      <div className="observation-load-picker">
        <label htmlFor={`${fieldId}-load`}>{t('learning.load')}</label>
        <select
          id={`${fieldId}-load`}
          value={trace.loadId}
          onChange={(event) => onLoadChange(event.target.value)}
        >
          {LOADS.map((load) => (
            <option key={load.deviceId} value={load.deviceId}>
              {load.deviceId} · {t(load.kind === 'coil' ? 'learning.coil' : 'learning.lamp')}
            </option>
          ))}
        </select>
      </div>
      <label className="observation-trace-toggle">
        <input
          type="checkbox"
          checked={traceVisible}
          onChange={(event) => onTraceVisibleChange(event.target.checked)}
        />
        {t('learning.showTrace')}
      </label>
      <div className={`observation-result is-${trace.status}`}>
        <strong aria-live="polite">{t(`learning.status.${trace.status}`)}</strong>
        {trace.status !== 'fault' && (
          <div className="observation-ends">
            {trace.ends.map((end) => (
              <div key={end.terminalId}>
                <code>{end.terminalId}</code>
                <span>{end.potential === 'floating' ? t('learning.floating') : end.potential}</span>
              </div>
            ))}
          </div>
        )}
        {trace.status === 'energized' ? (
          <>
            <p>
              {t('learning.traceCount', {
                wires: trace.wireIds.length,
                contacts: trace.contactIds.length,
              })}
            </p>
            {keptOn && <p>{t('learning.keptOn', { id: trace.loadId })}</p>}
          </>
        ) : (
          <p>
            {t(
              trace.status === 'unpowered'
                ? 'learning.unpoweredHint'
                : trace.status === 'fault'
                  ? 'learning.faultHint'
                  : trace.status === 'same-rail'
                    ? 'learning.sameRailHint'
                    : 'learning.unconnectedHint',
            )}
          </p>
        )}
        {displayed.result.fault && <p>{localizeFault(displayed.result.fault, locale)}</p>}
      </div>
      {trace.status === 'energized' && (
        <div className="observation-path">
          <h3>{t('learning.pathContacts')}</h3>
          {trace.contactIds.length ? (
            <ul className="observation-contact-list">
              {trace.contactIds.map((id) => (
                <li key={id}>
                  <code>{id}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="observation-hint">{t('learning.directWires')}</p>
          )}
          <p className="observation-hint">{t('learning.traceHint')}</p>
        </div>
      )}
      {previousDisplayed && (
        <details className="observation-differences" open>
          <summary>{t('learning.changes')}</summary>
          {changes.length ? (
            <ul>
              {changes.map((change, index) => (
                <li key={index}>{change}</li>
              ))}
            </ul>
          ) : (
            <p className="observation-hint">{t('learning.noChanges')}</p>
          )}
          {comparableTrace && trace.status !== 'fault' && comparableTrace.status !== 'fault' && (
            <div className="observation-path-difference">
              <h3>{t('learning.pathChanges')}</h3>
              <WireChanges
                ids={wiresAdded}
                wires={displayed.wires}
                label={t('learning.wiresAdded', { count: wiresAdded.length })}
              />
              <WireChanges
                ids={wiresRemoved}
                wires={previousDisplayed.wires}
                label={t('learning.wiresRemoved', { count: wiresRemoved.length })}
              />
              {contactsAdded.length > 0 && (
                <p>{t('learning.contactsAdded', { contacts: contactsAdded.join(', ') })}</p>
              )}
              {contactsRemoved.length > 0 && (
                <p>{t('learning.contactsRemoved', { contacts: contactsRemoved.join(', ') })}</p>
              )}
              {!traceChanged && <p className="observation-hint">{t('learning.pathUnchanged')}</p>}
            </div>
          )}
        </details>
      )}
      <p className="observation-hint">{t('learning.focusHint')}</p>
      <p className="observation-hint">
        {t('learning.historyLimit', { count: OBSERVATION_HISTORY_LIMIT })}{' '}
        {t('learning.stableStepHint')}
      </p>
    </section>
  );
}
