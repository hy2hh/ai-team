import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { SearchResult } from '@/lib/types';

const MEMORY_ROOT = process.env.MEMORY_ROOT || '/Users/sid/git/ai-team/.memory';

function searchFiles(query: string, dirPath: string, relativePath: string = ''): SearchResult[] {
  const results: SearchResult[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const lowerQuery = query.toLowerCase();

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.')) {
        results.push(...searchFiles(query, fullPath, relPath));
      }
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.jsonl')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        const matches: { lineNumber: number; line: string }[] = [];

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            matches.push({ lineNumber: i + 1, line: lines[i].trim().slice(0, 200) });
            if (matches.length >= 5) break; // 파일당 최대 5개
          }
        }

        if (matches.length > 0) {
          results.push({ path: relPath, name: entry.name, matches });
        }
      } catch {
        // 읽기 실패 무시
      }
    }
  }

  return results.slice(0, 50); // 전체 최대 50개
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const results = searchFiles(query, MEMORY_ROOT);
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
