import type { zh } from './learning.zh';

export const en = {
  'learning.guide':
    'Enable Step observation, then click a button to press and click again to release. Choose a coil or lamp in the inspector to trace its circuit and compare changes. Return to the live run before operating after reviewing history.',
  'learning.mode': 'Step observation',
  'learning.modeHint': 'Click to observe press and release separately.',
  'learning.focusHint':
    'Leaving the window or hiding the page releases momentary buttons and records a separate step.',
  'learning.press': 'Press {id}',
  'learning.release': 'Release {id}',
  'learning.stepButtonPress': 'Click to press',
  'learning.stepButtonRelease': 'Click to release',
  'learning.historyReadonly': 'History snapshot · read only',
  'learning.backToLive': 'Return to current run',
  'learning.inspect': 'Observe & explain',
  'learning.traceTarget': 'Observing {id}',
  'learning.live': 'Current run',
  'learning.previous': 'Previous step',
  'learning.next': 'Next step',
  'learning.snapshot': 'Choose an action snapshot',
  'learning.snapshotOption': 'Step {step} · {action}',
  'learning.historyHint':
    'Reviewing does not restore or change the running state. Return to the current run to operate.',
  'learning.historyLimit':
    'Keeps up to {count} recent actions. Wiring changes or reset begin a new record.',
  'learning.initial': 'Observation started',
  'learning.wiringChange': 'Wiring updated · new record',
  'learning.reset': 'Reset · new record',
  'learning.powerOn': 'Power on',
  'learning.powerOff': 'Power off',
  'learning.inputOn': 'Actuate {id}',
  'learning.inputOff': 'Reset {id}',
  'learning.thermalOn': '{id} test trip',
  'learning.thermalOff': '{id} reset',
  'learning.releaseBlur': 'Window lost focus · buttons released',
  'learning.releaseHidden': 'Page hidden · buttons released',
  'learning.releaseMode': 'Operation mode changed · buttons released',
  'learning.load': 'Observe load',
  'learning.coil': 'coil',
  'learning.motor': 'motor',
  'learning.lamp': 'indicator lamp',
  'learning.showTrace': 'Show supply paths',
  'learning.status.energized': 'Energized: a complete supply path is connected',
  'learning.status.energized-not-running':
    'All three windings have a modeled supply path, but the three-phase run criteria are not met',
  'learning.status.unpowered': 'Power is off',
  'learning.status.fault': 'Stopped by fault · no supply trace',
  'learning.status.unconnected': 'No complete supply path',
  'learning.status.partial':
    'Only some windings have modeled supply paths; the three-phase run criteria are not met',
  'learning.status.same-rail': 'Both ends connect to the same rail',
  'learning.floating': 'Not on a supply rail',
  'learning.starPoint': 'Star point (shared winding node)',
  'learning.windingStatus': 'Winding supply checks',
  'learning.windingSupplied': 'Modeled supply path found',
  'learning.windingNotSupplied': 'No modeled supply path found',
  'learning.motorProblem.missing-phase':
    'A phase is missing, or a winding has no complete supply path.',
  'learning.motorProblem.same-phase':
    'The windings connect only to one phase; no phase-to-phase supply relation is formed.',
  'learning.motorProblem.open-winding':
    'The winding terminals do not form a recognized Y or delta connection.',
  'learning.motorProblem.no-pattern':
    'The winding-terminal topology does not match a supported Y or delta connection.',
  'learning.motorProblem.undefined-supply':
    'The winding is connected between supply rails with an undefined relationship, so its supply state cannot be determined.',
  'learning.motorProblem.undefined-star-rail':
    'The supply relationship for the rail connected to the star point is undefined.',
  'learning.unpoweredHint': 'Turn on the power to inspect the supply connections in this wiring.',
  'learning.unconnectedHint':
    'At least one end is not connected to a supply rail, or a complete circuit is not formed. Check the wiring and contact states.',
  'learning.partialHint':
    'The model indicates a run condition when all three windings have supply paths and phases U, V and W are present. It does not model whether a real motor keeps turning during phase loss, nor speed, torque or thermal protection. The star point may be on either side of the windings. Windings with modeled supply paths are highlighted below; check a missing phase, the KM main contacts, or the star-point wiring.',
  'learning.sameRailHint':
    'The load needs its two ends on different supply rails. Two ends on the same rail do not energize it.',
  'learning.faultHint':
    'Devices show the model state after a fault stop. Fault markers preserve evidence from when the fault occurred; they are not the present supply paths.',
  'learning.traceHint':
    'Highlights this load’s supply and return paths, including conductive parallel branches. This is not measured current or a unique route.',
  'learning.traceCount': '{wires} wires · {contacts} closed contacts',
  'learning.pathContacts': 'Closed contacts in these paths',
  'learning.directWires': 'These paths use direct wire connections without contacts.',
  'learning.changes': 'Compared with the previous step',
  'learning.noChanges': 'No device state changed.',
  'learning.inputState': '{id}: {state}',
  'learning.active': 'actuated',
  'learning.rest': 'reset',
  'learning.coilOn': '{id} coil energized',
  'learning.coilOff': '{id} coil de-energized',
  'learning.lampOn': '{id} lit',
  'learning.lampOff': '{id} went out',
  'learning.motorOn': '{id} meets the three-phase run criteria',
  'learning.motorOff': '{id} no longer meets the three-phase run criteria',
  'learning.closed': 'Closed: {contacts}',
  'learning.opened': 'Opened: {contacts}',
  'learning.faultChanged': 'The fault state changed.',
  'learning.keptOn':
    '{id} was energized before and after this step. The paths below show the supply-rail connections that remain after the action.',
  'learning.pathChanges': 'Supply path changes',
  'learning.wiresAdded': 'Wires entering the paths ({count})',
  'learning.wiresRemoved': 'Wires leaving the paths ({count})',
  'learning.contactsAdded': 'Contacts entering the paths: {contacts}',
  'learning.contactsRemoved': 'Contacts leaving the paths: {contacts}',
  'learning.pathUnchanged': 'This load’s supply paths did not change.',
  'learning.stableStepHint':
    'Each step shows the stable result of one action, not physical operating times or the order in which contacts move.',
} satisfies Record<keyof typeof zh, string>;
