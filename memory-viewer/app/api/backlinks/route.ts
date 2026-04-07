import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { Backlink } from '@/lib/types';

const MEMORY_ROOT = process.env.MEMORY_ROOT || '/Users/sid/git/ai-team/.memory';

function findBacklinks(targetPath: string, dirPath: string, relativePath: string = ''): Backlink[] {
  const results: Backlink[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.')) {
        results.push(...findBacklinks(targetPath, fullPath, relPath));
      }
    } else if (entry.name.endsWith('.md') && relPath !== targetPath) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const targetName = path.basename(targetPath, '.md');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // 파일명 또는 경로 참조 검색
          if (line.includes(targetPath) || line.includes(targetName)) {
            results.push({
              sourcePath: relPath,
              sourceName: entry.name.replace('.md', ''),
              lineNumber: i + 1,
              context: line.trim().slice(0, 200),
            });
          }
        }
      } catch {
        // 읽기 실패 무시
      }
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  const targetPath = request.nextUrl.searchParams.get('path');
  if (!targetPath) {
    return NextResponse.json({ error: 'path parameter required' }, { status: 400 });
  }

  try {
    const backlinks = findBacklinks(targetPath, MEMORY_ROOT);
    return NextResponse.json(backlinks);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
