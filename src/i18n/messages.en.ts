import type { zh } from './messages.zh';

export const en = {
  'message.fault.short':
    'Control supply L and N are directly connected through wires or closed contacts, causing a short circuit. Switch off the power and inspect the highlighted wires.',
  'message.fault.series':
    '{devices} form a series-load or voltage-divider circuit. This version supports loads connected independently across the control supply. Use parallel branches instead.',
  'message.fault.unknown-terminal':
    'The wiring file contains unrecognized terminals and cannot be simulated. Check or remove the highlighted wires.',
  'message.fault.reserved':
    'The three-phase supply and motor terminals are reserved and are not simulated in this version. Use POWER:L / POWER:N for control experiments.',
  'message.fault.unstable':
    '{devices} repeatedly energize and release, so the circuit cannot settle. Check coils controlled by their own NC contacts or by each other.',
  'message.project.invalid-object': '{subject} has an invalid structure.',
  'message.project.unsupported-field': '{subject} contains unsupported fields.',
  'message.project.invalid-string':
    '{subject} must contain between 1 and {max} valid text characters.',
  'message.project.format': 'This is not a WireBench-2D wiring file.',
  'message.project.version':
    'This wiring file version is not supported. The currently supported version is 1.',
  'message.project.wires': 'The wiring file is missing a valid wire list.',
  'message.project.wire-limit': 'A project can contain at most {max} wires.',
  'message.project.duplicate-id': '{subject} has a duplicate ID.',
  'message.project.unknown-terminal': '{subject} contains an unknown terminal.',
  'message.project.same-terminal': '{subject} cannot connect a terminal to itself.',
  'message.project.duplicate-wire':
    '{subject} connects the same pair of terminals as an existing wire.',
  'message.project.color': '{subject} must use a color in #RGB or #RRGGBB format.',
  'message.project.points': '{subject} must have a route containing at most {max} bend points.',
  'message.project.coordinates':
    '{subject} must have finite bend-point coordinates between {min} and {max}.',
  'message.project.text-size': 'The wiring file must not exceed {max} MB.',
  'message.project.text': 'The wiring file content must be text.',
  'message.project.json':
    'The wiring file is not valid JSON. Select a previously exported wiring file.',
  'message.subject.file': 'The wiring file',
  'message.subject.name': 'The project name',
  'message.subject.wire': 'Wire {index}',
  'message.subject.wire-id': 'The ID of {wire}',
  'message.subject.point': 'A bend point of {wire}',
  'message.storage.quota': 'The browser has insufficient local storage space',
  'message.storage.security': 'The browser has blocked access to local storage',
  'message.storage.unknown-reason': 'The browser did not provide a specific error reason',
  'message.storage.raw-reason': '{text}',
  'message.storage.read-failed':
    'The local project could not be read: {reason}. The current project is not saved. Use Export project to save a file.',
  'message.storage.protected':
    'The local project could not be loaded: {reason} The original data has been preserved, and browser saving is paused to prevent overwriting it. Use Export project to save your current work.',
  'message.storage.invalid': 'The project has not been saved: {reason}',
  'message.storage.unavailable':
    'Browser saving is unavailable: {reason}. Use Export project to save a file.',
  'message.storage.write-failed':
    'The project has not been saved: {reason}. Use Export project to save a file.',
  'message.error.unknown': 'The operation failed without a specific error reason.',
} satisfies Record<keyof typeof zh, string>;
