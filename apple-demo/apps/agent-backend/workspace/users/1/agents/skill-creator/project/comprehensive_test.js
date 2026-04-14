// 综合测试脚本逻辑
console.log('=== UPF 服务区规划工具综合测试 ===\n');

// 测试用例1：基本功能测试
console.log('测试用例1: 基本功能测试');
const test1 = {
  planningData: `网络类型,服务区类型,起始服务区,终止服务区,原UPF服务区,新UPF服务区
2/3G,LAI,6040204E4,6040204E4,zonetan2_lai,zonetec1_lai
4G,TAI,6040204E4,6040204E4,zonetan2_tai,
5G,N2TAI,6040204E4,6040204E4,,zonetec1_tai`,
  existingAreas: ['zonetan2_lai', 'zonetan2_tai']
};

runTest(test1, '基本功能测试');

// 测试用例2：服务区类型推断测试
console.log('\n\n测试用例2: 服务区类型推断测试');
const test2 = {
  planningData: `网络类型,服务区类型,起始服务区,终止服务区,原UPF服务区,新UPF服务区
2/3G,,6040204E4,6040204E4,old_lai,new_lai
4G,,6040204E4,6040204E4,old_tai,new_tai
5G,,6040204E4,6040204E4,,new_n2tai`,
  existingAreas: ['old_lai', 'old_tai']
};

runTest(test2, '服务区类型推断测试');

// 测试用例3：重复服务区测试
console.log('\n\n测试用例3: 重复服务区测试');
const test3 = {
  planningData: `网络类型,服务区类型,起始服务区,终止服务区,原UPF服务区,新UPF服务区
2/3G,LAI,6040204E4,6040204E4,old1,new_area
2/3G,LAI,6040205E4,6040205E4,old2,new_area
4G,TAI,6040204E4,6040204E4,old3,new_area`,
  existingAreas: ['old1', 'old2', 'old3']
};

runTest(test3, '重复服务区测试');

// 测试用例4：空值处理测试
console.log('\n\n测试用例4: 空值处理测试');
const test4 = {
  planningData: `网络类型,服务区类型,起始服务区,终止服务区,原UPF服务区,新UPF服务区
2/3G,LAI,6040204E4,6040204E4,old_only,
4G,TAI,6040204E4,6040204E4,,new_only
5G,N2TAI,6040204E4,6040204E4,,
2/3G,LAI,,6040204E4,old_no_start,new_no_start`,
  existingAreas: ['old_only']
};

runTest(test4, '空值处理测试');

function runTest(testData, testName) {
  console.log(`\n--- ${testName} ---`);
  console.log('规划数据:');
  console.log(testData.planningData);
  console.log('\n现网配置:', testData.existingAreas);
  
  // 模拟脚本逻辑
  const result = simulateGenerate(testData.planningData, testData.existingAreas);
  
  console.log('\n生成结果:');
  console.log(`命令数量: ${result.commands.length}`);
  console.log('统计信息:', result.summary);
  
  if (result.commands.length > 0) {
    console.log('\n生成的命令:');
    result.commands.forEach((cmd, i) => {
      console.log(`${i + 1}. ${cmd}`);
    });
  }
  
  console.log('\n解析的数据行:');
  result.planningRows.forEach((row, i) => {
    console.log(`${i + 1}.`, row);
  });
}

function simulateGenerate(planningData, existingAreas) {
  // 简化的模拟逻辑
  const lines = planningData.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const planningRows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    planningRows.push(row);
  }
  
  // 处理数据
  const processedRows = planningRows.map(row => {
    const networkType = row.网络类型?.trim() || '';
    let serviceType = row.服务区类型?.trim() || '';
    
    // 推断服务区类型
    if (!serviceType) {
      switch (networkType) {
        case '2/3G':
          serviceType = 'LAI';
          break;
        case '4G':
          serviceType = 'TAI';
          break;
        case '5G':
          serviceType = 'N2TAI';
          break;
      }
    }
    
    return {
      网络类型: networkType,
      服务区类型: serviceType,
      起始服务区: row.起始服务区?.trim() || '',
      终止服务区: row.终止服务区?.trim() || '',
      原UPF服务区: row.原UPF服务区?.trim() || '',
      新UPF服务区: row.新UPF服务区?.trim() || ''
    };
  });
  
  // 生成命令
  const commands = [];
  const addUpareaSet = new Set();
  
  let addUpareaCount = 0;
  let addBindCount = 0;
  let removeBindCount = 0;
  
  // 网络类型到 AREATYPE 映射
  const NETWORK_TO_AREATYPE = {
    '2/3G': 'LAI',
    '4G': 'S1TAI',
    '5G': 'N2TAI'
  };
  
  // 绑定命令映射
  const BIND_COMMAND_MAP = {
    '2/3G': { 'LAI': 'UPAREABINDLAI', 'default': 'UPAREABINDLAI' },
    '4G': { 'TAI': 'UPAREABINDS1TAI', 'default': 'UPAREABINDS1TAI' },
    '5G': { 'TAI': 'UPAREABINDN2TAI', 'N2TAI': 'UPAREABINDN2TAI', 'default': 'UPAREABINDN2TAI' }
  };
  
  // 绑定参数映射
  const BIND_PARAM_MAP = {
    'UPAREABINDLAI': { begin: 'BEGINLAI', end: 'ENDLAI' },
    'UPAREABINDS1TAI': { begin: 'S1BEGINTAI', end: 'S1ENDTAI' },
    'UPAREABINDN2TAI': { begin: 'N2BEGINTAI', end: 'N2ENDTAI' }
  };
  
  // ADD UPAREA 命令
  for (const row of processedRows) {
    const newArea = row.新UPF服务区;
    if (!newArea) continue;
    
    const networkType = row.网络类型;
    const areaType = NETWORK_TO_AREATYPE[networkType];
    
    if (!areaType) continue;
    
    const areaKey = `${newArea}:${areaType}`;
    const exists = existingAreas.includes(newArea);
    
    if (!exists && !addUpareaSet.has(areaKey)) {
      commands.push(`ADD UPAREA:AREANAME="${newArea}",AREATYPE=${areaType};`);
      addUpareaSet.add(areaKey);
      addUpareaCount++;
    }
  }
  
  // 绑定命令
  for (const row of processedRows) {
    const networkType = row.网络类型;
    const serviceType = row.服务区类型;
    const startArea = row.起始服务区;
    const endArea = row.终止服务区;
    const oldArea = row.原UPF服务区;
    const newArea = row.新UPF服务区;
    
    if (!startArea || !endArea) continue;
    
    const networkMap = BIND_COMMAND_MAP[networkType];
    if (!networkMap) continue;
    
    const bindCommand = networkMap[serviceType] || networkMap.default;
    const params = BIND_PARAM_MAP[bindCommand];
    if (!params) continue;
    
    // RMV 命令
    if (oldArea) {
      commands.push(`RMV ${bindCommand}:AREANAME="${oldArea}", ${params.begin}="${startArea}", ${params.end}="${endArea}";`);
      removeBindCount++;
    }
    
    // ADD 命令
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
    },
    planningRows: processedRows
  };
}