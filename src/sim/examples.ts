import type { Wire } from './model';

export interface Example {
  id: string;
  name: string;
  description: string;
  wires: Wire[];
}

const RED = '#e35a64';
const BLUE = '#4a85db';
const YELLOW = '#dba536';

function wires(prefix: string, connections: [string, string][]): Wire[] {
  return connections.map(([from, to], index) => ({
    id: `${prefix}-${index + 1}`,
    from,
    to,
    color: from === 'POWER:N' || to === 'POWER:N' ? BLUE : from === 'POWER:L' ? RED : YELLOW,
  }));
}

export const EXAMPLES: Example[] = [
  {
    id: 'button-lamp',
    name: '按钮点灯',
    description: '接通电源，按住 SB2，绿色灯 HL2 点亮；松开即熄灭。灯由 SB2 的常开触点直接控制。',
    wires: wires('lamp', [
      ['POWER:L', 'SB2:NO3'],
      ['SB2:NO4', 'HL2:1'],
      ['HL2:2', 'POWER:N'],
    ]),
  },
  {
    id: 'contactor-jog',
    name: '接触器点动',
    description: '按住 SB2，KM1 吸合，13–14 触点使 HL2 点亮；松开后线圈释放，灯熄灭。',
    wires: wires('jog', [
      ['POWER:L', 'SB2:NO3'],
      ['SB2:NO4', 'KM1:A1'],
      ['KM1:A2', 'POWER:N'],
      ['POWER:L', 'KM1:13'],
      ['KM1:14', 'HL2:1'],
      ['HL2:2', 'POWER:N'],
    ]),
  },
  {
    id: 'self-hold',
    name: '自锁启停',
    description:
      'SB2 启动，KM1 自锁，HL2 运行灯亮；SB1、急停或 FR1 测试切断线圈回路。HL1 显示待机，HL3 显示 FR1 跳闸。',
    wires: wires('hold', [
      ['POWER:L', 'ESTOP:NC1'],
      ['ESTOP:NC2', 'SB1:NC1'],
      ['SB1:NC2', 'FR1:95'],
      ['FR1:96', 'SB2:NO3'],
      ['SB2:NO4', 'KM1:A1'],
      ['KM1:A2', 'POWER:N'],
      ['FR1:96', 'KM1:13'],
      ['KM1:14', 'KM1:A1'],
      ['POWER:L', 'KM1:53'],
      ['KM1:54', 'HL2:1'],
      ['HL2:2', 'POWER:N'],
      ['POWER:L', 'KM1:61'],
      ['KM1:62', 'HL1:1'],
      ['HL1:2', 'POWER:N'],
      ['POWER:L', 'FR1:97'],
      ['FR1:98', 'HL3:1'],
      ['HL3:2', 'POWER:N'],
    ]),
  },
];
