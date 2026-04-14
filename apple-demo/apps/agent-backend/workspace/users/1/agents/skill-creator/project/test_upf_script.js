// 测试 UPF 脚本逻辑
const planningData = `网络类型,服务区类型,起始服务区,终止服务区,原UPF服务区,新UPF服务区
2/3G,LAI,6040204E4,6040204E4,zonetan2_lai,zonetec1_lai
4G,TAI,6040204E4,6040204E4,zonetan2_tai,
5G,N2TAI,6040204E4,6040204E4,,zonetec1_tai`;

const existingAreas = ['zonetan2_lai', 'zonetan2_tai'];

// 模拟脚本逻辑
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

const rows = parseCSV(planningData);
console.log('解析后的数据:');
rows.forEach((row, i) => {
  console.log(`行 ${i + 1}:`, {
    网络类型: row.网络类型,
    服务区类型: inferServiceType(row.网络类型, row.服务区类型),
    起始服务区: row.起始服务区,
    终止服务区: row.终止服务区,
    原UPF服务区: row.原UPF服务区,
    新UPF服务区: row.新UPF服务区
  });
});

// 模拟生成命令
const commands = [];
const processedAreas = new Set();

// ADD UPAREA 命令
rows.forEach(row => {
  const newArea = row.新UPF服务区;
  if (!newArea) return;
  
  const networkType = row.网络类型;
  let areaType = '';
  
  switch (networkType) {
    case '2/3G':
      areaType = 'LAI';
      break;
    case '4G':
      areaType = 'S1TAI';
      break;
    case '5G':
      areaType = 'N2TAI';
      break;
  }
  
  if (areaType) {
    const areaKey = `${newArea}:${areaType}`;
    const exists = existingAreas.includes(newArea);
    
    if (!exists && !processedAreas.has(areaKey)) {
      commands.push(`ADD UPAREA:AREANAME="${newArea}",AREATYPE=${areaType};`);
      processedAreas.add(areaKey);
    }
  }
});

// 绑定命令
rows.forEach(row => {
  const networkType = row.网络类型;
  const serviceType = inferServiceType(row.网络类型, row.服务区类型);
  const startArea = row.起始服务区;
  const endArea = row.终止服务区;
  const oldArea = row.原UPF服务区;
  const newArea = row.新UPF服务区;
  
  if (!startArea || !endArea) return;
  
  let bindCommand = '';
  let beginParam = '';
  let endParam = '';
  
  if (networkType === '2/3G' && serviceType === 'LAI') {
    bindCommand = 'UPAREABINDLAI';
    beginParam = 'BEGINLAI';
    endParam = 'ENDLAI';
  } else if (networkType === '4G' && serviceType === 'TAI') {
    bindCommand = 'UPAREABINDS1TAI';
    beginParam = 'S1BEGINTAI';
    endParam = 'S1ENDTAI';
  } else if (networkType === '5G' && (serviceType === 'TAI' || serviceType === 'N2TAI')) {
    bindCommand = 'UPAREABINDN2TAI';
    beginParam = 'N2BEGINTAI';
    endParam = 'N2ENDTAI';
  }
  
  if (bindCommand) {
    // RMV 命令
    if (oldArea) {
      commands.push(`RMV ${bindCommand}:AREANAME="${oldArea}", ${beginParam}="${startArea}", ${endParam}="${endArea}";`);
    }
    
    // ADD 命令
    if (newArea) {
      commands.push(`ADD ${bindCommand}:AREANAME="${newArea}", ${beginParam}="${startArea}", ${endParam}="${endArea}";`);
    }
  }
});

console.log('\n生成的命令:');
commands.forEach(cmd => console.log(cmd));