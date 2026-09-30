/** One wire joins two exposed terminal-strip sockets. Fixed leads are implicit. */
export interface Wire {
  id: string;
  from: string;
  to: string;
  color: string;
  points?: { x: number; y: number }[];
}

export interface Device {
  id: string;
  name: string;
  kind: 'contactor' | 'thermal' | 'button' | 'limit' | 'estop' | 'lamp' | 'motor' | 'supply';
  /** Local labels only. A complete terminal ID is `${device.id}:${label}`. */
  terminals: string[];
}

export const CONTACTOR_TERMINALS = [
  'A1',
  'L1',
  'L2',
  'L3',
  '13',
  '53',
  '61',
  '71',
  '83',
  'A2',
  'T1',
  'T2',
  'T3',
  '14',
  '54',
  '62',
  '72',
  '84',
];

export const DEVICES: Device[] = [
  ...[1, 2, 3].map((n): Device => ({
    id: `KM${n}`,
    name: `交流接触器 ${n}`,
    kind: 'contactor',
    terminals: [...CONTACTOR_TERMINALS],
  })),
  ...[1, 2].map((n): Device => ({
    id: `FR${n}`,
    name: `热继电器 ${n}`,
    kind: 'thermal',
    terminals: ['L1', 'L2', 'L3', 'T1', 'T2', 'T3', '97', '98', '95', '96'],
  })),
  ...[1, 2].map((n): Device => ({
    id: `SQ${n}`,
    name: `行程开关 ${n}`,
    kind: 'limit',
    terminals: ['NC1', 'NC2', 'NO3', 'NO4'],
  })),
  ...[1, 2, 3].map((n): Device => ({
    id: `SB${n}`,
    name: `控制按钮 ${n}`,
    kind: 'button',
    terminals: ['NC1', 'NC2', 'NO3', 'NO4'],
  })),
  { id: 'ESTOP', name: '急停按钮', kind: 'estop', terminals: ['NC1', 'NC2'] },
  ...[1, 2, 3].map((n): Device => ({
    id: `HL${n}`,
    name: ['黄色指示灯', '绿色指示灯', '红色指示灯'][n - 1],
    kind: 'lamp',
    terminals: ['1', '2'],
  })),
  {
    id: 'MOTOR',
    name: '电机接线区 · 预留',
    kind: 'motor',
    terminals: ['U1', 'V1', 'W1', 'U2', 'V2', 'W2'],
  },
  { id: 'POWER', name: '教学控制电源', kind: 'supply', terminals: ['U2', 'V2', 'W2', 'L', 'N'] },
];

export const DEVICE_MAP: Record<string, Device> = Object.fromEntries(
  DEVICES.map((device) => [device.id, device]),
);
export const TERMINAL_IDS: string[] = DEVICES.flatMap((device) =>
  device.terminals.map((label) => `${device.id}:${label}`),
);

export interface Contact {
  id: string;
  deviceId: string;
  from: string;
  to: string;
  behavior: 'NO' | 'NC' | 'through';
}

function contacts(deviceId: string, behavior: Contact['behavior'], pairs: string[][]): Contact[] {
  return pairs.map(([a, b]) => ({
    id: `${deviceId}:${a}-${b}`,
    deviceId,
    from: `${deviceId}:${a}`,
    to: `${deviceId}:${b}`,
    behavior,
  }));
}

/** The auxiliary block moves with its KM; it is not a separate relay. */
export const CONTACTS: Contact[] = DEVICES.flatMap((device) => {
  if (device.kind === 'contactor') {
    return [
      ...contacts(device.id, 'NO', [
        ['L1', 'T1'],
        ['L2', 'T2'],
        ['L3', 'T3'],
        ['13', '14'],
        ['53', '54'],
        ['83', '84'],
      ]),
      ...contacts(device.id, 'NC', [
        ['61', '62'],
        ['71', '72'],
      ]),
    ];
  }
  if (device.kind === 'thermal') {
    return [
      // A thermal relay does not physically open these power paths when tripped.
      ...contacts(device.id, 'through', [
        ['L1', 'T1'],
        ['L2', 'T2'],
        ['L3', 'T3'],
      ]),
      ...contacts(device.id, 'NC', [['95', '96']]),
      ...contacts(device.id, 'NO', [['97', '98']]),
    ];
  }
  if (device.kind === 'button' || device.kind === 'limit') {
    return [
      ...contacts(device.id, 'NC', [['NC1', 'NC2']]),
      ...contacts(device.id, 'NO', [['NO3', 'NO4']]),
    ];
  }
  return device.kind === 'estop' ? contacts(device.id, 'NC', [['NC1', 'NC2']]) : [];
});

export interface Load {
  deviceId: string;
  kind: 'coil' | 'lamp';
  from: string;
  to: string;
}

export const LOADS: Load[] = DEVICES.flatMap((device): Load[] => {
  if (device.kind === 'contactor')
    return [{ deviceId: device.id, kind: 'coil', from: `${device.id}:A1`, to: `${device.id}:A2` }];
  if (device.kind === 'lamp')
    return [{ deviceId: device.id, kind: 'lamp', from: `${device.id}:1`, to: `${device.id}:2` }];
  return [];
});

export const UNSUPPORTED_TERMINALS = new Set([
  'POWER:U2',
  'POWER:V2',
  'POWER:W2',
  ...DEVICE_MAP.MOTOR.terminals.map((label) => `MOTOR:${label}`),
]);
