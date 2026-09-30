export const zh = {
  'message.fault.short':
    '控制电源 L 与 N 被导线或闭合触点直接接通，发生短路。请断电检查标出的线路。',
  'message.fault.series':
    '{devices} 构成负载串联或分压网络；首版只计算独立跨接控制电源的负载，请改用并联支路。',
  'message.fault.unknown-terminal':
    '接线文件包含无法识别的端子，不能进行仿真。请检查或删除标出的线路。',
  'message.fault.reserved':
    '三相电源与电机端子为预留区域，首版暂不计算这类接法。控制实验请使用 POWER:L / POWER:N。',
  'message.fault.unstable':
    '{devices} 出现反复吸合与释放，回路无法稳定。请检查线圈与自身常闭触点或互相控制的接法。',
  'message.project.invalid-object': '{subject}格式不正确。',
  'message.project.unsupported-field': '{subject}包含不支持的字段。',
  'message.project.invalid-string': '{subject}必须是 1～{max} 个字符的有效文字。',
  'message.project.format': '这不是 WireBench-2D 接线文件。',
  'message.project.version': '不支持此接线文件版本，当前支持版本 1。',
  'message.project.wires': '接线文件缺少有效的导线列表。',
  'message.project.wire-limit': '一个方案最多包含 {max} 根导线。',
  'message.project.duplicate-id': '{subject}的编号重复。',
  'message.project.unknown-terminal': '{subject}包含未知端子。',
  'message.project.same-terminal': '{subject}不能连接同一个端子。',
  'message.project.duplicate-wire': '{subject}与已有导线重复连接同一对端子。',
  'message.project.color': '{subject}的颜色必须采用 #RGB 或 #RRGGBB 格式。',
  'message.project.points': '{subject}的路径必须是最多 {max} 个拐点的列表。',
  'message.project.coordinates': '{subject}的拐点坐标必须是 {min}～{max} 范围内的有限数值。',
  'message.project.text-size': '接线文件不能超过 {max} MB。',
  'message.project.text': '接线文件内容必须是文本。',
  'message.project.json': '接线文件不是有效的 JSON，请选择导出的接线文件。',
  'message.subject.file': '接线文件',
  'message.subject.name': '方案名称',
  'message.subject.wire': '第 {index} 根导线',
  'message.subject.wire-id': '{wire}的编号',
  'message.subject.point': '{wire}的拐点',
  'message.storage.quota': '浏览器本地存储空间不足',
  'message.storage.security': '浏览器禁止访问本地存储',
  'message.storage.unknown-reason': '浏览器未提供具体错误原因',
  'message.storage.raw-reason': '{text}',
  'message.storage.read-failed':
    '本地存档无法读取：{reason}。当前方案尚未保存，请使用「导出方案」保存文件。',
  'message.storage.protected':
    '本地存档无法载入：{reason} 原始存档已保留，浏览器保存已暂停以免覆盖。当前操作请使用「导出方案」保存。',
  'message.storage.invalid': '方案尚未保存：{reason}',
  'message.storage.unavailable': '浏览器保存不可用：{reason}。请使用「导出方案」保存文件。',
  'message.storage.write-failed': '方案尚未保存：{reason}。请使用「导出方案」保存文件。',
  'message.error.unknown': '操作失败，未提供具体错误原因。',
} as const;
