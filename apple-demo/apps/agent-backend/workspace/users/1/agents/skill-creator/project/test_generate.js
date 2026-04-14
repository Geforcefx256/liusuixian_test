// 测试 generate.ts 脚本的逻辑
const { execSync } = require('child_process');
const fs = require('fs');

// 准备测试数据
const testData = {
  planningData: `网络类型,服务区类型,起始服务区,终止服务区,原UPF服务区,新UPF服务区
2/3G,LAI,6040204E4,6040204E4,zonetan2_lai,zonetec1_lai
4G,TAI,6040204E4,6040204E4,zonetan2_tai,
5G,N2TAI,6040204E4,6040204E4,,zonetec1_tai`,
  existingAreas: ['zonetan2_lai', 'zonetan2_tai']
};

// 将测试数据写入临时文件
const inputFile = 'test_input.json';
fs.writeFileSync(inputFile, JSON.stringify(testData));

try {
  // 编译 TypeScript 文件
  console.log('编译 TypeScript...');
  execSync('npx tsc --target es2020 --module commonjs --outDir ./temp skills/upf-area-planner/scripts/generate.ts', { stdio: 'inherit' });
  
  // 执行编译后的脚本
  console.log('\n执行脚本...');
  const result = execSync(`node temp/generate.js < ${inputFile}`, { encoding: 'utf8' });
  
  console.log('\n脚本输出:');
  console.log(result);
  
  // 解析输出
  const output = JSON.parse(result);
  if (output.success) {
    console.log('\n✅ 测试成功!');
    console.log('生成的命令数量:', output.commands.length);
    console.log('统计信息:', output.summary);
    
    console.log('\n生成的命令:');
    output.commands.forEach((cmd, i) => {
      console.log(`${i + 1}. ${cmd}`);
    });
    
    console.log('\n解析的规划数据:');
    output.planningRows.forEach((row, i) => {
      console.log(`${i + 1}.`, row);
    });
  } else {
    console.log('❌ 测试失败:', output.error);
  }
} catch (error) {
  console.error('执行错误:', error.message);
  console.error('错误详情:', error.stderr?.toString());
} finally {
  // 清理临时文件
  if (fs.existsSync(inputFile)) {
    fs.unlinkSync(inputFile);
  }
  if (fs.existsSync('temp')) {
    fs.rmSync('temp', { recursive: true });
  }
}