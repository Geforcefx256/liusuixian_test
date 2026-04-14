// 直接测试脚本逻辑
const planningData = `网络类型,服务区类型,起始服务区,终止服务区,原UPF服务区,新UPF服务区
2/3G,LAI,6040204E4,6040204E4,zonetan2_lai,zonetec1_lai
4G,TAI,6040204E4,6040204E4,zonetan2_tai,
5G,N2TAI,6040204E4,6040204E4,,zonetec1_tai`;

const existingAreas = ['zonetan2_lai', 'zonetan2_tai'];

// 解析 CSV
function parseCSV(data) {
  const lines = data.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

// 推断服务区类型
function inferServiceType(networkType, serviceType) {
  if (serviceType && serviceType.trim()) {
    return serviceType.trim();
  }
  
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

// 网络类型到 AREATYPE 映射
const NETWORK_TO_AREATYPE = {
  '2/3G': 'LAI',
  '4G': 'S1TAI',
  '5G': 'N2TAI'
};

// 绑定命令映射
const BIND_COMMAND_MAP = {
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

// 绑定参数映射
const BIND_PARAM_MAP = {
  'UPAREABINDLAI': { begin: 'BEGINLAI', end: 'ENDLAI' },
  'UPAREABINDS1TAI': { begin: 'S1BEGINTAI', end: 'S1ENDTAI' },
  'UPAREABINDN2TAI': { begin: 'N2BEGINTAI', end: 'N2ENDTAI' }
};

// 获取绑定命令
function getBindCommand(networkType, serviceType) {
  const networkMap = BIND_COMMAND_MAP[networkType];
  if (!networkMap) {
    throw new Error(`不支持的网络类型: ${networkType}`);
  }
  
  return networkMap[serviceType] || networkMap.default;
}

// 生成命令
function generateCommands(planningRows, existingAreas) {
  const commands = [];
  const addUpareaSet = new Set();
  
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
    const serviceType = inferServiceType(row.网络类型, row.服务区类型);
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
    
    // 生成 RMV 命令
    if (oldArea) {
      commands.push(`RMV ${bindCommand}:AREANAME="${oldArea}", ${params.begin}="${startArea}", ${params.end}="${endArea}";`);
      removeBindCount++;
    }
    
    // 生成 ADD 命令
    if (newArea) {
      commands.push(`ADD ${bindCommand}:AREANAME="${newArea}", ${params.begin}="${startArea}", ${params.end}="${endArea}";`);
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

// 执行测试
console.log('=== UPF 服务区规划工具测试 ===\n');

// 解析数据
const rawRows = parseCSV(planningData);
console.log('原始数据解析结果:');
rawRows.forEach((row, i) => {
  console.log(`行 ${i + 1}:`, row);
});

// 处理数据
const planningRows = rawRows.map(row => ({
  网络类型: row.网络类型?.trim() || '',
  服务区类型: inferServiceType(row.网络类型?.trim() || '', row.服务区类型?.trim() || ''),
  起始服务区: row.起始服务区?.trim() || '',
  终止服务区: row.终止服务区?.trim() || '',
  原UPF服务区: row.原UPF服务区?.trim() || '',
  新UPF服务区: row.新UPF服务区?.trim() || ''
}));

console.log('\n处理后的数据:');
planningRows.forEach((row, i) => {
  console.log(`行 ${i + 1}:`, row);
});

// 生成命令
console.log('\n现网配置中的 AREANAME:', existingAreas);
const result = generateCommands(planningRows, existingAreas);

console.log('\n=== 生成结果 ===');
console.log(`ADD UPAREA 命令数量: ${result.summary.addUpareaCount}`);
console.log(`ADD 绑定命令数量: ${result.summary.addBindCount}`);
console.log(`RMV 绑定命令数量: ${result.summary.removeBindCount}`);

console.log('\n生成的命令:');
result.commands.forEach((cmd, i) => {
  console.log(`${i + 1}. ${cmd}`);
});

// 验证预期输出
console.log('\n=== 验证预期输出 ===');
const expectedCommands = [
  'ADD UPAREA:AREANAME="zonetec1_lai",AREATYPE=LAI;',
  'ADD UPAREA:AREANAME="zonetec1_tai",AREATYPE=N2TAI;',
  'RMV UPAREABINDLAI:AREANAME="zonetan2_lai", BEGINLAI="6040204E4", ENDLAI="6040204E4";',
  'ADD UPAREABINDLAI:AREANAME="zonetec1_lai", BEGINLAI="6040204E4", ENDLAI="6040204E4";',
  'RMV UPAREABINDS1TAI:AREANAME="zonetan2_tai", S1BEGINTAI="6040204E4", S1ENDTAI="6040204E4";',
  'ADD UPAREABINDN2TAI:AREANAME="zonetec1_tai", N2BEGINTAI="6040204E4", N2ENDTAI="6040204E4";'
];

console.log('预期命令数量:', expectedCommands.length);
console.log('实际命令数量:', result.commands.length);

let allMatch = true;
expectedCommands.forEach((expected, i) => {
  const actual = result.commands[i];
  const match = actual === expected;
  console.log(`${i + 1}. 预期: ${expected}`);
  console.log(`   实际: ${actual}`);
  console.log(`   ${match ? '✅ 匹配' : '❌ 不匹配'}`);
  if (!match) allMatch = false;
});

if (allMatch) {
  console.log('\n🎉 所有测试通过!');
} else {
  console.log('\n⚠️ 部分测试未通过，需要检查逻辑。');
}