import WebSocket from 'ws';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

const WS_URL = "ws://localhost:8856/tuling/ast/v3";
const AUDIO_PATH = 'data/张三丰.wav';
const FRAME_SIZE = 4096;
const INTERVAL = 40;
const CONNECTION_TIMEOUT = 10000;

interface TestResult {
  clientId: number;
  success: boolean;
  connectionTime: number;
  firstResponseTime: number;
  totalTime: number;
  error?: string;
  receivedMessages: number;
  finalText?: string;
}

interface PerformanceStats {
  totalClients: number;
  successfulClients: number;
  successRate: number;
  avgConnectionTime: number;
  avgFirstResponseTime: number;
  avgTotalTime: number;
  minFirstResponseTime: number;
  maxFirstResponseTime: number;
  minConnectionTime: number;
  maxConnectionTime: number;
  totalTestTime: number;
  results: TestResult[];
}

function genTraceId(): string {
  return uuidv4();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendAudio(ws: WebSocket, audioPath: string): Promise<void> {
  try {
    const traceId = genTraceId();
    const bizId = 'test_bizid_001';
    const appId = '123456';
    let status = 0;

    if (!fs.existsSync(audioPath)) {
      throw new Error(`音频文件不存在: ${audioPath}`);
    }
    
    const fileBuffer = fs.readFileSync(audioPath);
    
    let offset = 0;
    let isFirstChunk = true;
    let chunkNumber = 0;

    while (offset < fileBuffer.length) {
      chunkNumber++;
      const chunk = fileBuffer.slice(offset, offset + FRAME_SIZE);
      offset += FRAME_SIZE;
      const isLastChunk = offset >= fileBuffer.length;
      if (isLastChunk) {
        status = 2;
      }
      
      const audioB64 = chunk.toString('base64');
      const payload: any = {
        audio: {
          audio: audioB64,
        },
      };

      const msg = {
        header: {
          traceId,
          appId,
          bizId,
          status,
          resIdList: [],
        },
        parameter: {
          engine: {
            wdec_param_LanguageTypeChoice: '1',
          },
        },
        payload,
      };
      
      try {
        ws.send(JSON.stringify(msg));
      } catch (sendError) {
        throw sendError;
      }
      
      if (isLastChunk) {
        break;
      }
      await sleep(INTERVAL);
      status = 1;
      isFirstChunk = false;
    }
  } catch (error) {
    throw error;
  }
}

async function runSingleTest(clientId: number): Promise<TestResult> {
  const result: TestResult = {
    clientId,
    success: false,
    connectionTime: 0,
    firstResponseTime: 0,
    totalTime: 0,
    receivedMessages: 0,
  };

  const startTime = Date.now();
  let connectionStartTime = startTime;
  let firstResponseReceived = false;

  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    
    const connectionTimeout = setTimeout(() => {
      result.error = '连接超时';
      ws.terminate();
      resolve(result);
    }, CONNECTION_TIMEOUT);

    ws.on('open', async () => {
      clearTimeout(connectionTimeout);
      const connectionEndTime = Date.now();
      result.connectionTime = connectionEndTime - connectionStartTime;
      
      try {
        await sendAudio(ws, AUDIO_PATH);
      } catch (error) {
        result.error = `发送音频失败: ${error}`;
        ws.close();
        resolve(result);
      }
    });

    ws.on('message', (data) => {
      if (!firstResponseReceived) {
        const firstResponseTime = Date.now();
        result.firstResponseTime = firstResponseTime - startTime;
        firstResponseReceived = true;
      }
      result.receivedMessages++;

      try {
        const message = data.toString();
        const resp = JSON.parse(message);
        
        if (resp.header && resp.header.status === 2) {
          result.success = true;
          result.totalTime = Date.now() - startTime;
          
          if (resp.payload && resp.payload.result) {
            let finalText = '';
            const resultData = resp.payload.result;
            if (resultData.ws) {
              for (const wsItem of resultData.ws) {
                if (wsItem.cw) {
                  for (const cwItem of wsItem.cw) {
                    if (cwItem.w) {
                      finalText += cwItem.w;
                    }
                  }
                }
              }
            }
            result.finalText = finalText;
          }
          
          ws.close();
          resolve(result);
        }
      } catch (e) {
        // 忽略解析错误，继续接收消息
      }
    });

    ws.on('error', (error) => {
      clearTimeout(connectionTimeout);
      result.error = `连接错误: ${error.message}`;
      resolve(result);
    });

    ws.on('close', () => {
      clearTimeout(connectionTimeout);
      if (!result.success && !result.error) {
        result.error = '连接意外关闭';
      }
      if (result.totalTime === 0) {
        result.totalTime = Date.now() - startTime;
      }
      resolve(result);
    });
  });
}

