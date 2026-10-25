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
const STAR_LINK = '#858b8d';
/** Three-phase main conductors keep the usual brown/black/grey phase colours. */
const PHASE_COLORS: Record<string, string> = {
  'POWER:U2': '#a1583f',
  'POWER:V2': '#4d5457',
  'POWER:W2': '#8a7a3f',
};

function wireColor(from: string, to: string): string {
  if (from === 'POWER:N' || to === 'POWER:N') return BLUE;
  if (from === 'POWER:L' || to === 'POWER:L') return RED;
  return PHASE_COLORS[from] ?? PHASE_COLORS[to] ?? YELLOW;
}

/**
 * A connection may name its own colour. Three-phase main conductors need this
 * after a contactor: the outgoing wire no longer touches a supply terminal, yet
 * a learner must still see which phase left T1.
 */
function wires(prefix: string, connections: [string, string, string?][]): Wire[] {
  return connections.map(([from, to, color], index) => ({
    id: `${prefix}-${index + 1}`,
    from,
    to,
    color: color ?? wireColor(from, to),
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
  {
    id: 'motor-self-hold',
    name: '接触器自锁 + 电机',
    description:
      'SB2 启动，KM1 自锁，三相主回路经 KM1 主触点给电机供电，模型显示满足三相运转条件；SB1 断开控制回路，KM1 释放，模型撤销运转状态。U2/V2/W2 已短接成星点，即 Y 接法；改成 Δ 可自行拆掉星点并交叉连线。',
    wires: wires('motor', [
      // Control circuit: stop, start, self-holding contact, coil return.
      ['POWER:L', 'SB1:NC1'],
      ['SB1:NC2', 'SB2:NO3'],
      ['SB2:NO4', 'KM1:A1'],
      ['SB2:NO3', 'KM1:13'],
      ['KM1:14', 'KM1:A1'],
      ['KM1:A2', 'POWER:N'],
      // Main circuit: three phases through the contactor into the windings. The
      // outgoing conductors keep their phase colour so U/V/W stay traceable.
      ['POWER:U2', 'KM1:L1', PHASE_COLORS['POWER:U2']],
      ['KM1:T1', 'MOTOR:U1', PHASE_COLORS['POWER:U2']],
      ['POWER:V2', 'KM1:L2', PHASE_COLORS['POWER:V2']],
      ['KM1:T2', 'MOTOR:V1', PHASE_COLORS['POWER:V2']],
      ['POWER:W2', 'KM1:L3', PHASE_COLORS['POWER:W2']],
      ['KM1:T3', 'MOTOR:W1', PHASE_COLORS['POWER:W2']],
      // Y connection: the user wires the star point on the terminal box.
      ['MOTOR:U2', 'MOTOR:V2', STAR_LINK],
      ['MOTOR:V2', 'MOTOR:W2', STAR_LINK],
    ]),
  },
];
