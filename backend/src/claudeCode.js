import { spawn } from 'node:child_process';
import { YUSHEN_SYSTEM_PROMPT, FALLBACK_REPLY, estimateTokens } from './persona.js';

const CLI_BIN = process.env.CLAUDE_CODE_BIN || 'claude';
const TIMEOUT_MS = 30000;

function runClaude(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(CLI_BIN, args, { timeout: TIMEOUT_MS });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `claude exited with code ${code}`));
      resolve(stdout);
    });
  });
}

export async function isClaudeCodeAvailable() {
  try {
    await runClaude(['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function getReplyViaClaudeCode(userText, model) {
  const args = [
    '-p', userText,
    '--append-system-prompt', YUSHEN_SYSTEM_PROMPT,
    '--output-format', 'json',
    '--allowedTools', '',
  ];
  if (model) args.push('--model', model);

  const stdout = await runClaude(args);
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('无法解析 claude CLI 输出');
  }
  const text = (parsed.result || '').trim() || FALLBACK_REPLY;
  const tokens = parsed.output_tokens ?? parsed.usage?.output_tokens ?? estimateTokens(text);
  return { text, tokens };
}

export async function testClaudeCode() {
  await getReplyViaClaudeCode('你好，简单回复一下就行', undefined);
}