async function runConcurrentTest(concurrentCount: number): Promise<PerformanceStats> {
  console.log(`开始并发测试，并发数: ${concurrentCount}`);
  console.log('='.repeat(50));

  const startTime = Date.now();
  const promises: Promise<TestResult>[] = [];

  for (let i = 0; i < concurrentCount; i++) {
    promises.push(runSingleTest(i + 1));
  }

  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);

  const connectionTimes = successfulResults.map(r => r.connectionTime);
  const responseTimes = successfulResults.map(r => r.firstResponseTime);
  const totalTimes = successfulResults.map(r => r.totalTime);

  const stats: PerformanceStats = {
    totalClients: concurrentCount,
    successfulClients: successfulResults.length,
    successRate: (successfulResults.length / concurrentCount) * 100,
    avgConnectionTime: connectionTimes.length > 0 ? connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length : 0,
    avgFirstResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
    avgTotalTime: totalTimes.length > 0 ? totalTimes.reduce((a, b) => a + b, 0) / totalTimes.length : 0,
    minFirstResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
    maxFirstResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
    minConnectionTime: connectionTimes.length > 0 ? Math.min(...connectionTimes) : 0,
    maxConnectionTime: connectionTimes.length > 0 ? Math.max(...connectionTimes) : 0,
    totalTestTime: totalTime,
    results
  };

  return stats;
}

function printResults(stats: PerformanceStats): void {
  console.log('\n测试结果统计:');
  console.log('='.repeat(50));
  console.log(`总客户端数: ${stats.totalClients}`);
  console.log(`成功客户端数: ${stats.successfulClients}`);
  console.log(`成功率: ${stats.successRate.toFixed(2)}%`);
  console.log(`总测试时间: ${stats.totalTestTime}ms`);
  console.log(`\n连接时间统计 (ms):`);
  console.log(`平均连接时间: ${stats.avgConnectionTime.toFixed(2)}`);
  console.log(`最小连接时间: ${stats.minConnectionTime}`);
  console.log(`最大连接时间: ${stats.maxConnectionTime}`);
  console.log(`\n首次响应时间统计 (ms):`);
  console.log(`平均首次响应时间: ${stats.avgFirstResponseTime.toFixed(2)}`);
  console.log(`最小首次响应时间: ${stats.minFirstResponseTime}`);
  console.log(`最大首次响应时间: ${stats.maxFirstResponseTime}`);
  console.log(`\n总处理时间统计 (ms):`);
  console.log(`平均总处理时间: ${stats.avgTotalTime.toFixed(2)}`);

  if (stats.successfulClients < stats.totalClients) {
    console.log('\n失败客户端详情:');
    console.log('-'.repeat(30));
    stats.results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`客户端 ${r.clientId}: ${r.error}`);
      });
  }

  console.log('\n详细性能数据:');
  console.log('-'.repeat(30));
  stats.results.forEach(r => {
    const status = r.success ? '✓' : '✗';
    console.log(`客户端 ${r.clientId.toString().padStart(3)}: ${status} ` +
      `连接:${r.connectionTime}ms ` +
      `首响:${r.firstResponseTime}ms ` +
      `总时:${r.totalTime}ms ` +
      `消息:${r.receivedMessages}` +
      (r.error ? ` 错误:${r.error}` : ''));
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = 'test_results';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const outputPath = path.join(outputDir, `concurrent_test_${stats.totalClients}_${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`\n详细结果已保存到: ${outputPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('使用方法: ts-node concurrent_test.ts <并发数量>');
    console.log('示例: ts-node concurrent_test.ts 10');
    console.log('示例: ts-node concurrent_test.ts 200');
    process.exit(1);
  }

  const concurrentCount = parseInt(args[0], 10);
  if (isNaN(concurrentCount) || concurrentCount <= 0) {
    console.error('错误: 并发数量必须是正整数');
    process.exit(1);
  }

  try {
    console.log(`准备进行 ${concurrentCount} 个并发客户端测试...`);
    console.log(`WebSocket 服务器: ${WS_URL}`);
    console.log(`音频文件: ${AUDIO_PATH}`);
    
    const stats = await runConcurrentTest(concurrentCount);
    printResults(stats);
    
  } catch (error) {
    console.error('测试执行失败:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
