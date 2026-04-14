#!/usr/bin/env node

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

interface PlanningRow {
  网络类型: string;
  服务区类型: string;
  起始服务区: string;
  终止服务区: string;
  原UPF服务区: string;
  新UPF服务区: string;
}

interface CommandResult {
  commands: string[];
  summary: {
    addUpareaCount: number;
    addBindCount: number;
    removeBindCount: number;
  };
}

// 网络类型到 AREATYPE 的映射
const NETWORK_TO_AREATYPE: Record<string, string> = {
  '2/3G': 'LAI',
  '4G': 'S1TAI',
  '5G': 'N2TAI'
};

// 网络类型和服务区类型到绑定命令的映射
const BIND_COMMAND_MAP: Record<string, Record<string, string>> = {
  '2/3G': {
    'LAI': 'UPAREABINDLAI',
    'default': 'UPAREABINDLAI'
  },
  '4G': {
    'TAI': 'UPAREABINDS1TAI',
    'default': 'UPAREABINDS1TAI'
  },
  '5G': {
    'TAI': 'UPAREABINDN2TAI',
    'N2TAI': 'UPAREABINDN2TAI',
    'default': 'UPAREABINDN2TAI'
  }
};

// 绑定命令的参数名映射
const BIND_PARAM_MAP: Record<string, { begin: string; end: string }> = {
  'UPAREABINDLAI': { begin: 'BEGINLAI', end: 'ENDLAI' },
  'UPAREABINDS1TAI': { begin: 'S1BEGINTAI', end: 'S1ENDTAI' },
  'UPAREABINDN2TAI': { begin: 'N2BEGINTAI', end: 'N2ENDTAI' }
};

function inferServiceType(networkType: string, serviceType: string): string {
  if (serviceType && serviceType.trim()) {
    return serviceType.trim();
  }
  
  // 根据网络类型推断
  switch (networkType) {
    case '2/3G':
      return 'LAI';
    case '4G':
      return 'TAI';
    case '5G':
      return 'N2TAI';
    default:
      return serviceType || '';
  }
}

function parsePlanningData(csvData: string): PlanningRow[] {
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as PlanningRow[];
  
  return records.map(row => ({
    网络类型: row.网络类型?.trim() || '',
    服务区类型: inferServiceType(row.网络类型?.trim() || '', row.服务区类型?.trim() || ''),
    起始服务区: row.起始服务区?.trim() || '',
    终止服务区: row.终止服务区?.trim() || '',
    原UPF服务区: row.原UPF服务区?.trim() || '',
    新UPF服务区: row.新UPF服务区?.trim() || ''
  }));
}

function getBindCommand(networkType: string, serviceType: string): string {
  const networkMap = BIND_COMMAND_MAP[networkType];
  if (!networkMap) {
    throw new Error(`不支持的网络类型: ${networkType}`);
  }
  
  return networkMap[serviceType] || networkMap.default;
}

function generateCommands(
  planningRows: PlanningRow[],
  existingAreas: string[]
): CommandResult {
  const commands: string[] = [];
  const processedAreas = new Set<string>();
  const addUpareaSet = new Set<string>();
  
  // 统计信息
  let addUpareaCount = 0;
  let addBindCount = 0;
  let removeBindCount = 0;
  
  // 第一步：生成 ADD UPAREA 命令
  for (const row of planningRows) {
    const newArea = row.新UPF服务区;
    if (!newArea) continue;
    
    const networkType = row.网络类型;
    const areaType = NETWORK_TO_AREATYPE[networkType];
    
    if (!areaType) {
      console.warn(`警告: 未知的网络类型 ${networkType}, 跳过生成 ADD UPAREA 命令`);
      continue;
    }
    
    const areaKey = `${newArea}:${areaType}`;
    
    // 检查是否已存在
    const exists = existingAreas.includes(newArea);
    
    if (!exists && !addUpareaSet.has(areaKey)) {
      commands.push(`ADD UPAREA:AREANAME="${newArea}",AREATYPE=${areaType};`);
      addUpareaSet.add(areaKey);
      addUpareaCount++;
    }
  }
  
  // 第二步：生成 RMV 和 ADD 绑定命令
  for (const row of planningRows) {
    const networkType = row.网络类型;
    const serviceType = row.服务区类型;
    const startArea = row.起始服务区;
    const endArea = row.终止服务区;
    const oldArea = row.原UPF服务区;
    const newArea = row.新UPF服务区;
    
    if (!startArea || !endArea) {
      console.warn(`警告: 行 ${JSON.stringify(row)} 缺少起始/终止服务区, 跳过绑定命令生成`);
      continue;
    }
    
    const bindCommand = getBindCommand(networkType, serviceType);
    const params = BIND_PARAM_MAP[bindCommand];
    
    if (!params) {
      console.warn(`警告: 未知的绑定命令 ${bindCommand}, 跳过`);
      continue;
    }
    
    // 生成 RMV 命令（如果原服务区存在）
    if (oldArea) {
      const rmvCommand = `RMV ${bindCommand}:AREANAME="${oldArea}", ${params.begin}="${startArea}", ${params.end}="${endArea}";`;
      commands.push(rmvCommand);
      removeBindCount++;
    }
    
    // 生成 ADD 绑定命令（如果新服务区存在）
    if (newArea) {
      const addCommand = `ADD ${bindCommand}:AREANAME="${newArea}", ${params.begin}="${startArea}", ${params.end}="${endArea}";`;
      commands.push(addCommand);
      addBindCount++;
    }
  }
  
  return {
    commands,
    summary: {
      addUpareaCount,
      addBindCount,
      removeBindCount
    }
  };
}

function main() {
  try {
    // 从 stdin 读取输入
    const input = readFileSync(0, 'utf-8');
    const data = JSON.parse(input);
    
    const { planningData, existingAreas } = data;
    
    if (!planningData) {
      throw new Error('缺少规划数据 (planningData)');
    }
    
    // 解析规划数据
    const planningRows = parsePlanningData(planningData);
    console.error('解析到的规划数据行数:', planningRows.length);
    
    // 生成命令
    const result = generateCommands(planningRows, existingAreas || []);
    
    // 输出结果
    console.log(JSON.stringify({
      success: true,
      commands: result.commands,
      summary: result.summary,
      planningRows
    }, null, 2));
    
  } catch (error) {
    console.error('错误:', error.message);
    console.log(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}